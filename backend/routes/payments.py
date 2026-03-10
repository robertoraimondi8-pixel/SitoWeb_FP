"""Payment routes: Stripe checkout and status."""
import os
from fastapi import APIRouter, HTTPException, Depends, Request
import logging

from database import leagues_col, memberships_col, payments_col
from models import CheckoutRequest, CheckoutResponse, new_id, now_utc
from auth import get_current_user
from services import NATIONAL_LEAGUE_PRICE

logger = logging.getLogger(__name__)

payment_router = APIRouter(prefix="/api/payments", tags=["Payments"])


@payment_router.post("/checkout")
async def create_checkout(req: CheckoutRequest, request: Request, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": req.league_id}, {"_id": 0})
    if not league or league["league_type"] != "national":
        raise HTTPException(400, "Invalid national league")

    existing_mem = await memberships_col.find_one({"user_id": user["id"], "league_id": req.league_id, "status": "active"})
    if existing_mem:
        raise HTTPException(400, "Already a member of this league")

    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_api_key:
        raise HTTPException(500, "Stripe not configured")

    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)

    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/league/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/league/join"

    metadata = {"user_id": user["id"], "league_id": req.league_id, "type": "national_league_membership"}
    checkout_req = CheckoutSessionRequest(amount=NATIONAL_LEAGUE_PRICE, currency="eur", success_url=success_url, cancel_url=cancel_url, metadata=metadata)
    session = await stripe_checkout.create_checkout_session(checkout_req)

    await payments_col.insert_one({
        "id": new_id(), "user_id": user["id"], "league_id": req.league_id,
        "session_id": session.session_id, "amount": NATIONAL_LEAGUE_PRICE,
        "currency": "eur", "payment_status": "pending", "metadata": metadata, "created_at": now_utc(),
    })
    return CheckoutResponse(url=session.url, session_id=session.session_id)


@payment_router.get("/status/{session_id}")
async def get_payment_status(session_id: str, request: Request, user=Depends(get_current_user)):
    payment = await payments_col.find_one({"session_id": session_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Payment not found")

    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)

    status = await stripe_checkout.get_checkout_status(session_id)

    if status.payment_status == "paid" and payment["payment_status"] != "paid":
        await payments_col.update_one({"session_id": session_id}, {"$set": {"payment_status": "paid", "status": status.status}})
        existing = await memberships_col.find_one({"user_id": payment["user_id"], "league_id": payment["league_id"]})
        if not existing:
            await memberships_col.insert_one({"id": new_id(), "user_id": payment["user_id"], "league_id": payment["league_id"], "status": "active", "joined_at": now_utc(), "payment_id": payment["id"]})
    elif status.status == "expired":
        await payments_col.update_one({"session_id": session_id}, {"$set": {"payment_status": "expired", "status": "expired"}})

    return {"payment_status": status.payment_status, "status": status.status, "amount": payment["amount"], "currency": payment["currency"]}
