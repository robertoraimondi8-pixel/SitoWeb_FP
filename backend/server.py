"""FantaPronostic Backend - Main FastAPI Application."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel as PydanticBaseModel
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from typing import Optional, List
import os
import logging
import random
import string
import asyncio
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import (
    db, create_indexes, users_col, seasons_col, leagues_col,
    memberships_col, payments_col, matchdays_col, matches_col,
    predictions_col, joker_usages_col, champion_picks_col,
    score_summaries_col, standings_cache_col, audit_logs_col,
    notifications_col
)
from models import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
    UserResponse, SeasonCreate, SeasonResponse, LeagueCreate,
    LeagueUpdateRequest, LeagueJoinRequest, LeagueResponse, MatchdayCreate, MatchdayResponse,
    MatchCreate, MatchUpdate, MatchResponse, PredictionInput,
    PredictionsBatchRequest, PredictionResponse, JokerSetRequest,
    JokerResponse, ScoreSummaryResponse, StandingEntry, StandingsResponse,
    LiveMatchData, LiveMatchdayResponse, LiveUpdateRequest,
    ConfirmMatchdayRequest, HomeResponse, CheckoutRequest, CheckoutResponse,
    AuditLogResponse, AdminSeasonUpdate, AdminMatchdayUpdate, ProfileUpdate,
    CompleteProfileRequest, ForgotPasswordRequest,
    new_id, now_utc
)
from auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_refresh_token, get_current_user,
    require_admin, get_optional_user
)
from scoring import calculate_match_points, calculate_matchday_total

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="FantaPronostic API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== ROUTERS =====
auth_router = APIRouter(prefix="/api/auth", tags=["Auth"])
user_router = APIRouter(prefix="/api", tags=["User"])
league_router = APIRouter(prefix="/api/leagues", tags=["Leagues"])
prediction_router = APIRouter(prefix="/api/predictions", tags=["Predictions"])
standings_router = APIRouter(prefix="/api/standings", tags=["Standings"])
live_router = APIRouter(prefix="/api/live", tags=["Live"])
payment_router = APIRouter(prefix="/api/payments", tags=["Payments"])
admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])
fixtures_router = APIRouter(prefix="/api/admin/real-fixtures", tags=["Real Fixtures"])


# ===== UTILITY =====
def generate_invite_code(length=8):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


async def log_audit(admin_id: str, admin_username: str, action: str, entity_type: str, entity_id: str, details: dict = None):
    entry = {
        "id": new_id(),
        "admin_id": admin_id,
        "admin_username": admin_username,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "created_at": now_utc(),
    }
    await audit_logs_col.insert_one(entry)


def server_now() -> datetime:
    """Server time - all lock checks use this."""
    return datetime.now(timezone.utc)


def _match_source_query(matchday_id: str, source_league_id: str) -> dict:
    """
    Build match query with strict league isolation.
    After DB migration all records have explicit league_id — no fallbacks needed.
    source_league_id: national league id OR private/manual league id.
    """
    return {"matchday_id": matchday_id, "league_id": source_league_id}


# B) FUNZIONE CENTRALIZZATA CALCOLO PUNTI GIORNATA
async def compute_matchday_points(user_id: str, matchday_id: str) -> dict:
    """
    Calcola i punti di un utente per una giornata.
    Ritorna: {base_points, joker_bonus, total_points, joker_active}
    Usa prima score_summaries se esistono E sono validi, altrimenti calcola al volo.
    """
    # Get matchday to check status
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    matchday_completed = matchday and matchday.get("status") == "COMPLETED"
    
    # Controlla se abbiamo già score_summaries
    score_summary = await score_summaries_col.find_one(
        {"user_id": user_id, "matchday_id": matchday_id},
        {"_id": 0}
    )
    
    # Use score_summary only if:
    # 1. It exists and has total_points set
    # 2. AND either: matchday is not completed OR total_points > 0 (valid summary)
    # This avoids using stale summaries with 0 points for completed matchdays
    use_stored_summary = (
        score_summary and 
        score_summary.get("total_points") is not None and
        (not matchday_completed or score_summary.get("total_points", 0) > 0 or score_summary.get("valid_matches", 0) > 0)
    )
    
    if use_stored_summary:
        return {
            "base_points": score_summary.get("base_points", 0),
            "joker_bonus": score_summary.get("joker_bonus", 0),
            "total_points": score_summary.get("total_points", 0),
            "joker_active": score_summary.get("joker_active", False),
        }
    
    # Calcola al volo
    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds = await predictions_col.find({"user_id": user_id, "matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}
    
    # Get joker status
    joker = await joker_usages_col.find_one({"user_id": user_id, "matchday_id": matchday_id}, {"_id": 0})
    joker_active = joker is not None and joker.get("is_active", False)
    
    base_points = 0.0
    for m in matches:
        # Determine effective match status
        # If matchday is COMPLETED, treat all matches as finished for scoring
        effective_status = m["status"]
        if matchday_completed and effective_status in ("scheduled", "live"):
            effective_status = "finished"
        
        if effective_status in ("void", "postponed", "cancelled"):
            continue
        
        pred = preds_dict.get(m["id"])
        if not pred:
            continue
        
        # Usa stored is_correct se disponibile
        if pred.get("is_correct") is True:
            base_points += pred.get("points", 0)
        elif pred.get("is_correct") is None and m.get("home_score") is not None:
            # Calcola al volo - pass "finished" to calculate_match_points when matchday completed
            pts, is_correct = calculate_match_points(
                pred["prediction_value"],
                pred.get("market_type", "1X2"),
                m.get("home_score"),
                m.get("away_score"),
                effective_status  # This is now "finished" for COMPLETED matchdays
            )
            if is_correct:
                base_points += pts
    
    joker_bonus = base_points if joker_active else 0
    total_points = base_points + joker_bonus
    
    return {
        "base_points": base_points,
        "joker_bonus": joker_bonus,
        "total_points": total_points,
        "joker_active": joker_active,
    }


async def recalculate_match_predictions(match_id: str, league_id: str):
    """
    Ricalcola i punti per tutti i pronostici di una specifica partita.
    Chiamato quando una partita viene marcata 'finished' con risultato.
    """
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match or match.get("home_score") is None:
        return
    
    matchday_id = match.get("matchday_id")
    preds = await predictions_col.find({"match_id": match_id}).to_list(1000)
    
    for pred in preds:
        pts, is_correct = calculate_match_points(
            pred.get("prediction_value"),
            pred.get("market_type", match.get("market_type", "1X2")),
            match.get("home_score"),
            match.get("away_score"),
            "finished"
        )
        await predictions_col.update_one(
            {"id": pred["id"]},
            {"$set": {"points": pts, "is_correct": is_correct}}
        )
    
    logger.info(f"[SCORING] Recalculated {len(preds)} predictions for match {match_id}")


async def recalculate_matchday_scores(matchday_id: str, league_id: str):
    """
    Ricalcola TUTTI i punteggi per una giornata quando viene marcata COMPLETED.
    - Per ogni partita finished: calcola punti per ogni pronostico
    - Aggiorna score_summaries per ogni utente
    - Aggiorna standings per la lega
    """
    logger.info(f"[SCORING] Starting full recalculation for matchday {matchday_id} league {league_id}")
    
    # 1. Get all matches for this matchday (filter by league_id)
    matches = await matches_col.find({"matchday_id": matchday_id, "league_id": league_id}, {"_id": 0}).to_list(100)
    matches_dict = {m["id"]: m for m in matches}
    
    # 2. Get all predictions for this matchday
    match_ids = [m["id"] for m in matches]
    if not match_ids:
        logger.info(f"[SCORING] No matches found for matchday {matchday_id}")
        return
    
    preds = await predictions_col.find({"match_id": {"$in": match_ids}}).to_list(10000)
    
    # 3. Calculate points for each prediction
    user_points = {}  # user_id -> {base_points, matches_correct, matches_total}
    
    for pred in preds:
        match = matches_dict.get(pred.get("match_id"))
        if not match or match.get("home_score") is None:
            continue
        
        pts, is_correct = calculate_match_points(
            pred.get("prediction_value"),
            pred.get("market_type", match.get("market_type", "1X2")),
            match.get("home_score"),
            match.get("away_score"),
            "finished"
        )
        
        # Update prediction
        await predictions_col.update_one(
            {"id": pred["id"]},
            {"$set": {"points": pts, "is_correct": is_correct}}
        )
        
        user_id = pred.get("user_id")
        if user_id not in user_points:
            user_points[user_id] = {"base_points": 0, "matches_correct": 0, "matches_total": 0}
        
        user_points[user_id]["matches_total"] += 1
        if is_correct:
            user_points[user_id]["base_points"] += pts
            user_points[user_id]["matches_correct"] += 1
    
    # 4. Update score_summaries for each user
    for user_id, points_data in user_points.items():
        # Check joker
        joker = await joker_usages_col.find_one({"user_id": user_id, "matchday_id": matchday_id}, {"_id": 0})
        joker_active = joker is not None and joker.get("is_active", False)
        
        base_points = points_data["base_points"]
        joker_bonus = base_points if joker_active else 0
        total_points = base_points + joker_bonus
        
        # Upsert score_summary con id univoco
        existing_summary = await score_summaries_col.find_one(
            {"user_id": user_id, "matchday_id": matchday_id, "league_id": league_id}
        )
        
        if existing_summary:
            await score_summaries_col.update_one(
                {"id": existing_summary["id"]},
                {"$set": {
                    "base_points": base_points,
                    "joker_bonus": joker_bonus,
                    "total_points": total_points,
                    "joker_active": joker_active,
                    "valid_matches": points_data["matches_total"],
                    "correct_matches": points_data["matches_correct"],
                    "updated_at": now_utc(),
                }}
            )
        else:
            await score_summaries_col.insert_one({
                "id": new_id(),
                "user_id": user_id,
                "matchday_id": matchday_id,
                "league_id": league_id,
                "base_points": base_points,
                "joker_bonus": joker_bonus,
                "total_points": total_points,
                "joker_active": joker_active,
                "valid_matches": points_data["matches_total"],
                "correct_matches": points_data["matches_correct"],
                "updated_at": now_utc(),
            })
    
    # 5. RICALCOLO STANDINGS TOTALI per la lega
    # Per ogni utente che ha partecipato, ricalcola il totale punti di TUTTE le sue giornate in questa lega
    for user_id in user_points.keys():
        await recalculate_user_total_standings(user_id, league_id)
    
    logger.info(f"[SCORING] Recalculated scores for {len(user_points)} users in matchday {matchday_id}, standings updated")


async def recalculate_user_total_standings(user_id: str, league_id: str):
    """
    Ricalcola il totale punti di un utente per una specifica lega.
    Somma tutti i score_summaries per quella lega.
    """
    # Get all score_summaries for this user in this league
    summaries = await score_summaries_col.find(
        {"user_id": user_id, "league_id": league_id},
        {"_id": 0}
    ).to_list(100)
    
    total_points = sum(s.get("total_points", 0) for s in summaries)
    total_correct = sum(s.get("correct_matches", 0) for s in summaries)
    total_matches = sum(s.get("valid_matches", 0) for s in summaries)
    matchdays_played = len(summaries)
    
    # Upsert standings cache con id univoco
    existing = await standings_cache_col.find_one(
        {"user_id": user_id, "league_id": league_id, "type": "total"}
    )
    
    if existing:
        await standings_cache_col.update_one(
            {"id": existing["id"]},
            {"$set": {
                "total_points": total_points,
                "correct_matches": total_correct,
                "valid_matches": total_matches,
                "matchdays_played": matchdays_played,
                "updated_at": now_utc(),
            }}
        )
    else:
        await standings_cache_col.insert_one({
            "id": new_id(),
            "user_id": user_id,
            "league_id": league_id,
            "type": "total",
            "total_points": total_points,
            "correct_matches": total_correct,
            "valid_matches": total_matches,
            "matchdays_played": matchdays_played,
            "updated_at": now_utc(),
        })
    
    logger.info(f"[STANDINGS] Updated total for user {user_id} in league {league_id}: {total_points} pts")


# ========================================
# AUTH ROUTES
# ========================================
@auth_router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    # Validate age >= 18
    from datetime import date
    try:
        dob = datetime.strptime(req.date_of_birth, "%Y-%m-%d").date()
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age < 18:
            raise HTTPException(400, "Devi avere almeno 18 anni per registrarti")
    except ValueError:
        raise HTTPException(400, "Formato data di nascita non valido (YYYY-MM-DD)")

    # Validate consents
    if not req.accepted_privacy:
        raise HTTPException(400, "È necessario accettare la Privacy Policy")
    if not req.accepted_terms:
        raise HTTPException(400, "È necessario accettare i Termini e Condizioni")

    # Check email uniqueness
    existing = await users_col.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, "Email già registrata")

    # Use user-provided username if present, otherwise auto-generate
    import random as _random, string as _string, re as _re
    if req.username:
        # Validate format
        if not _re.match(r'^[a-zA-Z0-9_]{3,20}$', req.username):
            raise HTTPException(400, "Username non valido (3-20 caratteri: lettere, numeri, underscore)")
        # Check uniqueness
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

    # MOCK: log token (in production, send email)
    logger.info(f"[EMAIL-VERIFY] token={vtoken} for {req.email[:3]}*** — link: myapp://verify-email?token={vtoken}")

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
    """Check if username is available. Returns {available: bool}."""
    if not username or len(username) < 3 or len(username) > 20:
        return {"available": False, "reason": "Username deve essere tra 3 e 20 caratteri"}
    import re
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return {"available": False, "reason": "Solo lettere, numeri e underscore"}
    existing = await users_col.find_one({"username": username})
    return {"available": existing is None}


@auth_router.post("/verify-email")
async def verify_email_endpoint(body: dict):
    """Verify email with token from link."""
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
    """Resend email verification link."""
    email = body.get("email")
    if not email:
        raise HTTPException(400, "Email richiesta")
    user = await users_col.find_one({"email": email}, {"_id": 0})
    if not user:
        # Generic response for security
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
    # MOCK: log token (in production, send email)
    logger.info(f"[EMAIL-VERIFY-RESEND] token={vtoken} for {email[:3]}*** — link: myapp://verify-email?token={vtoken}")
    return {"message": "Nuovo link inviato. Controlla la tua email."}




@auth_router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await users_col.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(401, "Email o password non validi")

    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
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
            "email_verified": user.get("email_verified", True),  # legacy users are considered verified
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
    """Process Google OAuth session_id from Emergent Auth.
    Verifies session with Emergent, creates/updates user, returns JWT tokens."""
    import aiohttp
    
    logger.info("HIT /api/auth/google")
    logger.info("[GoogleOAuth] === GOOGLE SESSION VERIFICATION STARTED ===")
    
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        logger.warning("[GoogleOAuth] ERROR: No session_id provided")
        raise HTTPException(400, "session_id required")
    
    logger.info(f"[GoogleOAuth] Received session_id (length={len(session_id)})")

    # Call Emergent Auth to verify session and get user data
    logger.info("[GoogleOAuth] Calling Emergent Auth API to verify session...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            ) as resp:
                logger.info(f"[GoogleOAuth] Emergent Auth response status: {resp.status}")
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"[GoogleOAuth] Emergent Auth error: {error_text[:200]}")
                    raise HTTPException(401, "Invalid Google session")
                google_data = await resp.json()
                logger.info(f"[GoogleOAuth] Received Google data, email present: {'email' in google_data}")
    except aiohttp.ClientError as e:
        logger.error(f"[GoogleOAuth] Network error calling Emergent Auth: {str(e)}")
        raise HTTPException(500, "Authentication service unavailable")

    email = google_data.get("email")
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")

    if not email:
        logger.error("[GoogleOAuth] ERROR: No email in Google data")
        raise HTTPException(400, "No email from Google")
    
    logger.info(f"[GoogleOAuth] Google email verified: {email[:3]}***")

    # Check if user already exists
    existing = await users_col.find_one({"email": email}, {"_id": 0})
    if existing:
        logger.info(f"[GoogleOAuth] Existing user found: {existing['username']}")
        # Update profile picture if changed
        if picture and existing.get("picture") != picture:
            await users_col.update_one({"id": existing["id"]}, {"$set": {"picture": picture}})
        user_id = existing["id"]
        role = existing.get("role", "user")
        username = existing.get("username", name)
        language = existing.get("language", "it")
    else:
        logger.info("[GoogleOAuth] Creating new user from Google data...")
        # Create new user from Google data
        user_id = new_id()
        # Generate unique username from name
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
            "password": "",  # No password for Google users
            "role": "user",
            "language": "it",
            "picture": picture,
            "auth_provider": "google",
            "created_at": now_utc(),
        }
        await users_col.insert_one(user)
        role = "user"
        language = "it"
        logger.info(f"[GoogleOAuth] New user created: {username}")

    access = create_access_token(user_id, role)
    refresh = create_refresh_token(user_id)
    
    # Check if profile needs completion (Google users miss many fields)
    google_user = await users_col.find_one({"id": user_id}, {"_id": 0})
    profile_completed = bool(google_user.get("profile_completed", False))
    
    logger.info(f"[GoogleOAuth] SUCCESS: Tokens generated for user {username}")
    logger.info("[GoogleOAuth] === GOOGLE SESSION VERIFICATION COMPLETED ===")
    
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
            "email_verified": True,  # Google email is always verified
            "accepted_privacy": google_user.get("accepted_privacy", False),
            "accepted_terms": google_user.get("accepted_terms", False),
        }
    )


# ========================================
# USER ROUTES (Home, Profile)
# ========================================
# Costante: ogni giornata ha sempre 11 partite
MATCHES_PER_MATCHDAY = 11
# National league ID — after DB migration, all national records carry this explicit league_id
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"

@user_router.get("/home")
async def get_home(league_id: str = None, user=Depends(get_current_user)):
    # Get active season
    season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
    if not season:
        return HomeResponse()

    # Get user leagues with membership info
    user_memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
    membership_map = {m["league_id"]: m for m in user_memberships}
    league_ids = list(membership_map.keys())
    user_leagues = []
    if league_ids:
        leagues = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0}).to_list(100)
        user_leagues = leagues

    # Determine active league: use query param → user's current_league_id → first league
    active_league = None
    if league_id and league_id in league_ids:
        active_league = next((l for l in user_leagues if l["id"] == league_id), None)
    if not active_league:
        saved_id = user.get("current_league_id")
        if saved_id and saved_id in league_ids:
            active_league = next((l for l in user_leagues if l["id"] == saved_id), None)
    if not active_league and user_leagues:
        active_league = user_leagues[0]

    # MATCHDAY LOGIC: Dipende dal tipo di lega
    matchday = None
    
    # "manual" e "custom" sono entrambi tipi di lega gestita manualmente
    is_manual_league = active_league and active_league.get("match_source_type") in ("manual", "custom")
    
    if is_manual_league:
        # MANUAL LEAGUE: cerca matchday SOLO della lega manuale
        # Priorità: LIVE > OPEN > LOCKED > ultima giornata
        matchday = await matchdays_col.find_one(
            {"league_id": active_league["id"], "status": "LIVE"},
            {"_id": 0}
        )
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"league_id": active_league["id"], "status": "OPEN"},
                {"_id": 0}
            )
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"league_id": active_league["id"], "status": "LOCKED"},
                {"_id": 0},
                sort=[("number", -1)]
            )
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"league_id": active_league["id"]},
                {"_id": 0},
                sort=[("number", -1)]
            )
    else:
        # NATIONAL LEAGUE: usa logica standard dalla stagione
        # Priorità: LIVE > OPEN > LOCKED > current_matchday_id > ultima giornata
        matchday = await matchdays_col.find_one(
            {"season_id": season["id"], "status": "LIVE", "league_id": NATIONAL_LEAGUE_ID},
            {"_id": 0}
        )
        
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"season_id": season["id"], "status": "OPEN", "league_id": NATIONAL_LEAGUE_ID},
                {"_id": 0}
            )
        
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"season_id": season["id"], "status": "LOCKED", "league_id": NATIONAL_LEAGUE_ID},
                {"_id": 0},
                sort=[("number", -1)]
            )
        
        if not matchday and season.get("current_matchday_id"):
            matchday = await matchdays_col.find_one(
                {"id": season["current_matchday_id"], "league_id": NATIONAL_LEAGUE_ID},
                {"_id": 0}
            )
        
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"season_id": season["id"], "league_id": NATIONAL_LEAGUE_ID},
                {"_id": 0},
                sort=[("number", -1)]
            )

    matchday_data = None
    live_data = None

    if matchday:
        now = server_now()
        # Handle None or invalid first_kickoff
        first_kickoff_str = matchday.get("first_kickoff")
        try:
            if first_kickoff_str and len(first_kickoff_str) > 10:
                first_kickoff = datetime.fromisoformat(first_kickoff_str.replace("Z", "+00:00"))
            else:
                # Default to 1 hour from now if no kickoff time or invalid
                first_kickoff = now + timedelta(hours=1)
        except (ValueError, TypeError):
            first_kickoff = now + timedelta(hours=1)
        
        lock_time = first_kickoff - timedelta(seconds=60)
        countdown_seconds = max(0, int((lock_time - now).total_seconds()))

        # C) Count only relevant matches using source isolation (dopo migrazione: NATIONAL_LEAGUE_ID esplicito)
        _md_source_lid = active_league["id"] if is_manual_league else NATIONAL_LEAGUE_ID
        match_count = await matches_col.count_documents(_match_source_query(matchday["id"], _md_source_lid))
        total_matches = max(match_count, MATCHES_PER_MATCHDAY)  # Mai mostrare 0/0
        
        my_predictions = await predictions_col.count_documents({"user_id": user["id"], "matchday_id": matchday["id"]})

        # Per matchday COMPLETED: carica punti da score_summaries (fonte autorevole)
        my_points = None
        if matchday["status"] == "COMPLETED":
            ss = await score_summaries_col.find_one(
                {"user_id": user["id"], "matchday_id": matchday["id"]},
                {"_id": 0, "total_points": 1}
            )
            my_points = ss.get("total_points") if ss else 0.0

        matchday_data = {
            "id": matchday["id"],
            "number": matchday["number"],
            "label": matchday.get("label") or f"Giornata {matchday['number']}",
            "status": matchday["status"],
            "first_kickoff": matchday["first_kickoff"],
            "countdown_seconds": countdown_seconds,
            "total_matches": total_matches,
            "matches_loaded": match_count,
            "my_predictions_count": my_predictions,
            "my_points": my_points,  # Punti ufficiali (solo se COMPLETED, fonte: score_summaries)
        }

        # Live data if matchday is LIVE
        if matchday["status"] == "LIVE":
            live_matches = await matches_col.find(_match_source_query(matchday["id"], _md_source_lid), {"_id": 0}).to_list(20)
            preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday["id"]}, {"_id": 0}).to_list(20)
            preds_dict = {p["match_id"]: p for p in preds}
            joker = await joker_usages_col.find_one({"user_id": user["id"], "matchday_id": matchday["id"]}, {"_id": 0})
            joker_active = joker is not None and joker.get("is_active", False)

            # Calculate base points for all matches
            base_pts_sum = 0.0
            live_list = []
            for m in live_matches:
                pred = preds_dict.get(m["id"])
                pts = 0.0
                if pred and m.get("home_score") is not None:
                    pts, _ = calculate_match_points(pred["prediction_value"], pred.get("market_type", m.get("market_type", "1X2")), m.get("home_score"), m.get("away_score"), m["status"])
                    if m["status"] not in ("void", "postponed", "cancelled"):
                        base_pts_sum += pts
                live_list.append({
                    "match_id": m["id"],
                    "home_team": m["home_team"],
                    "away_team": m["away_team"],
                    "home_score": m.get("home_score"),
                    "away_score": m.get("away_score"),
                    "status": m["status"],
                    "my_prediction": pred["prediction_value"] if pred else None,
                    "points": pts,
                })

            # Jolly x2 on total matchday points
            total_prov = base_pts_sum * 2 if joker_active else base_pts_sum

            live_data = {
                "matchday_id": matchday["id"],
                "matches": live_list,
                "total_provisional": total_prov,
                "joker_active": joker_active,
            }

    # Rankings preview + User Summary + Last 5 Performance
    rankings_preview = None
    user_summary = None
    last_5_performance = []
    
    if user_leagues:
        first_league = active_league or user_leagues[0]
        
        # Get ALL members of the league for ranking calculation
        league_members = await memberships_col.find(
            {"league_id": first_league["id"], "status": "active"}
        ).to_list(1000)
        league_member_ids = [m["user_id"] for m in league_members]
        
        # Get only COMPLETED matchday IDs for THIS LEAGUE
        # IMPORTANTE: filtrare per league_id se lega manuale
        is_manual_league = first_league.get("match_source_type") in ("manual", "custom")
        
        if is_manual_league:
            # Lega manuale: matchdays con league_id = questa lega
            completed_matchdays_docs = await matchdays_col.find(
                {"league_id": first_league["id"], "status": "COMPLETED"},
                {"_id": 0, "id": 1, "number": 1}
            ).sort("number", -1).to_list(100)
            logger.info(f"[HOME] last5 league_id={first_league['id']}, source=manual, matchdays_completed={len(completed_matchdays_docs)}")
        else:
            # Lega nazionale privata: usa predictions con league_id = questa lega (isolamento diretto)
            played_md_ids_for_home = await predictions_col.distinct(
                "matchday_id",
                {
                    "user_id": {"$in": league_member_ids},
                    "league_id": first_league["id"]
                }
            )
            if played_md_ids_for_home:
                completed_matchdays_docs = await matchdays_col.find(
                    {"id": {"$in": played_md_ids_for_home}, "status": "COMPLETED"},
                    {"_id": 0, "id": 1, "number": 1}
                ).sort("number", -1).to_list(100)
            else:
                completed_matchdays_docs = []
            logger.info(f"[HOME] last5 league_id={first_league['id']}, source=national, matchdays_completed={len(completed_matchdays_docs)}")
        
        completed_md_ids = [m["id"] for m in completed_matchdays_docs]
        # GIORNATE = number of COMPLETED matchdays in season (same dataset as last_5_performance)
        total_completed_in_season = len(completed_md_ids)

        # Aggregate total points for all members (only COMPLETED matchdays)
        # Per leghe manuali: filtra per league_id (score_summaries hanno league_id)
        # Per leghe nazionali/nazionali private: NO filtro league_id (admin_confirm non salva league_id)
        if is_manual_league:
            totals_match = {"user_id": {"$in": league_member_ids}, "matchday_id": {"$in": completed_md_ids}, "league_id": first_league["id"]}
        else:
            totals_match = {"user_id": {"$in": league_member_ids}, "matchday_id": {"$in": completed_md_ids}}

        all_totals = await score_summaries_col.aggregate([
            {"$match": totals_match},
            {"$group": {"_id": "$user_id", "total": {"$sum": "$total_points"}}},
            {"$sort": {"total": -1}},
        ]).to_list(1000)
        
        # Build rankings preview (top 5)
        entries = []
        user_rank = None
        user_total_points = 0.0
        # GIORNATE = per leghe manuali: giornate completate della lega
        #            per leghe nazionali private: giornate dove l'utente ha predictions con league_id = questa lega
        if is_manual_league:
            user_matchdays_played = total_completed_in_season
        else:
            # Conta DISTINCT matchday_id dalle predictions di questo utente per questa lega
            user_played_md_ids = await predictions_col.distinct(
                "matchday_id",
                {
                    "user_id": user["id"],
                    "league_id": first_league["id"]
                }
            )
            # Filtra solo ai matchday nazionali della stagione (evita cross-lega)
            user_played_md_ids = [mid for mid in user_played_md_ids if mid in completed_md_ids or mid in {m["id"] for m in completed_matchdays_docs}]
            user_matchdays_played = len(user_played_md_ids)
        
        for i, t in enumerate(all_totals):
            # Check if this is the current user
            if t["_id"] == user["id"]:
                user_rank = i + 1
                user_total_points = t["total"]
            
            # Add to top 5 preview
            if i < 5:
                u = await users_col.find_one({"id": t["_id"]}, {"_id": 0, "password": 0})
                entries.append({
                    "rank": i + 1,
                    "user_id": t["_id"],
                    "username": u["username"] if u else "Unknown",
                    "total_points": t["total"],
                })
        
        rankings_preview = {"league_name": first_league["name"], "top": entries}
        
        # User Summary
        user_summary = {
            "rank": user_rank,
            "points": user_total_points,
            "matchdays_played": user_matchdays_played,
            "total_points": user_total_points,
        }
        
        # Last 5 Performance - usa completed_matchdays_docs già filtrati
        last_5_matchdays = list(completed_matchdays_docs[:5])
        last_5_matchdays.reverse()  # ASC order (oldest first) per display

        for md in last_5_matchdays:
            # Per leghe manuali filtra per league_id; per nazionali NO league_id (score_summaries salvati senza)
            if is_manual_league:
                score_filter = {"user_id": user["id"], "matchday_id": md["id"], "league_id": first_league["id"]}
            else:
                # Lega nazionale/privata nazionale: score_summaries non hanno league_id della lega privata
                score_filter = {"user_id": user["id"], "matchday_id": md["id"]}
            score = await score_summaries_col.find_one(score_filter, {"_id": 0, "total_points": 1})
            pts = score.get("total_points", 0.0) if score else 0.0
            last_5_performance.append({
                "matchday_number": md["number"],
                "points": pts,
            })
        logger.info(f"[HOME] last5 league={first_league['id']}, md_ids={[m['id'] for m in last_5_matchdays]}, pts={[r['points'] for r in last_5_performance]}")

    # Build league response with owner_id and my_role for frontend to check ownership
    league_response = None
    if active_league:
        league_response = {k: v for k, v in active_league.items() if k != "_id"}
        # Ensure owner_id is included for frontend ownership checks
        if "owner_id" not in league_response and "created_by" in active_league:
            league_response["owner_id"] = active_league["created_by"]
        
        # Check if user is owner (by owner_id or created_by)
        is_owner = active_league.get("owner_id") == user["id"] or active_league.get("created_by") == user["id"]
        
        # Get user's membership and role
        my_membership = membership_map.get(active_league["id"])
        my_role = my_membership.get("role", "player") if my_membership else None
        
        # AUTO-REPAIR: Se user è owner ma membership role non è owner/admin, correggi
        if is_owner and my_membership and my_role not in ("owner", "admin"):
            logger.info(f"[AUTO-REPAIR] Fixing membership role for owner {user['id']} in league {active_league['id']}")
            await memberships_col.update_one(
                {"id": my_membership["id"]},
                {"$set": {"role": "owner"}}
            )
            my_role = "owner"
            my_membership["role"] = "owner"
        
        # Se owner ma nessuna membership, creala
        if is_owner and not my_membership:
            logger.info(f"[AUTO-REPAIR] Creating missing membership for owner {user['id']} in league {active_league['id']}")
            new_mem = {
                "id": new_id(),
                "user_id": user["id"],
                "league_id": active_league["id"],
                "role": "owner",
                "status": "active",
                "joined_at": now_utc(),
            }
            await memberships_col.insert_one(new_mem)
            my_membership = new_mem
            my_role = "owner"
        
        league_response["my_role"] = my_role
        league_response["is_owner"] = is_owner

        # === DIAGNOSTIC LOG 2: /api/home ===
        logger.info("=" * 60)
        logger.info("[DIAG-2] /api/home RESPONSE")
        logger.info(f"  user.id = {user['id']}")
        logger.info(f"  user.email = {user.get('email')}")
        logger.info(f"  league.id = {active_league.get('id')}")
        logger.info(f"  league.name = {active_league.get('name')}")
        logger.info(f"  league.match_source_type = {active_league.get('match_source_type')}")
        logger.info(f"  league.owner_id = {active_league.get('owner_id')}")
        logger.info(f"  league.created_by = {active_league.get('created_by')}")
        logger.info(f"  my_membership = {my_membership}")
        logger.info(f"  my_role = {my_role}")
        logger.info(f"  CALCULATED is_owner = {is_owner}")
        logger.info("=" * 60)

    return {
        "matchday": matchday_data,
        "live": live_data,
        "rankings_preview": rankings_preview,
        "user_summary": user_summary,
        "last_5_performance": last_5_performance,
        "stats_preview": {"message": "Stats coming soon"},
        "user_leagues": [{k: v for k, v in l.items() if k != "_id"} for l in user_leagues],
        "league": league_response,
    }


@user_router.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
    return {
        "user": {k: v for k, v in user.items() if k not in ("_id", "password")},
        "leagues_count": len(memberships),
    }


@user_router.put("/profile")
async def update_profile(req: ProfileUpdate, user=Depends(get_current_user)):
    updates = {}
    if req.username:
        existing = await users_col.find_one({"username": req.username, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(400, "Username already taken")
        updates["username"] = req.username
    if req.language:
        updates["language"] = req.language
    if updates:
        await users_col.update_one({"id": user["id"]}, {"$set": updates})
    updated = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated


@user_router.patch("/profile/current-league")
async def set_current_league(league_id: str = None, user=Depends(get_current_user)):
    """Persiste la lega corrente selezionata dall'utente."""
    from fastapi import Body
    if league_id:
        mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
        if not mem:
            raise HTTPException(403, "Non sei membro di questa lega")
        await users_col.update_one({"id": user["id"]}, {"$set": {"current_league_id": league_id}})
    return {"current_league_id": league_id}


@user_router.post("/users/me/complete-profile")
async def complete_profile(req: CompleteProfileRequest, user=Depends(get_current_user)):
    """Complete missing profile fields (mandatory after Google OAuth or partial registration)."""
    from datetime import date as _date
    updates: dict = {}

    if req.first_name is not None:
        updates["first_name"] = req.first_name
    if req.last_name is not None:
        updates["last_name"] = req.last_name
    if req.date_of_birth is not None:
        try:
            dob = datetime.strptime(req.date_of_birth, "%Y-%m-%d").date()
            today = _date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 18:
                raise HTTPException(400, "Devi avere almeno 18 anni")
        except ValueError:
            raise HTTPException(400, "Formato data di nascita non valido (YYYY-MM-DD)")
        updates["date_of_birth"] = req.date_of_birth
    if req.address is not None:
        updates["address"] = req.address
    if req.city is not None:
        updates["city"] = req.city
    if req.country is not None:
        updates["country"] = req.country
    if req.postal_code is not None:
        updates["postal_code"] = req.postal_code
    if req.accepted_privacy is True:
        updates["accepted_privacy"] = True
        updates["consents_accepted_at"] = now_utc()
    if req.accepted_terms is True:
        updates["accepted_terms"] = True

    # Check if profile is now complete
    current = {**user, **updates}
    required_fields = ["first_name", "last_name", "date_of_birth", "address", "city", "country", "postal_code"]
    is_complete = all(current.get(f) for f in required_fields) and current.get("accepted_privacy") and current.get("accepted_terms")
    updates["profile_completed"] = is_complete

    if updates:
        await users_col.update_one({"id": user["id"]}, {"$set": updates})

    updated = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {
        "user": updated,
        "profile_completed": is_complete,
    }



# ========================================
# LEAGUE ROUTES
# ========================================
DEFAULT_SCORING_CONFIG = {
    "1x2": {"enabled": True, "points": 1.0},
    "over_under": {"enabled": True, "points": 0.5},
    "goal_no_goal": {"enabled": True, "points": 0.5},
    "exact_score": {"enabled": True, "points": 4.0},
}

@league_router.get("/seasons")
async def get_league_seasons(user=Depends(get_current_user)):
    """Restituisce le stagioni attive per la creazione lega."""
    seasons = await seasons_col.find({"is_active": True}, {"_id": 0}).to_list(10)
    return seasons


@league_router.get("")
async def get_my_leagues(user=Depends(get_current_user)):
    memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
    league_ids = [m["league_id"] for m in memberships]
    if not league_ids:
        return []
    leagues = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0}).to_list(100)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@league_router.post("")
async def create_league(req: LeagueCreate, user=Depends(get_current_user)):
    # Validate matchday range
    if req.end_matchday < req.start_matchday:
        raise HTTPException(400, "La giornata finale deve essere >= giornata iniziale")

    league_id = new_id()
    invite_code = generate_invite_code()

    scoring = req.scoring_config or DEFAULT_SCORING_CONFIG

    league = {
        "id": league_id,
        "name": req.name,
        "league_type": "private",
        "season_id": req.season_id,
        "invite_code": invite_code,
        "owner_id": user["id"],
        "created_by": user["id"],
        "logo_url": req.logo_url,
        "start_matchday": req.start_matchday,
        "end_matchday": req.end_matchday,
        "bet_deadline_minutes": req.bet_deadline_minutes,
        "match_source_type": req.match_source_type,
        "scoring_config": scoring,
        "include_championship_predictions": req.include_championship_predictions,
        "rules_locked": False,
        "created_at": now_utc(),
    }

    # Auto-set source_league_id when inheriting from national league
    if req.match_source_type == "national":
        national = await leagues_col.find_one({"league_type": "national"}, {"_id": 0, "id": 1})
        if national:
            league["source_league_id"] = national["id"]

    await leagues_col.insert_one(league)

    # Auto-join owner with role="owner" (upsert per idempotenza)
    existing_membership = await memberships_col.find_one({
        "user_id": user["id"],
        "league_id": league_id
    })
    
    if existing_membership:
        # Aggiorna a owner se già esiste
        await memberships_col.update_one(
            {"id": existing_membership["id"]},
            {"$set": {"role": "owner", "status": "active"}}
        )
        membership_doc = {**existing_membership, "role": "owner"}
    else:
        # Crea nuova membership come owner
        membership_doc = {
            "id": new_id(),
            "user_id": user["id"],
            "league_id": league_id,
            "role": "owner",
            "status": "active",
            "joined_at": now_utc(),
        }
        await memberships_col.insert_one(membership_doc)

    # === DIAGNOSTIC LOG 1: League Creation ===
    logger.info("=" * 60)
    logger.info("[DIAG-1] LEAGUE CREATION")
    logger.info(f"  new_league.id = {league_id}")
    logger.info(f"  new_league.name = {req.name}")
    logger.info(f"  new_league.match_source_type = {req.match_source_type}")
    logger.info(f"  new_league.owner_id = {user['id']}")
    logger.info(f"  creator.user_id = {user['id']}")
    logger.info(f"  creator.email = {user.get('email')}")
    logger.info(f"  membership.role = {membership_doc.get('role')}")
    logger.info(f"  membership.league_id = {membership_doc.get('league_id')}")
    logger.info(f"  OWNER_ID == USER_ID: {league['owner_id'] == user['id']}")
    logger.info("=" * 60)

    await log_audit(user["id"], user["username"], "CREATE", "league", league_id, {"name": req.name})
    league.pop("_id", None)
    league["member_count"] = 1
    return league


@league_router.get("/national")
async def get_national_leagues():
    leagues = await leagues_col.find({"league_type": "national"}, {"_id": 0}).to_list(10)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@league_router.get("/{league_id}")
async def get_league_detail(league_id: str, user=Depends(get_current_user)):
    """Dettaglio singola lega — include scoring_config e regole."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    # Verify membership
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem and league.get("league_type") != "national":
        raise HTTPException(403, "Non sei membro di questa lega")
    league["member_count"] = await memberships_col.count_documents({"league_id": league_id, "status": "active"})
    # Ensure scoring_config fallback
    if not league.get("scoring_config"):
        league["scoring_config"] = DEFAULT_SCORING_CONFIG
    return league


@league_router.patch("/{league_id}")
async def update_league(league_id: str, req: LeagueUpdateRequest, user=Depends(get_current_user)):
    """Aggiorna impostazioni lega — bloccato se rules_locked=True."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    if league.get("owner_id") != user["id"]:
        raise HTTPException(403, "Solo il creatore può modificare la lega")

    # Fields locked once rules_locked=True
    locked_fields = {"start_matchday", "end_matchday", "bet_deadline_minutes", "scoring_config", "include_championship_predictions", "match_source_type", "competition_name"}
    if league.get("rules_locked", False):
        incoming = {k for k, v in req.model_dump(exclude_none=True).items() if k in locked_fields}
        if incoming:
            raise HTTPException(403, f"Regole bloccate: impossibile modificare {', '.join(incoming)}")

    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if updates:
        await leagues_col.update_one({"id": league_id}, {"$set": updates})

    updated = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    updated.pop("_id", None)
    return updated


@league_router.post("/join")
async def join_league(req: LeagueJoinRequest, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"invite_code": req.invite_code}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Codice invito non valido")

    existing = await memberships_col.find_one({"user_id": user["id"], "league_id": league["id"]})
    if existing:
        raise HTTPException(400, "Sei già membro di questa lega")

    await memberships_col.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "league_id": league["id"],
        "role": "member",
        "status": "active",
        "joined_at": now_utc(),
    })

    # Lock rules when second member joins
    member_count = await memberships_col.count_documents({"league_id": league["id"], "status": "active"})
    if member_count > 1 and not league.get("rules_locked", False):
        await leagues_col.update_one({"id": league["id"]}, {"$set": {"rules_locked": True}})
        logger.info(f"[League] rules_locked=True for league {league['id'][:8]} (members: {member_count})")

    return {"message": "Iscrizione completata", "league": league}


@league_router.get("/{league_id}/fixtures")
async def get_league_fixtures(league_id: str, user=Depends(get_current_user)):
    """Partite per una lega — national eredita dalla Nazionale, manual/custom legge le proprie."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    # "manual" e "custom" sono entrambi tipi di lega gestita manualmente
    is_manual_league = league.get("match_source_type") in ("manual", "custom")

    # === DIAGNOSTIC LOG 4: Fixtures Query ===
    logger.info("=" * 60)
    logger.info("[DIAG-4] /api/leagues/{league_id}/fixtures")
    logger.info(f"  league_id requested = {league_id}")
    logger.info(f"  league.name = {league.get('name')}")
    logger.info(f"  league.match_source_type = {league.get('match_source_type')}")
    logger.info(f"  is_manual_league = {is_manual_league}")

    if not is_manual_league:
        source_id = league.get("source_league_id")
        if not source_id:
            nat = await leagues_col.find_one({"league_type": "national"}, {"_id": 0, "id": 1})
            source_id = nat["id"] if nat else None
        source_league = await leagues_col.find_one({"id": source_id}, {"_id": 0}) if source_id else None
        season_id = source_league["season_id"] if source_league else league["season_id"]
        # CRITICAL: filter only national matchdays (league_id == NATIONAL_LEAGUE_ID) to exclude manual-league matchdays
        # that may share the same season_id
        matchdays = await matchdays_col.find(
            {"season_id": season_id, "league_id": NATIONAL_LEAGUE_ID},
            {"_id": 0}
        ).sort("number", 1).to_list(100)
        logger.info(f"  NATIONAL MODE: query matchdays by season_id={season_id} league_id=NATIONAL_LEAGUE_ID")
    else:
        source_id = league_id
        season_id = league["season_id"]
        # Manual: query by league_id to avoid collision with national matchdays
        matchdays = await matchdays_col.find({"league_id": league_id}, {"_id": 0}).sort("number", 1).to_list(100)
        logger.info(f"  MANUAL MODE: query matchdays by league_id={league_id}")
        logger.info(f"  Matchdays found: {len(matchdays)}")
        for md in matchdays:
            logger.info(f"    - matchday.id={md.get('id')}, number={md.get('number')}, league_id={md.get('league_id')}")

    start_md = league.get("start_matchday", 1)
    end_md = league.get("end_matchday", 38)
    matchdays = [md for md in matchdays if start_md <= md.get("number", 0) <= end_md]

    result = []
    for md in matchdays:
        if is_manual_league:
            matches = await matches_col.find({"matchday_id": md["id"], "league_id": league_id}, {"_id": 0}).to_list(20)
            logger.info(f"  MANUAL/CUSTOM: Matches for matchday {md.get('number')}: {len(matches)}")
            for m in matches:
                logger.info(f"    - {m.get('home_team')} vs {m.get('away_team')}, league_id={m.get('league_id')}")
        else:
            # National-type league: use _match_source_query with NATIONAL_LEAGUE_ID
            matches = await matches_col.find(_match_source_query(md["id"], NATIONAL_LEAGUE_ID), {"_id": 0}).to_list(20)
        result.append({**md, "matches": matches})

    logger.info("=" * 60)
    return {"league_id": league_id, "source_league_id": source_id, "matchdays": result}


def _require_league_admin(league: dict, user: dict):
    if league.get("owner_id") != user["id"]:
        raise HTTPException(403, "Solo il creatore della lega può gestire le partite")
    # "manual" e "custom" sono entrambi tipi di lega gestita manualmente
    if league.get("match_source_type") not in ("manual", "custom"):
        raise HTTPException(400, "Questa lega usa le partite della Lega Nazionale")


@league_router.get("/{league_id}/matchdays")
async def get_league_matchdays(league_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem:
        raise HTTPException(403, "Non sei membro di questa lega")
    matchdays = await matchdays_col.find({"league_id": league_id}, {"_id": 0}).sort("number", 1).to_list(50)
    for md in matchdays:
        md["match_count"] = await matches_col.count_documents({"matchday_id": md["id"]})
    return matchdays


@league_router.post("/{league_id}/matchdays")
async def create_league_matchday(league_id: str, req: MatchdayCreate, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    md_id = new_id()
    matchday = {
        "id": md_id,
        "league_id": league_id,
        "season_id": req.season_id or league["season_id"],
        "number": req.number,
        "label": req.label or f"Giornata {req.number}",
        "half": req.half,
        "first_kickoff": req.first_kickoff,
        "status": "OPEN",
        "created_at": now_utc(),
    }
    await matchdays_col.insert_one(matchday)
    matchday.pop("_id", None)
    return matchday


@league_router.put("/{league_id}/matchdays/{matchday_id}")
async def update_league_matchday(league_id: str, matchday_id: str, req: dict, user=Depends(get_current_user)):
    """Aggiorna lo status di una giornata per una lega manuale.
    Se status diventa COMPLETED, ricalcola tutti i punteggi.
    """
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    
    # Get current matchday to check for status change
    matchday = await matchdays_col.find_one({"id": matchday_id, "league_id": league_id}, {"_id": 0})
    old_status = matchday.get("status") if matchday else None
    
    updates = {}
    if "status" in req:
        updates["status"] = req["status"]
    if "label" in req:
        updates["label"] = req["label"]
    
    if updates:
        await matchdays_col.update_one({"id": matchday_id, "league_id": league_id}, {"$set": updates})
    
    # Se status cambia a COMPLETED, ricalcola tutti i punteggi
    new_status = updates.get("status")
    if new_status == "COMPLETED":
        logger.info(f"[SCORING] Matchday {matchday_id} marked COMPLETED, triggering recalculation...")
        await recalculate_matchday_scores(matchday_id, league_id)
    
    return await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})


@league_router.post("/{league_id}/matchdays/{matchday_id}/recalculate")
async def force_recalculate_matchday(league_id: str, matchday_id: str, user=Depends(get_current_user)):
    """Forza il ricalcolo dei punteggi per una giornata - utile per debug o fix."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    
    logger.info(f"[SCORING] Manual recalculation triggered for matchday {matchday_id} in league {league_id}")
    await recalculate_matchday_scores(matchday_id, league_id)
    
    return {"message": "Ricalcolo completato", "matchday_id": matchday_id, "league_id": league_id}


@league_router.delete("/{league_id}/matchdays/{matchday_id}")
async def delete_league_matchday(league_id: str, matchday_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    await matches_col.delete_many({"matchday_id": matchday_id})
    await matchdays_col.delete_one({"id": matchday_id, "league_id": league_id})
    return {"message": "Giornata eliminata"}


MAX_MATCHES_PER_MATCHDAY = 10


@league_router.get("/{league_id}/matchdays/{matchday_id}/matches")
async def get_league_matchday_matches(league_id: str, matchday_id: str, user=Depends(get_current_user)):
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem:
        raise HTTPException(403, "Non sei membro")
    return await matches_col.find({"matchday_id": matchday_id, "league_id": league_id}, {"_id": 0}).to_list(20)


@league_router.post("/{league_id}/matchdays/{matchday_id}/matches")
async def create_league_match(league_id: str, matchday_id: str, req: MatchCreate, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    
    # Check limit: max 10 matches per matchday
    current_count = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": league_id})
    if current_count >= MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Limite massimo di {MAX_MATCHES_PER_MATCHDAY} partite per giornata raggiunto")
    
    match_id = new_id()
    match = {
        "id": match_id, "matchday_id": matchday_id, "league_id": league_id,
        "home_team": req.home_team, "away_team": req.away_team,
        "competition": req.competition, "start_time": req.start_time,
        "market_type": req.market_type, "status": req.status,
        "home_score": None, "away_score": None, "created_at": now_utc(),
    }
    await matches_col.insert_one(match)
    match.pop("_id", None)
    return match


@league_router.patch("/{league_id}/matchdays/{matchday_id}/matches/{match_id}")
async def update_league_match(league_id: str, matchday_id: str, match_id: str, req: MatchUpdate, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if updates:
        await matches_col.update_one({"id": match_id, "matchday_id": matchday_id}, {"$set": updates})
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@league_router.delete("/{league_id}/matchdays/{matchday_id}/matches/{match_id}")
async def delete_league_match(league_id: str, matchday_id: str, match_id: str, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    await matches_col.delete_one({"id": match_id, "matchday_id": matchday_id, "league_id": league_id})
    return {"message": "Partita eliminata"}


@league_router.put("/{league_id}/matches/{match_id}")
async def update_league_match_simple(league_id: str, match_id: str, req: dict, user=Depends(get_current_user)):
    """Aggiorna una partita (risultato, status) - semplificato senza matchday_id nel path.
    Se status diventa 'finished', ricalcola i punti per tutti i pronostici di quella partita.
    """
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    
    # Get current match to check for status change
    match = await matches_col.find_one({"id": match_id, "league_id": league_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")
    
    old_status = match.get("status")
    
    updates = {}
    if "home_score" in req:
        updates["home_score"] = req["home_score"]
    if "away_score" in req:
        updates["away_score"] = req["away_score"]
    if "status" in req:
        updates["status"] = req["status"]
    
    if updates:
        await matches_col.update_one({"id": match_id, "league_id": league_id}, {"$set": updates})
    
    # Se status cambia a 'finished' o risultato viene aggiornato, ricalcola punti
    new_status = updates.get("status", old_status)
    has_result = (updates.get("home_score") is not None or match.get("home_score") is not None)
    
    if new_status == "finished" and has_result:
        # Ricalcola punti per tutti i pronostici di questa partita
        await recalculate_match_predictions(match_id, league_id)
    
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@league_router.delete("/{league_id}/matches/{match_id}")
async def delete_league_match_simple(league_id: str, match_id: str, user=Depends(get_current_user)):
    """Elimina una partita - semplificato senza matchday_id nel path."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    _require_league_admin(league, user)
    await matches_col.delete_one({"id": match_id, "league_id": league_id})
    return {"message": "Partita eliminata"}


@league_router.post("/{league_id}/join-direct")
async def join_league_direct(league_id: str, user=Depends(get_current_user)):
    """Join a league directly after Stripe payment return (fallback if webhook missed)."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    # Check existing membership
    existing = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if existing:
        return {"message": "Sei già membro di questa lega", "already_member": True}

    # For national leagues: verify payment OR allow fallback (Stripe webhook may not fire in dev)
    if league.get("league_type") == "national":
        paid_payment = await payments_col.find_one({
            "user_id": user["id"], "league_id": league_id, "payment_status": "paid"
        })
        if not paid_payment:
            logger.info(f"[JoinDirect] National join without paid record – fallback for user {user['id'][:8]}")

    await memberships_col.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "league_id": league_id,
        "status": "active",
        "joined_at": now_utc(),
        "payment_id": None,
    })
    logger.info(f"[JoinDirect] User {user['id'][:8]} joined league {league_id[:8]}")
    return {"message": "Iscrizione alla lega completata", "already_member": False}


async def get_active_seasons():
    seasons = await seasons_col.find({"is_active": True}, {"_id": 0}).to_list(10)
    return seasons


# ========================================
# PREDICTION ROUTES
# ========================================
@prediction_router.get("/{matchday_id}")
async def get_predictions(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    # Determine which matches to fetch based on league type
    match_query = {"matchday_id": matchday_id}
    
    # If league_id provided, check if it's a manual league
    if league_id:
        league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
        if league and league.get("match_source_type") == "manual":
            # Manual league: fetch only matches created for this league
            match_query["league_id"] = league_id
    else:
        # Fallback: check if matchday belongs to a manual league
        if matchday.get("league_id"):
            league = await leagues_col.find_one({"id": matchday["league_id"]}, {"_id": 0})
            if league and league.get("match_source_type") == "manual":
                match_query["league_id"] = matchday["league_id"]

    matches = await matches_col.find(match_query, {"_id": 0}).to_list(20)
    preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    # Get joker status for this matchday
    season = await seasons_col.find_one({"id": matchday["season_id"]}, {"_id": 0})
    half = matchday["half"]
    joker = await joker_usages_col.find_one({
        "user_id": user["id"],
        "season_id": season["id"] if season else "",
        "half": half,
    }, {"_id": 0})

    joker_active = joker is not None and joker.get("matchday_id") == matchday_id and joker.get("is_active", False)
    joker_used_other_matchday = joker is not None and joker.get("matchday_id") != matchday_id

    now = server_now()
    first_kickoff = datetime.fromisoformat(matchday["first_kickoff"].replace("Z", "+00:00"))
    lock_time = first_kickoff - timedelta(seconds=60)
    joker_locked = now >= lock_time

    result = []
    for m in matches:
        start = datetime.fromisoformat(m["start_time"].replace("Z", "+00:00"))
        is_locked = now >= start
        pred = preds_dict.get(m["id"])
        result.append({
            "match": m,
            "prediction": pred,
            "is_locked": is_locked,
        })

    return {
        "matchday": matchday,
        "predictions": result,
        "joker": {
            "is_active": joker_active,
            "is_locked": joker_locked,
            "used_other_matchday": joker_used_other_matchday,
            "half": half,
        },
    }


@prediction_router.post("/{matchday_id}")
async def save_predictions(matchday_id: str, req: PredictionsBatchRequest, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    if matchday["status"] in ("COMPLETED",):
        raise HTTPException(400, "Matchday is completed, cannot modify predictions")

    now = server_now()

    # Validate completeness: all unlocked matches must have predictions (new or already saved)
    all_matchday_matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(100)
    unlocked_match_ids = set()
    for m in all_matchday_matches:
        try:
            if m.get("start_time"):
                start = datetime.fromisoformat(m["start_time"].replace("Z", "+00:00"))
                if now < start:
                    unlocked_match_ids.add(m["id"])
            else:
                # Nessun start_time: considerata aperta per pronostici
                unlocked_match_ids.add(m["id"])
        except Exception:
            unlocked_match_ids.add(m["id"])

    if unlocked_match_ids:
        # Already saved predictions for this matchday
        existing_preds = await predictions_col.find(
            {"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0}
        ).to_list(100)
        existing_pred_match_ids = {p["match_id"] for p in existing_preds}
        incoming_match_ids = {p.match_id for p in req.predictions}
        covered_ids = existing_pred_match_ids | incoming_match_ids
        missing = unlocked_match_ids - covered_ids
        if missing:
            raise HTTPException(422, detail={
                "code": "PREDICTIONS_INCOMPLETE",
                "message": f"Devi inserire un pronostico per tutte le {len(unlocked_match_ids)} partite",
                "completed": len(covered_ids & unlocked_match_ids),
                "required": len(unlocked_match_ids),
            })

    saved = []
    errors = []

    # Validate: no duplicate match_ids in payload
    match_ids_in_payload = [p.match_id for p in req.predictions]
    if len(match_ids_in_payload) != len(set(match_ids_in_payload)):
        raise HTTPException(400, "Duplicate match_id in payload — only 1 market per match allowed")

    # league_id associata a queste predictions (per isolamento dati nelle leghe private nazionali)
    pred_league_id = req.league_id if req.league_id else None

    for p in req.predictions:
        match = await matches_col.find_one({"id": p.match_id, "matchday_id": matchday_id}, {"_id": 0})
        if not match:
            errors.append({"match_id": p.match_id, "error": "Match not found"})
            continue

        # Lock per match: check match start_time (server time)
        start = datetime.fromisoformat(match["start_time"].replace("Z", "+00:00"))
        if now >= start:
            errors.append({"match_id": p.match_id, "error": "Match locked (started)"})
            continue

        # Validate market_type is valid
        if p.market_type not in ("1X2", "GOAL_NOGOL", "OVER_UNDER_25", "EXACT_SCORE"):
            errors.append({"match_id": p.match_id, "error": f"Invalid market_type: {p.market_type}"})
            continue

        # Validate prediction value based on user-chosen market type
        valid = _validate_prediction(p.prediction_value, p.market_type)
        if not valid:
            errors.append({"match_id": p.match_id, "error": f"Invalid value '{p.prediction_value}' for market {p.market_type}"})
            continue

        existing = await predictions_col.find_one({"user_id": user["id"], "match_id": p.match_id})
        ts = now_utc()
        if existing:
            # Overwrite: change market + value (only 1 market per match guaranteed)
            update_fields = {
                "market_type": p.market_type,
                "prediction_value": p.prediction_value,
                "updated_at": ts,
            }
            if pred_league_id:
                update_fields["league_id"] = pred_league_id
            await predictions_col.update_one(
                {"user_id": user["id"], "match_id": p.match_id},
                {"$set": update_fields}
            )
        else:
            doc = {
                "id": new_id(),
                "user_id": user["id"],
                "match_id": p.match_id,
                "matchday_id": matchday_id,
                "market_type": p.market_type,
                "prediction_value": p.prediction_value,
                "points": None,
                "is_correct": None,
                "locked": False,
                "created_at": ts,
                "updated_at": ts,
            }
            if pred_league_id:
                doc["league_id"] = pred_league_id
            await predictions_col.insert_one(doc)
        saved.append({"match_id": p.match_id, "market_type": p.market_type, "value": p.prediction_value})

    return {"saved_count": len(saved), "saved": saved, "errors": errors}


# C) REGOLA 11 PARTITE: Endpoint per verificare/confermare pronostici completi
@prediction_router.post("/{matchday_id}/confirm")
async def confirm_predictions(matchday_id: str, user=Depends(get_current_user)):
    """
    Verifica che l'utente abbia inserito tutti gli 11 pronostici.
    Ritorna errore 400 se < 11 pronostici.
    """
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    
    if matchday["status"] in ("COMPLETED",):
        raise HTTPException(400, "Matchday is completed")
    
    # Count matches in matchday
    total_matches = await matches_col.count_documents({"matchday_id": matchday_id})
    required_matches = max(total_matches, MATCHES_PER_MATCHDAY)
    
    # Count user predictions
    user_predictions = await predictions_col.count_documents({
        "user_id": user["id"], 
        "matchday_id": matchday_id
    })
    
    if user_predictions < required_matches:
        raise HTTPException(400, {
            "code": "NEED_11_PREDICTIONS",
            "message": f"Devi inserire tutti e {required_matches} i pronostici per confermare",
            "current": user_predictions,
            "required": required_matches,
        })
    
    return {
        "status": "confirmed",
        "predictions_count": user_predictions,
        "required": required_matches,
        "message": f"Hai inserito tutti i {required_matches} pronostici!"
    }


def _validate_prediction(value: str, market_type: str) -> bool:
    v = value.upper()
    if market_type == "1X2":
        return v in ("1", "X", "2")
    elif market_type == "GOAL_NOGOL":
        return v in ("GOAL", "NOGOL")
    elif market_type == "OVER_UNDER_25":
        return v in ("OVER", "UNDER")
    elif market_type == "EXACT_SCORE":
        parts = v.split("-")
        if len(parts) == 2:
            try:
                int(parts[0])
                int(parts[1])
                return True
            except ValueError:
                return False
    return False


# ========================================
# JOKER ROUTES (Matchday-level, NOT per-match)
# ========================================
@prediction_router.post("/{matchday_id}/joker")
async def set_joker(matchday_id: str, user=Depends(get_current_user)):
    """Activate joker for this matchday. x2 on ALL valid match points."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    now = server_now()
    first_kickoff = datetime.fromisoformat(matchday["first_kickoff"].replace("Z", "+00:00"))
    lock_time = first_kickoff - timedelta(seconds=60)

    if now >= lock_time:
        raise HTTPException(400, "Joker lock time passed (60s before first kickoff)")

    season = await seasons_col.find_one({"id": matchday["season_id"]}, {"_id": 0})
    if not season:
        raise HTTPException(400, "Season not found")

    half = matchday["half"]

    existing_joker = await joker_usages_col.find_one({
        "user_id": user["id"],
        "season_id": season["id"],
        "half": half,
    })

    if existing_joker:
        if existing_joker["matchday_id"] == matchday_id:
            # Already active on this matchday, toggle is_active
            await joker_usages_col.update_one(
                {"id": existing_joker["id"]},
                {"$set": {"is_active": True}}
            )
            return {"message": "Joker activated for matchday", "matchday_id": matchday_id, "is_active": True}
        else:
            raise HTTPException(400, f"Joker already used in half {half} (matchday {existing_joker['matchday_id']})")

    await joker_usages_col.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "season_id": season["id"],
        "matchday_id": matchday_id,
        "half": half,
        "is_active": True,
        "created_at": now_utc(),
    })
    return {"message": "Joker activated for matchday", "matchday_id": matchday_id, "is_active": True}


@prediction_router.delete("/{matchday_id}/joker")
async def remove_joker(matchday_id: str, user=Depends(get_current_user)):
    """Deactivate joker for this matchday."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    now = server_now()
    first_kickoff = datetime.fromisoformat(matchday["first_kickoff"].replace("Z", "+00:00"))
    lock_time = first_kickoff - timedelta(seconds=60)

    if now >= lock_time:
        raise HTTPException(400, "Cannot remove joker after lock time")

    result = await joker_usages_col.delete_one({"user_id": user["id"], "matchday_id": matchday_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "No joker found for this matchday")
    return {"message": "Joker removed", "matchday_id": matchday_id, "is_active": False}


@prediction_router.get("/{matchday_id}/joker-status")
async def get_joker_status(matchday_id: str, user=Depends(get_current_user)):
    """Get joker status for this matchday and availability for the half."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    season = await seasons_col.find_one({"id": matchday["season_id"]}, {"_id": 0})
    half = matchday["half"]

    now = server_now()
    first_kickoff = datetime.fromisoformat(matchday["first_kickoff"].replace("Z", "+00:00"))
    lock_time = first_kickoff - timedelta(seconds=60)
    is_locked = now >= lock_time

    joker = await joker_usages_col.find_one({
        "user_id": user["id"],
        "season_id": season["id"] if season else "",
        "half": half,
    }, {"_id": 0})

    is_active_this_matchday = joker is not None and joker.get("matchday_id") == matchday_id and joker.get("is_active", False)
    used_other_matchday = joker is not None and joker.get("matchday_id") != matchday_id

    return {
        "is_active": is_active_this_matchday,
        "is_locked": is_locked,
        "used_other_matchday": used_other_matchday,
        "half": half,
        "matchday_id": matchday_id,
    }


# ========================================
# STANDINGS ROUTES (Classifiche)
# ========================================

@standings_router.get("/total")
async def get_total_standings(league_id: str = None, user=Depends(get_current_user)):
    """
    Classifica Totale della lega.
    Ordinamento: punti_totali DESC, punti_settimana_corrente DESC, created_at ASC
    """
    if not league_id:
        membership = await memberships_col.find_one({"user_id": user["id"], "status": "active"})
        if membership:
            league_id = membership["league_id"]

    if not league_id:
        return {"league_id": "", "league_name": "", "standings_type": "total", "entries": [], "my_position": None}

    league_doc = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league_doc:
        raise HTTPException(404, "League not found")
    
    members = await memberships_col.find({"league_id": league_id, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    # Get active season for current week points
    season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
    current_matchday = None
    if season:
        current_matchday = await matchdays_col.find_one(
            {"season_id": season["id"], "status": {"$in": ["OPEN", "LOCKED", "LIVE"]}},
            {"_id": 0},
            sort=[("number", -1)]
        )

    # Aggregate total points and matchdays per user
    # Per leghe manuali: filtra per league_id (score_summaries hanno league_id)
    # Per leghe nazionali private: usa predictions.league_id per identificare matchday giocati
    is_national_type = league_doc.get("match_source_type") not in ("manual", "custom")
    if is_national_type:
        # Trova matchday_ids dove questa lega ha effettivamente predictions
        league_played_md_ids = await predictions_col.distinct(
            "matchday_id",
            {
                "league_id": league_id,
                "user_id": {"$in": member_user_ids}
            }
        )
        if not league_played_md_ids:
            # Nessuna giornata giocata: restituisci standings vuota con solo i membri
            entries = []
            for uid in member_user_ids:
                u = await users_col.find_one({"id": uid}, {"_id": 0, "password": 0})
                entries.append({
                    "user_id": uid,
                    "username": u["username"] if u else "Unknown",
                    "total_points": 0,
                    "current_week_points": 0,
                    "matchdays_played": 0,
                    "jolly_used": 0,
                    "created_at": "",
                    "is_current_user": uid == user["id"],
                    "rank": None,
                })
            for i, e in enumerate(entries):
                e["rank"] = i + 1
            my_pos = next((e for e in entries if e["is_current_user"]), None)
            return {
                "league_id": league_id,
                "league_name": league_doc["name"],
                "standings_type": "total",
                "entries": entries,
                "my_position": my_pos,
                "current_matchday": current_matchday["number"] if current_matchday else None,
            }
        # Usa score_summaries filtrati per i matchday giocati da questa lega (no league_id filter)
        standings_match = {"user_id": {"$in": member_user_ids}, "matchday_id": {"$in": league_played_md_ids}}
    else:
        standings_match = {"user_id": {"$in": member_user_ids}, "league_id": league_id}

    pipeline = [
        {"$match": standings_match},
        {"$group": {
            "_id": "$user_id", 
            "total_points": {"$sum": "$total_points"}, 
            "matchdays_played": {"$sum": 1},
            "created_at": {"$min": "$created_at"}
        }},
    ]
    totals = await score_summaries_col.aggregate(pipeline).to_list(1000)
    totals_dict = {t["_id"]: t for t in totals}

    # Get current week points for secondary sort
    current_week_points = {}
    if current_matchday:
        current_scores = await score_summaries_col.find(
            {"matchday_id": current_matchday["id"], "user_id": {"$in": member_user_ids}},
            {"_id": 0}
        ).to_list(1000)
        current_week_points = {s["user_id"]: s["total_points"] for s in current_scores}

    # Get jolly usage count per user for this season
    jolly_counts = {}
    if season:
        jolly_pipeline = [
            {"$match": {"user_id": {"$in": member_user_ids}, "season_id": season["id"]}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
        ]
        jolly_data = await joker_usages_col.aggregate(jolly_pipeline).to_list(1000)
        jolly_counts = {j["_id"]: j["count"] for j in jolly_data}

    # Build entries for all members (including those with 0 points)
    entries = []
    for uid in member_user_ids:
        u = await users_col.find_one({"id": uid}, {"_id": 0, "password": 0})
        t = totals_dict.get(uid, {"total_points": 0, "matchdays_played": 0, "created_at": ""})
        entries.append({
            "user_id": uid,
            "username": u["username"] if u else "Unknown",
            "total_points": t["total_points"],
            "current_week_points": current_week_points.get(uid, 0),
            "matchdays_played": t["matchdays_played"],
            "jolly_used": jolly_counts.get(uid, 0),
            "created_at": t.get("created_at", ""),
            "is_current_user": uid == user["id"],
        })

    # Sort: total DESC, current_week DESC, created_at ASC
    entries.sort(key=lambda x: (-x["total_points"], -x["current_week_points"], x["created_at"]))
    
    # Assign ranks
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    my_pos = next((e for e in entries if e["is_current_user"]), None)

    return {
        "league_id": league_id,
        "league_name": league_doc["name"],
        "standings_type": "total",
        "entries": entries[:50],
        "my_position": my_pos,
        "current_matchday": current_matchday["number"] if current_matchday else None,
    }


@standings_router.get("/weekly/{matchday_id}")
async def get_weekly_standings(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    """
    Classifica Settimanale per una giornata specifica.
    Ordinamento: punti_giornata DESC, risultati_esatti DESC, 1x2_corretti DESC
    """
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    if not league_id:
        membership = await memberships_col.find_one({"user_id": user["id"], "status": "active"})
        if membership:
            league_id = membership["league_id"]

    if not league_id:
        return {"league_id": "", "league_name": "", "standings_type": "weekly", "entries": [], "my_position": None}

    league_doc = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league_doc:
        raise HTTPException(404, "League not found")
    
    members = await memberships_col.find({"league_id": league_id, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    # Get predictions filtrate per questa lega
    # Per leghe nazionali private: usa predictions.league_id = league_id
    # Per leghe manuali: usa predictions.matchday_id (i matchday sono già unici per lega)
    is_manual = league_doc.get("match_source_type") in ("manual", "custom")
    # Dopo la migrazione: ogni prediction ha league_id esplicito — query diretta senza fallback
    pred_filter = {
        "matchday_id": matchday_id,
        "user_id": {"$in": member_user_ids},
        "league_id": league_id,
    }

    all_preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(10000)

    # Per leghe nazionali private: includi solo utenti che hanno giocato questa giornata per questa lega
    if not is_manual:
        users_who_played = {p["user_id"] for p in all_preds}
        member_user_ids = [uid for uid in member_user_ids if uid in users_who_played]

    # Group predictions by user and count correct predictions
    user_pred_stats = {}
    for p in all_preds:
        uid = p["user_id"]
        if uid not in user_pred_stats:
            user_pred_stats[uid] = {"total_correct": 0, "1x2_correct": 0}
        
        if p.get("is_correct"):
            user_pred_stats[uid]["total_correct"] += 1
            market = p.get("market_type", "1X2")
            if market == "1X2":
                user_pred_stats[uid]["1x2_correct"] += 1

    # B) COERENZA PUNTI: Usa compute_matchday_points per ogni utente
    # Questo garantisce che matchday_points == total_points di /predictions/user
    entries = []
    for uid in member_user_ids:
        u = await users_col.find_one({"id": uid}, {"_id": 0, "password": 0})
        
        # Usa la funzione centralizzata che ritorna gli stessi valori di /predictions/user
        points_data = await compute_matchday_points(uid, matchday_id)
        
        stats = user_pred_stats.get(uid, {"total_correct": 0, "1x2_correct": 0})
        
        entries.append({
            "user_id": uid,
            "username": u["username"] if u else "Unknown",
            "matchday_points": points_data["total_points"],  # Coerente con /predictions/user
            "base_points": points_data["base_points"],
            "joker_bonus": points_data["joker_bonus"],
            "total_correct": stats["total_correct"],
            "1x2_correct": stats["1x2_correct"],
            "jolly_active": points_data["joker_active"],
            "is_current_user": uid == user["id"],
        })

    # Sort: points DESC, total_correct DESC, 1x2 DESC
    entries.sort(key=lambda x: (-x["matchday_points"], -x["total_correct"], -x["1x2_correct"]))
    
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    my_pos = next((e for e in entries if e["is_current_user"]), None)

    return {
        "league_id": league_id,
        "league_name": league_doc["name"],
        "standings_type": "weekly",
        "matchday_id": matchday_id,
        "matchday_number": matchday["number"],
        "matchday_label": matchday.get("label", f"Giornata {matchday['number']}"),
        "entries": entries[:50],
        "my_position": my_pos,
    }


@standings_router.get("/matchdays")
async def get_available_matchdays(league_id: str = None, user=Depends(get_current_user)):
    """Lista giornate disponibili per la classifica settimanale - filtrate per lega."""
    
    # Se league_id specificato, filtra per quella lega
    if league_id:
        league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
        if league:
            is_manual = league.get("match_source_type") in ("manual", "custom")
            if is_manual:
                # Lega manuale: matchdays con league_id = questa lega
                matchdays = await matchdays_col.find(
                    {"league_id": league_id},
                    {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}
                ).sort("number", -1).to_list(50)
                return matchdays
            else:
                # Lega nazionale privata: restituisce SOLO matchday dove esistono predictions
                # con league_id = questo league_id OPPURE senza league_id (retrocompatibilità)
                # Filtrato per memberships della lega (solo giornate dove i propri membri hanno giocato)
                league_members_snap = await memberships_col.find(
                    {"league_id": league_id, "status": "active"}, {"_id": 0, "user_id": 1}
                ).to_list(1000)
                member_ids_snap = [m["user_id"] for m in league_members_snap]

                # Lega nazionale privata: matchday dove i membri hanno predictions con league_id = questo
                played_md_ids = await predictions_col.distinct(
                    "matchday_id",
                    {
                        "league_id": league_id,
                        "user_id": {"$in": member_ids_snap}
                    }
                )
                if not played_md_ids:
                    return []  # Lega nuova: nessuna giornata giocata ancora
                matchdays = await matchdays_col.find(
                    {"id": {"$in": played_md_ids}},
                    {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}
                ).sort("number", -1).to_list(50)
                return matchdays
    
    # Fallback: matchdays dalla stagione attiva (nazionali = league_id == NATIONAL_LEAGUE_ID)
    season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
    if not season:
        return []
    
    matchdays = await matchdays_col.find(
        {"season_id": season["id"], "league_id": NATIONAL_LEAGUE_ID},
        {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}
    ).sort("number", -1).to_list(50)
    
    return matchdays


@standings_router.get("/user/{target_user_id}")
async def get_user_standings_profile(target_user_id: str, league_id: str = None, season_id: str = None, user=Depends(get_current_user)):
    """
    Profilo utente con statistiche totali nella lega.
    Ritorna gli stessi dati visibili nella classifica totale + breakdown per matchday.
    """
    if not league_id:
        # Cerca una lega in comune
        my_memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
        my_leagues = [m["league_id"] for m in my_memberships]
        
        target_membership = await memberships_col.find_one({
            "user_id": target_user_id, 
            "status": "active",
            "league_id": {"$in": my_leagues}
        })
        if not target_membership:
            raise HTTPException(403, "Utente non nella stessa lega")
        league_id = target_membership["league_id"]
    else:
        # Verifica che entrambi siano nella lega specificata
        my_mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
        target_mem = await memberships_col.find_one({"user_id": target_user_id, "league_id": league_id, "status": "active"})
        if not my_mem or not target_mem:
            raise HTTPException(403, "Entrambi gli utenti devono essere nella stessa lega")

    # Get target user info
    target_user = await users_col.find_one({"id": target_user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(404, "User not found")

    # Get league info
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})

    # Get active season or use provided season_id
    if season_id:
        season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    else:
        season = await seasons_col.find_one({"is_active": True}, {"_id": 0})

    # Aggregate total points for this user
    pipeline = [
        {"$match": {"user_id": target_user_id}},
        {"$group": {
            "_id": "$user_id", 
            "total_points": {"$sum": "$total_points"}, 
            "matchdays_played": {"$sum": 1},
            "total_base_points": {"$sum": "$base_points"},
            "total_joker_bonus": {"$sum": "$joker_bonus"},
        }},
    ]
    totals = await score_summaries_col.aggregate(pipeline).to_list(1)
    user_totals = totals[0] if totals else {"total_points": 0, "matchdays_played": 0, "total_base_points": 0, "total_joker_bonus": 0}

    # Get current week points
    current_matchday = None
    current_week_points = 0
    last_matchday_id = None
    if season:
        current_matchday = await matchdays_col.find_one(
            {"season_id": season["id"], "status": {"$in": ["OPEN", "LOCKED", "LIVE", "COMPLETED"]}},
            {"_id": 0},
            sort=[("number", -1)]
        )
        if current_matchday:
            last_matchday_id = current_matchday["id"]
            current_score = await score_summaries_col.find_one(
                {"user_id": target_user_id, "matchday_id": current_matchday["id"]},
                {"_id": 0}
            )
            if current_score:
                current_week_points = current_score.get("total_points", 0)

    # Get jolly usage count
    jolly_used = 0
    if season:
        jolly_used = await joker_usages_col.count_documents({
            "user_id": target_user_id, 
            "season_id": season["id"]
        })

    # Calculate rank in league
    members = await memberships_col.find({"league_id": league_id, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    # Get all totals for ranking
    all_totals_pipeline = [
        {"$match": {"user_id": {"$in": member_user_ids}}},
        {"$group": {
            "_id": "$user_id", 
            "total_points": {"$sum": "$total_points"}, 
        }},
        {"$sort": {"total_points": -1}},
    ]
    all_totals = await score_summaries_col.aggregate(all_totals_pipeline).to_list(1000)
    
    rank = 1
    for i, t in enumerate(all_totals):
        if t["_id"] == target_user_id:
            rank = i + 1
            break

    # NEW: Get breakdown per matchday (P2 fix)
    matchday_breakdown = []
    if season:
        # Get all score summaries for this user in this season
        user_scores = await score_summaries_col.find(
            {"user_id": target_user_id},
            {"_id": 0}
        ).to_list(100)
        
        # Get matchdays info
        matchdays_list = await matchdays_col.find(
            {"season_id": season["id"]},
            {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}
        ).sort("number", 1).to_list(50)
        matchdays_dict = {m["id"]: m for m in matchdays_list}
        
        for score in user_scores:
            md = matchdays_dict.get(score.get("matchday_id"))
            if md:
                matchday_breakdown.append({
                    "matchday_id": score["matchday_id"],
                    "matchday_number": md["number"],
                    "matchday_label": md.get("label", f"Giornata {md['number']}"),
                    "status": md["status"],
                    "base_points": score.get("base_points", 0),
                    "joker_bonus": score.get("joker_bonus", 0),
                    "total_points": score.get("total_points", 0),
                })
        
        # Sort by matchday number
        matchday_breakdown.sort(key=lambda x: x["matchday_number"])

    return {
        "user_id": target_user_id,
        "username": target_user["username"],
        "email": target_user.get("email", ""),
        "league_id": league_id,
        "league_name": league["name"] if league else "",
        "rank": rank,
        "total_points": user_totals["total_points"],
        "matchdays_played": user_totals["matchdays_played"],
        "total_base_points": user_totals["total_base_points"],
        "total_joker_bonus": user_totals["total_joker_bonus"],
        "current_week_points": current_week_points,
        "current_matchday": current_matchday["number"] if current_matchday else None,
        "last_matchday_id": last_matchday_id,
        "jolly_used": jolly_used,
        "is_current_user": target_user_id == user["id"],
        "matchday_breakdown": matchday_breakdown,
    }


# ========================================
# TRASPARENZA PRONOSTICI
# ========================================

@prediction_router.get("/user/{target_user_id}/{matchday_id}")
async def get_user_predictions_transparency(target_user_id: str, matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    """
    Visualizza i pronostici di un altro utente per una giornata.
    Accessibile solo se matchday.status = LOCKED, LIVE, o COMPLETED.
    Entrambi gli utenti devono essere nella stessa lega.
    """
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    
    # Solo LOCKED, LIVE o COMPLETED
    if matchday["status"] not in ("LOCKED", "LIVE", "COMPLETED"):
        raise HTTPException(403, "Pronostici visibili solo dopo il lock della giornata")

    # Trova la lega in comune
    if not league_id:
        # Cerca una lega in cui entrambi sono membri
        my_memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
        my_leagues = [m["league_id"] for m in my_memberships]
        
        target_membership = await memberships_col.find_one({
            "user_id": target_user_id, 
            "status": "active",
            "league_id": {"$in": my_leagues}
        })
        if not target_membership:
            raise HTTPException(403, "Utente non nella stessa lega")
        league_id = target_membership["league_id"]
    else:
        # Verifica che entrambi siano nella lega specificata
        my_mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
        target_mem = await memberships_col.find_one({"user_id": target_user_id, "league_id": league_id, "status": "active"})
        if not my_mem or not target_mem:
            raise HTTPException(403, "Entrambi gli utenti devono essere nella stessa lega")

    # Get target user info
    target_user = await users_col.find_one({"id": target_user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(404, "User not found")

    # Get all matches for this matchday
    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    # Get user predictions
    preds = await predictions_col.find({"user_id": target_user_id, "matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    # Get joker status
    joker = await joker_usages_col.find_one({"user_id": target_user_id, "matchday_id": matchday_id}, {"_id": 0})
    jolly_active = joker is not None and joker.get("is_active", False)

    # Get score summary
    score_summary = await score_summaries_col.find_one(
        {"user_id": target_user_id, "matchday_id": matchday_id}, 
        {"_id": 0}
    )

    # Build response with all 11 matches
    predictions_list = []
    total_base_points = 0.0
    
    # For COMPLETED matchdays, use stored scores if available
    use_stored_scores = matchday["status"] == "COMPLETED" and score_summary is not None
    
    for m in sorted(matches, key=lambda x: x.get("start_time", "")):
        pred = preds_dict.get(m["id"])
        
        # Determine outcome based on match and matchday status
        outcome = "pending"  # pending / correct / wrong / no_prediction / void
        points = 0.0
        
        # Determine final match status for UI FIRST
        final_match_status = m["status"]
        if matchday["status"] == "COMPLETED" and final_match_status in ("scheduled", "live"):
            # If matchday is completed but match still shows scheduled/live, it should be finished
            final_match_status = "finished"
        
        if pred:
            # If prediction has is_correct stored, use it (from admin confirm)
            if pred.get("is_correct") is True:
                outcome = "correct"
                points = pred.get("points", 0)
            elif pred.get("is_correct") is False:
                outcome = "wrong"
                points = 0
            elif final_match_status in ("finished", "void", "postponed", "cancelled"):
                # Match is finished, calculate outcome on the fly
                pts, is_correct = calculate_match_points(
                    pred["prediction_value"],
                    pred.get("market_type", "1X2"),
                    m.get("home_score"),
                    m.get("away_score"),
                    final_match_status
                )
                if is_correct is True:
                    outcome = "correct"
                    points = pts
                elif is_correct is False:
                    outcome = "wrong"
                    points = 0
                else:
                    # calculate_match_points returned None for is_correct
                    # For COMPLETED matchdays, treat as wrong
                    if matchday["status"] == "COMPLETED":
                        outcome = "wrong"
                    else:
                        outcome = "pending"
            else:
                # Match not finished yet
                if matchday["status"] == "COMPLETED":
                    # Matchday completed but no stored result - treat as wrong
                    outcome = "wrong"
                else:
                    outcome = "pending"
            
            # Handle void/postponed/cancelled matches
            if final_match_status in ("void", "postponed", "cancelled"):
                outcome = "void"
                points = 0
        else:
            # No prediction made
            if matchday["status"] == "COMPLETED" or final_match_status in ("finished", "void", "postponed", "cancelled"):
                outcome = "no_prediction"
            else:
                outcome = "no_prediction"
        
        # Only count valid matches towards base points
        if final_match_status not in ("void", "postponed", "cancelled") and outcome == "correct":
            total_base_points += points
        
        predictions_list.append({
            "match_id": m["id"],
            "home_team": m["home_team"],
            "away_team": m["away_team"],
            "competition": m.get("competition", ""),
            "start_time": m["start_time"],
            "home_score": m.get("home_score"),
            "away_score": m.get("away_score"),
            "match_status": final_match_status,
            "market_type": pred.get("market_type") if pred else None,
            "prediction_value": pred.get("prediction_value") if pred else None,
            "outcome": outcome if pred else "no_prediction",
            "points": points,
        })

    # Calculate totals
    total_points = total_base_points * 2 if jolly_active else total_base_points
    joker_bonus = total_base_points if jolly_active else 0

    return {
        "user_id": target_user_id,
        "username": target_user["username"],
        "matchday_id": matchday_id,
        "matchday_number": matchday["number"],
        "matchday_label": matchday.get("label", f"Giornata {matchday['number']}"),
        "matchday_status": matchday["status"],
        "predictions": predictions_list,
        "jolly_active": jolly_active,
        "base_points": total_base_points,
        "joker_bonus": joker_bonus,
        "total_points": total_points,
        "score_summary": score_summary,
    }


# Legacy endpoint - redirect to new one
@standings_router.get("/leagues/{league_id}/matchdays/{matchday_id}/users/{user_id}/predictions")
async def view_user_predictions_legacy(league_id: str, matchday_id: str, user_id: str, user=Depends(get_current_user)):
    """Legacy endpoint - use /api/predictions/user/{user_id}/{matchday_id} instead."""
    return await get_user_predictions_transparency(user_id, matchday_id, league_id, user)


# ========================================
# LIVE ROUTES (con supporto polling 60s)
# ========================================

@live_router.get("/{matchday_id}")
async def get_live_data(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    """
    Live matchday data con supporto polling ogni 60 secondi.
    Include: stato partite, score aggiornati, punti live utente, totale con jolly.
    """
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    # Use _match_source_query for correct data isolation:
    # - manual matchday (has league_id) → filter by that league_id
    # - national matchday (no league_id) → filter to matches without league_id
    matches = await matches_col.find(
        _match_source_query(matchday_id, matchday.get("league_id")),
        {"_id": 0}
    ).to_list(20)

    # Filter predictions by league_id for strict isolation (no fallbacks after migration)
    pred_query: dict = {"user_id": user["id"], "matchday_id": matchday_id}
    if league_id:
        pred_query["league_id"] = league_id
    preds = await predictions_col.find(pred_query, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}
    
    # Get joker for this matchday
    joker = await joker_usages_col.find_one({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0})
    joker_active = joker is not None and joker.get("is_active", False)

    matches_dict = {m["id"]: m for m in matches}

    # Calculate points for all matches
    match_pts = []
    live_matches = []
    
    for m in sorted(matches, key=lambda x: x.get("start_time", "")):
        pred = preds_dict.get(m["id"])
        pts = 0.0
        is_correct = None
        outcome = "pending"
        
        if pred and m.get("home_score") is not None:
            pred_market = pred.get("market_type", m.get("market_type", "1X2"))
            pts, is_correct = calculate_match_points(
                pred["prediction_value"], pred_market,
                m.get("home_score"), m.get("away_score"), m["status"]
            )
            if is_correct is True:
                outcome = "correct"
            elif is_correct is False:
                outcome = "wrong"
        
        match_pts.append((m["id"], pts, is_correct))

        live_matches.append({
            "match_id": m["id"],
            "home_team": m["home_team"],
            "away_team": m["away_team"],
            "competition": m.get("competition", ""),
            "start_time": m["start_time"],
            "home_score": m.get("home_score"),
            "away_score": m.get("away_score"),
            "status": m["status"],  # scheduled / live / finished / postponed / void
            "my_prediction": pred.get("prediction_value") if pred else None,
            "my_market": pred.get("market_type") if pred else None,
            "points": pts,
            "outcome": outcome if pred else "no_prediction",
        })

    # Calculate totals with joker
    totals = calculate_matchday_total(match_pts, joker_active, matches_dict)

    return {
        "matchday_id": matchday_id,
        "matchday_number": matchday["number"],
        "matchday_label": matchday.get("label", f"Giornata {matchday['number']}"),
        "matchday_status": matchday["status"],
        "matches": live_matches,
        "jolly_active": joker_active,
        "base_points": totals["base_points"],
        "joker_bonus": totals["joker_bonus"],
        "total_live_points": totals["total_points"],
        "valid_matches": totals["valid_matches"],
        "void_matches": totals["void_matches"],
        "server_time": server_now().isoformat(),
    }


# Legacy endpoint - keep for compatibility
@live_router.get("/matchday/{matchday_id}")
async def get_live_matchday(matchday_id: str, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}
    
    # Get joker for this matchday (per-matchday logic)
    joker = await joker_usages_col.find_one({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0})
    joker_active = joker is not None and joker.get("is_active", False)

    matches_dict = {m["id"]: m for m in matches}

    # Calculate points for all matches
    match_pts = []
    live_matches = []
    for m in matches:
        pred = preds_dict.get(m["id"])
        pts = 0.0
        is_correct = None
        if pred and m.get("home_score") is not None:
            pred_market = pred.get("market_type", m.get("market_type", "1X2"))
            pts, is_correct = calculate_match_points(
                pred["prediction_value"], pred_market,
                m.get("home_score"), m.get("away_score"), m["status"]
            )
        match_pts.append((m["id"], pts, is_correct))

        live_matches.append(LiveMatchData(
            match_id=m["id"],
            home_team=m["home_team"],
            away_team=m["away_team"],
            competition=m.get("competition", ""),
            home_score=m.get("home_score"),
            away_score=m.get("away_score"),
            status=m["status"],
            my_prediction=pred["prediction_value"] if pred else None,
            points=pts,
            is_joker=False,  # No longer per-match, always False
        ))

    # Calculate totals with joker_active (boolean for matchday)
    totals = calculate_matchday_total(match_pts, joker_active, matches_dict)

    return LiveMatchdayResponse(
        matchday_id=matchday_id,
        matchday_number=matchday["number"],
        status=matchday["status"],
        matches=live_matches,
        total_provisional_points=totals["total_points"],
        joker_applied=joker_active,
    )


# ========================================
# PAYMENT ROUTES (Stripe)
# ========================================
NATIONAL_LEAGUE_PRICE = 20.00  # EUR

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

    metadata = {
        "user_id": user["id"],
        "league_id": req.league_id,
        "type": "national_league_membership",
    }

    checkout_req = CheckoutSessionRequest(
        amount=NATIONAL_LEAGUE_PRICE,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)

    # Create payment transaction record
    await payments_col.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "league_id": req.league_id,
        "session_id": session.session_id,
        "amount": NATIONAL_LEAGUE_PRICE,
        "currency": "eur",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": now_utc(),
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
        await payments_col.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": status.status}}
        )
        # Activate membership
        existing = await memberships_col.find_one({"user_id": payment["user_id"], "league_id": payment["league_id"]})
        if not existing:
            await memberships_col.insert_one({
                "id": new_id(),
                "user_id": payment["user_id"],
                "league_id": payment["league_id"],
                "status": "active",
                "joined_at": now_utc(),
                "payment_id": payment["id"],
            })
    elif status.status == "expired":
        await payments_col.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "expired", "status": "expired"}}
        )

    return {
        "payment_status": status.payment_status,
        "status": status.status,
        "amount": payment["amount"],
        "currency": payment["currency"],
    }


# Stripe webhook
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")

    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)

    try:
        webhook_response = await stripe_checkout.handle_webhook(body, sig)
        logger.info(f"Webhook: {webhook_response.event_type} session={webhook_response.session_id}")

        if webhook_response.payment_status == "paid":
            payment = await payments_col.find_one({"session_id": webhook_response.session_id})
            if payment and payment["payment_status"] != "paid":
                await payments_col.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "status": "complete"}}
                )
                existing = await memberships_col.find_one({
                    "user_id": payment["user_id"], "league_id": payment["league_id"]
                })
                if not existing:
                    await memberships_col.insert_one({
                        "id": new_id(),
                        "user_id": payment["user_id"],
                        "league_id": payment["league_id"],
                        "status": "active",
                        "joined_at": now_utc(),
                        "payment_id": payment["id"],
                    })
                    logger.info(f"Membership activated via webhook for user {payment['user_id']}")

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return JSONResponse({"error": str(e)}, status_code=400)


# ========================================
# ADMIN ROUTES
# ========================================
@admin_router.get("/seasons")
async def admin_list_seasons(admin=Depends(require_admin)):
    return await seasons_col.find({}, {"_id": 0}).to_list(100)


@admin_router.post("/seasons")
async def admin_create_season(req: SeasonCreate, admin=Depends(require_admin)):
    season_id = new_id()
    season = {
        "id": season_id,
        "name": req.name,
        "year": req.year,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "is_active": req.is_active,
        "created_at": now_utc(),
    }
    await seasons_col.insert_one(season)
    await log_audit(admin["id"], admin["username"], "CREATE", "season", season_id, {"name": req.name})
    season.pop("_id", None)
    return season


@admin_router.put("/seasons/{season_id}")
async def admin_update_season(season_id: str, req: AdminSeasonUpdate, admin=Depends(require_admin)):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates provided")
    await seasons_col.update_one({"id": season_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "season", season_id, updates)
    return await seasons_col.find_one({"id": season_id}, {"_id": 0})


# A) ADMIN: Set current matchday for /home
@admin_router.put("/seasons/{season_id}/current-matchday")
async def admin_set_current_matchday(season_id: str, matchday_id: str, admin=Depends(require_admin)):
    """
    Imposta la giornata corrente che sarà mostrata in /home.
    Usare questo per forzare quale giornata vedere indipendentemente dallo status.
    """
    season = await seasons_col.find_one({"id": season_id})
    if not season:
        raise HTTPException(404, "Season not found")
    
    matchday = await matchdays_col.find_one({"id": matchday_id, "season_id": season_id})
    if not matchday:
        raise HTTPException(404, "Matchday not found in this season")
    # Only national matchdays (league_id == NATIONAL_LEAGUE_ID) can be the season current matchday
    if matchday.get("league_id") != NATIONAL_LEAGUE_ID:
        raise HTTPException(400, "Solo le giornate della Lega Nazionale possono essere impostate come giornata corrente della stagione.")
    
    await seasons_col.update_one(
        {"id": season_id}, 
        {"$set": {"current_matchday_id": matchday_id}}
    )
    await log_audit(admin["id"], admin["username"], "SET_CURRENT_MATCHDAY", "season", season_id, 
        {"matchday_id": matchday_id, "matchday_number": matchday["number"]})
    
    return {
        "status": "success",
        "season_id": season_id,
        "current_matchday_id": matchday_id,
        "matchday_number": matchday["number"],
        "matchday_label": matchday.get("label", f"Giornata {matchday['number']}"),
    }


@admin_router.get("/matchdays")
async def admin_list_matchdays(season_id: str = None, admin=Depends(require_admin)):
    # Admin console manages ONLY the national league — never show matchdays from private/manual leagues
    query: dict = {"league_id": NATIONAL_LEAGUE_ID}
    if season_id:
        query["season_id"] = season_id
    return await matchdays_col.find(query, {"_id": 0}).sort("number", 1).to_list(100)


@admin_router.post("/matchdays")
async def admin_create_matchday(req: MatchdayCreate, admin=Depends(require_admin)):
    md_id = new_id()
    md = {
        "id": md_id,
        "season_id": req.season_id,
        "number": req.number,
        "label": req.label or f"Giornata {req.number}",
        "half": req.half,
        "first_kickoff": req.first_kickoff,
        "status": req.status,
        "league_id": NATIONAL_LEAGUE_ID,   # Admin console manages only national league
        "created_at": now_utc(),
    }
    await matchdays_col.insert_one(md)
    await log_audit(admin["id"], admin["username"], "CREATE", "matchday", md_id, {"number": req.number})
    md.pop("_id", None)
    return md


@admin_router.put("/matchdays/{matchday_id}")
async def admin_update_matchday(matchday_id: str, req: AdminMatchdayUpdate, admin=Depends(require_admin)):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates")
    
    # REGOLA: Una sola giornata OPEN per stagione
    # Quando si setta OPEN, tutte le altre della stessa stagione diventano LOCKED
    if updates.get("status") == "OPEN":
        matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            season_id = matchday["season_id"]
            # Lock tutte le altre giornate OPEN della stessa stagione
            result = await matchdays_col.update_many(
                {"season_id": season_id, "id": {"$ne": matchday_id}, "status": "OPEN"},
                {"$set": {"status": "LOCKED"}}
            )
            if result.modified_count > 0:
                await log_audit(admin["id"], admin["username"], "AUTO_LOCK", "matchday", season_id, 
                    {"locked_count": result.modified_count, "reason": f"New OPEN matchday {matchday_id}"})
    
    await matchdays_col.update_one({"id": matchday_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "matchday", matchday_id, updates)
    
    # AUTO-CALCULATE SCORES: Quando status diventa COMPLETED, calcola tutti i punteggi
    if updates.get("status") == "COMPLETED":
        logger.info(f"[ADMIN] Matchday {matchday_id} set to COMPLETED - calculating scores...")
        await _calculate_matchday_scores(matchday_id, admin)
    
    return await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})


async def _calculate_matchday_scores(matchday_id: str, admin: dict):
    """Helper function to calculate and store scores for all users with predictions."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0, "league_id": 1})
    md_league_id = matchday.get("league_id") if matchday else NATIONAL_LEAGUE_ID
    matches = await matches_col.find(_match_source_query(matchday_id, md_league_id), {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    # Get all predictions for this matchday (all leagues that played it)
    all_preds = await predictions_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(10000)

    # Group by user
    user_preds = {}
    for p in all_preds:
        user_preds.setdefault(p["user_id"], []).append(p)

    # Calculate scores for each user (idempotent - delete old scores first)
    await score_summaries_col.delete_many({"matchday_id": matchday_id})

    for uid, preds in user_preds.items():
        # Check if joker is active for this matchday
        joker = await joker_usages_col.find_one({"user_id": uid, "matchday_id": matchday_id}, {"_id": 0})
        joker_active = joker is not None and joker.get("is_active", False)

        match_pts = []
        for p in preds:
            m = matches_dict.get(p["match_id"])
            if not m:
                continue
            # Use prediction's market_type (user's choice)
            pred_market = p.get("market_type", m.get("market_type", "1X2"))
            pts, is_correct = calculate_match_points(
                p["prediction_value"], pred_market,
                m.get("home_score"), m.get("away_score"), m["status"]
            )
            match_pts.append((m["id"], pts, is_correct))

            # Update individual prediction
            await predictions_col.update_one(
                {"id": p["id"]},
                {"$set": {"points": pts, "is_correct": is_correct}}
            )

        # Calculate totals with joker_active (boolean for matchday x2)
        totals = calculate_matchday_total(match_pts, joker_active, matches_dict)

        await score_summaries_col.insert_one({
            "id": new_id(),
            "user_id": uid,
            "matchday_id": matchday_id,
            "base_points": totals["base_points"],
            "joker_bonus": totals["joker_bonus"],
            "total_points": totals["total_points"],
            "valid_matches": totals["valid_matches"],
            "void_matches": totals["void_matches"],
            "joker_active": joker_active,
            "created_at": now_utc(),
        })

    logger.info(f"[ADMIN] Scores calculated for {len(user_preds)} users in matchday {matchday_id}")


@admin_router.delete("/matchdays/{matchday_id}")
async def admin_delete_matchday(matchday_id: str, admin=Depends(require_admin)):
    """Elimina una giornata e tutti i dati associati (partite, pronostici, score_summaries, joker)."""
    matchday = await matchdays_col.find_one({"id": matchday_id})
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    
    # Delete associated data
    deleted_matches = await matches_col.delete_many({"matchday_id": matchday_id})
    deleted_predictions = await predictions_col.delete_many({"matchday_id": matchday_id})
    deleted_scores = await score_summaries_col.delete_many({"matchday_id": matchday_id})
    deleted_jokers = await joker_usages_col.delete_many({"matchday_id": matchday_id})
    
    # Delete matchday
    await matchdays_col.delete_one({"id": matchday_id})
    
    await log_audit(admin["id"], admin["username"], "DELETE", "matchday", matchday_id, {
        "deleted_matches": deleted_matches.deleted_count,
        "deleted_predictions": deleted_predictions.deleted_count,
        "deleted_scores": deleted_scores.deleted_count,
        "deleted_jokers": deleted_jokers.deleted_count,
    })
    
    return {
        "status": "deleted",
        "matchday_id": matchday_id,
        "deleted_matches": deleted_matches.deleted_count,
        "deleted_predictions": deleted_predictions.deleted_count,
    }


@admin_router.get("/matches")
async def admin_list_matches(matchday_id: str = None, admin=Depends(require_admin)):
    query = {}
    if matchday_id:
        query["matchday_id"] = matchday_id
    return await matches_col.find(query, {"_id": 0}).to_list(100)


@admin_router.post("/matches")
async def admin_create_match(req: MatchCreate, admin=Depends(require_admin)):
    # Lookup the matchday to inherit its league_id
    matchday = await matchdays_col.find_one({"id": req.matchday_id}, {"_id": 0, "league_id": 1})
    match_league_id = matchday.get("league_id", NATIONAL_LEAGUE_ID) if matchday else NATIONAL_LEAGUE_ID

    # Validate max matches
    current_count = await matches_col.count_documents({"matchday_id": req.matchday_id, "league_id": match_league_id})
    if current_count >= MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Limite massimo di {MAX_MATCHES_PER_MATCHDAY} partite per giornata raggiunto")

    match_id = new_id()
    match = {
        "id": match_id,
        "matchday_id": req.matchday_id,
        "league_id": match_league_id,   # inherit from matchday (national or custom)
        "home_team": req.home_team,
        "away_team": req.away_team,
        "competition": req.competition,
        "start_time": req.start_time,
        "market_type": req.market_type,
        "status": req.status,
        "home_score": None,
        "away_score": None,
        "created_at": now_utc(),
    }
    await matches_col.insert_one(match)
    await log_audit(admin["id"], admin["username"], "CREATE", "match", match_id, {"teams": f"{req.home_team} vs {req.away_team}"})
    match.pop("_id", None)
    return match


@admin_router.put("/matches/{match_id}")
async def admin_update_match(match_id: str, req: MatchUpdate, admin=Depends(require_admin)):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates")
    await matches_col.update_one({"id": match_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "match", match_id, updates)
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@admin_router.delete("/matches/{match_id}")
async def admin_delete_match(match_id: str, admin=Depends(require_admin)):
    """Elimina una partita e tutti i pronostici associati."""
    match = await matches_col.find_one({"id": match_id})
    if not match:
        raise HTTPException(404, "Match not found")
    
    # Delete predictions for this match
    deleted_predictions = await predictions_col.delete_many({"match_id": match_id})
    
    # Delete match
    await matches_col.delete_one({"id": match_id})
    
    await log_audit(admin["id"], admin["username"], "DELETE", "match", match_id, {
        "teams": f"{match.get('home_team')} vs {match.get('away_team')}",
        "deleted_predictions": deleted_predictions.deleted_count,
    })
    
    return {
        "status": "deleted",
        "match_id": match_id,
        "deleted_predictions": deleted_predictions.deleted_count,
    }


@admin_router.post("/matches/{match_id}/live-update")
async def admin_live_update(match_id: str, req: LiveUpdateRequest, admin=Depends(require_admin)):
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Match not found")

    updates = {
        "home_score": req.home_score,
        "away_score": req.away_score,
        "status": req.status,
    }
    await matches_col.update_one({"id": match_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "LIVE_UPDATE", "match", match_id, updates)
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@admin_router.post("/matchdays/{matchday_id}/confirm")
async def admin_confirm_matchday(matchday_id: str, admin=Depends(require_admin)):
    """Confirm matchday as COMPLETED and calculate final scores (idempotent)."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    # Get all predictions for this matchday
    all_preds = await predictions_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(10000)

    # Group by user
    user_preds = {}
    for p in all_preds:
        user_preds.setdefault(p["user_id"], []).append(p)

    # Calculate scores for each user (idempotent - delete old scores first)
    await score_summaries_col.delete_many({"matchday_id": matchday_id})

    for uid, preds in user_preds.items():
        # Check if joker is active for this matchday (per-matchday, not per-match)
        joker = await joker_usages_col.find_one({"user_id": uid, "matchday_id": matchday_id}, {"_id": 0})
        joker_active = joker is not None and joker.get("is_active", False)

        match_pts = []
        for p in preds:
            m = matches_dict.get(p["match_id"])
            if not m:
                continue
            # Use prediction's market_type (user's choice)
            pred_market = p.get("market_type", m.get("market_type", "1X2"))
            pts, is_correct = calculate_match_points(
                p["prediction_value"], pred_market,
                m.get("home_score"), m.get("away_score"), m["status"]
            )
            match_pts.append((m["id"], pts, is_correct))

            # Update individual prediction
            await predictions_col.update_one(
                {"id": p["id"]},
                {"$set": {"points": pts, "is_correct": is_correct}}
            )

        # Calculate totals with joker_active (boolean for matchday x2)
        totals = calculate_matchday_total(match_pts, joker_active, matches_dict)

        await score_summaries_col.insert_one({
            "id": new_id(),
            "user_id": uid,
            "matchday_id": matchday_id,
            "base_points": totals["base_points"],
            "joker_bonus": totals["joker_bonus"],
            "total_points": totals["total_points"],
            "valid_matches": totals["valid_matches"],
            "void_matches": totals["void_matches"],
            "joker_active": joker_active,
            "created_at": now_utc(),
        })

    # Update matchday status
    await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status": "COMPLETED"}})
    await log_audit(admin["id"], admin["username"], "CONFIRM", "matchday", matchday_id, {"users_scored": len(user_preds)})

    return {"message": "Matchday confirmed", "users_scored": len(user_preds)}


@admin_router.post("/matchdays/{matchday_id}/recalc")
async def admin_recalc_standings(matchday_id: str, admin=Depends(require_admin)):
    """Idempotent recalculation of matchday scores."""
    return await admin_confirm_matchday(matchday_id, admin)


# ========================================
# ADMIN V3 – UNIFIED CONSOLE ENDPOINTS
# ========================================

VALID_TRANSITIONS = {
    "DRAFT": ["OPEN"],
    "OPEN": ["LOCKED"],
    "LOCKED": ["LIVE"],
    "LIVE": ["COMPLETED"],
    "COMPLETED": [],
}

STATUS_ORDER = ["DRAFT", "OPEN", "LOCKED", "LIVE", "COMPLETED"]


@admin_router.get("/v3/leagues")
async def admin_v3_leagues(user=Depends(get_current_user)):
    """Ritorna le leghe gestibili dall'utente per la console Admin v3.
    SUPER_ADMIN (role=admin): tutte le leghe + Lega Nazionale.
    LEAGUE_ADMIN: solo le leghe di cui è owner.
    """
    is_super = user.get("role") in ("admin", "superadmin")
    results = []

    # Lega Nazionale (solo per SUPER_ADMIN)
    if is_super:
        nat = await leagues_col.find_one({"id": NATIONAL_LEAGUE_ID}, {"_id": 0})
        if nat:
            nat["_is_national"] = True
            results.append(nat)

    # Leghe private
    if is_super:
        privates = await leagues_col.find({"id": {"$ne": NATIONAL_LEAGUE_ID}}, {"_id": 0}).to_list(200)
    else:
        owned_ids = await memberships_col.find(
            {"user_id": user["id"], "role": {"$in": ["owner", "admin"]}, "status": "active"},
            {"league_id": 1, "_id": 0}
        ).to_list(100)
        league_ids = [m["league_id"] for m in owned_ids]
        privates = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0}).to_list(100) if league_ids else []

    for lg in privates:
        lg["_is_national"] = False
        source = lg.get("match_source_type", "")
        lg["_can_manage_matches"] = source in ("manual", "custom") or is_super
        lg["member_count"] = await memberships_col.count_documents({"league_id": lg["id"], "status": "active"})
        results.append(lg)

    # Per non-super admin, filtra le leghe senza gestione partite
    if not is_super:
        results = [lg for lg in results if lg.get("_can_manage_matches", False)]

    return results


@admin_router.get("/v3/matchdays")
async def admin_v3_matchdays(league_id: str, season_id: str = None, user=Depends(get_current_user)):
    """Ritorna le giornate arricchite (conteggio partite, risultati, pronostici) per una lega."""
    is_super = user.get("role") in ("admin", "superadmin")

    # Verifica permessi
    if not is_super:
        mem = await memberships_col.find_one(
            {"user_id": user["id"], "league_id": league_id, "role": {"$in": ["owner", "admin"]}, "status": "active"}
        )
        if not mem:
            raise HTTPException(403, "Non hai i permessi per gestire questa lega")

    query: dict = {"league_id": league_id}
    if season_id:
        query["season_id"] = season_id
    matchdays = await matchdays_col.find(query, {"_id": 0}).sort("number", 1).to_list(100)

    for md in matchdays:
        md_id = md["id"]
        # Conteggio partite
        match_count = await matches_col.count_documents({"matchday_id": md_id, "league_id": league_id})
        md["match_count"] = match_count

        # Partite con risultato inserito
        results_count = await matches_col.count_documents({
            "matchday_id": md_id, "league_id": league_id,
            "home_score": {"$ne": None}, "away_score": {"$ne": None}
        })
        md["results_count"] = results_count

        # Pronostici ricevuti (utenti unici)
        pred_users = await predictions_col.distinct("user_id", {"matchday_id": md_id, "league_id": league_id})
        md["predictions_user_count"] = len(pred_users)

        # Auto-lock check: se server time >= first_kickoff e status è OPEN
        if md.get("status") == "OPEN" and md.get("first_kickoff"):
            try:
                kickoff = datetime.fromisoformat(md["first_kickoff"].replace("Z", "+00:00"))
                if server_now() >= kickoff:
                    await matchdays_col.update_one({"id": md_id}, {"$set": {"status": "LOCKED"}})
                    md["status"] = "LOCKED"
                    logger.info(f"[AUTO-LOCK] Matchday {md_id} auto-locked (kickoff passed)")
            except Exception:
                pass

    return matchdays


@admin_router.post("/matchday/{matchday_id}/transition")
async def admin_v3_transition(matchday_id: str, body: dict, user=Depends(get_current_user)):
    """Endpoint unificato per transizioni di stato giornata.
    Body: {"league_id": "...", "target_status": "OPEN"|"LOCKED"|"LIVE"|"COMPLETED"}
    Regole:
    - Valida stato corrente
    - Impedisce salto di stati
    - Impedisce ritorno indietro
    - Valida permessi ruolo
    - Valida conteggio partite
    - Su COMPLETED → calcola punteggi
    """
    league_id = body.get("league_id")
    target_status = body.get("target_status")
    if not league_id or not target_status:
        raise HTTPException(400, "league_id e target_status sono obbligatori")

    if target_status not in STATUS_ORDER:
        raise HTTPException(400, f"target_status non valido: {target_status}")

    is_super = user.get("role") in ("admin", "superadmin")

    # Verifica permessi sulla lega
    if not is_super:
        mem = await memberships_col.find_one(
            {"user_id": user["id"], "league_id": league_id, "role": {"$in": ["owner", "admin"]}, "status": "active"}
        )
        if not mem:
            raise HTTPException(403, "Non hai i permessi per gestire questa lega")

    # Get matchday
    matchday = await matchdays_col.find_one({"id": matchday_id, "league_id": league_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Giornata non trovata per questa lega")

    current_status = matchday.get("status", "DRAFT")

    # Validazione: non si può modificare COMPLETED (tranne recalc per SUPER_ADMIN)
    if current_status == "COMPLETED":
        raise HTTPException(400, "La giornata è già completata. Non è possibile cambiare stato.")

    # Validazione: transizione valida (no salto, no indietro)
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise HTTPException(400, f"Transizione non permessa: {current_status} → {target_status}. Transizioni valide: {', '.join(allowed) if allowed else 'nessuna'}")

    # Conteggio partite
    match_count = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": league_id})

    # DRAFT → OPEN: servono almeno 1 partita
    if target_status == "OPEN":
        if match_count < 1:
            raise HTTPException(400, "Impossibile aprire la giornata: inserisci almeno 1 partita")
        if match_count > 10:
            raise HTTPException(400, f"La giornata ha {match_count} partite. Il massimo consentito è 10.")

    # LIVE → COMPLETED: tutti i risultati devono essere inseriti
    if target_status == "COMPLETED":
        if match_count < 1:
            raise HTTPException(400, "Impossibile completare: la giornata non ha partite")
        results_count = await matches_col.count_documents({
            "matchday_id": matchday_id, "league_id": league_id,
            "home_score": {"$ne": None}, "away_score": {"$ne": None}
        })
        if results_count < match_count:
            raise HTTPException(400, f"Impossibile completare: risultati inseriti {results_count}/{match_count}. Inserisci tutti i risultati prima di completare.")

    # OPEN: auto-lock altre giornate OPEN + aggiorna current_matchday_id della stagione
    if target_status == "OPEN":
        season_id = matchday.get("season_id")
        if season_id:
            await matchdays_col.update_many(
                {"season_id": season_id, "league_id": league_id, "id": {"$ne": matchday_id}, "status": "OPEN"},
                {"$set": {"status": "LOCKED"}}
            )
            # Aggiorna current_matchday_id nella stagione
            await seasons_col.update_one(
                {"id": season_id},
                {"$set": {"current_matchday_id": matchday_id}}
            )
            logger.info(f"[ADMIN_V3] Season {season_id} current_matchday_id → {matchday_id}")

    # Esegui transizione
    await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status": target_status}})

    # Log
    admin_username = user.get("username", user.get("email", "unknown"))
    await log_audit(user["id"], admin_username, "TRANSITION", "matchday", matchday_id,
        {"from": current_status, "to": target_status, "league_id": league_id})

    # Su COMPLETED → calcola punteggi
    if target_status == "COMPLETED":
        logger.info(f"[ADMIN_V3] Matchday {matchday_id} COMPLETED - calculating scores for league {league_id}")
        await recalculate_matchday_scores(matchday_id, league_id)

    return {
        "status": "ok",
        "matchday_id": matchday_id,
        "previous_status": current_status,
        "new_status": target_status,
        "league_id": league_id,
    }


@admin_router.post("/matchday/{matchday_id}/recalculate")
async def admin_v3_recalculate(matchday_id: str, body: dict, user=Depends(get_current_user)):
    """Ricalcola punteggi per una giornata COMPLETED. Solo SUPER_ADMIN."""
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        raise HTTPException(403, "Solo il super admin può ricalcolare i punteggi")

    league_id = body.get("league_id")
    if not league_id:
        raise HTTPException(400, "league_id obbligatorio")

    matchday = await matchdays_col.find_one({"id": matchday_id, "league_id": league_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Giornata non trovata")
    if matchday.get("status") != "COMPLETED":
        raise HTTPException(400, "Il ricalcolo è possibile solo per giornate COMPLETATE")

    await recalculate_matchday_scores(matchday_id, league_id)
    admin_username = user.get("username", user.get("email", "unknown"))
    await log_audit(user["id"], admin_username, "RECALCULATE", "matchday", matchday_id, {"league_id": league_id})

    return {"status": "ok", "message": "Ricalcolo completato", "matchday_id": matchday_id}


@admin_router.get("/audit-logs")
async def admin_get_audit_logs(limit: int = 50, admin=Depends(require_admin)):
    logs = await audit_logs_col.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs


@admin_router.get("/leagues")
async def admin_list_leagues(admin=Depends(require_admin)):
    leagues = await leagues_col.find({}, {"_id": 0}).to_list(100)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@admin_router.get("/payments")
async def admin_list_payments(admin=Depends(require_admin)):
    return await payments_col.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@admin_router.get("/score-summaries/{matchday_id}")
async def admin_score_summaries(matchday_id: str, admin=Depends(require_admin)):
    summaries = await score_summaries_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(1000)
    for s in summaries:
        u = await users_col.find_one({"id": s["user_id"]}, {"_id": 0, "password": 0})
        s["username"] = u["username"] if u else "Unknown"
    return summaries


# ========================================
# REAL FIXTURES (API-Football) ENDPOINTS
# ========================================
from apifootball import APIFootballClient, map_api_status

_apifootball_client: Optional[APIFootballClient] = None

def _get_apifootball() -> APIFootballClient:
    global _apifootball_client
    if _apifootball_client is None:
        key = os.environ.get("APIFOOTBALL_API_KEY", "")
        if not key:
            raise HTTPException(503, "API-Football key not configured")
        _apifootball_client = APIFootballClient(key)
    return _apifootball_client


@fixtures_router.get("/leagues")
async def real_fixtures_leagues(admin=Depends(require_admin)):
    """Top 5 leagues with current season."""
    try:
        client = _get_apifootball()
        leagues = await client.get_top_leagues()
        return leagues
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@fixtures_router.get("/search")
async def real_fixtures_search(
    league: int = Query(..., description="API-Football league ID"),
    season: int = Query(..., description="Season year, e.g. 2025"),
    date_from: Optional[str] = Query(None, alias="from", description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, alias="to", description="YYYY-MM-DD"),
    admin=Depends(require_admin),
):
    """Search real fixtures from API-Football."""
    try:
        client = _get_apifootball()
        fixtures = await client.search_fixtures(league, season, date_from, date_to)
        return fixtures
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


class ImportFixturesRequest(PydanticBaseModel):
    league_id: str          # Our internal league_id (national)
    matchday_id: str        # Our internal matchday_id
    fixture_ids: List[int]  # API-Football fixture IDs to import
    league_id: str          # Our internal league_id (national)
    matchday_id: str        # Our internal matchday_id
    fixture_ids: List[int]  # API-Football fixture IDs to import


@fixtures_router.post("/import")
async def real_fixtures_import(req: ImportFixturesRequest, admin=Depends(require_admin)):
    """Import real fixtures as matches into our DB (max 10 per matchday)."""
    if len(req.fixture_ids) > MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Massimo {MAX_MATCHES_PER_MATCHDAY} partite per giornata")

    # Verify league and matchday exist
    league = await leagues_col.find_one({"id": req.league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    matchday = await matchdays_col.find_one({"id": req.matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Giornata non trovata")

    # Check existing match count
    existing = await matches_col.count_documents({
        "matchday_id": req.matchday_id, "league_id": req.league_id
    })
    if existing + len(req.fixture_ids) > MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Superato il limite di {MAX_MATCHES_PER_MATCHDAY} partite (già {existing} presenti)")

    # Check for duplicate external_fixture_id
    already_imported = await matches_col.find(
        {"external_fixture_id": {"$in": req.fixture_ids}},
        {"_id": 0, "external_fixture_id": 1}
    ).to_list(100)
    already_set = {m["external_fixture_id"] for m in already_imported}

    client = _get_apifootball()
    imported = []
    skipped = []

    for fid in req.fixture_ids:
        if fid in already_set:
            skipped.append({"fixture_id": fid, "reason": "already_imported"})
            continue

        fx = await client.get_fixture_by_id(fid)
        if not fx:
            skipped.append({"fixture_id": fid, "reason": "not_found"})
            continue

        match_id = new_id()
        match = {
            "id": match_id,
            "matchday_id": req.matchday_id,
            "league_id": req.league_id,
            "home_team": fx["home_team"],
            "away_team": fx["away_team"],
            "home_logo": fx.get("home_logo"),
            "away_logo": fx.get("away_logo"),
            "competition": fx.get("league_name", ""),
            "start_time": fx["date"],
            "market_type": "1X2",
            "status": map_api_status(fx.get("status_short", "NS")),
            "home_score": fx.get("home_goals"),
            "away_score": fx.get("away_goals"),
            "external_provider": "api-football",
            "external_fixture_id": fx["fixture_id"],
            "created_at": now_utc(),
        }
        await matches_col.insert_one(match)
        match.pop("_id", None)
        imported.append(match)

    await log_audit(admin["id"], admin["username"], "IMPORT_FIXTURES", "match", req.matchday_id, {
        "imported_count": len(imported),
        "skipped_count": len(skipped),
        "fixture_ids": req.fixture_ids,
    })

    return {
        "imported": len(imported),
        "skipped": len(skipped),
        "matches": imported,
        "skipped_details": skipped,
    }


# ========================================
# LIVE FIXTURES BACKGROUND SCHEDULER
# ========================================
_live_task: Optional[asyncio.Task] = None
LIVE_SYNC_ENABLED = os.environ.get("APIFOOTBALL_LIVE_SYNC_ENABLED", "false").lower() == "true"
LIVE_REFRESH_INTERVAL = int(os.environ.get("APIFOOTBALL_LIVE_INTERVAL", "180"))  # seconds (default 3min)

# Circuit breaker state
_circuit_open_until: float = 0  # timestamp when circuit breaker resets
CIRCUIT_BREAKER_COOLDOWN = 3600  # 60 min pause on 429/403/suspended


async def _live_fixtures_loop():
    """Background loop: update imported matches that are currently live."""
    if not LIVE_SYNC_ENABLED:
        logger.info("[LIVE-REFRESH] Sync disabled (APIFOOTBALL_LIVE_SYNC_ENABLED=false)")
        return
    logger.info(f"[LIVE-REFRESH] Sync enabled, interval={LIVE_REFRESH_INTERVAL}s")
    while True:
        try:
            logger.info(f"[LIVE-REFRESH] Sleeping {LIVE_REFRESH_INTERVAL}s before next check...")
            await asyncio.sleep(LIVE_REFRESH_INTERVAL)
            logger.info("[LIVE-REFRESH] Woke up, checking for live matches...")
            await _refresh_live_fixtures()
        except asyncio.CancelledError:
            logger.info("[LIVE-REFRESH] Task cancelled")
            break
        except Exception as e:
            logger.error(f"[LIVE-REFRESH] Error in loop: {e}", exc_info=True)


async def _refresh_live_fixtures():
    """Fetch live scores from API-Football for imported matches with status 'live' or 'scheduled'."""
    global _circuit_open_until

    # Circuit breaker check
    if time.time() < _circuit_open_until:
        remaining = int(_circuit_open_until - time.time())
        logger.info(f"[LIVE-REFRESH] Circuit breaker open, skipping ({remaining}s remaining)")
        return

    # Find matches that are imported and either live or scheduled (to detect transitions)
    live_matches = await matches_col.find(
        {
            "external_provider": "api-football",
            "external_fixture_id": {"$exists": True},
            "status": {"$in": ["live", "scheduled"]},
        },
        {"_id": 0}
    ).to_list(200)

    if not live_matches:
        return

    client = _get_apifootball()
    updated_count = 0
    finished_matchday_ids = set()

    for m in live_matches:
        fid = m["external_fixture_id"]
        try:
            fx = await client.get_fixture_by_id(fid)
        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "403" in err_msg or "suspended" in err_msg or "rate" in err_msg:
                _circuit_open_until = time.time() + CIRCUIT_BREAKER_COOLDOWN
                logger.warning(f"[LIVE-REFRESH] Circuit breaker OPEN for {CIRCUIT_BREAKER_COOLDOWN}s due to: {e}")
                return
            logger.warning(f"[LIVE-REFRESH] Failed to fetch fixture {fid}: {e}")
            continue

        if not fx:
            continue

        new_status = map_api_status(fx.get("status_short", "NS"))
        updates = {}

        if fx.get("home_goals") is not None:
            updates["home_score"] = fx["home_goals"]
        if fx.get("away_goals") is not None:
            updates["away_score"] = fx["away_goals"]
        if new_status != m["status"]:
            updates["status"] = new_status
        # Save logos if missing
        if fx.get("home_logo") and not m.get("home_logo"):
            updates["home_logo"] = fx["home_logo"]
        if fx.get("away_logo") and not m.get("away_logo"):
            updates["away_logo"] = fx["away_logo"]

        if updates:
            await matches_col.update_one({"id": m["id"]}, {"$set": updates})
            updated_count += 1
            logger.info(f"[LIVE-REFRESH] Updated {m['home_team']} vs {m['away_team']}: {updates}")

            # If match just finished, recalculate predictions
            if new_status == "finished" and m["status"] != "finished":
                await recalculate_match_predictions(m["id"], m["league_id"])
                finished_matchday_ids.add(m["matchday_id"])

    # Check if all matches in a matchday are finished → auto-complete
    for md_id in finished_matchday_ids:
        await _check_auto_complete_matchday(md_id)

    if updated_count > 0:
        logger.info(f"[LIVE-REFRESH] Updated {updated_count} matches")


async def _check_auto_complete_matchday(matchday_id: str):
    """If all imported matches in a matchday are finished, set matchday status to COMPLETED and calculate scores."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday or matchday.get("status") == "COMPLETED":
        return

    all_matches = await matches_col.find(
        {"matchday_id": matchday_id},
        {"_id": 0, "status": 1}
    ).to_list(20)

    if not all_matches:
        return

    # Check: all matches must be finished (or void/postponed)
    terminal_statuses = {"finished", "void", "postponed", "cancelled"}
    all_done = all(m["status"] in terminal_statuses for m in all_matches)

    if all_done:
        logger.info(f"[AUTO-COMPLETE] All matches finished for matchday {matchday_id} — auto-completing")
        await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status": "COMPLETED"}})

        # Create a fake admin dict for score calculation
        system_admin = {"id": "system", "username": "system-auto"}
        await _calculate_matchday_scores(matchday_id, system_admin)

        await audit_logs_col.insert_one({
            "id": new_id(),
            "admin_id": "system",
            "admin_username": "system-auto",
            "action": "AUTO_COMPLETE",
            "entity_type": "matchday",
            "entity_id": matchday_id,
            "details": {"reason": "all_matches_finished_via_api_football"},
            "created_at": now_utc(),
        })


@fixtures_router.post("/refresh-live")
async def real_fixtures_refresh_live(admin=Depends(require_admin)):
    """Manually trigger a live refresh of imported matches."""
    try:
        await _refresh_live_fixtures()
        return {"status": "ok", "message": "Live refresh completato"}
    except Exception as e:
        raise HTTPException(502, f"Errore refresh: {e}")



# ========================================
# SEED ENDPOINT
# ========================================
@app.post("/api/seed")
async def seed_data():
    """Seed demo data for development."""
    from seed import run_seed
    result = await run_seed()
    return result


# ========================================
# INCLUDE ROUTERS
# ========================================
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(league_router)
app.include_router(prediction_router)
app.include_router(standings_router)
app.include_router(live_router)
app.include_router(payment_router)
app.include_router(admin_router)
app.include_router(fixtures_router)


@app.on_event("startup")
async def startup():
    global _live_task
    await create_indexes()
    # Add index for external_fixture_id
    await matches_col.create_index("external_fixture_id", sparse=True)
    # Start live-refresh background task
    _live_task = asyncio.create_task(_live_fixtures_loop())
    logger.info("FantaPronostic API started - indexes created - live refresh started")


@app.on_event("shutdown")
async def shutdown():
    global _live_task, _apifootball_client
    if _live_task:
        _live_task.cancel()
        try:
            await _live_task
        except asyncio.CancelledError:
            pass
    if _apifootball_client:
        await _apifootball_client.close()
    from database import client
    client.close()


@app.get("/api")
async def api_root():
    return {"message": "FantaPronostic API v2.1", "status": "running"}


# ========================================
# ADMIN WEB DASHBOARD
# ========================================
@app.get("/api/admin-ui", response_class=HTMLResponse)
@app.get("/api/admin-ui/{path:path}", response_class=HTMLResponse)
async def admin_dashboard(path: str = ""):
    return get_admin_html()


def get_admin_html():
    return """<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FantaPronostic Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0F172A;color:#F1F5F9;min-height:100vh}
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:#1E293B;padding:40px;border-radius:16px;width:360px}
.login-box h1{color:#F5A623;margin-bottom:24px;font-size:24px}
.login-box input{width:100%;padding:12px;margin-bottom:16px;background:#0F172A;border:1px solid #334155;border-radius:8px;color:#F1F5F9;font-size:14px}
.login-box button{width:100%;padding:12px;background:#F5A623;color:#0F172A;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px}
.login-box button:hover{background:#E09215}
.dashboard{display:flex;min-height:100vh}
.sidebar{width:240px;background:#1E293B;padding:20px;border-right:1px solid #334155}
.sidebar h2{color:#F5A623;font-size:20px;margin-bottom:24px}
.sidebar a{display:block;padding:10px 12px;color:#94A3B8;text-decoration:none;border-radius:8px;margin-bottom:4px;font-size:14px}
.sidebar a:hover,.sidebar a.active{background:#0F172A;color:#F5A623}
.main{flex:1;padding:24px;overflow-y:auto}
.main h2{color:#F5A623;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #334155;font-size:13px}
th{background:#1E293B;color:#F5A623;position:sticky;top:0}
tr:hover{background:rgba(245,166,35,0.05)}
.btn{padding:8px 16px;background:#F5A623;color:#0F172A;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;margin:2px}
.btn:hover{background:#E09215}
.btn-danger{background:#EF4444;color:#fff}
.btn-danger:hover{background:#DC2626}
.btn-sm{padding:4px 10px;font-size:12px}
.form-row{display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.form-row input,.form-row select{padding:8px;background:#0F172A;border:1px solid #334155;border-radius:6px;color:#F1F5F9;font-size:13px;flex:1;min-width:120px}
.card{background:#1E293B;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #334155}
.status-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.status-scheduled{background:#3B82F6;color:#fff}
.status-live{background:#10B981;color:#fff}
.status-finished{background:#6B7280;color:#fff}
.status-void{background:#EF4444;color:#fff}
.status-OPEN{background:#3B82F6;color:#fff}
.status-LOCKED{background:#F59E0B;color:#000}
.status-LIVE{background:#10B981;color:#fff}
.status-COMPLETED{background:#6B7280;color:#fff}
.toast{position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;z-index:1000;font-size:14px;display:none}
.toast.success{background:#10B981}
.toast.error{background:#EF4444}
#app{min-height:100vh}
</style>
</head>
<body>
<div id="app"></div>
<div id="toast" class="toast"></div>
<script>
const API = '/api';
let token = localStorage.getItem('admin_token');
let currentPage = 'seasons';

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}

async function apiCall(url, method='GET', body=null) {
  const opts = {method, headers: {'Content-Type':'application/json'}};
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + url, opts);
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail || r.statusText); }
  return r.json();
}

function renderLogin() {
  document.getElementById('app').innerHTML = `
  <div class="login-wrap"><div class="login-box">
    <h1>FantaPronostic Admin</h1>
    <input id="email" placeholder="Email" type="email">
    <input id="pass" placeholder="Password" type="password">
    <button onclick="doLogin()">Accedi</button>
    <p id="login-err" style="color:#EF4444;margin-top:12px;font-size:13px"></p>
  </div></div>`;
}

async function doLogin() {
  try {
    const res = await apiCall('/auth/login', 'POST', {
      email: document.getElementById('email').value,
      password: document.getElementById('pass').value
    });
    if (res.user.role !== 'admin' && res.user.role !== 'superadmin') {
      document.getElementById('login-err').textContent = 'Accesso solo per admin';
      return;
    }
    token = res.access_token;
    localStorage.setItem('admin_token', token);
    renderDashboard();
  } catch(e) { document.getElementById('login-err').textContent = e.message; }
}

function renderDashboard() {
  document.getElementById('app').innerHTML = `
  <div class="dashboard">
    <div class="sidebar">
      <h2>Admin</h2>
      <a href="#" onclick="navigate('seasons')" id="nav-seasons">Stagioni</a>
      <a href="#" onclick="navigate('matchdays')" id="nav-matchdays">Giornate</a>
      <a href="#" onclick="navigate('matches')" id="nav-matches">Partite</a>
      <a href="#" onclick="navigate('leagues')" id="nav-leagues">Leghe</a>
      <a href="#" onclick="navigate('payments')" id="nav-payments">Pagamenti</a>
      <a href="#" onclick="navigate('audit')" id="nav-audit">Audit Log</a>
      <a href="#" onclick="doLogout()" style="color:#EF4444;margin-top:24px">Logout</a>
    </div>
    <div class="main" id="content"></div>
  </div>`;
  navigate(currentPage);
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
  const nav = document.getElementById('nav-'+page);
  if(nav) nav.classList.add('active');
  window['render_'+page]();
}

function doLogout() { token=null; localStorage.removeItem('admin_token'); renderLogin(); }

// ===== SEASONS =====
async function render_seasons() {
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Stagioni</h2><div id="season-form" class="card"></div><div id="season-list"></div>';
  document.getElementById('season-form').innerHTML = `
    <div class="form-row">
      <input id="s-name" placeholder="Nome stagione">
      <input id="s-year" placeholder="Anno (es. 2024-2025)">
      <input id="s-start" type="date" placeholder="Inizio">
      <input id="s-end" type="date" placeholder="Fine">
      <button class="btn" onclick="createSeason()">Crea</button>
    </div>`;
  const seasons = await apiCall('/admin/seasons');
  let html = '<table><tr><th>Nome</th><th>Anno</th><th>Attiva</th><th>Azioni</th></tr>';
  seasons.forEach(s => {
    html += `<tr><td>${s.name}</td><td>${s.year}</td><td>${s.is_active?'Si':'No'}</td>
    <td><button class="btn btn-sm" onclick="toggleSeason('${s.id}',${!s.is_active})">${s.is_active?'Disattiva':'Attiva'}</button></td></tr>`;
  });
  html += '</table>';
  document.getElementById('season-list').innerHTML = html;
}

async function createSeason() {
  try {
    await apiCall('/admin/seasons', 'POST', {
      name: document.getElementById('s-name').value,
      year: document.getElementById('s-year').value,
      start_date: document.getElementById('s-start').value,
      end_date: document.getElementById('s-end').value,
      is_active: true
    });
    showToast('Stagione creata');
    render_seasons();
  } catch(e) { showToast(e.message, 'error'); }
}

async function toggleSeason(id, active) {
  await apiCall('/admin/seasons/'+id, 'PUT', {is_active: active});
  showToast('Stagione aggiornata');
  render_seasons();
}

// ===== MATCHDAYS =====
async function render_matchdays() {
  const el = document.getElementById('content');
  el.innerHTML = '<h2>Giornate</h2><div id="md-form" class="card"></div><div id="md-list"></div>';
  const seasons = await apiCall('/admin/seasons');
  const opts = seasons.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('md-form').innerHTML = `
    <div class="form-row">
      <select id="md-season">${opts}</select>
      <input id="md-num" type="number" placeholder="Numero" min="1">
      <input id="md-label" placeholder="Etichetta">
      <select id="md-half"><option value="1">Andata</option><option value="2">Ritorno</option></select>
      <input id="md-kickoff" type="datetime-local">
      <button class="btn" onclick="createMatchday()">Crea</button>
    </div>`;
  const mds = await apiCall('/admin/matchdays' + (seasons[0] ? '?season_id='+seasons[0].id : ''));
  let html = '<table><tr><th>#</th><th>Etichetta</th><th>Metà</th><th>Kickoff</th><th>Stato</th><th>Azioni</th></tr>';
  mds.forEach(m => {
    html += `<tr><td>${m.number}</td><td>${m.label||''}</td><td>${m.half==1?'Andata':'Ritorno'}</td>
    <td>${new Date(m.first_kickoff).toLocaleString('it')}</td>
    <td><span class="status-badge status-${m.status}">${m.status}</span></td>
    <td>
      <button class="btn btn-sm" onclick="setMdStatus('${m.id}','OPEN')">OPEN</button>
      <button class="btn btn-sm" onclick="setMdStatus('${m.id}','LOCKED')">LOCK</button>
      <button class="btn btn-sm" onclick="setMdStatus('${m.id}','LIVE')">LIVE</button>
      <button class="btn btn-sm" onclick="confirmMatchday('${m.id}')">CONFIRM</button>
    </td></tr>`;
  });
  html += '</table>';
  document.getElementById('md-list').innerHTML = html;
}

async function createMatchday() {
  try {
    const kickoff = document.getElementById('md-kickoff').value;
    await apiCall('/admin/matchdays', 'POST', {
      season_id: document.getElementById('md-season').value,
      number: parseInt(document.getElementById('md-num').value),
      label: document.getElementById('md-label').value,
      half: parseInt(document.getElementById('md-half').value),
      first_kickoff: new Date(kickoff).toISOString(),
      status: 'OPEN'
    });
    showToast('Giornata creata');
    render_matchdays();
  } catch(e) { showToast(e.message, 'error'); }
}

async function setMdStatus(id, status) {
  await apiCall('/admin/matchdays/'+id, 'PUT', {status});
  showToast('Stato aggiornato: '+status);
  render_matchdays();
}

async function confirmMatchday(id) {
  if(!confirm('Confermare giornata? Verranno calcolati i punteggi.')) return;
  try {
    const r = await apiCall('/admin/matchdays/'+id+'/confirm', 'POST');
    showToast('Giornata confermata: '+r.users_scored+' utenti');
    render_matchdays();
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== MATCHES =====
let selectedMatchday = null;
async function render_matches() {
  const el = document.getElementById('content');
  const mds = await apiCall('/admin/matchdays');
  const opts = mds.map(m => `<option value="${m.id}">G${m.number} - ${m.label||''} (${m.status})</option>`).join('');
  el.innerHTML = `<h2>Partite</h2>
    <div class="card"><div class="form-row">
      <select id="match-md" onchange="loadMatches()">${opts}</select>
    </div></div>
    <div id="match-form" class="card" style="display:none"></div>
    <div id="match-list"></div>`;
  if(mds.length) { selectedMatchday = mds[0].id; loadMatches(); }
}

async function loadMatches() {
  selectedMatchday = document.getElementById('match-md').value;
  const markets = ['1X2','GOAL_NOGOL','OVER_UNDER_25','EXACT_SCORE'];
  document.getElementById('match-form').style.display = 'block';
  document.getElementById('match-form').innerHTML = `
    <div class="form-row">
      <input id="m-home" placeholder="Squadra casa">
      <input id="m-away" placeholder="Squadra ospite">
      <input id="m-comp" placeholder="Competizione">
      <select id="m-market">${markets.map(m=>`<option value="${m}">${m}</option>`).join('')}</select>
      <input id="m-time" type="datetime-local">
      <button class="btn" onclick="createMatch()">Aggiungi</button>
    </div>`;
  const matches = await apiCall('/admin/matches?matchday_id='+selectedMatchday);
  let html = '<table><tr><th>Casa</th><th>Ospite</th><th>Comp</th><th>Mercato</th><th>Orario</th><th>Score</th><th>Stato</th><th>Azioni</th></tr>';
  matches.forEach(m => {
    const score = m.home_score !== null ? `${m.home_score}-${m.away_score}` : '-';
    html += `<tr>
      <td>${m.home_team}</td><td>${m.away_team}</td><td>${m.competition}</td><td>${m.market_type}</td>
      <td>${new Date(m.start_time).toLocaleString('it')}</td>
      <td><strong>${score}</strong></td>
      <td><span class="status-badge status-${m.status}">${m.status}</span></td>
      <td>
        <button class="btn btn-sm" onclick="showLiveUpdate('${m.id}','${m.home_team}','${m.away_team}',${m.home_score||0},${m.away_score||0})">Update</button>
      </td></tr>`;
  });
  html += '</table>';
  html += '<div id="live-update-panel"></div>';
  document.getElementById('match-list').innerHTML = html;
}

async function createMatch() {
  try {
    await apiCall('/admin/matches', 'POST', {
      matchday_id: selectedMatchday,
      home_team: document.getElementById('m-home').value,
      away_team: document.getElementById('m-away').value,
      competition: document.getElementById('m-comp').value,
      market_type: document.getElementById('m-market').value,
      start_time: new Date(document.getElementById('m-time').value).toISOString(),
      status: 'scheduled'
    });
    showToast('Partita aggiunta');
    loadMatches();
  } catch(e) { showToast(e.message, 'error'); }
}

function showLiveUpdate(id, home, away, hs, as) {
  document.getElementById('live-update-panel').innerHTML = `
  <div class="card"><h3 style="color:#F5A623;margin-bottom:12px">${home} vs ${away}</h3>
    <div class="form-row">
      <input id="lu-hs" type="number" value="${hs}" min="0" placeholder="Gol casa" style="width:80px">
      <input id="lu-as" type="number" value="${as}" min="0" placeholder="Gol ospite" style="width:80px">
      <select id="lu-status"><option value="live">Live</option><option value="finished">Finished</option>
        <option value="postponed">Postponed</option><option value="void">Void</option></select>
      <button class="btn" onclick="doLiveUpdate('${id}')">Salva</button>
    </div>
  </div>`;
}

async function doLiveUpdate(id) {
  try {
    await apiCall('/admin/matches/'+id+'/live-update', 'POST', {
      match_id: id,
      home_score: parseInt(document.getElementById('lu-hs').value),
      away_score: parseInt(document.getElementById('lu-as').value),
      status: document.getElementById('lu-status').value
    });
    showToast('Match aggiornato');
    loadMatches();
  } catch(e) { showToast(e.message, 'error'); }
}

// ===== LEAGUES =====
async function render_leagues() {
  const leagues = await apiCall('/admin/leagues');
  let html = '<h2>Leghe</h2><table><tr><th>Nome</th><th>Tipo</th><th>Codice</th><th>Membri</th></tr>';
  leagues.forEach(l => {
    html += `<tr><td>${l.name}</td><td><span class="status-badge status-${l.league_type=='national'?'LIVE':'OPEN'}">${l.league_type}</span></td>
    <td>${l.invite_code||'-'}</td><td>${l.member_count}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('content').innerHTML = html;
}

// ===== PAYMENTS =====
async function render_payments() {
  const payments = await apiCall('/admin/payments');
  let html = '<h2>Pagamenti Stripe</h2><table><tr><th>Data</th><th>Utente</th><th>Importo</th><th>Stato</th><th>Session</th></tr>';
  payments.forEach(p => {
    html += `<tr><td>${new Date(p.created_at).toLocaleString('it')}</td><td>${p.user_id}</td>
    <td>${p.amount} ${p.currency}</td><td><span class="status-badge status-${p.payment_status=='paid'?'finished':'scheduled'}">${p.payment_status}</span></td>
    <td style="font-size:11px">${p.session_id||''}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('content').innerHTML = html;
}

// ===== AUDIT =====
async function render_audit() {
  const logs = await apiCall('/admin/audit-logs?limit=100');
  let html = '<h2>Audit Log</h2><table><tr><th>Data</th><th>Admin</th><th>Azione</th><th>Entità</th><th>Dettagli</th></tr>';
  logs.forEach(l => {
    html += `<tr><td>${new Date(l.created_at).toLocaleString('it')}</td><td>${l.admin_username}</td>
    <td>${l.action}</td><td>${l.entity_type}/${l.entity_id.substring(0,8)}</td>
    <td style="font-size:11px">${JSON.stringify(l.details||{}).substring(0,80)}</td></tr>`;
  });
  html += '</table>';
  document.getElementById('content').innerHTML = html;
}

// Init
if(token) { renderDashboard(); } else { renderLogin(); }
</script>
</body>
</html>"""
