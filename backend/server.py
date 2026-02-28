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
import httpx
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from database import (
    db, create_indexes, users_col, seasons_col, leagues_col,
    memberships_col, payments_col, matchdays_col, matches_col,
    predictions_col, joker_usages_col, champion_picks_col,
    score_summaries_col, standings_cache_col, audit_logs_col,
    notifications_col, push_tokens_col, roles_col
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
    CompleteProfileRequest, ForgotPasswordRequest, PasswordChangeRequest, NewsCreate,
    RoleCreate, RoleUpdate, AssignRolesRequest, SetSuperAdminRequest,
    new_id, now_utc
)
from auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_refresh_token, get_current_user,
    get_optional_user
)
from scoring import calculate_match_points, calculate_matchday_total
from permissions import ALL_PERMISSIONS, DEFAULT_ROLES, require_permission, get_user_permissions

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
stats_router = APIRouter(prefix="/api/stats", tags=["Statistics"])
rbac_router = APIRouter(prefix="/api/rbac", tags=["RBAC"])


# ===== UTILITY =====
def generate_invite_code(length=8):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


async def log_audit(admin_id: str, admin_username: str, action: str, entity_type: str, entity_id: str, details: dict = None, actor_roles: list = None, ip: str = None, before: dict = None, after: dict = None):
    entry = {
        "id": new_id(),
        "admin_id": admin_id,
        "admin_username": admin_username,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "actor_roles": actor_roles or [],
        "ip": ip,
        "before": before,
        "after": after,
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


async def compute_matchday_status(matchday: dict, league_id: str) -> str:
    """
    Compute the effective matchday status based on kickoff times and match results.
    Rules:
      DRAFT  → stays DRAFT (manual publish to OPEN required)
      OPEN   → LIVE when now >= first_kickoff
      LIVE   → COMPLETED when ALL matches are finished (FT/finished)
    status_override (SUPER_ADMIN) takes precedence over auto-computed status.
    """
    override = matchday.get("status_override")
    if override:
        return override

    stored = matchday.get("status", "DRAFT")

    if stored == "DRAFT":
        return "DRAFT"

    if stored == "COMPLETED":
        return "COMPLETED"

    first_kickoff = matchday.get("first_kickoff")
    now = server_now()

    # Parse first_kickoff
    kickoff_dt = None
    if first_kickoff:
        try:
            if isinstance(first_kickoff, str):
                kickoff_dt = datetime.fromisoformat(first_kickoff.replace("Z", "+00:00"))
            elif isinstance(first_kickoff, datetime):
                kickoff_dt = first_kickoff
        except Exception:
            pass

    if stored in ("OPEN", "LOCKED"):
        if kickoff_dt and now >= kickoff_dt:
            # Auto-transition: check if all matches finished
            matches = await matches_col.find(
                {"matchday_id": matchday["id"], "league_id": league_id},
                {"_id": 0, "status": 1}
            ).to_list(50)
            if matches and all(m.get("status", "").lower() in ("finished", "ft") for m in matches):
                # Persist COMPLETED
                await matchdays_col.update_one({"id": matchday["id"]}, {"$set": {"status": "COMPLETED"}})
                return "COMPLETED"
            return "LIVE"
        return "OPEN"

    if stored == "LIVE":
        matches = await matches_col.find(
            {"matchday_id": matchday["id"], "league_id": league_id},
            {"_id": 0, "status": 1}
        ).to_list(50)
        if matches and all(m.get("status", "").lower() in ("finished", "ft") for m in matches):
            await matchdays_col.update_one({"id": matchday["id"]}, {"$set": {"status": "COMPLETED"}})
            return "COMPLETED"
        return "LIVE"

    return stored


async def recompute_matchday_kickoff(matchday_id: str, league_id: str):
    """
    Auto-compute first_kickoff from the earliest match start_time.
    Called whenever matches are added/updated/imported for a matchday.
    """
    matches = await matches_col.find(
        {"matchday_id": matchday_id, "league_id": league_id, "start_time": {"$ne": None}},
        {"_id": 0, "start_time": 1}
    ).to_list(100)
    if not matches:
        return
    times = []
    for m in matches:
        st = m.get("start_time")
        if st:
            try:
                if isinstance(st, str):
                    times.append(datetime.fromisoformat(st.replace("Z", "+00:00")))
                elif isinstance(st, datetime):
                    times.append(st)
            except Exception:
                pass
    if times:
        first = min(times).isoformat()
        await matchdays_col.update_one(
            {"id": matchday_id},
            {"$set": {"first_kickoff": first}}
        )



# B) FUNZIONE CENTRALIZZATA CALCOLO PUNTI GIORNATA
async def compute_matchday_points(user_id: str, matchday_id: str, league_id: str = None) -> dict:
    """
    Calcola i punti di un utente per una giornata.
    Ritorna: {base_points, joker_bonus, total_points, joker_active}
    Usa prima score_summaries se esistono E sono validi, altrimenti calcola al volo.
    IMPORTANTE: league_id DEVE essere passato per isolamento dati tra leghe.
    """
    # Get matchday to check status
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    matchday_completed = matchday and matchday.get("status") == "COMPLETED"
    
    # Controlla se abbiamo già score_summaries (FILTRO OBBLIGATORIO: league_id)
    ss_filter = {"user_id": user_id, "matchday_id": matchday_id}
    if league_id:
        ss_filter["league_id"] = league_id
    score_summary = await score_summaries_col.find_one(
        ss_filter,
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
            "special_bonus": score_summary.get("special_bonus", 0),
            "total_points": score_summary.get("total_points", 0),
            "joker_active": score_summary.get("joker_active", False),
        }
    
    # Calcola al volo
    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    # Predictions are per user+match+league — filter by league_id
    pred_filter = {"user_id": user_id, "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}
    
    # Jolly rimosso — forza sempre inattivo in ingresso
    joker_active = False
    
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
            multiplier = m.get("multiplier", 1.0)
            pts, is_correct = calculate_match_points(
                pred["prediction_value"],
                pred.get("market_type", "1X2"),
                m.get("home_score"),
                m.get("away_score"),
                effective_status,
                multiplier
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
            "finished",
            match.get("multiplier", 1.0)
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
    
    preds = await predictions_col.find({"match_id": {"$in": match_ids}, "league_id": league_id}).to_list(10000)
    
    # 3. Calculate points for each prediction
    user_points = {}  # user_id -> {base_points, matches_correct, matches_total}
    
    for pred in preds:
        match = matches_dict.get(pred.get("match_id"))
        if not match or match.get("home_score") is None:
            continue
        
        multiplier = match.get("multiplier", 1.0)
        pts, is_correct = calculate_match_points(
            pred.get("prediction_value"),
            pred.get("market_type", match.get("market_type", "1X2")),
            match.get("home_score"),
            match.get("away_score"),
            "finished",
            multiplier
        )
        
        # Update prediction
        await predictions_col.update_one(
            {"id": pred["id"]},
            {"$set": {"points": pts, "is_correct": is_correct}}
        )
        
        user_id = pred.get("user_id")
        if user_id not in user_points:
            user_points[user_id] = {"base_points": 0, "matches_correct": 0, "matches_total": 0, "special_bonus": 0}
        
        user_points[user_id]["matches_total"] += 1
        if is_correct:
            user_points[user_id]["base_points"] += pts
            user_points[user_id]["matches_correct"] += 1
            if multiplier > 1.0:
                # Track bonus from special match
                base_market_pts = pts / multiplier
                user_points[user_id]["special_bonus"] += pts - base_market_pts
    
    # 4. Update score_summaries for each user
    for user_id, points_data in user_points.items():
        # Jolly rimosso — forza sempre inattivo in ingresso
        joker_active = False
        
        base_points = points_data["base_points"]
        special_bonus = points_data.get("special_bonus", 0)
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
                    "special_bonus": special_bonus,
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
                "special_bonus": special_bonus,
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
    
    # Upsert standings cache
    await standings_cache_col.update_one(
        {"user_id": user_id, "league_id": league_id, "type": "total"},
        {"$set": {
            "total_points": total_points,
            "correct_matches": total_correct,
            "valid_matches": total_matches,
            "matchdays_played": matchdays_played,
            "updated_at": now_utc(),
        }, "$setOnInsert": {"id": new_id()}},
        upsert=True
    )
    
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
    # Track last login
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
    is_manual_league = active_league and active_league.get("match_source_type") in ("manual", "custom", "api")
    
    if is_manual_league:
        # MANUAL LEAGUE: cerca matchday SOLO della lega manuale
        # Priorità: LIVE > OPEN > ultima giornata
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
            # Fallback: ultima giornata NON in bozza (DRAFT non visibile agli utenti)
            matchday = await matchdays_col.find_one(
                {"league_id": active_league["id"], "status": {"$ne": "DRAFT"}},
                {"_id": 0},
                sort=[("number", -1)]
            )
    else:
        # NATIONAL LEAGUE: usa logica standard dalla stagione
        # Priorità: LIVE > OPEN > current_matchday_id > ultima giornata
        matchday = await matchdays_col.find_one(
            {"season_id": season["id"], "status": "LIVE", "league_id": NATIONAL_LEAGUE_ID},
            {"_id": 0}
        )
        
        if not matchday:
            matchday = await matchdays_col.find_one(
                {"season_id": season["id"], "status": "OPEN", "league_id": NATIONAL_LEAGUE_ID},
                {"_id": 0}
            )
        
        if not matchday and season.get("current_matchday_id"):
            matchday = await matchdays_col.find_one(
                {"id": season["current_matchday_id"], "league_id": NATIONAL_LEAGUE_ID},
                {"_id": 0}
            )
        
        if not matchday:
            # Fallback: ultima giornata NON in bozza (DRAFT non visibile agli utenti)
            matchday = await matchdays_col.find_one(
                {"season_id": season["id"], "league_id": NATIONAL_LEAGUE_ID, "status": {"$ne": "DRAFT"}},
                {"_id": 0},
                sort=[("number", -1)]
            )

    matchday_data = None
    live_data = None

    if matchday:
        # Compute effective status (kickoff-driven auto-transitions)
        _md_source_lid = active_league["id"] if is_manual_league else NATIONAL_LEAGUE_ID
        effective_status = await compute_matchday_status(matchday, _md_source_lid)
        matchday["status"] = effective_status

        now = server_now()
        # Handle None or invalid first_kickoff
        first_kickoff_str = matchday.get("first_kickoff")
        try:
            if first_kickoff_str and len(str(first_kickoff_str)) > 10:
                first_kickoff = datetime.fromisoformat(str(first_kickoff_str).replace("Z", "+00:00"))
            else:
                first_kickoff = now + timedelta(hours=1)
        except (ValueError, TypeError):
            first_kickoff = now + timedelta(hours=1)
        
        # Countdown to first_kickoff (lock_window = 0)
        countdown_seconds = max(0, int((first_kickoff - now).total_seconds())) if effective_status == "OPEN" else 0

        # C) Count only relevant matches using source isolation (dopo migrazione: NATIONAL_LEAGUE_ID esplicito)
        _md_source_lid = active_league["id"] if is_manual_league else NATIONAL_LEAGUE_ID
        match_count = await matches_col.count_documents(_match_source_query(matchday["id"], _md_source_lid))
        total_matches = max(match_count, MATCHES_PER_MATCHDAY)  # Mai mostrare 0/0
        
        # Predictions count — filter by league_id (predictions are per user+match+league)
        my_predictions = await predictions_col.count_documents({"user_id": user["id"], "matchday_id": matchday["id"], "league_id": active_league["id"]})

        # Per matchday COMPLETED: carica punti da score_summaries (con league_id)
        my_points = None
        if matchday["status"] == "COMPLETED":
            ss = await score_summaries_col.find_one(
                {"user_id": user["id"], "matchday_id": matchday["id"], "league_id": active_league["id"]},
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
            # Predictions per user+match+league — filter by league_id
            preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday["id"], "league_id": active_league["id"]}, {"_id": 0}).to_list(20)
            preds_dict = {p["match_id"]: p for p in preds}
            # Jolly rimosso — forza sempre inattivo in ingresso
            joker_active = False

            # Calculate base points for all matches
            base_pts_sum = 0.0
            live_list = []
            for m in live_matches:
                pred = preds_dict.get(m["id"])
                pts = 0.0
                if pred and m.get("home_score") is not None:
                    pts, _ = calculate_match_points(pred["prediction_value"], pred.get("market_type", m.get("market_type", "1X2")), m.get("home_score"), m.get("away_score"), m["status"], multiplier=m.get("multiplier", 1.0))
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

            # ── LIVE RANKING: compute user's provisional position among league members ──
            league_members_live = await memberships_col.find(
                {"league_id": active_league["id"], "status": "active"}, {"_id": 0, "user_id": 1}
            ).to_list(1000)
            member_ids_live = [m["user_id"] for m in league_members_live]

            all_live_preds = await predictions_col.find(
                {"matchday_id": matchday["id"], "league_id": active_league["id"], "user_id": {"$in": member_ids_live}},
                {"_id": 0}
            ).to_list(10000)

            # Group predictions by user
            user_preds_map = {}
            for p in all_live_preds:
                uid = p["user_id"]
                if uid not in user_preds_map:
                    user_preds_map[uid] = {}
                user_preds_map[uid][p["match_id"]] = p

            # Calculate points for each member using live match data
            member_scores = []
            for uid in member_ids_live:
                preds_d = user_preds_map.get(uid, {})
                bp = 0.0
                for lm in live_matches:
                    pred_lm = preds_d.get(lm["id"])
                    if pred_lm and lm.get("home_score") is not None:
                        lm_pts, _ = calculate_match_points(
                            pred_lm["prediction_value"],
                            pred_lm.get("market_type", lm.get("market_type", "1X2")),
                            lm.get("home_score"), lm.get("away_score"),
                            lm["status"], multiplier=lm.get("multiplier", 1.0)
                        )
                        if lm["status"] not in ("void", "postponed", "cancelled"):
                            bp += lm_pts
                member_scores.append((uid, bp))

            member_scores.sort(key=lambda x: -x[1])
            for i, (uid, pts) in enumerate(member_scores):
                if uid == user["id"]:
                    live_data["live_rank"] = i + 1
                    live_data["live_points"] = pts
                    break
            live_data["total_members"] = len(member_ids_live)

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
        is_manual_league = first_league.get("match_source_type") in ("manual", "custom", "api")
        
        if is_manual_league:
            # Lega manuale: matchdays con league_id = questa lega
            completed_matchdays_docs = await matchdays_col.find(
                {"league_id": first_league["id"], "status": "COMPLETED"},
                {"_id": 0, "id": 1, "number": 1}
            ).sort("number", -1).to_list(100)
            logger.info(f"[HOME] last5 league_id={first_league['id']}, source=manual, matchdays_completed={len(completed_matchdays_docs)}")
        else:
            # Lega nazionale/privata nazionale: query matchdays direttamente dal DB
            # Non usare predictions per scoprire matchdays (league_id nelle predictions può differire)
            completed_matchdays_docs = await matchdays_col.find(
                {"league_id": NATIONAL_LEAGUE_ID, "status": "COMPLETED"},
                {"_id": 0, "id": 1, "number": 1}
            ).sort("number", -1).to_list(100)
            logger.info(f"[HOME] last5 league_id={first_league['id']}, source=national, matchdays_completed={len(completed_matchdays_docs)}")
        
        completed_md_ids = [m["id"] for m in completed_matchdays_docs]
        # GIORNATE = number of COMPLETED matchdays in season (same dataset as last_5_performance)
        total_completed_in_season = len(completed_md_ids)

        # Aggregate total points for all members (only COMPLETED matchdays)
        # ALWAYS filter by league_id for strict league isolation
        totals_match = {"user_id": {"$in": league_member_ids}, "matchday_id": {"$in": completed_md_ids}, "league_id": first_league["id"]}

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
            # Conta matchdays con score_summaries per questo utente E questa lega
            user_played_md_ids = await score_summaries_col.distinct(
                "matchday_id",
                {"user_id": user["id"], "matchday_id": {"$in": completed_md_ids}, "league_id": first_league["id"]}
            )
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
            # ALWAYS filter by league_id for strict league isolation
            score_filter = {"user_id": user["id"], "matchday_id": md["id"], "league_id": first_league["id"]}
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


class EmailChangeRequest(PydanticBaseModel):
    new_email: str
    password: str


@user_router.put("/profile/email")
async def change_email(req: EmailChangeRequest, user=Depends(get_current_user)):
    """Cambio email utente con verifica password."""
    new_email = req.new_email.strip().lower()
    password = req.password
    if not new_email or "@" not in new_email:
        raise HTTPException(400, "Email non valida")
    if new_email == user.get("email"):
        raise HTTPException(400, "La nuova email è uguale a quella attuale")
    # Fetch password from DB since get_current_user excludes it
    full_user = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 1})
    stored_password = full_user.get("password", "") if full_user else ""
    if not stored_password:
        raise HTTPException(400, "Questo account non ha una password impostata (utente Google)")
    if not verify_password(password, stored_password):
        raise HTTPException(400, "Password non corretta")
    existing = await users_col.find_one({"email": new_email, "id": {"$ne": user["id"]}})
    if existing:
        raise HTTPException(400, "Questa email è già in uso")
    await users_col.update_one({"id": user["id"]}, {"$set": {"email": new_email}})
    return {"message": "Email aggiornata con successo", "email": new_email}


@user_router.put("/profile/password")
async def change_password(req: PasswordChangeRequest, user=Depends(get_current_user)):
    """Cambio password utente."""
    full_user = await users_col.find_one({"id": user["id"]}, {"_id": 0, "password": 1})
    stored_password = full_user.get("password", "") if full_user else ""
    # Handle users with no password (e.g., Google OAuth users)
    if not stored_password:
        raise HTTPException(400, "Questo account non ha una password impostata (utente Google)")
    if not verify_password(req.current_password, stored_password):
        raise HTTPException(400, "Password attuale non corretta")
    if len(req.new_password) < 6:
        raise HTTPException(400, "La nuova password deve avere almeno 6 caratteri")
    hashed = hash_password(req.new_password)
    await users_col.update_one({"id": user["id"]}, {"$set": {"password": hashed}})
    return {"message": "Password aggiornata con successo"}


@user_router.delete("/profile")
async def delete_account(user=Depends(get_current_user)):
    """Eliminazione account utente."""
    uid = user["id"]
    await memberships_col.delete_many({"user_id": uid})
    await predictions_col.delete_many({"user_id": uid})
    await score_summaries_col.delete_many({"user_id": uid})
    await standings_cache_col.delete_many({"user_id": uid})
    await users_col.delete_one({"id": uid})
    return {"message": "Account eliminato"}


# ── League Members ──
@league_router.get("/{league_id}/members")
async def get_league_members(league_id: str, user=Depends(get_current_user)):
    """Lista partecipanti di una lega."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    if not mem and league.get("league_type") != "national":
        raise HTTPException(403, "Non sei membro di questa lega")
    members = await memberships_col.find({"league_id": league_id, "status": "active"}, {"_id": 0}).to_list(500)
    user_ids = [m["user_id"] for m in members]
    users = await users_col.find({"id": {"$in": user_ids}}, {"_id": 0, "password": 0}).to_list(500)
    user_map = {u["id"]: u for u in users}
    result = []
    for m in members:
        u = user_map.get(m["user_id"], {})
        result.append({
            "user_id": m["user_id"],
            "username": u.get("username", ""),
            "email": u.get("email", ""),
            "role": m.get("role", "player"),
            "joined_at": m.get("created_at", ""),
        })
    result.sort(key=lambda x: (0 if x["role"] in ("owner", "admin") else 1, x["username"].lower()))
    return {"league_id": league_id, "league_name": league.get("name"), "members": result}


# ── News (Announcements) ──
news_router = APIRouter(prefix="/api/news", tags=["News"])

@news_router.get("")
async def get_news(user=Depends(get_current_user)):
    """Lista news/comunicazioni."""
    news = await db["news"].find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return news

@news_router.post("")
async def create_news(req: NewsCreate, user=Depends(get_current_user)):
    """Crea una news (solo super admin)."""
    if user.get("role") != "super_admin":
        raise HTTPException(403, "Solo il super admin può creare news")
    doc = {
        "id": new_id(),
        "title": req.title,
        "body": req.body,
        "author_id": user["id"],
        "author_name": user.get("username", "Admin"),
        "created_at": now_utc(),
    }
    await db["news"].insert_one(doc)
    doc.pop("_id", None)
    # ── Notification: Nuova News per tutti gli utenti ──
    all_users = await users_col.find({}, {"_id": 0, "id": 1}).to_list(5000)
    for u in all_users:
        await create_notification(
            u["id"], "news",
            req.title,
            req.body[:100] + ("..." if len(req.body) > 100 else ""),
            link="/menu/news",
        )
    return doc


# ── Notifications ──
@user_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    """Lista notifiche utente."""
    notifs = await notifications_col.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return notifs


@user_router.get("/notifications/unread-count")
async def get_unread_count(user=Depends(get_current_user)):
    """Conteggio notifiche non lette."""
    count = await notifications_col.count_documents({"user_id": user["id"], "read": False})
    return {"count": count}


@user_router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user=Depends(get_current_user)):
    await notifications_col.update_one(
        {"id": notif_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "OK"}


@user_router.patch("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user)):
    """Segna tutte le notifiche come lette."""
    await notifications_col.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "OK"}


# ── Notification Helper ──
async def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    link: str = "",
):
    """Create an internal notification for a user."""
    doc = {
        "id": new_id(),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "link": link,
        "read": False,
        "created_at": now_utc(),
    }
    await notifications_col.insert_one(doc)
    # Also send push notification if enabled
    await send_expo_push(user_id, title, message, {"type": notif_type, "link": link})


async def create_notification_for_league(
    league_id: str,
    notif_type: str,
    title: str,
    message: str,
    link: str = "",
):
    """Create notification for all active members of a league."""
    members = await memberships_col.find(
        {"league_id": league_id, "status": "active"}, {"user_id": 1, "_id": 0}
    ).to_list(500)
    for m in members:
        await create_notification(m["user_id"], notif_type, title, message, link)


# ── Push Notification System ──
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
PUSH_ENABLED = os.environ.get("PUSH_NOTIFICATIONS_ENABLED", "false").lower() == "true"


class PushTokenRequest(PydanticBaseModel):
    token: str
    device_type: Optional[str] = "unknown"


@user_router.post("/push-token")
async def register_push_token(req: PushTokenRequest, user=Depends(get_current_user)):
    """Register/update an Expo Push Token for the current user."""
    if not req.token or not req.token.startswith("ExponentPushToken["):
        raise HTTPException(400, "Token Expo Push non valido")
    await push_tokens_col.update_one(
        {"user_id": user["id"], "token": req.token},
        {"$set": {
            "user_id": user["id"],
            "token": req.token,
            "device_type": req.device_type,
            "updated_at": now_utc(),
        }},
        upsert=True,
    )
    return {"message": "Push token registrato"}


@user_router.delete("/push-token")
async def unregister_push_token(req: PushTokenRequest, user=Depends(get_current_user)):
    """Remove a push token (e.g. on logout)."""
    await push_tokens_col.delete_one({"user_id": user["id"], "token": req.token})
    return {"message": "Push token rimosso"}


async def send_expo_push(user_id: str, title: str, body: str, data: dict = None):
    """Send a push notification via Expo Push API to all devices of a user."""
    if not PUSH_ENABLED:
        return
    tokens = await push_tokens_col.find(
        {"user_id": user_id}, {"_id": 0, "token": 1}
    ).to_list(10)
    if not tokens:
        return
    messages = [
        {
            "to": t["token"],
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        for t in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                logger.warning(f"[PUSH] Expo API returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"[PUSH] Failed to send push to user {user_id[:8]}: {e}")


# ── Reminder Scheduler (24h and 2h before deadline) ──
_reminder_task = None
REMINDER_CHECK_INTERVAL = 300  # Check every 5 minutes


async def _reminder_scheduler_loop():
    """Background task that checks for upcoming matchday deadlines and sends reminders."""
    if not PUSH_ENABLED:
        logger.info("[REMINDER] Push notifications disabled, scheduler not running")
        return
    logger.info(f"[REMINDER] Scheduler started, checking every {REMINDER_CHECK_INTERVAL}s")
    while True:
        try:
            await asyncio.sleep(REMINDER_CHECK_INTERVAL)
            await _check_and_send_reminders()
        except asyncio.CancelledError:
            logger.info("[REMINDER] Scheduler cancelled")
            return
        except Exception as e:
            logger.error(f"[REMINDER] Error: {e}", exc_info=True)


async def _check_and_send_reminders():
    """Check OPEN matchdays for 24h and 2h reminders."""
    now = datetime.now(timezone.utc)

    # Find all OPEN matchdays with first_kickoff set
    open_matchdays = await matchdays_col.find(
        {"status": "OPEN", "first_kickoff": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "number": 1, "league_id": 1, "first_kickoff": 1, "season_id": 1}
    ).to_list(20)

    for md in open_matchdays:
        fk = md.get("first_kickoff")
        if not fk:
            continue
        try:
            if isinstance(fk, str):
                kickoff_dt = datetime.fromisoformat(fk.replace("Z", "+00:00"))
            elif isinstance(fk, datetime):
                kickoff_dt = fk
            else:
                continue
        except (ValueError, TypeError):
            continue

        time_left = (kickoff_dt - now).total_seconds()
        md_id = md["id"]
        md_num = md.get("number", "?")
        league_id = md.get("league_id")

        # 24h reminder: between 24h and 24h-5min (to avoid sending multiple times)
        if 86100 <= time_left <= 86400:
            already_sent = await notifications_col.find_one({
                "type": "reminder_24h", "link": {"$regex": md_id}
            })
            if not already_sent:
                logger.info(f"[REMINDER] Sending 24h reminder for matchday {md_num}")
                leagues = await _get_leagues_for_matchday(md)
                for lg in leagues:
                    await create_notification_for_league(
                        lg["id"], "reminder_24h",
                        f"24 ore alla chiusura!",
                        f"Mancano 24 ore per inserire i pronostici della Giornata {md_num}.",
                        link=f"/predictions?matchday={md_id}",
                    )

        # 2h reminder: between 2h and 2h-5min, only for users WITHOUT predictions
        if 7200 <= time_left <= 7500:
            already_sent = await notifications_col.find_one({
                "type": "reminder_2h", "link": {"$regex": md_id}
            })
            if not already_sent:
                logger.info(f"[REMINDER] Sending 2h reminder for matchday {md_num}")
                leagues = await _get_leagues_for_matchday(md)
                for lg in leagues:
                    members = await memberships_col.find(
                        {"league_id": lg["id"], "status": "active"}, {"user_id": 1, "_id": 0}
                    ).to_list(500)
                    for m in members:
                        # Check if user has predictions
                        pred_count = await predictions_col.count_documents({
                            "user_id": m["user_id"],
                            "matchday_id": md_id,
                            "league_id": lg["id"],
                        })
                        if pred_count == 0:
                            await create_notification(
                                m["user_id"], "reminder_2h",
                                f"Ultima chance!",
                                f"Hai solo 2 ore per inserire i pronostici della Giornata {md_num}!",
                                link=f"/predictions?matchday={md_id}",
                            )


async def _get_leagues_for_matchday(md: dict) -> list:
    """Get all leagues that use a matchday (national leagues share matchdays)."""
    league_id = md.get("league_id")
    if league_id:
        leagues = await leagues_col.find(
            {"$or": [{"id": league_id}, {"league_type": "national"}]},
            {"_id": 0, "id": 1}
        ).to_list(50)
    else:
        leagues = await leagues_col.find(
            {"league_type": "national"}, {"_id": 0, "id": 1}
        ).to_list(50)
    return leagues


@user_router.patch("/profile/complete")
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

    # ── Notification: Invito ricevuto (notify league owner) ──
    owner_mem = await memberships_col.find_one({"league_id": league["id"], "role": {"$in": ["owner", "admin"]}}, {"user_id": 1, "_id": 0})
    if owner_mem:
        await create_notification(
            owner_mem["user_id"], "member_joined",
            "Nuovo membro!",
            f"{user.get('username', 'Un utente')} si e' unito alla lega {league.get('name', '')}.",
            link="/menu/members",
        )

    return {"message": "Iscrizione completata", "league": league}


@league_router.get("/{league_id}/fixtures")
async def get_league_fixtures(league_id: str, user=Depends(get_current_user)):
    """Partite per una lega — national eredita dalla Nazionale, manual/custom legge le proprie."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    # "manual" e "custom" sono entrambi tipi di lega gestita manualmente
    is_manual_league = league.get("match_source_type") in ("manual", "custom", "api")

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
        # Compute effective matchday status (OPEN→LIVE, LIVE→COMPLETED)
        _source_lid = league_id if is_manual_league else NATIONAL_LEAGUE_ID
        effective_status = await compute_matchday_status(md, _source_lid)
        result.append({**md, "status": effective_status, "matches": matches})

    logger.info("=" * 60)
    return {"league_id": league_id, "source_league_id": source_id, "matchdays": result}


def _require_league_admin(league: dict, user: dict):
    if league.get("owner_id") != user["id"]:
        raise HTTPException(403, "Solo il creatore della lega può gestire le partite")
    if league.get("match_source_type") not in ("manual", "custom", "api"):
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
        "status": req.status or "DRAFT",
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
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        _require_league_admin(league, user)
    
    logger.info(f"[SCORING] Manual recalculation triggered for matchday {matchday_id} in league {league_id}")
    # Use _calculate_matchday_scores which handles cross-league match sources
    # (e.g. private leagues with match_source_type='national')
    await _calculate_matchday_scores(matchday_id, user)
    
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
        if league and league.get("match_source_type") in ("manual", "custom", "api"):
            # Manual/API league: fetch only matches created for this league
            match_query["league_id"] = league_id
    else:
        # Fallback: check if matchday belongs to a manual league
        if matchday.get("league_id"):
            league = await leagues_col.find_one({"id": matchday["league_id"]}, {"_id": 0})
            if league and league.get("match_source_type") in ("manual", "custom", "api"):
                match_query["league_id"] = matchday["league_id"]

    matches = await matches_col.find(match_query, {"_id": 0}).to_list(20)
    # Predictions per user+match+league — filter by league_id
    preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday_id, "league_id": league_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    now = server_now()
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
    }


@prediction_router.post("/{matchday_id}")
async def save_predictions(matchday_id: str, req: PredictionsBatchRequest, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    if matchday["status"] in ("COMPLETED",):
        raise HTTPException(400, "Matchday is completed, cannot modify predictions")

    # league_id associata a queste predictions (per isolamento dati nelle leghe private nazionali)
    # MUST be defined BEFORE being used in existing_preds query
    pred_league_id = req.league_id if req.league_id else None

    # SERVER-SIDE GUARD: Validazione cross-league (moved earlier)
    # Verifica che l'utente appartenga alla lega indicata e che il matchday sia coerente
    if pred_league_id:
        user_membership = await memberships_col.find_one({
            "user_id": user["id"], "league_id": pred_league_id, "status": "active"
        })
        if not user_membership:
            raise HTTPException(403, "Non sei membro di questa lega")
        
        # Per leghe manuali: verifica che il matchday appartenga alla lega
        league_doc = await leagues_col.find_one({"id": pred_league_id}, {"_id": 0})
        if league_doc and league_doc.get("match_source_type") in ("manual", "custom", "api"):
            if matchday.get("league_id") != pred_league_id:
                raise HTTPException(400, "Questa giornata non appartiene alla tua lega")
    else:
        raise HTTPException(400, "league_id è obbligatorio per salvare i pronostici")

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
        # Already saved predictions for this matchday (ISOLAMENTO: filtra per league_id)
        existing_preds = await predictions_col.find(
            {"user_id": user["id"], "matchday_id": matchday_id, "league_id": pred_league_id}, {"_id": 0}
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

        existing = await predictions_col.find_one({"user_id": user["id"], "match_id": p.match_id, "league_id": pred_league_id})
        ts = now_utc()
        if existing:
            # Overwrite: change market + value (only 1 market per match per league)
            update_fields = {
                "market_type": p.market_type,
                "prediction_value": p.prediction_value,
                "updated_at": ts,
            }
            await predictions_col.update_one(
                {"user_id": user["id"], "match_id": p.match_id, "league_id": pred_league_id},
                {"$set": update_fields}
            )
        else:
            doc = {
                "id": new_id(),
                "user_id": user["id"],
                "match_id": p.match_id,
                "matchday_id": matchday_id,
                "league_id": pred_league_id,  # SEMPRE impostare league_id
                "market_type": p.market_type,
                "prediction_value": p.prediction_value,
                "points": None,
                "is_correct": None,
                "locked": False,
                "created_at": ts,
                "updated_at": ts,
            }
            await predictions_col.insert_one(doc)
        saved.append({"match_id": p.match_id, "market_type": p.market_type, "value": p.prediction_value})

    return {"saved_count": len(saved), "saved": saved, "errors": errors}


# C) REGOLA 11 PARTITE: Endpoint per verificare/confermare pronostici completi
@prediction_router.post("/{matchday_id}/confirm")
async def confirm_predictions(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
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
    
    # Count user predictions (ISOLAMENTO: filtra per league_id)
    pred_filter = {"user_id": user["id"], "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    user_predictions = await predictions_col.count_documents(pred_filter)
    
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
    is_national_type = league_doc.get("match_source_type") not in ("manual", "custom", "api")
    if is_national_type:
        # Per leghe nazionali: usa matchdays COMPLETED direttamente (non predictions)
        completed_mds = await matchdays_col.find(
            {"league_id": NATIONAL_LEAGUE_ID, "status": "COMPLETED"},
            {"_id": 0, "id": 1}
        ).to_list(200)
        league_played_md_ids = [m["id"] for m in completed_mds]
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
        # ALWAYS filter by league_id for strict league isolation
        standings_match = {"user_id": {"$in": member_user_ids}, "matchday_id": {"$in": league_played_md_ids}, "league_id": league_id}
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

    # Get current week points for secondary sort (ISOLAMENTO: filtra per league_id)
    current_week_points = {}
    if current_matchday:
        current_scores = await score_summaries_col.find(
            {"matchday_id": current_matchday["id"], "user_id": {"$in": member_user_ids}, "league_id": league_id},
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

    # Compute effective matchday status
    is_manual = league_doc.get("match_source_type") in ("manual", "custom", "api")
    source_lid = league_id if is_manual else NATIONAL_LEAGUE_ID
    effective_status = await compute_matchday_status(matchday, source_lid)
    matchday["status"] = effective_status

    # Pronostici visibili solo da LIVE in poi (non durante OPEN/DRAFT)
    if effective_status in ("DRAFT", "OPEN"):
        return {
            "league_id": league_id,
            "league_name": league_doc["name"],
            "standings_type": "weekly",
            "matchday_id": matchday_id,
            "matchday_number": matchday.get("number"),
            "matchday_label": matchday.get("label"),
            "matchday_status": effective_status,
            "entries": [],
            "my_position": None,
        }
    
    members = await memberships_col.find({"league_id": league_id, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    pred_filter = {
        "matchday_id": matchday_id,
        "user_id": {"$in": member_user_ids},
        "league_id": league_id,
    }

    all_preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(10000)

    # Per leghe nazionali private: includi solo utenti che hanno giocato
    # ECCEZIONE: per giornate LIVE mostra TUTTI i membri (anche con 0 punti)
    if not is_manual and matchday["status"] != "LIVE":
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
        points_data = await compute_matchday_points(uid, matchday_id, league_id=league_id)
        
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
        "matchday_status": matchday["status"],
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
            is_manual = league.get("match_source_type") in ("manual", "custom", "api")
            if is_manual:
                # Lega manuale: matchdays con league_id = questa lega
                matchdays = await matchdays_col.find(
                    {"league_id": league_id},
                    {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}
                ).sort("number", -1).to_list(50)
                return matchdays
            else:
                # Lega nazionale privata: restituisce solo i matchday dove almeno
                # un membro di questa lega ha predictions con league_id = questa lega
                members = await memberships_col.find(
                    {"league_id": league_id, "status": "active"}, {"_id": 0, "user_id": 1}
                ).to_list(1000)
                member_user_ids = [m["user_id"] for m in members]
                
                # Trova matchday_ids con almeno una prediction per questa lega
                played_md_ids = await predictions_col.distinct(
                    "matchday_id",
                    {"user_id": {"$in": member_user_ids}, "league_id": league_id}
                )
                
                # Includi anche matchday OPEN/LIVE nazionali (possono essere LIVE senza predictions)
                season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
                if season:
                    active_national_mds = await matchdays_col.find(
                        {"season_id": season["id"], "league_id": NATIONAL_LEAGUE_ID, "status": {"$in": ["OPEN", "LIVE"]}},
                        {"_id": 0, "id": 1}
                    ).to_list(5)
                    for amd in active_national_mds:
                        if amd["id"] not in played_md_ids:
                            played_md_ids.append(amd["id"])
                
                if not played_md_ids:
                    return []
                
                matchdays = await matchdays_col.find(
                    {"id": {"$in": played_md_ids}, "status": {"$in": ["COMPLETED", "LIVE", "OPEN"]}},
                    {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1, "first_kickoff": 1}
                ).sort("number", -1).to_list(50)
                
                # Compute effective status for OPEN matchdays (may be LIVE dynamically)
                for md in matchdays:
                    if md["status"] == "OPEN":
                        md["status"] = await compute_matchday_status(md, NATIONAL_LEAGUE_ID)
                    md.pop("first_kickoff", None)
                
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

    # Aggregate total points for this user (ISOLAMENTO: filtra per league_id)
    pipeline = [
        {"$match": {"user_id": target_user_id, "league_id": league_id}},
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
                {"user_id": target_user_id, "matchday_id": current_matchday["id"], "league_id": league_id},
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

    # Get all totals for ranking (ISOLAMENTO: filtra per league_id)
    all_totals_pipeline = [
        {"$match": {"user_id": {"$in": member_user_ids}, "league_id": league_id}},
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
        # Get all score summaries for this user in this season (ISOLAMENTO: filtra per league_id)
        user_scores = await score_summaries_col.find(
            {"user_id": target_user_id, "league_id": league_id},
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
    
    # Compute effective status (OPEN may actually be LIVE dynamically)
    effective_status = await compute_matchday_status(matchday, NATIONAL_LEAGUE_ID)
    matchday["status"] = effective_status
    
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

    # Get user predictions — predictions are per user+match+league
    pred_filter = {"user_id": target_user_id, "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    # Get joker status
    joker = await joker_usages_col.find_one({"user_id": target_user_id, "matchday_id": matchday_id}, {"_id": 0})
    jolly_active = joker is not None and joker.get("is_active", False)

    # Get score summary (ISOLAMENTO: filtra per league_id — score_summaries sono per lega)
    ss_filter = {"user_id": target_user_id, "matchday_id": matchday_id}
    if league_id:
        ss_filter["league_id"] = league_id
    score_summary = await score_summaries_col.find_one(
        ss_filter, 
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
            elif final_match_status in ("finished", "void", "postponed", "cancelled", "live"):
                # Match is finished or live with scores — calculate outcome on the fly
                pts, is_correct = calculate_match_points(
                    pred["prediction_value"],
                    pred.get("market_type", "1X2"),
                    m.get("home_score"),
                    m.get("away_score"),
                    final_match_status,
                    multiplier=m.get("multiplier", 1.0),
                )
                if is_correct is True:
                    outcome = "correct"
                    points = pts
                elif is_correct is False:
                    outcome = "wrong"
                    points = 0
                else:
                    if matchday["status"] == "COMPLETED":
                        outcome = "wrong"
                    elif final_match_status == "live":
                        outcome = "pending"
                    else:
                        outcome = "pending"
            else:
                # Match not started yet (scheduled)
                if matchday["status"] == "COMPLETED":
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
        if final_match_status not in ("void", "postponed", "cancelled") and outcome in ("correct",):
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
            "is_special": m.get("is_special", False),
            "multiplier": m.get("multiplier", 1.0),
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

    # Filter predictions: predictions are per user+match+league
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
                m.get("home_score"), m.get("away_score"), m["status"],
                multiplier=m.get("multiplier", 1.0)
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
            "home_logo": m.get("home_logo"),
            "away_logo": m.get("away_logo"),
            "competition": m.get("competition", ""),
            "start_time": m["start_time"],
            "home_score": m.get("home_score"),
            "away_score": m.get("away_score"),
            "elapsed": m.get("elapsed"),
            "status": m["status"],  # scheduled / live / finished / postponed / void
            "my_prediction": pred.get("prediction_value") if pred else None,
            "my_market": pred.get("market_type") if pred else None,
            "points": pts,
            "outcome": outcome if pred else "no_prediction",
            "is_special": m.get("is_special", False),
            "multiplier": m.get("multiplier", 1.0),
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
async def get_live_matchday(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    # Use _match_source_query for league isolation
    source_lid = matchday.get("league_id") or NATIONAL_LEAGUE_ID
    matches = await matches_col.find(_match_source_query(matchday_id, source_lid), {"_id": 0}).to_list(20)
    # ISOLAMENTO: filtra predictions per league_id (predictions per user+match+league)
    pred_filter = {"user_id": user["id"], "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(20)
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
                m.get("home_score"), m.get("away_score"), m["status"],
                multiplier=m.get("multiplier", 1.0)
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
async def admin_list_seasons(admin=Depends(require_permission("admin.seasons.manage"))):
    return await seasons_col.find({}, {"_id": 0}).to_list(100)


@admin_router.post("/seasons")
async def admin_create_season(req: SeasonCreate, admin=Depends(require_permission("admin.seasons.manage"))):
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
async def admin_update_season(season_id: str, req: AdminSeasonUpdate, admin=Depends(require_permission("admin.seasons.manage"))):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates provided")
    await seasons_col.update_one({"id": season_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "season", season_id, updates)
    return await seasons_col.find_one({"id": season_id}, {"_id": 0})


# A) ADMIN: Set current matchday for /home
@admin_router.put("/seasons/{season_id}/current-matchday")
async def admin_set_current_matchday(season_id: str, matchday_id: str, admin=Depends(require_permission("admin.seasons.manage"))):
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
async def admin_list_matchdays(season_id: str = None, admin=Depends(require_permission("admin.matchdays.manage"))):
    # Admin console manages ONLY the national league — never show matchdays from private/manual leagues
    query: dict = {"league_id": NATIONAL_LEAGUE_ID}
    if season_id:
        query["season_id"] = season_id
    return await matchdays_col.find(query, {"_id": 0}).sort("number", 1).to_list(100)


@admin_router.post("/matchdays")
async def admin_create_matchday(req: MatchdayCreate, admin=Depends(require_permission("admin.matchdays.manage"))):
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
async def admin_update_matchday(matchday_id: str, req: AdminMatchdayUpdate, admin=Depends(require_permission("admin.matchdays.manage"))):
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
    
    # ── Notification: Matchday OPEN ──
    if updates.get("status") == "OPEN":
        matchday = matchday or await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            md_num = matchday.get("number", "?")
            league_id_for_notif = matchday.get("league_id", NATIONAL_LEAGUE_ID)
            leagues_using = await leagues_col.find({"$or": [{"id": league_id_for_notif}, {"league_type": "national"}]}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
            for lg in leagues_using:
                await create_notification_for_league(
                    lg["id"], "matchday_open",
                    f"Giornata {md_num} aperta!",
                    f"I pronostici per la Giornata {md_num} sono ora aperti. Inserisci i tuoi pronostici!",
                    link=f"/predictions?matchday={matchday_id}",
                )

    # AUTO-CALCULATE SCORES: Quando status diventa COMPLETED, calcola tutti i punteggi
    if updates.get("status") == "COMPLETED":
        logger.info(f"[ADMIN] Matchday {matchday_id} set to COMPLETED - calculating scores...")
        await _calculate_matchday_scores(matchday_id, admin)
        # ── Notification: Classifica aggiornata ──
        matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            md_num = matchday.get("number", "?")
            league_id_for_notif = matchday.get("league_id", NATIONAL_LEAGUE_ID)
            leagues_using = await leagues_col.find({"$or": [{"id": league_id_for_notif}, {"league_type": "national"}]}, {"_id": 0, "id": 1}).to_list(50)
            for lg in leagues_using:
                await create_notification_for_league(
                    lg["id"], "standings_updated",
                    f"Classifica aggiornata!",
                    f"I risultati della Giornata {md_num} sono stati calcolati. Controlla la classifica!",
                    link="/rankings",
                )
    
    return await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})


async def _calculate_matchday_scores(matchday_id: str, admin: dict):
    """Helper function to calculate and store scores for all users with predictions."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0, "league_id": 1})
    md_league_id = matchday.get("league_id") if matchday else NATIONAL_LEAGUE_ID
    matches = await matches_col.find(_match_source_query(matchday_id, md_league_id), {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    # Get all predictions for this matchday (all leagues that played it)
    all_preds = await predictions_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(10000)

    # Group by (user_id, league_id) — predictions are per league
    user_league_preds = {}
    for p in all_preds:
        key = (p["user_id"], p.get("league_id", md_league_id))
        user_league_preds.setdefault(key, []).append(p)

    # Calculate scores for each user+league (idempotent - delete old scores first)
    await score_summaries_col.delete_many({"matchday_id": matchday_id})

    for (uid, pred_league_id), preds in user_league_preds.items():
        # Jolly rimosso — forza sempre inattivo in ingresso
        joker_active = False

        match_pts = []
        special_bonus = 0.0
        for p in preds:
            m = matches_dict.get(p["match_id"])
            if not m:
                continue
            # Use prediction's market_type (user's choice)
            pred_market = p.get("market_type", m.get("market_type", "1X2"))
            pts, is_correct = calculate_match_points(
                p["prediction_value"], pred_market,
                m.get("home_score"), m.get("away_score"), m["status"],
                m.get("multiplier", 1.0)
            )
            match_pts.append((m["id"], pts, is_correct))
            # Track special bonus from X3 multiplier
            multiplier = m.get("multiplier", 1.0)
            if is_correct and multiplier > 1.0:
                special_bonus += pts - (pts / multiplier)

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
            "league_id": pred_league_id,
            "base_points": totals["base_points"],
            "joker_bonus": totals["joker_bonus"],
            "special_bonus": special_bonus,
            "total_points": totals["total_points"],
            "valid_matches": totals["valid_matches"],
            "void_matches": totals["void_matches"],
            "joker_active": joker_active,
            "created_at": now_utc(),
        })

    logger.info(f"[ADMIN] Scores calculated for {len(user_league_preds)} user+league combos in matchday {matchday_id}")


@admin_router.delete("/matchdays/{matchday_id}")
async def admin_delete_matchday(matchday_id: str, admin=Depends(require_permission("admin.matchdays.manage"))):
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
async def admin_list_matches(matchday_id: str = None, admin=Depends(require_permission("admin.matches.manage"))):
    query = {}
    if matchday_id:
        query["matchday_id"] = matchday_id
    return await matches_col.find(query, {"_id": 0}).to_list(100)


@admin_router.post("/matches")
async def admin_create_match(req: MatchCreate, admin=Depends(require_permission("admin.matches.manage"))):
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
async def admin_update_match(match_id: str, req: MatchUpdate, admin=Depends(require_permission("admin.matches.manage"))):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates")
    await matches_col.update_one({"id": match_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "match", match_id, updates)
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@admin_router.delete("/matches/{match_id}")
async def admin_delete_match(match_id: str, admin=Depends(require_permission("admin.matches.manage"))):
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


@admin_router.post("/matches/{match_id}/special")
async def admin_set_special_match(match_id: str, body: dict = {}, user=Depends(get_current_user)):
    """Imposta/rimuovi Partita Speciale X3.
    Body opzionale: {"is_special": true/false}
    Max 1 partita speciale per giornata. Se ne selezioni una nuova, la precedente perde lo status.
    Permesso: super admin OR owner della lega a cui appartiene la partita.
    """
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")
    
    # Permission check: super admin OR league owner
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        match_league_id = match.get("league_id")
        if match_league_id:
            league_of_match = await leagues_col.find_one({"id": match_league_id}, {"_id": 0})
            if not league_of_match or league_of_match.get("owner_id") != user["id"]:
                raise HTTPException(403, "Solo il creatore della lega o un super admin può impostare X3")
        else:
            raise HTTPException(403, "Solo un super admin può impostare X3 sulle partite nazionali")
    
    # Toggle: se non specificato, inverti lo stato corrente
    new_special = body.get("is_special", not match.get("is_special", False))
    matchday_id = match.get("matchday_id")
    
    if new_special:
        # Rimuovi lo status speciale dalla partita precedente (max 1 per giornata)
        await matches_col.update_many(
            {"matchday_id": matchday_id, "is_special": True, "id": {"$ne": match_id}},
            {"$set": {"is_special": False, "multiplier": 1.0}}
        )
        # Imposta questa come speciale
        await matches_col.update_one(
            {"id": match_id},
            {"$set": {"is_special": True, "multiplier": 3.0}}
        )
        logger.info(f"[SPECIAL] Match {match_id} set as X3 special in matchday {matchday_id}")
    else:
        # Rimuovi lo status speciale
        await matches_col.update_one(
            {"id": match_id},
            {"$set": {"is_special": False, "multiplier": 1.0}}
        )
        logger.info(f"[SPECIAL] Match {match_id} unset as special in matchday {matchday_id}")
    
    return {
        "status": "ok",
        "match_id": match_id,
        "is_special": new_special,
        "multiplier": 3.0 if new_special else 1.0,
    }



@admin_router.post("/matches/{match_id}/live-update")
async def admin_live_update(match_id: str, req: LiveUpdateRequest, admin=Depends(require_permission("admin.matches.manage"))):
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
async def admin_confirm_matchday(matchday_id: str, admin=Depends(require_permission("admin.matchdays.manage"))):
    """Confirm matchday as COMPLETED and calculate final scores (idempotent)."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    # Get all predictions for this matchday
    all_preds = await predictions_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(10000)

    # Group by (user_id, league_id) — predictions are per league
    user_league_preds = {}
    for p in all_preds:
        key = (p["user_id"], p.get("league_id", matchday.get("league_id", NATIONAL_LEAGUE_ID)))
        user_league_preds.setdefault(key, []).append(p)

    # Calculate scores for each user+league (idempotent - delete old scores first)
    await score_summaries_col.delete_many({"matchday_id": matchday_id})

    for (uid, pred_league_id), preds in user_league_preds.items():
        # Jolly rimosso — forza sempre inattivo in ingresso
        joker_active = False

        match_pts = []
        for p in preds:
            m = matches_dict.get(p["match_id"])
            if not m:
                continue
            # Use prediction's market_type (user's choice)
            pred_market = p.get("market_type", m.get("market_type", "1X2"))
            pts, is_correct = calculate_match_points(
                p["prediction_value"], pred_market,
                m.get("home_score"), m.get("away_score"), m["status"],
                m.get("multiplier", 1.0)
            )
            match_pts.append((m["id"], pts, is_correct))
            # Track special bonus from X3 multiplier
            multiplier = m.get("multiplier", 1.0)
            if is_correct and multiplier > 1.0:
                special_bonus += pts - (pts / multiplier)

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
            "league_id": pred_league_id,
            "base_points": totals["base_points"],
            "joker_bonus": totals["joker_bonus"],
            "special_bonus": special_bonus,
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
async def admin_recalc_standings(matchday_id: str, admin=Depends(require_permission("admin.matchdays.manage"))):
    """Idempotent recalculation of matchday scores."""
    return await admin_confirm_matchday(matchday_id, admin)


# ========================================
# ADMIN V3 – UNIFIED CONSOLE ENDPOINTS
# ========================================

VALID_TRANSITIONS = {
    "DRAFT": ["OPEN"],     # Manual publish by admin
    "OPEN": [],            # Auto-transition to LIVE at first_kickoff
    "LIVE": [],            # Auto-transition to COMPLETED when all matches FT
    "COMPLETED": [],
}

STATUS_ORDER = ["DRAFT", "OPEN", "LIVE", "COMPLETED"]


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
        lg["_can_manage_matches"] = source in ("manual", "custom", "api") or is_super
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

        # Kickoff-driven: compute effective status automatically
        effective_status = await compute_matchday_status(md, league_id)
        if effective_status != md.get("status"):
            md["status"] = effective_status

    return matchdays


@admin_router.post("/matchday/{matchday_id}/transition")
async def admin_v3_transition(matchday_id: str, body: dict, user=Depends(get_current_user)):
    """Endpoint unificato per transizioni di stato giornata.
    Body: {"league_id": "...", "target_status": "OPEN"}
    Kickoff-driven: solo DRAFT → OPEN è manuale.
    OPEN → LIVE e LIVE → COMPLETED sono automatiche.
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

    # Validazione: transizione valida (solo DRAFT → OPEN è manuale)
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise HTTPException(400, f"Transizione non permessa: {current_status} → {target_status}. Le transizioni OPEN→LIVE e LIVE→COMPLETED sono automatiche.")

    # Conteggio partite
    match_count = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": league_id})

    # DRAFT → OPEN: servono almeno 1 partita
    if target_status == "OPEN":
        if match_count < 1:
            raise HTTPException(400, "Impossibile pubblicare: inserisci almeno 1 partita")
        # Auto-compute first_kickoff from matches
        await recompute_matchday_kickoff(matchday_id, league_id)

    # OPEN: close other OPEN matchdays + update current_matchday_id
    if target_status == "OPEN":
        season_id = matchday.get("season_id")
        if season_id:
            await matchdays_col.update_many(
                {"season_id": season_id, "league_id": league_id, "id": {"$ne": matchday_id}, "status": "OPEN"},
                {"$set": {"status": "DRAFT"}}
            )
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

    return {
        "status": "ok",
        "matchday_id": matchday_id,
        "previous_status": current_status,
        "new_status": target_status,
        "league_id": league_id,
    }


@admin_router.post("/matchday/{matchday_id}/override")
async def admin_v3_override(matchday_id: str, body: dict, user=Depends(get_current_user)):
    """SUPER_ADMIN override: forza lo stato di una giornata per emergenze.
    Body: {"league_id": "...", "target_status": "DRAFT"|"OPEN"|"LIVE"|"COMPLETED"|null}
    Passare target_status=null per rimuovere l'override e ripristinare lo stato automatico.
    """
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        raise HTTPException(403, "Solo il Super Admin può forzare lo stato di una giornata")

    league_id = body.get("league_id")
    target_status = body.get("target_status")
    if not league_id:
        raise HTTPException(400, "league_id obbligatorio")

    matchday = await matchdays_col.find_one({"id": matchday_id, "league_id": league_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Giornata non trovata per questa lega")

    admin_username = user.get("username", user.get("email", "unknown"))

    if target_status is None:
        # Remove override → restore automatic status
        await matchdays_col.update_one({"id": matchday_id}, {"$unset": {"status_override": ""}})
        await log_audit(user["id"], admin_username, "OVERRIDE_CLEAR", "matchday", matchday_id,
            {"league_id": league_id})
        return {"status": "ok", "message": "Override rimosso", "matchday_id": matchday_id}

    if target_status not in ("DRAFT", "OPEN", "LIVE", "COMPLETED"):
        raise HTTPException(400, f"target_status non valido: {target_status}")

    # Set override + also update the stored status
    await matchdays_col.update_one(
        {"id": matchday_id},
        {"$set": {"status_override": target_status, "status": target_status}}
    )

    # If forcing COMPLETED, trigger score calculation
    if target_status == "COMPLETED":
        logger.info(f"[SUPER_ADMIN] Force COMPLETED matchday {matchday_id} — calculating scores")
        await recalculate_matchday_scores(matchday_id, league_id)

    await log_audit(user["id"], admin_username, "OVERRIDE", "matchday", matchday_id,
        {"target_status": target_status, "league_id": league_id})

    return {
        "status": "ok",
        "message": f"Override forzato a {target_status}",
        "matchday_id": matchday_id,
        "new_status": target_status,
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
async def admin_get_audit_logs(limit: int = 50, admin=Depends(require_permission("admin.audit.view"))):
    logs = await audit_logs_col.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs


@admin_router.get("/leagues")
async def admin_list_leagues(admin=Depends(require_permission("admin.leagues.manage"))):
    leagues = await leagues_col.find({}, {"_id": 0}).to_list(100)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@admin_router.get("/payments")
async def admin_list_payments(admin=Depends(require_permission("admin.payments.view"))):
    return await payments_col.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@admin_router.get("/score-summaries/{matchday_id}")
async def admin_score_summaries(matchday_id: str, admin=Depends(require_permission("admin.dashboard.view"))):
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
async def real_fixtures_leagues(user=Depends(get_current_user)):
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
    user=Depends(get_current_user),
):
    """Search real fixtures from API-Football."""
    try:
        client = _get_apifootball()
        fixtures = await client.search_fixtures(league, season, date_from, date_to)
        return fixtures
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


class ImportFixturesRequest(PydanticBaseModel):
    league_id: str          # Our internal league_id
    matchday_id: str        # Our internal matchday_id
    fixture_ids: List[int]  # API-Football fixture IDs to import


@fixtures_router.post("/import")
async def real_fixtures_import(req: ImportFixturesRequest, user=Depends(get_current_user)):
    """Import real fixtures as matches into our DB (max 10 per matchday).
    Super admin can import for any league. League owner can import for their own league (custom or api).
    """
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        # League owner permission check
        league_check = await leagues_col.find_one({"id": req.league_id}, {"_id": 0})
        if not league_check:
            raise HTTPException(404, "Lega non trovata")
        if league_check.get("owner_id") != user["id"]:
            raise HTTPException(403, "Solo il creatore della lega o un super admin può importare partite")
        if league_check.get("match_source_type") not in ("custom", "manual", "api"):
            raise HTTPException(400, "Questa lega usa le partite della Lega Nazionale")

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

    # Check for duplicate external_fixture_id within this league AND matchday only
    already_imported = await matches_col.find(
        {"external_fixture_id": {"$in": req.fixture_ids}, "league_id": req.league_id, "matchday_id": req.matchday_id},
        {"_id": 0, "external_fixture_id": 1, "matchday_id": 1, "home_team": 1, "away_team": 1}
    ).to_list(100)
    already_dict = {m["external_fixture_id"]: m for m in already_imported}

    client = _get_apifootball()
    imported = []
    skipped = []

    for fid in req.fixture_ids:
        if fid in already_dict:
            existing = already_dict[fid]
            existing_md = await matchdays_col.find_one({"id": existing["matchday_id"]}, {"_id": 0, "number": 1, "label": 1})
            skipped.append({
                "fixture_id": fid,
                "reason": "already_imported",
                "existing_matchday": existing_md.get("label", f"G{existing_md['number']}") if existing_md else existing["matchday_id"],
                "match": f"{existing.get('home_team', '?')} vs {existing.get('away_team', '?')}",
            })
            logger.info(f"[IMPORT] Skip fid={fid} ({existing.get('home_team')} vs {existing.get('away_team')}): already in {existing_md.get('label') if existing_md else existing['matchday_id']}")
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

    await log_audit(user["id"], user["username"], "IMPORT_FIXTURES", "match", req.matchday_id, {
        "imported_count": len(imported),
        "skipped_count": len(skipped),
        "fixture_ids": req.fixture_ids,
    })

    # Auto-compute first_kickoff from imported match times
    if imported:
        await recompute_matchday_kickoff(req.matchday_id, req.league_id)

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
        # Save elapsed minutes for live matches
        if fx.get("elapsed") is not None:
            updates["elapsed"] = fx["elapsed"]
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
async def real_fixtures_refresh_live(admin=Depends(require_permission("admin.matches.manage"))):
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
# STATISTICS ENDPOINTS (PUBLIC API-FOOTBALL DATA)
# ========================================
from apifootball import TOP_LEAGUES

@stats_router.get("/leagues")
async def stats_available_leagues(user=Depends(get_current_user)):
    """Return the 5 fixed leagues with current season info."""
    try:
        client = _get_apifootball()
        leagues = await client.get_top_leagues()
        return leagues
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@stats_router.get("/standings/{league_id}")
async def stats_league_standings(
    league_id: int,
    season: int = Query(2025, description="Season year"),
    user=Depends(get_current_user),
):
    """Get league table standings from API-Football."""
    try:
        client = _get_apifootball()
        entries = await client.get_standings(league_id, season)
        league_info = next((lg for lg in TOP_LEAGUES if lg["id"] == league_id), None)
        return {
            "league_id": league_id,
            "league_name": league_info["name"] if league_info else str(league_id),
            "season": season,
            "standings": entries,
        }
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@stats_router.get("/results/{league_id}")
async def stats_recent_results(
    league_id: int,
    season: int = Query(2025, description="Season year"),
    last: int = Query(15, ge=1, le=30),
    user=Depends(get_current_user),
):
    """Get recent finished fixtures from API-Football."""
    try:
        client = _get_apifootball()
        fixtures = await client.get_recent_results(league_id, season, last)
        league_info = next((lg for lg in TOP_LEAGUES if lg["id"] == league_id), None)
        return {
            "league_id": league_id,
            "league_name": league_info["name"] if league_info else str(league_id),
            "season": season,
            "fixtures": fixtures,
        }
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@stats_router.get("/upcoming/{league_id}")
async def stats_upcoming_fixtures(
    league_id: int,
    season: int = Query(2025, description="Season year"),
    next_count: int = Query(15, ge=1, le=30, alias="next"),
    user=Depends(get_current_user),
):
    """Get upcoming fixtures from API-Football."""
    try:
        client = _get_apifootball()
        fixtures = await client.get_upcoming_fixtures(league_id, season, next_count)
        league_info = next((lg for lg in TOP_LEAGUES if lg["id"] == league_id), None)
        return {
            "league_id": league_id,
            "league_name": league_info["name"] if league_info else str(league_id),
            "season": season,
            "fixtures": fixtures,
        }
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


# ── Match Preview (team form, H2H, standings) ──
import re as _re

def _extract_team_id_from_logo(logo_url: str) -> Optional[int]:
    """Extract API-Football team ID from logo URL like .../teams/502.png"""
    if not logo_url:
        return None
    m = _re.search(r'/teams/(\d+)', logo_url)
    return int(m.group(1)) if m else None


@stats_router.get("/match-preview/{match_id}")
async def stats_match_preview(match_id: str, user=Depends(get_current_user)):
    """Get match preview stats: team form, H2H, standings position."""
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")

    if not match.get("external_fixture_id"):
        raise HTTPException(400, "Statistiche disponibili solo per partite API")

    home_team_id = _extract_team_id_from_logo(match.get("home_logo", ""))
    away_team_id = _extract_team_id_from_logo(match.get("away_logo", ""))
    if not home_team_id or not away_team_id:
        raise HTTPException(400, "ID squadre non disponibili")

    client = _get_apifootball()

    api_league_id = None
    season = 2025
    competition = (match.get("competition") or "").lower()
    for lg in TOP_LEAGUES:
        if lg["name"].lower() in competition or competition in lg["name"].lower():
            api_league_id = lg["id"]
            break

    try:
        home_form = await client.get_team_last_matches(home_team_id, 5)
        away_form = await client.get_team_last_matches(away_team_id, 5)
        h2h = await client.get_h2h(home_team_id, away_team_id, 5)

        home_standing = None
        away_standing = None
        if api_league_id:
            home_standing = await client.get_team_standing_position(home_team_id, api_league_id, season)
            away_standing = await client.get_team_standing_position(away_team_id, api_league_id, season)

        return {
            "match_id": match_id,
            "home_team": match.get("home_team"),
            "away_team": match.get("away_team"),
            "home_logo": match.get("home_logo"),
            "away_logo": match.get("away_logo"),
            "home_form": home_form,
            "away_form": away_form,
            "h2h": h2h,
            "home_standing": home_standing,
            "away_standing": away_standing,
        }
    except Exception as e:
        raise HTTPException(502, f"Statistiche non disponibili: {e}")


# ========================================
# RBAC ROUTES
# ========================================

async def _bootstrap_rbac():
    """Bootstrap RBAC system: create default roles and mark initial admin as super_admin."""
    # Create default roles if they don't exist
    for key, tmpl in DEFAULT_ROLES.items():
        existing = await roles_col.find_one({"name": tmpl["name"]})
        if not existing:
            role_doc = {
                "id": new_id(),
                "name": tmpl["name"],
                "description": tmpl["description"],
                "permissions": tmpl["permissions"],
                "is_system": True,
                "created_at": now_utc(),
            }
            await roles_col.insert_one(role_doc)
            logger.info(f"[RBAC] Created default role: {tmpl['name']}")

    # Use env var for super admin email (no hardcoding)
    super_admin_email = os.environ.get("SUPER_ADMIN_EMAIL", "admin@fantapronostic.com")
    admin_user = await users_col.find_one({"email": super_admin_email})
    if admin_user and not admin_user.get("is_super_admin"):
        sa_role = await roles_col.find_one({"name": "Super Admin"}, {"_id": 0, "id": 1})
        role_ids = admin_user.get("role_ids", [])
        if sa_role and sa_role["id"] not in role_ids:
            role_ids.append(sa_role["id"])
        await users_col.update_one(
            {"email": super_admin_email},
            {"$set": {"is_super_admin": True, "role_ids": role_ids}}
        )
        logger.info(f"[RBAC] Bootstrapped {super_admin_email} as SUPER_ADMIN")


@rbac_router.get("/permissions")
async def list_permissions(user=Depends(require_permission("admin.roles.manage"))):
    """List all available permissions in the system."""
    return [{"key": k, "description": v} for k, v in ALL_PERMISSIONS.items()]


@rbac_router.get("/my-permissions")
async def my_permissions(user=Depends(get_current_user)):
    """Get the current user's aggregated permissions."""
    perms = await get_user_permissions(user)
    return {
        "user_id": user["id"],
        "is_super_admin": user.get("is_super_admin", False),
        "permissions": perms,
        "role_ids": user.get("role_ids", []),
    }


@rbac_router.get("/dashboard-stats")
async def dashboard_stats(user=Depends(require_permission("admin.dashboard.view"))):
    """Aggregated KPI stats for the admin dashboard overview."""
    from datetime import timedelta, datetime, timezone

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    one_day_ago = now - timedelta(hours=24)
    seven_days_ago_str = seven_days_ago.isoformat()
    one_day_ago_str = one_day_ago.isoformat()

    # --- Users KPI ---
    total_users = await users_col.count_documents({"is_deleted": {"$ne": True}})
    disabled_users = await users_col.count_documents({"is_disabled": True, "is_deleted": {"$ne": True}})
    deleted_users = await users_col.count_documents({"is_deleted": True})
    new_users_7d = await users_col.count_documents({
        "created_at": {"$gte": seven_days_ago_str},
        "is_deleted": {"$ne": True}
    })
    # Recent logins (last 24h)
    recent_logins = await users_col.count_documents({
        "last_login": {"$gte": one_day_ago_str}
    })

    # --- Leagues KPI ---
    total_leagues = await leagues_col.count_documents({})
    # At-risk: no owner or no admin at all
    all_leagues_list = await leagues_col.find({}, {"_id": 0, "id": 1, "name": 1, "owner_id": 1}).to_list(500)
    at_risk_leagues = []
    for lg in all_leagues_list:
        if not lg.get("owner_id"):
            at_risk_leagues.append({"id": lg["id"], "name": lg["name"], "reason": "Nessun owner"})
            continue
        admin_count = await memberships_col.count_documents({
            "league_id": lg["id"],
            "role": {"$in": ["admin", "owner"]},
            "status": "active"
        })
        if admin_count == 0:
            at_risk_leagues.append({"id": lg["id"], "name": lg["name"], "reason": "Nessun admin"})

    # --- Matchday KPI ---
    md_statuses = {}
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    async for doc in matchdays_col.aggregate(pipeline):
        md_statuses[doc["_id"]] = doc["count"]

    # --- Payments KPI ---
    recent_payments = await payments_col.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    # Clean ObjectIds
    for p in recent_payments:
        p.pop("_id", None)
    pending_payments = await payments_col.count_documents({"payment_status": {"$ne": "paid"}})

    # --- Audit (latest 20) ---
    recent_audit = await audit_logs_col.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)

    return {
        "users": {
            "total": total_users,
            "disabled": disabled_users,
            "deleted": deleted_users,
            "new_7d": new_users_7d,
            "recent_logins_24h": recent_logins,
        },
        "leagues": {
            "total": total_leagues,
            "at_risk": at_risk_leagues,
        },
        "matchdays": md_statuses,
        "payments": {
            "recent": recent_payments,
            "pending_count": pending_payments,
        },
        "audit": recent_audit,
    }


@rbac_router.get("/roles")
async def list_roles(user=Depends(require_permission("admin.roles.manage"))):
    """List all roles."""
    roles = await roles_col.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return roles


@rbac_router.post("/roles")
async def create_role(req: RoleCreate, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Create a new role."""
    # Validate permissions
    invalid = [p for p in req.permissions if p not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(400, f"Permessi non validi: {invalid}")

    existing = await roles_col.find_one({"name": req.name})
    if existing:
        raise HTTPException(409, f"Ruolo '{req.name}' esiste già")

    role_doc = {
        "id": new_id(),
        "name": req.name,
        "description": req.description or "",
        "permissions": req.permissions,
        "is_system": False,
        "created_at": now_utc(),
    }
    await roles_col.insert_one(role_doc)
    role_doc.pop("_id", None)

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "CREATE", "role", role_doc["id"],
        {"name": req.name, "permissions": req.permissions},
        actor_roles=user.get("role_ids", []), ip=ip
    )
    return role_doc


@rbac_router.put("/roles/{role_id}")
async def update_role(role_id: str, req: RoleUpdate, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Update an existing role."""
    role = await roles_col.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(404, "Ruolo non trovato")

    before = {k: v for k, v in role.items() if k != "_id"}
    updates = {}
    if req.name is not None:
        # Check uniqueness
        dup = await roles_col.find_one({"name": req.name, "id": {"$ne": role_id}})
        if dup:
            raise HTTPException(409, f"Ruolo '{req.name}' esiste già")
        updates["name"] = req.name
    if req.description is not None:
        updates["description"] = req.description
    if req.permissions is not None:
        invalid = [p for p in req.permissions if p not in ALL_PERMISSIONS]
        if invalid:
            raise HTTPException(400, f"Permessi non validi: {invalid}")
        updates["permissions"] = req.permissions

    if not updates:
        raise HTTPException(400, "Nessun aggiornamento fornito")

    await roles_col.update_one({"id": role_id}, {"$set": updates})
    updated = await roles_col.find_one({"id": role_id}, {"_id": 0})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "UPDATE", "role", role_id,
        updates, actor_roles=user.get("role_ids", []), ip=ip,
        before=before, after={k: v for k, v in updated.items() if k != "_id"}
    )
    return updated


@rbac_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Delete a role. System roles cannot be deleted."""
    role = await roles_col.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(404, "Ruolo non trovato")
    if role.get("is_system"):
        raise HTTPException(403, "I ruoli di sistema non possono essere eliminati")

    # Remove role from all users who have it
    await users_col.update_many(
        {"role_ids": role_id},
        {"$pull": {"role_ids": role_id}}
    )
    await roles_col.delete_one({"id": role_id})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "DELETE", "role", role_id,
        {"name": role.get("name")},
        actor_roles=user.get("role_ids", []), ip=ip
    )
    return {"deleted": True}


@rbac_router.get("/users")
async def list_users_rbac(request: Request, user=Depends(require_permission("admin.users.manage"))):
    """List all users with their role assignments and league info."""
    users = await users_col.find(
        {}, {"_id": 0, "password": 0}
    ).sort("username", 1).to_list(5000)

    all_roles = {r["id"]: r for r in await roles_col.find({}, {"_id": 0}).to_list(200)}

    # Pre-fetch all memberships for league counts
    all_memberships = await memberships_col.find(
        {"status": "active"}, {"_id": 0, "user_id": 1, "league_id": 1, "role": 1}
    ).to_list(50000)
    # Pre-fetch all leagues for owner info
    all_leagues = await leagues_col.find({}, {"_id": 0, "id": 1, "owner_id": 1, "created_by": 1}).to_list(500)
    leagues_by_owner = {}
    leagues_by_creator = {}
    for lg in all_leagues:
        if lg.get("owner_id"):
            leagues_by_owner.setdefault(lg["owner_id"], []).append(lg["id"])
        if lg.get("created_by"):
            leagues_by_creator.setdefault(lg["created_by"], []).append(lg["id"])
    # Group memberships by user
    memberships_by_user = {}
    for m in all_memberships:
        memberships_by_user.setdefault(m["user_id"], []).append(m)

    result = []
    for u in users:
        uid = u["id"]
        role_ids = u.get("role_ids", [])
        roles_detail = [
            {"id": rid, "name": all_roles[rid]["name"]}
            for rid in role_ids if rid in all_roles
        ]
        user_memberships = memberships_by_user.get(uid, [])
        leagues_admin = [m for m in user_memberships if m.get("role") in ("admin", "owner")]
        result.append({
            "id": uid,
            "email": u["email"],
            "username": u["username"],
            "role": u.get("role"),
            "is_super_admin": u.get("is_super_admin", False),
            "is_disabled": u.get("is_disabled", False),
            "is_deleted": u.get("is_deleted", False),
            "role_ids": role_ids,
            "roles": roles_detail,
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login"),
            "leagues_created": len(leagues_by_creator.get(uid, [])),
            "leagues_admin": len(leagues_admin),
            "leagues_member": len(user_memberships),
        })
    return result


@rbac_router.put("/users/{user_id}/roles")
async def assign_user_roles(user_id: str, req: AssignRolesRequest, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Assign roles to a user."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    # Validate all role_ids exist
    for rid in req.role_ids:
        r = await roles_col.find_one({"id": rid})
        if not r:
            raise HTTPException(400, f"Ruolo non trovato: {rid}")

    before_roles = target.get("role_ids", [])
    await users_col.update_one({"id": user_id}, {"$set": {"role_ids": req.role_ids}})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "ASSIGN_ROLES", "user", user_id,
        {"target_username": target["username"]},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"role_ids": before_roles}, after={"role_ids": req.role_ids}
    )
    return {"user_id": user_id, "role_ids": req.role_ids}


@rbac_router.put("/users/{user_id}/super-admin")
async def set_super_admin(user_id: str, req: SetSuperAdminRequest, request: Request, user=Depends(require_permission("admin.roles.manage"))):
    """Set or remove super_admin flag on a user. Only super_admins can do this."""
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Solo un super admin può modificare questo flag")

    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    # Prevent removing own super_admin
    if user_id == user["id"] and not req.is_super_admin:
        raise HTTPException(400, "Non puoi rimuovere il tuo status di super admin")

    # Protect last super admin
    if not req.is_super_admin and target.get("is_super_admin"):
        sa_count = await users_col.count_documents({"is_super_admin": True})
        if sa_count <= 1:
            raise HTTPException(400, "Non puoi rimuovere l'ultimo super admin")

    before_val = target.get("is_super_admin", False)
    await users_col.update_one({"id": user_id}, {"$set": {"is_super_admin": req.is_super_admin}})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "SET_SUPER_ADMIN", "user", user_id,
        {"target_username": target["username"], "is_super_admin": req.is_super_admin},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"is_super_admin": before_val}, after={"is_super_admin": req.is_super_admin}
    )
    return {"user_id": user_id, "is_super_admin": req.is_super_admin}


@rbac_router.put("/users/{user_id}/status")
async def toggle_user_status(user_id: str, request: Request, user=Depends(require_permission("admin.users.manage"))):
    """Disable or enable a user account."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    # Cannot disable yourself
    if user_id == user["id"]:
        raise HTTPException(400, "Non puoi disabilitare il tuo account")

    # Cannot disable a super_admin (unless you are super_admin)
    if target.get("is_super_admin") and not user.get("is_super_admin"):
        raise HTTPException(403, "Non puoi disabilitare un super admin")

    new_status = not target.get("is_disabled", False)
    await users_col.update_one({"id": user_id}, {"$set": {"is_disabled": new_status}})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "TOGGLE_STATUS", "user", user_id,
        {"target_username": target["username"], "is_disabled": new_status},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"is_disabled": target.get("is_disabled", False)}, after={"is_disabled": new_status}
    )
    return {"user_id": user_id, "is_disabled": new_status}


@rbac_router.get("/users/{user_id}/leagues")
async def get_user_leagues(user_id: str, user=Depends(require_permission("admin.users.manage"))):
    """Get detailed league info for a user."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")

    memberships = await memberships_col.find(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    ).to_list(500)
    league_ids = [m["league_id"] for m in memberships]
    leagues = {l["id"]: l for l in await leagues_col.find(
        {"id": {"$in": league_ids}}, {"_id": 0}
    ).to_list(500)}

    result = []
    for m in memberships:
        lg = leagues.get(m["league_id"])
        if not lg:
            continue
        result.append({
            "league_id": lg["id"],
            "league_name": lg["name"],
            "league_type": lg.get("league_type", ""),
            "membership_role": m.get("role", "member"),
            "is_owner": lg.get("owner_id") == user_id,
            "is_creator": lg.get("created_by") == user_id,
            "joined_at": m.get("joined_at"),
        })
    return result


@rbac_router.put("/users/{user_id}/soft-delete")
async def soft_delete_user(user_id: str, request: Request, user=Depends(require_permission("admin.users.manage"))):
    """Soft-delete a user. Blocks if user is sole owner/admin of any league."""
    target = await users_col.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")
    if target.get("is_deleted"):
        raise HTTPException(400, "Utente già eliminato")
    if user_id == user["id"]:
        raise HTTPException(400, "Non puoi eliminare il tuo account")
    if target.get("is_super_admin"):
        raise HTTPException(403, "Non puoi eliminare un super admin")

    # Check if user is sole owner/admin of any league
    orphan_leagues = []
    owned_leagues = await leagues_col.find(
        {"owner_id": user_id}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    for lg in owned_leagues:
        # Check if there's another admin for this league
        other_admins = await memberships_col.count_documents({
            "league_id": lg["id"],
            "user_id": {"$ne": user_id},
            "role": {"$in": ["admin", "owner"]},
            "status": "active"
        })
        if other_admins == 0:
            orphan_leagues.append({"id": lg["id"], "name": lg["name"]})

    if orphan_leagues:
        raise HTTPException(409, detail={
            "message": "L'utente è l'unico admin/owner di queste leghe. Trasferisci la ownership prima di eliminare.",
            "orphan_leagues": orphan_leagues
        })

    await users_col.update_one({"id": user_id}, {"$set": {
        "is_deleted": True,
        "is_disabled": True,
        "deleted_at": now_utc(),
        "deleted_by": user["id"],
    }})

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "SOFT_DELETE", "user", user_id,
        {"target_username": target["username"], "target_email": target["email"]},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"is_deleted": False}, after={"is_deleted": True}
    )
    return {"user_id": user_id, "is_deleted": True}


@rbac_router.get("/leagues")
async def rbac_list_leagues(user=Depends(require_permission("admin.leagues.manage"))):
    """List all leagues with owner, admins, and member counts."""
    leagues = await leagues_col.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    result = []
    for lg in leagues:
        member_count = await memberships_col.count_documents({"league_id": lg["id"], "status": "active"})
        admins = await memberships_col.find(
            {"league_id": lg["id"], "role": {"$in": ["admin", "owner"]}, "status": "active"},
            {"_id": 0, "user_id": 1, "role": 1}
        ).to_list(50)
        admin_ids = [a["user_id"] for a in admins]
        admin_users = {u["id"]: u async for u in users_col.find(
            {"id": {"$in": admin_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}
        )}
        owner = None
        if lg.get("owner_id"):
            ow = await users_col.find_one({"id": lg["owner_id"]}, {"_id": 0, "id": 1, "username": 1, "email": 1})
            if ow:
                owner = {"id": ow["id"], "username": ow["username"], "email": ow["email"]}
        admin_list = []
        for a in admins:
            u = admin_users.get(a["user_id"])
            if u:
                admin_list.append({"id": u["id"], "username": u["username"], "email": u["email"], "role": a["role"]})
        result.append({
            "id": lg["id"],
            "name": lg["name"],
            "league_type": lg.get("league_type", ""),
            "invite_code": lg.get("invite_code"),
            "owner": owner,
            "admins": admin_list,
            "member_count": member_count,
            "created_at": lg.get("created_at"),
        })
    return result


@rbac_router.put("/leagues/{league_id}/transfer-owner")
async def transfer_league_owner(league_id: str, request: Request, user=Depends(require_permission("admin.leagues.manage"))):
    """Transfer league ownership to another member."""
    body = await request.json()
    new_owner_id = body.get("new_owner_id")
    if not new_owner_id:
        raise HTTPException(400, "new_owner_id richiesto")

    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    new_owner = await users_col.find_one({"id": new_owner_id}, {"_id": 0, "password": 0})
    if not new_owner:
        raise HTTPException(404, "Nuovo owner non trovato")

    # Ensure new owner is a member
    membership = await memberships_col.find_one({"league_id": league_id, "user_id": new_owner_id, "status": "active"})
    if not membership:
        raise HTTPException(400, "Il nuovo owner deve essere membro della lega")

    old_owner_id = league.get("owner_id")

    # Update league owner
    await leagues_col.update_one({"id": league_id}, {"$set": {"owner_id": new_owner_id}})

    # Update membership roles
    if old_owner_id:
        await memberships_col.update_one(
            {"league_id": league_id, "user_id": old_owner_id, "status": "active"},
            {"$set": {"role": "admin"}}
        )
    await memberships_col.update_one(
        {"league_id": league_id, "user_id": new_owner_id, "status": "active"},
        {"$set": {"role": "owner"}}
    )

    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], "TRANSFER_OWNER", "league", league_id,
        {"league_name": league["name"], "new_owner": new_owner["username"]},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"owner_id": old_owner_id}, after={"owner_id": new_owner_id}
    )
    return {"league_id": league_id, "new_owner_id": new_owner_id}


@rbac_router.put("/leagues/{league_id}/admins")
async def manage_league_admins(league_id: str, request: Request, user=Depends(require_permission("admin.leagues.manage"))):
    """Add or remove a league admin."""
    body = await request.json()
    target_user_id = body.get("user_id")
    action = body.get("action")  # "add" or "remove"
    if not target_user_id or action not in ("add", "remove"):
        raise HTTPException(400, "user_id e action ('add'|'remove') richiesti")

    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    membership = await memberships_col.find_one({"league_id": league_id, "user_id": target_user_id, "status": "active"})
    if not membership:
        raise HTTPException(400, "L'utente deve essere membro della lega")

    # Cannot change owner role via this endpoint
    if league.get("owner_id") == target_user_id:
        raise HTTPException(400, "Non puoi modificare il ruolo del proprietario. Usa 'Trasferisci Ownership'.")

    new_role = "admin" if action == "add" else "member"
    old_role = membership.get("role", "member")
    await memberships_col.update_one(
        {"league_id": league_id, "user_id": target_user_id, "status": "active"},
        {"$set": {"role": new_role}}
    )

    target = await users_col.find_one({"id": target_user_id}, {"_id": 0, "id": 1, "username": 1})
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    await log_audit(
        user["id"], user["username"], f"LEAGUE_ADMIN_{action.upper()}", "league", league_id,
        {"league_name": league["name"], "target_user": target["username"] if target else target_user_id},
        actor_roles=user.get("role_ids", []), ip=ip,
        before={"role": old_role}, after={"role": new_role}
    )
    return {"league_id": league_id, "user_id": target_user_id, "new_role": new_role}


@rbac_router.get("/leagues/{league_id}/members")
async def get_league_members(league_id: str, user=Depends(require_permission("admin.leagues.manage"))):
    """Get all members of a league."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    members = await memberships_col.find(
        {"league_id": league_id, "status": "active"}, {"_id": 0}
    ).to_list(1000)
    user_ids = [m["user_id"] for m in members]
    users_map = {u["id"]: u async for u in users_col.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}
    )}

    result = []
    for m in members:
        u = users_map.get(m["user_id"])
        if u:
            result.append({
                "user_id": u["id"],
                "username": u["username"],
                "email": u["email"],
                "role": m.get("role", "member"),
                "is_owner": league.get("owner_id") == u["id"],
                "joined_at": m.get("joined_at"),
            })
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
app.include_router(stats_router)
app.include_router(news_router)
app.include_router(rbac_router)


@app.on_event("startup")
async def startup():
    global _live_task, _reminder_task
    await create_indexes()
    # Add index for external_fixture_id
    await matches_col.create_index("external_fixture_id", sparse=True)
    # Bootstrap RBAC system
    await _bootstrap_rbac()
    # Start live-refresh background task
    _live_task = asyncio.create_task(_live_fixtures_loop())
    # Start reminder scheduler for push notifications
    _reminder_task = asyncio.create_task(_reminder_scheduler_loop())
    logger.info("FantaPronostic API started - indexes created - RBAC bootstrapped - live refresh started")


@app.on_event("shutdown")
async def shutdown():
    global _live_task, _apifootball_client, _reminder_task
    if _live_task:
        _live_task.cancel()
        try:
            await _live_task
        except asyncio.CancelledError:
            pass
    if _reminder_task:
        _reminder_task.cancel()
        try:
            await _reminder_task
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
    from admin_ui import get_admin_html
    return get_admin_html()
