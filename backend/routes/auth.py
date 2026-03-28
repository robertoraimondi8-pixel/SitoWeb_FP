"""Auth routes: register, login, refresh, verify-email, Google OAuth."""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
import logging

from database import users_col, memberships_col, predictions_col, payments_col, leagues_col, trophies_col
from models import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
    new_id, now_utc
)
from auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_refresh_token, get_current_user
)

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["Auth"])


@auth_router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    from datetime import date
    try:
        dob = datetime.strptime(req.date_of_birth, "%Y-%m-%d").date()
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age < 18:
            raise HTTPException(400, "Devi avere almeno 18 anni per registrarti")
    except ValueError:
        raise HTTPException(400, "Formato data di nascita non valido (YYYY-MM-DD)")

    if not req.accepted_privacy:
        raise HTTPException(400, "È necessario accettare la Privacy Policy")
    if not req.accepted_terms:
        raise HTTPException(400, "È necessario accettare i Termini e Condizioni")

    existing = await users_col.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, "Email già registrata")

    import random as _random, string as _string, re as _re
    if req.username:
        if not _re.match(r'^[a-zA-Z0-9_]{3,20}$', req.username):
            raise HTTPException(400, "Username non valido (3-20 caratteri: lettere, numeri, underscore)")
        if await users_col.find_one({"username": req.username}):
            raise HTTPException(400, "Username già in uso")
        username = req.username
    else:
        base_username = f"{req.first_name.lower()}.{req.last_name.lower()}"
        base_username = ''.join(c for c in base_username if c.isalnum() or c == '.')
        suffix = ''.join(_random.choices(_string.digits, k=3))
        username = f"{base_username}{suffix}"

    import secrets as _secrets_reg
    vtoken = _secrets_reg.token_urlsafe(32)
    token_expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    user_id = new_id()
    user = {
        "id": user_id,
        "email": req.email,
        "username": username,
        "first_name": req.first_name,
        "last_name": req.last_name,
        "date_of_birth": req.date_of_birth,
        "address": req.address,
        "city": req.city,
        "country": req.country,
        "postal_code": req.postal_code,
        "password": hash_password(req.password),
        "role": "user",
        "language": req.language,
        "accepted_privacy": req.accepted_privacy,
        "accepted_terms": req.accepted_terms,
        "consents_accepted_at": now_utc(),
        "profile_completed": True,
        "email_verified": False,
        "email_verification_token": vtoken,
        "token_expiry": token_expiry,
        "created_at": now_utc(),
    }
    await users_col.insert_one(user)

    logger.info(f"[EMAIL-VERIFY] token={vtoken} for {req.email[:3]}*** — link: myapp://verify-email?token={vtoken}")

    # Send verification email
    from email_service import send_verification_email
    await send_verification_email(req.email, vtoken, username)

    access = create_access_token(user_id, "user")
    refresh = create_refresh_token(user_id)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={
            "id": user_id,
            "email": req.email,
            "username": username,
            "first_name": req.first_name,
            "last_name": req.last_name,
            "role": "user",
            "language": req.language,
            "profile_completed": True,
            "email_verified": False,
            "accepted_privacy": True,
            "accepted_terms": True,
        }
    )


@auth_router.get("/username-available")
async def username_available(username: str):
    if not username or len(username) < 3 or len(username) > 20:
        return {"available": False, "reason": "Username deve essere tra 3 e 20 caratteri"}
    import re
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return {"available": False, "reason": "Solo lettere, numeri e underscore"}
    existing = await users_col.find_one({"username": username})
    return {"available": existing is None}


@auth_router.post("/verify-email")
async def verify_email_endpoint(body: dict):
    token = body.get("token")
    if not token:
        raise HTTPException(400, "Token mancante")
    user = await users_col.find_one({"email_verification_token": token}, {"_id": 0})
    if not user:
        raise HTTPException(400, "Token non valido o già utilizzato")
    expiry = user.get("token_expiry")
    if expiry:
        from datetime import timezone as _tz
        expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00")) if isinstance(expiry, str) else expiry
        if datetime.now(_tz.utc) > expiry_dt.replace(tzinfo=_tz.utc) if expiry_dt.tzinfo is None else datetime.now(_tz.utc) > expiry_dt:
            raise HTTPException(400, "Token scaduto. Richiedi un nuovo link di verifica.")
    await users_col.update_one(
        {"id": user["id"]},
        {"$set": {"email_verified": True, "email_verification_token": None, "token_expiry": None}}
    )
    logger.info(f"[EmailVerify] Email verified for user {user['email'][:3]}***")
    return {"message": "Email verificata con successo. Puoi accedere."}


@auth_router.post("/resend-verification")
async def resend_verification(body: dict):
    email = body.get("email")
    if not email:
        raise HTTPException(400, "Email richiesta")
    user = await users_col.find_one({"email": email}, {"_id": 0})
    if not user:
        return {"message": "Se l'email è registrata, riceverai un nuovo link."}
    if user.get("email_verified"):
        return {"message": "Email già verificata."}
    import secrets as _sec
    vtoken = _sec.token_urlsafe(32)
    expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    await users_col.update_one(
        {"id": user["id"]},
        {"$set": {"email_verification_token": vtoken, "token_expiry": expiry}}
    )
    logger.info(f"[EMAIL-VERIFY-RESEND] token={vtoken} for {email[:3]}*** — link: myapp://verify-email?token={vtoken}")

    # Send verification email
    from email_service import send_verification_email
    await send_verification_email(email, vtoken, user.get("username", ""))

    return {"message": "Nuovo link inviato. Controlla la tua email."}


@auth_router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await users_col.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(401, "Email o password non validi")

    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
    await users_col.update_one({"id": user["id"]}, {"$set": {"last_login": now_utc()}})
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "role": user["role"],
            "language": user.get("language", "it"),
            "profile_completed": user.get("profile_completed", True),
            "email_verified": user.get("email_verified", True),
            "accepted_privacy": user.get("accepted_privacy", False),
            "accepted_terms": user.get("accepted_terms", False),
        }
    )


@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest):
    payload = decode_refresh_token(req.refresh_token)
    user = await users_col.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")

    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={"id": user["id"], "email": user["email"], "username": user["username"], "role": user["role"], "language": user.get("language", "it")}
    )


@auth_router.get("/me")
async def get_me(user=Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "_id"}


@auth_router.post("/google/session")
async def google_auth_session(request: Request):
    """Process Google OAuth session_id from Emergent Auth (LEGACY — kept for backward compat)."""
    import aiohttp

    logger.info("HIT /api/auth/google (legacy Emergent flow)")

    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            ) as resp:
                if resp.status != 200:
                    raise HTTPException(401, "Invalid Google session")
                google_data = await resp.json()
    except aiohttp.ClientError as e:
        raise HTTPException(500, "Authentication service unavailable")

    email = google_data.get("email")
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")

    if not email:
        raise HTTPException(400, "No email from Google")

    return await _upsert_google_user(email, name, picture)


@auth_router.post("/google/verify-token")
async def google_verify_token(request: Request):
    """Verify Google id_token directly (NEW — no Emergent dependency)."""
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    body = await request.json()
    token = body.get("id_token")
    if not token:
        raise HTTPException(400, "id_token required")

    logger.info("[GoogleOAuth-Direct] Verifying id_token...")

    GOOGLE_CLIENT_IDS = [
        "345472883983-g8pdjn2heauuq7jfmdal1n8snj6qbl09.apps.googleusercontent.com",  # web
        "345472883983-9ugfodmtmr4vbuotcvap5tphq20q747r.apps.googleusercontent.com",  # android
        "345472883983-gphr333q3n4m1albaq3km2r5ojt77r9t.apps.googleusercontent.com",  # ios
    ]

    try:
        idinfo = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), audience=None
        )
        # Verify the token was issued for one of our client IDs
        if idinfo.get("aud") not in GOOGLE_CLIENT_IDS:
            logger.warning(f"[GoogleOAuth-Direct] Token audience mismatch: {idinfo.get('aud')}")
            raise HTTPException(401, "Invalid token audience")
        if not idinfo.get("email_verified", False):
            raise HTTPException(401, "Email not verified by Google")
    except ValueError as e:
        logger.error(f"[GoogleOAuth-Direct] Token verification failed: {e}")
        raise HTTPException(401, f"Invalid Google token: {e}")

    email = idinfo["email"]
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    logger.info(f"[GoogleOAuth-Direct] Verified: {email[:3]}***")

    return await _upsert_google_user(email, name, picture)


async def _upsert_google_user(email: str, name: str, picture: str):
    """Shared logic: find or create Google user, return tokens."""
    existing = await users_col.find_one({"email": email}, {"_id": 0})
    if existing:
        if picture and existing.get("picture") != picture:
            await users_col.update_one({"id": existing["id"]}, {"$set": {"picture": picture}})
        user_id = existing["id"]
        role = existing.get("role", "user")
        username = existing.get("username", name)
        language = existing.get("language", "it")
    else:
        user_id = new_id()
        base_username = name.replace(" ", "_")[:20] if name else email.split("@")[0]
        username = base_username
        suffix = 1
        while await users_col.find_one({"username": username}):
            username = f"{base_username}_{suffix}"
            suffix += 1

        user = {
            "id": user_id,
            "email": email,
            "username": username,
            "password": "",
            "role": "user",
            "language": "it",
            "picture": picture,
            "auth_provider": "google",
            "profile_completed": False,
            "email_verified": True,
            "created_at": now_utc(),
        }
        await users_col.insert_one(user)
        role = "user"
        language = "it"
        logger.info(f"[GoogleOAuth] New user created: {username}")

    access = create_access_token(user_id, role)
    refresh = create_refresh_token(user_id)

    google_user = await users_col.find_one({"id": user_id}, {"_id": 0})
    profile_completed = bool(google_user.get("profile_completed", False))

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={
            "id": user_id,
            "email": email,
            "username": username,
            "role": role,
            "language": language,
            "profile_completed": profile_completed,
            "email_verified": True,
            "accepted_privacy": google_user.get("accepted_privacy", False),
            "accepted_terms": google_user.get("accepted_terms", False),
        }
    )


# ========================================
# DELETE ACCOUNT
# ========================================
@auth_router.delete("/delete-account")
async def delete_account(user=Depends(get_current_user)):
    """Permanently delete the authenticated user's account and all associated data."""
    user_id = user["id"]

    # Delete user's memberships
    await memberships_col.delete_many({"user_id": user_id})

    # Delete user's predictions
    await predictions_col.delete_many({"user_id": user_id})

    # Delete user's trophies
    await trophies_col.delete_many({"user_id": user_id})

    # Delete user's payments
    await payments_col.delete_many({"user_id": user_id})

    # Delete leagues owned by user
    owned_leagues = await leagues_col.find({"owner_id": user_id}, {"_id": 0, "id": 1}).to_list(None)
    for league in owned_leagues:
        await memberships_col.delete_many({"league_id": league["id"]})
        await leagues_col.delete_one({"id": league["id"]})

    # Delete the user
    await users_col.delete_one({"id": user_id})

    return {"status": "ok", "message": "Account eliminato con successo"}
