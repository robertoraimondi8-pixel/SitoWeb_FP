"""FantaPronostic Backend - Main FastAPI Application."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import random
import string
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
    LeagueJoinRequest, LeagueResponse, MatchdayCreate, MatchdayResponse,
    MatchCreate, MatchUpdate, MatchResponse, PredictionInput,
    PredictionsBatchRequest, PredictionResponse, JokerSetRequest,
    JokerResponse, ScoreSummaryResponse, StandingEntry, StandingsResponse,
    LiveMatchData, LiveMatchdayResponse, LiveUpdateRequest,
    ConfirmMatchdayRequest, HomeResponse, CheckoutRequest, CheckoutResponse,
    AuditLogResponse, AdminSeasonUpdate, AdminMatchdayUpdate, ProfileUpdate,
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


# ========================================
# AUTH ROUTES
# ========================================
@auth_router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    existing = await users_col.find_one({"$or": [{"email": req.email}, {"username": req.username}]})
    if existing:
        if existing.get("email") == req.email:
            raise HTTPException(400, "Email already registered")
        raise HTTPException(400, "Username already taken")

    user_id = new_id()
    user = {
        "id": user_id,
        "email": req.email,
        "username": req.username,
        "password": hash_password(req.password),
        "role": "user",
        "language": req.language,
        "created_at": now_utc(),
    }
    await users_col.insert_one(user)

    access = create_access_token(user_id, "user")
    refresh = create_refresh_token(user_id)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={"id": user_id, "email": req.email, "username": req.username, "role": "user", "language": req.language}
    )


@auth_router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = await users_col.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")

    access = create_access_token(user["id"], user["role"])
    refresh = create_refresh_token(user["id"])
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={"id": user["id"], "email": user["email"], "username": user["username"], "role": user["role"], "language": user.get("language", "it")}
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
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")

    # Call Emergent Auth to verify session and get user data
    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        ) as resp:
            if resp.status != 200:
                raise HTTPException(401, "Invalid Google session")
            google_data = await resp.json()

    email = google_data.get("email")
    name = google_data.get("name", "")
    picture = google_data.get("picture", "")

    if not email:
        raise HTTPException(400, "No email from Google")

    # Check if user already exists
    existing = await users_col.find_one({"email": email}, {"_id": 0})
    if existing:
        # Update profile picture if changed
        if picture and existing.get("picture") != picture:
            await users_col.update_one({"id": existing["id"]}, {"$set": {"picture": picture}})
        user_id = existing["id"]
        role = existing.get("role", "user")
        username = existing.get("username", name)
        language = existing.get("language", "it")
    else:
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

    access = create_access_token(user_id, role)
    refresh = create_refresh_token(user_id)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={"id": user_id, "email": email, "username": username, "role": role, "language": language}
    )


# ========================================
# USER ROUTES (Home, Profile)
# ========================================
@user_router.get("/home")
async def get_home(user=Depends(get_current_user)):
    # Get active season
    season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
    if not season:
        return HomeResponse()

    # Get user leagues
    user_memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
    league_ids = [m["league_id"] for m in user_memberships]
    user_leagues = []
    if league_ids:
        leagues = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0}).to_list(100)
        user_leagues = leagues

    # Get current/latest matchday
    matchday = await matchdays_col.find_one(
        {"season_id": season["id"]},
        {"_id": 0},
        sort=[("number", -1)]
    )

    matchday_data = None
    live_data = None

    if matchday:
        now = server_now()
        first_kickoff = datetime.fromisoformat(matchday["first_kickoff"].replace("Z", "+00:00"))
        lock_time = first_kickoff - timedelta(seconds=60)
        countdown_seconds = max(0, int((lock_time - now).total_seconds()))

        match_count = await matches_col.count_documents({"matchday_id": matchday["id"]})
        my_predictions = await predictions_col.count_documents({"user_id": user["id"], "matchday_id": matchday["id"]})

        matchday_data = {
            "id": matchday["id"],
            "number": matchday["number"],
            "label": matchday.get("label"),
            "status": matchday["status"],
            "first_kickoff": matchday["first_kickoff"],
            "countdown_seconds": countdown_seconds,
            "total_matches": match_count,
            "my_predictions_count": my_predictions,
        }

        # Live data if matchday is LIVE
        if matchday["status"] == "LIVE":
            live_matches = await matches_col.find({"matchday_id": matchday["id"]}, {"_id": 0}).to_list(20)
            preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday["id"]}, {"_id": 0}).to_list(20)
            preds_dict = {p["match_id"]: p for p in preds}
            joker = await joker_usages_col.find_one({"user_id": user["id"], "matchday_id": matchday["id"]}, {"_id": 0})

            total_prov = 0.0
            live_list = []
            for m in live_matches:
                pred = preds_dict.get(m["id"])
                pts = 0.0
                if pred and m.get("home_score") is not None:
                    pts, _ = calculate_match_points(pred["prediction_value"], m["market_type"], m.get("home_score"), m.get("away_score"), m["status"])
                    if joker and joker.get("match_id") == m["id"] and m["status"] not in ("void", "postponed", "cancelled") and pts > 0:
                        pts *= 2
                total_prov += pts
                live_list.append({
                    "match_id": m["id"],
                    "home_team": m["home_team"],
                    "away_team": m["away_team"],
                    "home_score": m.get("home_score"),
                    "away_score": m.get("away_score"),
                    "status": m["status"],
                    "my_prediction": pred["prediction_value"] if pred else None,
                    "points": pts,
                    "is_joker": joker and joker.get("match_id") == m["id"],
                })

            live_data = {
                "matchday_id": matchday["id"],
                "matches": live_list,
                "total_provisional": total_prov,
            }

    # Rankings preview
    rankings_preview = None
    if user_leagues:
        first_league = user_leagues[0]
        top = await score_summaries_col.aggregate([
            {"$lookup": {"from": "memberships", "localField": "user_id", "foreignField": "user_id", "as": "mem"}},
            {"$match": {"mem.league_id": first_league["id"]}},
            {"$group": {"_id": "$user_id", "total": {"$sum": "$total_points"}}},
            {"$sort": {"total": -1}},
            {"$limit": 5}
        ]).to_list(5)

        entries = []
        for i, t in enumerate(top):
            u = await users_col.find_one({"id": t["_id"]}, {"_id": 0, "password": 0})
            entries.append({
                "rank": i + 1,
                "user_id": t["_id"],
                "username": u["username"] if u else "Unknown",
                "total_points": t["total"],
            })
        rankings_preview = {"league_name": first_league["name"], "top": entries}

    return {
        "matchday": matchday_data,
        "live": live_data,
        "rankings_preview": rankings_preview,
        "stats_preview": {"message": "Stats coming soon"},
        "user_leagues": [{k: v for k, v in l.items() if k != "_id"} for l in user_leagues],
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


# ========================================
# LEAGUE ROUTES
# ========================================
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
    league_id = new_id()
    invite_code = generate_invite_code()
    league = {
        "id": league_id,
        "name": req.name,
        "league_type": "private",
        "season_id": req.season_id,
        "invite_code": invite_code,
        "owner_id": user["id"],
        "created_at": now_utc(),
    }
    await leagues_col.insert_one(league)

    # Auto-join owner
    await memberships_col.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "league_id": league_id,
        "status": "active",
        "joined_at": now_utc(),
    })

    await log_audit(user["id"], user["username"], "CREATE", "league", league_id, {"name": req.name})
    league.pop("_id", None)
    league["member_count"] = 1
    return league


@league_router.post("/join")
async def join_league(req: LeagueJoinRequest, user=Depends(get_current_user)):
    league = await leagues_col.find_one({"invite_code": req.invite_code}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Invalid invite code")

    existing = await memberships_col.find_one({"user_id": user["id"], "league_id": league["id"]})
    if existing:
        raise HTTPException(400, "Already a member of this league")

    await memberships_col.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "league_id": league["id"],
        "status": "active",
        "joined_at": now_utc(),
    })
    return {"message": "Joined league successfully", "league": league}


@league_router.get("/national")
async def get_national_leagues():
    leagues = await leagues_col.find({"league_type": "national"}, {"_id": 0}).to_list(10)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@league_router.get("/seasons")
async def get_active_seasons():
    seasons = await seasons_col.find({"is_active": True}, {"_id": 0}).to_list(10)
    return seasons


# ========================================
# PREDICTION ROUTES
# ========================================
@prediction_router.get("/{matchday_id}")
async def get_predictions(matchday_id: str, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    joker = await joker_usages_col.find_one(
        {"user_id": user["id"], "matchday_id": matchday_id},
        {"_id": 0}
    )

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
            "is_joker": joker["match_id"] == m["id"] if joker else False,
        })

    return {
        "matchday": matchday,
        "predictions": result,
        "joker": joker,
    }


@prediction_router.post("/{matchday_id}")
async def save_predictions(matchday_id: str, req: PredictionsBatchRequest, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    if matchday["status"] in ("COMPLETED",):
        raise HTTPException(400, "Matchday is completed, cannot modify predictions")

    now = server_now()
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

        existing = await predictions_col.find_one({"user_id": user["id"], "match_id": p.match_id})
        ts = now_utc()
        if existing:
            # Overwrite: change market + value (only 1 market per match guaranteed)
            await predictions_col.update_one(
                {"user_id": user["id"], "match_id": p.match_id},
                {"$set": {
                    "market_type": p.market_type,
                    "prediction_value": p.prediction_value,
                    "updated_at": ts,
                }}
            )
        else:
            await predictions_col.insert_one({
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
            })
        saved.append({"match_id": p.match_id, "market_type": p.market_type, "value": p.prediction_value})

    return {"saved_count": len(saved), "saved": saved, "errors": errors}


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
# JOKER ROUTES
# ========================================
@prediction_router.post("/{matchday_id}/joker")
async def set_joker(matchday_id: str, req: JokerSetRequest, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    now = server_now()
    first_kickoff = datetime.fromisoformat(matchday["first_kickoff"].replace("Z", "+00:00"))
    lock_time = first_kickoff - timedelta(seconds=60)

    if now >= lock_time:
        raise HTTPException(400, "Joker lock time passed (60s before first kickoff)")

    # Check joker limit: 1 per half per season
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
            # Update joker match for same matchday
            await joker_usages_col.update_one(
                {"id": existing_joker["id"]},
                {"$set": {"match_id": req.match_id, "is_active": True}}
            )
            return {"message": "Joker updated", "match_id": req.match_id}
        else:
            # Already used joker for this half in another matchday
            raise HTTPException(400, f"Joker already used for half {half} in matchday {existing_joker['matchday_id']}")

    await joker_usages_col.insert_one({
        "id": new_id(),
        "user_id": user["id"],
        "season_id": season["id"],
        "matchday_id": matchday_id,
        "match_id": req.match_id,
        "half": half,
        "is_active": True,
        "created_at": now_utc(),
    })
    return {"message": "Joker set", "match_id": req.match_id}


@prediction_router.delete("/{matchday_id}/joker")
async def remove_joker(matchday_id: str, user=Depends(get_current_user)):
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
    return {"message": "Joker removed"}


# ========================================
# STANDINGS ROUTES
# ========================================
@standings_router.get("/weekly/{matchday_id}")
async def get_weekly_standings(matchday_id: str, league: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    # Get league members
    if not league:
        membership = await memberships_col.find_one({"user_id": user["id"], "status": "active"})
        if membership:
            league = membership["league_id"]

    if not league:
        return StandingsResponse(league_id="", league_name="", standings_type="weekly", entries=[], my_position=None)

    league_doc = await leagues_col.find_one({"id": league}, {"_id": 0})
    members = await memberships_col.find({"league_id": league, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    # Get scores for this matchday
    scores = await score_summaries_col.find(
        {"matchday_id": matchday_id, "user_id": {"$in": member_user_ids}},
        {"_id": 0}
    ).to_list(1000)

    entries = []
    for s in scores:
        u = await users_col.find_one({"id": s["user_id"]}, {"_id": 0, "password": 0})
        entries.append(StandingEntry(
            rank=0,
            user_id=s["user_id"],
            username=u["username"] if u else "Unknown",
            total_points=s["total_points"],
            matchdays_played=1,
            is_current_user=s["user_id"] == user["id"],
        ))

    entries.sort(key=lambda x: x.total_points, reverse=True)
    for i, e in enumerate(entries):
        e.rank = i + 1

    my_pos = next((e for e in entries if e.is_current_user), None)

    return StandingsResponse(
        league_id=league,
        league_name=league_doc["name"] if league_doc else "",
        standings_type="weekly",
        entries=entries[:50],
        my_position=my_pos,
    )


@standings_router.get("/total")
async def get_total_standings(league: str = None, user=Depends(get_current_user)):
    if not league:
        membership = await memberships_col.find_one({"user_id": user["id"], "status": "active"})
        if membership:
            league = membership["league_id"]

    if not league:
        return StandingsResponse(league_id="", league_name="", standings_type="total", entries=[], my_position=None)

    league_doc = await leagues_col.find_one({"id": league}, {"_id": 0})
    members = await memberships_col.find({"league_id": league, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    # Aggregate total points per user
    pipeline = [
        {"$match": {"user_id": {"$in": member_user_ids}}},
        {"$group": {"_id": "$user_id", "total": {"$sum": "$total_points"}, "matchdays": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    totals = await score_summaries_col.aggregate(pipeline).to_list(1000)

    entries = []
    for i, t in enumerate(totals):
        u = await users_col.find_one({"id": t["_id"]}, {"_id": 0, "password": 0})
        entries.append(StandingEntry(
            rank=i + 1,
            user_id=t["_id"],
            username=u["username"] if u else "Unknown",
            total_points=t["total"],
            matchdays_played=t["matchdays"],
            is_current_user=t["_id"] == user["id"],
        ))

    my_pos = next((e for e in entries if e.is_current_user), None)

    return StandingsResponse(
        league_id=league,
        league_name=league_doc["name"] if league_doc else "",
        standings_type="total",
        entries=entries[:50],
        my_position=my_pos,
    )


# View user predictions (only if COMPLETED and same league)
@standings_router.get("/leagues/{league_id}/matchdays/{matchday_id}/users/{user_id}/predictions")
async def view_user_predictions(league_id: str, matchday_id: str, user_id: str, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday or matchday["status"] != "COMPLETED":
        raise HTTPException(403, "Predictions visible only for completed matchdays")

    # Check both users are in same league
    my_mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
    target_mem = await memberships_col.find_one({"user_id": user_id, "league_id": league_id, "status": "active"})
    if not my_mem or not target_mem:
        raise HTTPException(403, "Both users must be in the same league")

    preds = await predictions_col.find({"user_id": user_id, "matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    result = []
    for p in preds:
        m = matches_dict.get(p["match_id"], {})
        result.append({
            "match": m,
            "prediction_value": p["prediction_value"],
            "points": p.get("points"),
            "is_correct": p.get("is_correct"),
        })
    return result


# ========================================
# LIVE ROUTES
# ========================================
@live_router.get("/matchday/{matchday_id}")
async def get_live_matchday(matchday_id: str, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}
    joker = await joker_usages_col.find_one({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0})

    live_matches = []
    total_prov = 0.0
    matches_dict = {m["id"]: m for m in matches}

    match_pts = []
    for m in matches:
        pred = preds_dict.get(m["id"])
        pts = 0.0
        is_correct = None
        if pred and m.get("home_score") is not None:
            pts, is_correct = calculate_match_points(
                pred["prediction_value"], m["market_type"],
                m.get("home_score"), m.get("away_score"), m["status"]
            )
        match_pts.append((m["id"], pts, is_correct))

    joker_match_id = joker["match_id"] if joker else None
    totals = calculate_matchday_total(match_pts, joker_match_id, matches_dict)

    for m in matches:
        pred = preds_dict.get(m["id"])
        pts = 0.0
        if pred and m.get("home_score") is not None:
            pts, _ = calculate_match_points(
                pred["prediction_value"], m["market_type"],
                m.get("home_score"), m.get("away_score"), m["status"]
            )
            is_joker = joker_match_id == m["id"]
            if is_joker and m["status"] not in ("void", "postponed", "cancelled") and pts > 0:
                pts *= 2

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
            is_joker=joker_match_id == m["id"] if joker else False,
        ))

    return LiveMatchdayResponse(
        matchday_id=matchday_id,
        matchday_number=matchday["number"],
        status=matchday["status"],
        matches=live_matches,
        total_provisional_points=totals["total_points"],
        joker_applied=joker is not None,
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


@admin_router.get("/matchdays")
async def admin_list_matchdays(season_id: str = None, admin=Depends(require_admin)):
    query = {}
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
    await matchdays_col.update_one({"id": matchday_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "matchday", matchday_id, updates)
    return await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})


@admin_router.get("/matches")
async def admin_list_matches(matchday_id: str = None, admin=Depends(require_admin)):
    query = {}
    if matchday_id:
        query["matchday_id"] = matchday_id
    return await matches_col.find(query, {"_id": 0}).to_list(100)


@admin_router.post("/matches")
async def admin_create_match(req: MatchCreate, admin=Depends(require_admin)):
    match_id = new_id()
    match = {
        "id": match_id,
        "matchday_id": req.matchday_id,
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
        joker = await joker_usages_col.find_one({"user_id": uid, "matchday_id": matchday_id}, {"_id": 0})
        joker_match_id = joker["match_id"] if joker else None

        match_pts = []
        for p in preds:
            m = matches_dict.get(p["match_id"])
            if not m:
                continue
            pts, is_correct = calculate_match_points(
                p["prediction_value"], m["market_type"],
                m.get("home_score"), m.get("away_score"), m["status"]
            )
            match_pts.append((m["id"], pts, is_correct))

            # Update individual prediction
            await predictions_col.update_one(
                {"id": p["id"]},
                {"$set": {"points": pts, "is_correct": is_correct}}
            )

        totals = calculate_matchday_total(match_pts, joker_match_id, matches_dict)

        await score_summaries_col.insert_one({
            "id": new_id(),
            "user_id": uid,
            "matchday_id": matchday_id,
            "base_points": totals["base_points"],
            "joker_bonus": totals["joker_bonus"],
            "total_points": totals["total_points"],
            "valid_matches": totals["valid_matches"],
            "void_matches": totals["void_matches"],
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


@app.on_event("startup")
async def startup():
    await create_indexes()
    logger.info("FantaPronostic API started - indexes created")


@app.on_event("shutdown")
async def shutdown():
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
