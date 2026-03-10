"""Shared utility and domain service functions."""
import os
import random
import string
import logging
import time
import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx

from database import (
    db, matchdays_col, matches_col, predictions_col,
    score_summaries_col, standings_cache_col, audit_logs_col,
    notifications_col, push_tokens_col, memberships_col,
    leagues_col, users_col, roles_col, seasons_col
)
from models import new_id, now_utc
from scoring import calculate_match_points, calculate_matchday_total

logger = logging.getLogger(__name__)

# ============================================================
# CONSTANTS (shared across routes)
# ============================================================
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
MATCHES_PER_MATCHDAY = 11
MAX_MATCHES_PER_MATCHDAY = 10
NATIONAL_LEAGUE_PRICE = 20.00  # EUR

DEFAULT_SCORING_CONFIG = {
    "1x2": {"enabled": True, "points": 1.0},
    "over_under": {"enabled": True, "points": 0.5},
    "goal_no_goal": {"enabled": True, "points": 0.5},
    "exact_score": {"enabled": True, "points": 4.0},
}

VALID_TRANSITIONS = {
    "DRAFT": ["OPEN"],
    "OPEN": [],
    "LIVE": [],
    "COMPLETED": [],
}
STATUS_ORDER = ["DRAFT", "OPEN", "LIVE", "COMPLETED"]

# Push Notification Config
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
PUSH_ENABLED = os.environ.get("PUSH_NOTIFICATIONS_ENABLED", "false").lower() == "true"

# Live Fixtures Config
LIVE_SYNC_ENABLED = os.environ.get("APIFOOTBALL_LIVE_SYNC_ENABLED", "false").lower() == "true"
LIVE_REFRESH_INTERVAL = int(os.environ.get("APIFOOTBALL_LIVE_INTERVAL", "180"))

# Circuit breaker state
_circuit_open_until: float = 0
CIRCUIT_BREAKER_COOLDOWN = 3600

# Reminder Config
REMINDER_CHECK_INTERVAL = 300


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

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
    return {"matchday_id": matchday_id, "league_id": source_league_id}


# ============================================================
# MATCHDAY STATUS & KICKOFF
# ============================================================

async def compute_matchday_status(matchday: dict, league_id: str) -> str:
    override = matchday.get("status_override")
    stored = matchday.get("status", "DRAFT")
    if override and override != stored:
        return override
    if stored == "DRAFT":
        return "DRAFT"
    if stored == "COMPLETED":
        return "COMPLETED"

    first_kickoff = matchday.get("first_kickoff")
    now = server_now()
    kickoff_dt = None
    if first_kickoff:
        try:
            if isinstance(first_kickoff, str):
                kickoff_dt = datetime.fromisoformat(first_kickoff.replace("Z", "+00:00"))
            elif isinstance(first_kickoff, datetime):
                kickoff_dt = first_kickoff
            if kickoff_dt and not kickoff_dt.tzinfo:
                kickoff_dt = kickoff_dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass

    if stored in ("OPEN", "LOCKED"):
        if kickoff_dt and now >= kickoff_dt:
            matches = await matches_col.find(
                {"matchday_id": matchday["id"], "league_id": league_id},
                {"_id": 0, "status": 1}
            ).to_list(50)
            if matches and all(m.get("status", "").lower() in ("finished", "ft") for m in matches):
                await matchdays_col.update_one({"id": matchday["id"]}, {"$set": {"status": "COMPLETED"}})
                return "COMPLETED"
            return "LIVE"
        return stored

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
        await matchdays_col.update_one({"id": matchday_id}, {"$set": {"first_kickoff": first}})


# ============================================================
# SCORING FUNCTIONS
# ============================================================

async def compute_matchday_points(user_id: str, matchday_id: str, league_id: str = None) -> dict:
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    matchday_completed = matchday and matchday.get("status") == "COMPLETED"

    ss_filter = {"user_id": user_id, "matchday_id": matchday_id}
    if league_id:
        ss_filter["league_id"] = league_id
    score_summary = await score_summaries_col.find_one(ss_filter, {"_id": 0})

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

    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    pred_filter = {"user_id": user_id, "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    joker_active = False
    base_points = 0.0
    for m in matches:
        effective_status = m["status"]
        if matchday_completed and effective_status in ("scheduled", "live"):
            effective_status = "finished"
        if effective_status in ("void", "postponed", "cancelled"):
            continue
        pred = preds_dict.get(m["id"])
        if not pred:
            continue
        if pred.get("is_correct") is True:
            base_points += pred.get("points", 0)
        elif pred.get("is_correct") is None and m.get("home_score") is not None:
            multiplier = m.get("multiplier", 1.0)
            pts, is_correct = calculate_match_points(
                pred["prediction_value"], pred.get("market_type", "1X2"),
                m.get("home_score"), m.get("away_score"), effective_status, multiplier
            )
            if is_correct:
                base_points += pts

    joker_bonus = base_points if joker_active else 0
    total_points = base_points + joker_bonus
    return {"base_points": base_points, "joker_bonus": joker_bonus, "total_points": total_points, "joker_active": joker_active}


async def recalculate_match_predictions(match_id: str, league_id: str):
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match or match.get("home_score") is None:
        return
    preds = await predictions_col.find({"match_id": match_id}).to_list(1000)
    for pred in preds:
        pts, is_correct = calculate_match_points(
            pred.get("prediction_value"), pred.get("market_type", match.get("market_type", "1X2")),
            match.get("home_score"), match.get("away_score"), "finished", match.get("multiplier", 1.0)
        )
        await predictions_col.update_one({"id": pred["id"]}, {"$set": {"points": pts, "is_correct": is_correct}})
    logger.info(f"[SCORING] Recalculated {len(preds)} predictions for match {match_id}")


async def recalculate_matchday_scores(matchday_id: str, league_id: str):
    logger.info(f"[SCORING] Starting full recalculation for matchday {matchday_id} league {league_id}")
    matches = await matches_col.find({"matchday_id": matchday_id, "league_id": league_id}, {"_id": 0}).to_list(100)
    matches_dict = {m["id"]: m for m in matches}
    match_ids = [m["id"] for m in matches]
    if not match_ids:
        logger.info(f"[SCORING] No matches found for matchday {matchday_id}")
        return

    preds = await predictions_col.find({"match_id": {"$in": match_ids}, "league_id": league_id}).to_list(10000)
    user_points = {}

    for pred in preds:
        match = matches_dict.get(pred.get("match_id"))
        if not match or match.get("home_score") is None:
            continue
        multiplier = match.get("multiplier", 1.0)
        pts, is_correct = calculate_match_points(
            pred.get("prediction_value"), pred.get("market_type", match.get("market_type", "1X2")),
            match.get("home_score"), match.get("away_score"), "finished", multiplier
        )
        await predictions_col.update_one({"id": pred["id"]}, {"$set": {"points": pts, "is_correct": is_correct}})
        user_id = pred.get("user_id")
        if user_id not in user_points:
            user_points[user_id] = {"base_points": 0, "matches_correct": 0, "matches_total": 0, "special_bonus": 0}
        user_points[user_id]["matches_total"] += 1
        if is_correct:
            user_points[user_id]["base_points"] += pts
            user_points[user_id]["matches_correct"] += 1
            if multiplier > 1.0:
                base_market_pts = pts / multiplier
                user_points[user_id]["special_bonus"] += pts - base_market_pts

    for user_id, points_data in user_points.items():
        joker_active = False
        base_points = points_data["base_points"]
        special_bonus = points_data.get("special_bonus", 0)
        joker_bonus = base_points if joker_active else 0
        total_points = base_points + joker_bonus
        existing_summary = await score_summaries_col.find_one({"user_id": user_id, "matchday_id": matchday_id, "league_id": league_id})
        if existing_summary:
            await score_summaries_col.update_one(
                {"id": existing_summary["id"]},
                {"$set": {"base_points": base_points, "joker_bonus": joker_bonus, "special_bonus": special_bonus,
                          "total_points": total_points, "joker_active": joker_active,
                          "valid_matches": points_data["matches_total"], "correct_matches": points_data["matches_correct"],
                          "updated_at": now_utc()}}
            )
        else:
            await score_summaries_col.insert_one({
                "id": new_id(), "user_id": user_id, "matchday_id": matchday_id, "league_id": league_id,
                "base_points": base_points, "joker_bonus": joker_bonus, "special_bonus": special_bonus,
                "total_points": total_points, "joker_active": joker_active,
                "valid_matches": points_data["matches_total"], "correct_matches": points_data["matches_correct"],
                "updated_at": now_utc(),
            })

    for user_id in user_points.keys():
        await recalculate_user_total_standings(user_id, league_id)

    logger.info(f"[SCORING] Recalculated scores for {len(user_points)} users in matchday {matchday_id}, standings updated")


async def recalculate_user_total_standings(user_id: str, league_id: str):
    summaries = await score_summaries_col.find({"user_id": user_id, "league_id": league_id}, {"_id": 0}).to_list(100)
    total_points = sum(s.get("total_points", 0) for s in summaries)
    total_correct = sum(s.get("correct_matches", 0) for s in summaries)
    total_matches = sum(s.get("valid_matches", 0) for s in summaries)
    matchdays_played = len(summaries)
    await standings_cache_col.update_one(
        {"user_id": user_id, "league_id": league_id, "type": "total"},
        {"$set": {"total_points": total_points, "correct_matches": total_correct,
                  "valid_matches": total_matches, "matchdays_played": matchdays_played,
                  "updated_at": now_utc()},
         "$setOnInsert": {"id": new_id()}},
        upsert=True
    )
    logger.info(f"[STANDINGS] Updated total for user {user_id} in league {league_id}: {total_points} pts")


async def calculate_matchday_scores_full(matchday_id: str, admin: dict):
    """Calculate and store scores for all users with predictions (used by admin confirm/complete)."""
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0, "league_id": 1})
    md_league_id = matchday.get("league_id") if matchday else NATIONAL_LEAGUE_ID
    matches = await matches_col.find(_match_source_query(matchday_id, md_league_id), {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    all_preds = await predictions_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(10000)

    user_league_preds = {}
    for p in all_preds:
        key = (p["user_id"], p.get("league_id", md_league_id))
        user_league_preds.setdefault(key, []).append(p)

    await score_summaries_col.delete_many({"matchday_id": matchday_id})

    for (uid, pred_league_id), preds in user_league_preds.items():
        joker_active = False
        match_pts = []
        special_bonus = 0.0
        for p in preds:
            m = matches_dict.get(p["match_id"])
            if not m:
                continue
            pred_market = p.get("market_type", m.get("market_type", "1X2"))
            pts, is_correct = calculate_match_points(
                p["prediction_value"], pred_market,
                m.get("home_score"), m.get("away_score"), m["status"],
                m.get("multiplier", 1.0)
            )
            match_pts.append((m["id"], pts, is_correct))
            multiplier = m.get("multiplier", 1.0)
            if is_correct and multiplier > 1.0:
                special_bonus += pts - (pts / multiplier)
            await predictions_col.update_one(
                {"id": p["id"]},
                {"$set": {"points": pts, "is_correct": is_correct}}
            )

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
    return len(user_league_preds)


# ============================================================
# PUSH NOTIFICATIONS
# ============================================================

async def send_expo_push(user_id: str, title: str, body: str, data: dict = None, image: str = None):
    """Send a push notification via Expo Push API to all devices of a user."""
    if not PUSH_ENABLED:
        return
    tokens = await push_tokens_col.find(
        {"user_id": user_id}, {"_id": 0, "token": 1}
    ).to_list(10)
    if not tokens:
        return
    messages = []
    for t in tokens:
        msg = {
            "to": t["token"],
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        if image:
            msg["image"] = image
        messages.append(msg)
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


async def create_notification(user_id: str, notif_type: str, title: str, message: str, link: str = "", image: str = ""):
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
    if image:
        doc["image"] = image
    await notifications_col.insert_one(doc)
    await send_expo_push(user_id, title, message, {"type": notif_type, "link": link}, image=image or None)


async def create_notification_for_league(league_id: str, notif_type: str, title: str, message: str, link: str = ""):
    """Create notification for all active members of a league."""
    members = await memberships_col.find(
        {"league_id": league_id, "status": "active"}, {"user_id": 1, "_id": 0}
    ).to_list(500)
    for m in members:
        await create_notification(m["user_id"], notif_type, title, message, link)


# ============================================================
# VALIDATION HELPERS
# ============================================================

def validate_prediction(value: str, market_type: str) -> bool:
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


def require_league_admin(league: dict, user: dict):
    from fastapi import HTTPException
    if league.get("owner_id") != user["id"]:
        raise HTTPException(403, "Solo il creatore della lega può gestire le partite")
    if league.get("match_source_type") not in ("manual", "custom", "api"):
        raise HTTPException(400, "Questa lega usa le partite della Lega Nazionale")


# ============================================================
# API-FOOTBALL CLIENT
# ============================================================

_apifootball_client = None

def get_apifootball():
    from apifootball import APIFootballClient
    from fastapi import HTTPException
    global _apifootball_client
    if _apifootball_client is None:
        key = os.environ.get("APIFOOTBALL_API_KEY", "")
        if not key:
            raise HTTPException(503, "API-Football key not configured")
        _apifootball_client = APIFootballClient(key)
    return _apifootball_client


# ============================================================
# RBAC BOOTSTRAP
# ============================================================

async def bootstrap_rbac():
    """Bootstrap RBAC system: create default roles and mark initial admin as super_admin."""
    from permissions import DEFAULT_ROLES
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
