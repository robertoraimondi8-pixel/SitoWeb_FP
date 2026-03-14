"""Payment routes: Stripe checkout for custom-matches leagues and national league membership."""
import os
import logging
import stripe
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict

from database import leagues_col, memberships_col, payments_col
from models import new_id, now_utc
from auth import get_current_user
from services import (
    generate_invite_code, log_audit, normalize_scoring_config, DEFAULT_SCORING_CONFIG
)

logger = logging.getLogger(__name__)

payment_router = APIRouter(prefix="/api/payments", tags=["Payments"])

CUSTOM_LEAGUE_PRICE = 8999  # cents (€89.99)


class CustomLeagueCheckoutRequest(BaseModel):
    origin_url: str
    name: str
    season_id: str
    start_matchday: int
    end_matchday: int
    bet_deadline_minutes: int = 5
    scoring_config: Optional[Dict] = None
    include_championship_predictions: bool = False


class NationalLeagueCheckoutRequest(BaseModel):
    league_id: str
    origin_url: str


def _init_stripe():
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(500, "Stripe not configured")
    stripe.api_key = api_key


@payment_router.post("/custom-league-checkout")
async def create_custom_league_checkout(
    req: CustomLeagueCheckoutRequest,
    request: Request,
    user=Depends(get_current_user),
):
    """Create Stripe checkout session for a custom-matches league (€89.99)."""
    _init_stripe()

    if req.end_matchday < req.start_matchday:
        raise HTTPException(400, "La giornata finale deve essere >= giornata iniziale")

    from services import get_league_matchday_range
    first_selectable, last_matchday = await get_league_matchday_range(req.season_id)
    if req.start_matchday < first_selectable:
        raise HTTPException(400, f"La giornata iniziale deve essere >= {first_selectable}")
    if req.end_matchday > last_matchday:
        raise HTTPException(400, f"La giornata finale deve essere <= {last_matchday}")

    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/league/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/league/create"

    payment_id = new_id()

    metadata = {
        "payment_id": payment_id,
        "user_id": user["id"],
        "type": "custom_league_creation",
        "league_name": req.name,
        "season_id": req.season_id,
        "start_matchday": str(req.start_matchday),
        "end_matchday": str(req.end_matchday),
        "bet_deadline_minutes": str(req.bet_deadline_minutes),
        "include_championship_predictions": str(req.include_championship_predictions),
    }

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {"name": f"Lega Premium: {req.name}", "description": "Lega con partite personalizzate"},
                "unit_amount": CUSTOM_LEAGUE_PRICE,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    scoring = normalize_scoring_config(req.scoring_config) if req.scoring_config else DEFAULT_SCORING_CONFIG

    await payments_col.insert_one({
        "id": payment_id,
        "user_id": user["id"],
        "session_id": session.id,
        "amount": 89.99,
        "currency": "eur",
        "payment_status": "pending",
        "type": "custom_league_creation",
        "league_data": {
            "name": req.name,
            "season_id": req.season_id,
            "start_matchday": req.start_matchday,
            "end_matchday": req.end_matchday,
            "bet_deadline_minutes": req.bet_deadline_minutes,
            "scoring_config": scoring,
            "include_championship_predictions": req.include_championship_predictions,
        },
        "metadata": metadata,
        "created_at": now_utc(),
    })

    return {"url": session.url, "session_id": session.id}


@payment_router.get("/status/{session_id}")
async def get_payment_status(session_id: str, user=Depends(get_current_user)):
    """Poll payment status. On success for custom league, creates the league."""
    payment = await payments_col.find_one({"session_id": session_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Payment not found")

    _init_stripe()
    session = stripe.checkout.Session.retrieve(session_id)

    payment_status = session.payment_status or "unpaid"
    session_status = session.status or "open"

    result = {
        "payment_status": payment_status,
        "status": session_status,
        "amount": payment["amount"],
        "currency": payment["currency"],
        "type": payment.get("type", "unknown"),
    }

    if payment_status == "paid" and payment["payment_status"] != "paid":
        await payments_col.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": session_status}},
        )

        if payment.get("type") == "custom_league_creation":
            league = await _create_league_from_payment(payment)
            result["league"] = league

        elif payment.get("type") == "national_league_membership":
            league_id = payment.get("league_id")
            existing = await memberships_col.find_one(
                {"user_id": payment["user_id"], "league_id": league_id}
            )
            if not existing:
                await memberships_col.insert_one({
                    "id": new_id(),
                    "user_id": payment["user_id"],
                    "league_id": league_id,
                    "status": "active",
                    "joined_at": now_utc(),
                    "payment_id": payment["id"],
                })

    elif session_status == "expired":
        await payments_col.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "expired", "status": "expired"}},
        )

    if payment_status == "paid" and payment.get("type") == "custom_league_creation":
        existing_league = await leagues_col.find_one(
            {"payment_id": payment["id"]}, {"_id": 0}
        )
        if existing_league:
            existing_league.pop("_id", None)
            result["league"] = {
                "id": existing_league["id"],
                "name": existing_league["name"],
                "invite_code": existing_league.get("invite_code"),
                "start_matchday": existing_league.get("start_matchday"),
                "end_matchday": existing_league.get("end_matchday"),
                "match_source_type": existing_league.get("match_source_type"),
                "bet_deadline_minutes": existing_league.get("bet_deadline_minutes"),
            }

    return result


async def _create_league_from_payment(payment: dict) -> dict:
    """Create a league after successful custom-matches payment."""
    existing = await leagues_col.find_one({"payment_id": payment["id"]})
    if existing:
        existing.pop("_id", None)
        return {"id": existing["id"], "name": existing["name"], "invite_code": existing.get("invite_code")}

    ld = payment["league_data"]
    league_id = new_id()
    invite_code = generate_invite_code()

    league = {
        "id": league_id,
        "name": ld["name"],
        "league_type": "private",
        "season_id": ld["season_id"],
        "invite_code": invite_code,
        "owner_id": payment["user_id"],
        "created_by": payment["user_id"],
        "start_matchday": ld["start_matchday"],
        "end_matchday": ld["end_matchday"],
        "bet_deadline_minutes": ld["bet_deadline_minutes"],
        "match_source_type": "custom",
        "custom_matches_enabled": True,
        "custom_matches_paid": True,
        "scoring_config": ld["scoring_config"],
        "include_championship_predictions": ld["include_championship_predictions"],
        "status": "active",
        "rules_locked": False,
        "payment_id": payment["id"],
        "created_at": now_utc(),
    }
    await leagues_col.insert_one(league)

    await memberships_col.insert_one({
        "id": new_id(),
        "user_id": payment["user_id"],
        "league_id": league_id,
        "role": "owner",
        "status": "active",
        "joined_at": now_utc(),
    })

    await log_audit(payment["user_id"], "", "CREATE", "league", league_id, {"name": ld["name"], "paid": True})

    league.pop("_id", None)
    return {
        "id": league_id,
        "name": ld["name"],
        "invite_code": invite_code,
        "start_matchday": ld["start_matchday"],
        "end_matchday": ld["end_matchday"],
        "match_source_type": "custom",
        "bet_deadline_minutes": ld["bet_deadline_minutes"],
    }


@payment_router.post("/national-league-checkout")
async def create_national_league_checkout(
    req: NationalLeagueCheckoutRequest,
    request: Request,
    user=Depends(get_current_user),
):
    """Create Stripe checkout for joining a national league with entry fee."""
    league = await leagues_col.find_one({"id": req.league_id}, {"_id": 0})
    if not league or league.get("league_type") != "national":
        raise HTTPException(400, "Invalid national league")

    entry_fee = league.get("entry_fee", 0)
    if entry_fee <= 0:
        raise HTTPException(400, "This league is free to join")

    existing_mem = await memberships_col.find_one(
        {"user_id": user["id"], "league_id": req.league_id, "status": "active"}
    )
    if existing_mem:
        raise HTTPException(400, "Already a member of this league")

    _init_stripe()
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/league/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/league/join"

    payment_id = new_id()
    metadata = {
        "payment_id": payment_id,
        "user_id": user["id"],
        "league_id": req.league_id,
        "type": "national_league_membership",
    }

    amount_cents = int(float(entry_fee) * 100)

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {"name": f"Iscrizione Lega Nazionale: {league['name']}"},
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    await payments_col.insert_one({
        "id": payment_id,
        "user_id": user["id"],
        "league_id": req.league_id,
        "session_id": session.id,
        "amount": float(entry_fee),
        "currency": "eur",
        "payment_status": "pending",
        "type": "national_league_membership",
        "metadata": metadata,
        "created_at": now_utc(),
    })

    return {"url": session.url, "session_id": session.id}


@payment_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    _init_stripe()
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    try:
        if endpoint_secret:
            event = stripe.Webhook.construct_event(body, sig, endpoint_secret)
        else:
            import json
            event = stripe.Event.construct_from(json.loads(body), stripe.api_key)

        logger.info(f"Stripe webhook event: {event.type}")

        if event.type == "checkout.session.completed":
            session_data = event.data.object
            if session_data.payment_status == "paid":
                payment = await payments_col.find_one({"session_id": session_data.id})
                if payment and payment["payment_status"] != "paid":
                    await payments_col.update_one(
                        {"session_id": session_data.id},
                        {"$set": {"payment_status": "paid", "status": "complete"}},
                    )
                    if payment.get("type") == "custom_league_creation":
                        await _create_league_from_payment(payment)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        return {"status": "error", "message": str(e)}
