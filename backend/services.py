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
# Will be resolved dynamically at startup via init_national_league_id()
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
MATCHES_PER_MATCHDAY = 11
MAX_MATCHES_PER_MATCHDAY = 10
NATIONAL_LEAGUE_PRICE = 20.00  # EUR


async def init_national_league_id():
    """Resolve the national league ID from DB at startup. Updates the global."""
    global NATIONAL_LEAGUE_ID
    nl = await leagues_col.find_one({"league_type": "national"}, {"_id": 0, "id": 1})
    if nl:
        NATIONAL_LEAGUE_ID = nl["id"]
        logger.info(f"[INIT] National league ID resolved from DB: {nl['id']}")
    else:
        logger.warning(f"[INIT] No national league found, using fallback: {NATIONAL_LEAGUE_ID}")

DEFAULT_SCORING_CONFIG = {
    "1x2": {"enabled": True, "points": 2},
    "over_under": {"enabled": True, "points": 1},
    "goal_no_goal": {"enabled": True, "points": 1},
    "exact_score": {"enabled": True, "points": 5},
}


def normalize_scoring_config(raw_config: dict = None) -> dict:
    """Normalize scoring config: enforce global point values, only allow enabled/disabled toggle."""
    config = {}
    for key, default in DEFAULT_SCORING_CONFIG.items():
        user_cfg = (raw_config or {}).get(key, {})
        config[key] = {
            "enabled": user_cfg.get("enabled", default["enabled"]) if isinstance(user_cfg, dict) else default["enabled"],
            "points": default["points"],
        }
    return config

VALID_TRANSITIONS = {
    "DRAFT": ["OPEN"],
    "OPEN": [],
    "LIVE": [],
    "COMPLETED": [],
}
STATUS_ORDER = ["DRAFT", "OPEN", "LIVE", "COMPLETED"]

# Push Notification Config
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
_push_raw = os.environ.get("PUSH_NOTIFICATIONS_ENABLED", "")
PUSH_ENABLED = _push_raw.strip().lower() == "true"
logger.info(f"[INIT] PUSH_NOTIFICATIONS_ENABLED raw: {_push_raw!r} → PUSH_ENABLED={PUSH_ENABLED}")

# Live Fixtures Config
LIVE_SYNC_ENABLED = os.environ.get("APIFOOTBALL_LIVE_SYNC_ENABLED", "false").lower() == "true"
LIVE_REFRESH_INTERVAL = int(os.environ.get("APIFOOTBALL_LIVE_INTERVAL", "180"))

# Circuit breaker state
_circuit_open_until: float = 0
CIRCUIT_BREAKER_COOLDOWN = int(os.environ.get("APIFOOTBALL_CIRCUIT_BREAKER_COOLDOWN", "300"))
_circuit_fail_count: int = 0
_last_live_refresh_at: float = 0
_last_live_refresh_status: str = "never"
_last_live_error: str = ""

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
    base_points = 0
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
        pred_market = pred.get("market_type", match.get("market_type", "1X2"))
        pts, is_correct = calculate_match_points(
            pred.get("prediction_value"), pred_market,
            match.get("home_score"), match.get("away_score"), "finished", multiplier
        )
        await predictions_col.update_one({"id": pred["id"]}, {"$set": {"points": pts, "is_correct": is_correct}})
        user_id = pred.get("user_id")
        if user_id not in user_points:
            user_points[user_id] = {
                "base_points": 0, "matches_correct": 0, "matches_total": 0, "special_bonus": 0,
                "total_correct_predictions": 0, "exact_score_hits": 0,
                "one_x_two_hits": 0, "over_under_hits": 0, "goal_nogol_hits": 0,
            }
        user_points[user_id]["matches_total"] += 1
        if is_correct:
            user_points[user_id]["base_points"] += pts
            user_points[user_id]["matches_correct"] += 1
            user_points[user_id]["total_correct_predictions"] += 1
            if pred_market == "EXACT_SCORE":
                user_points[user_id]["exact_score_hits"] += 1
            elif pred_market == "1X2":
                user_points[user_id]["one_x_two_hits"] += 1
            elif pred_market == "OVER_UNDER_25":
                user_points[user_id]["over_under_hits"] += 1
            elif pred_market == "GOAL_NOGOL":
                user_points[user_id]["goal_nogol_hits"] += 1
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
                          "total_correct_predictions": points_data["total_correct_predictions"],
                          "exact_score_hits": points_data["exact_score_hits"],
                          "one_x_two_hits": points_data["one_x_two_hits"],
                          "over_under_hits": points_data["over_under_hits"],
                          "goal_nogol_hits": points_data["goal_nogol_hits"],
                          "updated_at": now_utc()}}
            )
        else:
            await score_summaries_col.insert_one({
                "id": new_id(), "user_id": user_id, "matchday_id": matchday_id, "league_id": league_id,
                "base_points": base_points, "joker_bonus": joker_bonus, "special_bonus": special_bonus,
                "total_points": total_points, "joker_active": joker_active,
                "valid_matches": points_data["matches_total"], "correct_matches": points_data["matches_correct"],
                "total_correct_predictions": points_data["total_correct_predictions"],
                "exact_score_hits": points_data["exact_score_hits"],
                "one_x_two_hits": points_data["one_x_two_hits"],
                "over_under_hits": points_data["over_under_hits"],
                "goal_nogol_hits": points_data["goal_nogol_hits"],
                "updated_at": now_utc(),
            })

    for user_id in user_points.keys():
        await recalculate_user_total_standings(user_id, league_id)

    # Award weekly trophies after scoring
    try:
        from trophies import award_weekly_trophies
        await award_weekly_trophies(matchday_id, league_id)
    except Exception as e:
        logger.error(f"[TROPHY] Error awarding weekly trophies: {e}")

    logger.info(f"[SCORING] Recalculated scores for {len(user_points)} users in matchday {matchday_id}, standings updated")


async def recalculate_user_total_standings(user_id: str, league_id: str):
    summaries = await score_summaries_col.find({"user_id": user_id, "league_id": league_id}, {"_id": 0}).to_list(100)
    total_points = sum(s.get("total_points", 0) for s in summaries)
    total_correct = sum(s.get("correct_matches", 0) for s in summaries)
    total_matches = sum(s.get("valid_matches", 0) for s in summaries)
    matchdays_played = len(summaries)
    # Tiebreak stats aggregation
    total_correct_predictions = sum(s.get("total_correct_predictions", s.get("correct_matches", 0)) for s in summaries)
    exact_score_hits = sum(s.get("exact_score_hits", 0) for s in summaries)
    one_x_two_hits = sum(s.get("one_x_two_hits", 0) for s in summaries)
    over_under_hits = sum(s.get("over_under_hits", 0) for s in summaries)
    goal_nogol_hits = sum(s.get("goal_nogol_hits", 0) for s in summaries)
    await standings_cache_col.update_one(
        {"user_id": user_id, "league_id": league_id, "type": "total"},
        {"$set": {"total_points": total_points, "correct_matches": total_correct,
                  "valid_matches": total_matches, "matchdays_played": matchdays_played,
                  "total_correct_predictions": total_correct_predictions,
                  "exact_score_hits": exact_score_hits,
                  "one_x_two_hits": one_x_two_hits,
                  "over_under_hits": over_under_hits,
                  "goal_nogol_hits": goal_nogol_hits,
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
        special_bonus = 0
        # Tiebreak stats
        total_correct_predictions = 0
        exact_score_hits = 0
        one_x_two_hits = 0
        over_under_hits = 0
        goal_nogol_hits = 0

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
            if is_correct:
                total_correct_predictions += 1
                if pred_market == "EXACT_SCORE":
                    exact_score_hits += 1
                elif pred_market == "1X2":
                    one_x_two_hits += 1
                elif pred_market == "OVER_UNDER_25":
                    over_under_hits += 1
                elif pred_market == "GOAL_NOGOL":
                    goal_nogol_hits += 1
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
            "correct_matches": total_correct_predictions,
            "total_correct_predictions": total_correct_predictions,
            "exact_score_hits": exact_score_hits,
            "one_x_two_hits": one_x_two_hits,
            "over_under_hits": over_under_hits,
            "goal_nogol_hits": goal_nogol_hits,
            "joker_active": joker_active,
            "created_at": now_utc(),
        })

    logger.info(f"[ADMIN] Scores calculated for {len(user_league_preds)} user+league combos in matchday {matchday_id}")

    # Award weekly trophies for each league involved
    try:
        from trophies import award_weekly_trophies
        leagues_processed = set()
        for (uid, pred_league_id) in user_league_preds.keys():
            if pred_league_id not in leagues_processed:
                leagues_processed.add(pred_league_id)
                await award_weekly_trophies(matchday_id, pred_league_id)
    except Exception as e:
        logger.error(f"[TROPHY] Error awarding weekly trophies: {e}")

    return len(user_league_preds)


# ============================================================
# PUSH NOTIFICATIONS
# ============================================================

async def send_expo_push(user_id: str, title: str, body: str, data: dict = None, image: str = None):
    """Send a push notification via Expo Push API to all devices of a user.
    Returns dict with delivery stats."""
    result = {"tokens_found": 0, "tickets_ok": 0, "tickets_error": 0, "errors": []}
    if not PUSH_ENABLED:
        return result
    tokens = await push_tokens_col.find(
        {"user_id": user_id}, {"_id": 0, "token": 1}
    ).to_list(10)
    if not tokens:
        return result
    result["tokens_found"] = len(tokens)
    messages = []
    for t in tokens:
        tok = t["token"]
        if not tok or not tok.startswith("ExponentPushToken["):
            logger.warning(f"[PUSH] Invalid token format for user {user_id[:8]}: {tok[:30] if tok else 'None'}")
            result["errors"].append(f"invalid_token:{tok[:20] if tok else 'None'}")
            continue
        msg = {
            "to": tok,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        if image:
            msg["image"] = image
        messages.append(msg)
    if not messages:
        logger.info(f"[PUSH] User {user_id[:8]}: {len(tokens)} tokens found but none valid")
        return result
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            if resp.status_code == 200:
                resp_data = resp.json()
                ticket_data = resp_data.get("data", [])
                for i, ticket in enumerate(ticket_data):
                    status = ticket.get("status", "unknown")
                    if status == "ok":
                        result["tickets_ok"] += 1
                    else:
                        result["tickets_error"] += 1
                        detail = ticket.get("details", {})
                        error_msg = ticket.get("message", detail.get("error", "unknown"))
                        logger.warning(f"[PUSH] Ticket error for user {user_id[:8]}, token {messages[i]['to'][:30]}: {error_msg}")
                        result["errors"].append(error_msg)
                logger.info(f"[PUSH] User {user_id[:8]}: sent={len(messages)}, ok={result['tickets_ok']}, err={result['tickets_error']}")
            else:
                logger.warning(f"[PUSH] Expo API HTTP {resp.status_code} for user {user_id[:8]}: {resp.text[:300]}")
                result["errors"].append(f"http_{resp.status_code}")
    except Exception as e:
        logger.warning(f"[PUSH] Failed to send push to user {user_id[:8]}: {e}")
        result["errors"].append(str(e))
    return result


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
    # Super admin and national league bypass all checks
    if user.get("is_super_admin") or league.get("league_type") == "national":
        return
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



# ============================================================
# LIFECYCLE: AUTO-COMPLETION LOGIC
# ============================================================

SEASON_STATES = ["draft", "active", "completed", "archived"]
LEAGUE_STATES = ["draft", "active", "completed", "cancelled"]


async def get_league_matchday_range(season_id: str):
    """Calculate the valid selectable matchday range for league creation.
    Uses season.current_matchday and season.total_matchdays.
    """
    season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    if not season:
        return (1, 38)

    total_matchdays = season.get("total_matchdays", 38)
    current_matchday = season.get("current_matchday", 1)

    # Check if the current matchday is already live or completed
    # If so, the first selectable is the next one
    national_league = await leagues_col.find_one({"league_type": "national"}, {"_id": 0, "id": 1})
    if national_league:
        nl_id = national_league["id"]
        current_md_doc = await matchdays_col.find_one(
            {"season_id": season_id, "league_id": nl_id, "number": current_matchday},
            {"_id": 0, "status": 1}
        )
        if current_md_doc and current_md_doc.get("status") in ("LIVE", "COMPLETED"):
            current_matchday = min(current_matchday + 1, total_matchdays)

    return (current_matchday, total_matchdays)


async def check_league_auto_completion(matchday_id: str, league_id: str):
    """Check if a league should auto-complete after a matchday is completed.
    Called after matchday status moves to COMPLETED.
    """
    from database import palmares_col

    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        return

    md_number = matchday.get("number")

    # Find all leagues that use this season and have end_matchday == md_number
    season_id = matchday.get("season_id")
    if not season_id:
        return

    leagues = await leagues_col.find({
        "season_id": season_id,
        "end_matchday": md_number,
        "status": {"$nin": ["completed", "cancelled"]}
    }, {"_id": 0}).to_list(100)

    for league in leagues:
        lid = league["id"]
        # Verify all matches in this matchday for this league are finished
        total_matches = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": lid})
        if total_matches == 0:
            # National source leagues might use the national league's matches
            source_lid = league.get("source_league_id", NATIONAL_LEAGUE_ID)
            total_matches = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": source_lid})
            finished = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": source_lid, "status": "finished"})
        else:
            finished = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": lid, "status": "finished"})

        if total_matches > 0 and finished == total_matches:
            await complete_league(lid)


async def complete_league(league_id: str):
    """Complete a league: freeze standings, determine winner, save to palmares, award trophies."""
    from database import palmares_col
    from trophies import award_league_trophies

    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        return

    logger.info(f"[LIFECYCLE] Auto-completing league {league.get('name')} ({league_id})")

    # Mark league as completed
    await leagues_col.update_one({"id": league_id}, {"$set": {
        "status": "completed",
        "completed_at": now_utc()
    }})

    # Get final standings
    standings = await standings_cache_col.find(
        {"league_id": league_id, "type": "total"},
        {"_id": 0}
    ).sort("total_points", -1).to_list(500)

    winner_id = standings[0]["user_id"] if standings else None
    winner_user = await users_col.find_one({"id": winner_id}, {"_id": 0, "username": 1}) if winner_id else None

    # Build top 3 for palmares
    top_3 = []
    for i, s in enumerate(standings[:3]):
        u = await users_col.find_one({"id": s["user_id"]}, {"_id": 0, "username": 1})
        top_3.append({
            "position": i + 1,
            "user_id": s["user_id"],
            "username": u.get("username", "?") if u else "?",
            "total_points": s.get("total_points", 0),
        })

    # Save to palmares
    palmares_doc = {
        "id": new_id(),
        "season_id": league.get("season_id"),
        "competition_id": league_id,
        "competition_type": "league",
        "competition_name": league.get("name", ""),
        "winner_id": winner_id,
        "winner_username": winner_user.get("username", "?") if winner_user else None,
        "top_3": top_3,
        "total_participants": len(standings),
        "start_matchday": league.get("start_matchday"),
        "end_matchday": league.get("end_matchday"),
        "completed_at": now_utc(),
    }
    try:
        await palmares_col.insert_one(palmares_doc)
    except Exception as e:
        if "duplicate" not in str(e).lower():
            raise
        logger.info(f"[LIFECYCLE] Palmares already exists for league {league_id}")

    # Award trophies
    try:
        await award_league_trophies(league_id)
    except Exception as e:
        logger.error(f"[LIFECYCLE] Error awarding league trophies: {e}")

    logger.info(f"[LIFECYCLE] League {league.get('name')} completed. Winner: {winner_user.get('username') if winner_user else 'N/A'}")


async def complete_season(season_id: str, admin_user: dict):
    """Complete a season: close all active competitions, freeze standings, update palmares."""
    from database import palmares_col, tournaments_col

    season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    if not season:
        return {"error": "Stagione non trovata"}

    if season.get("status") == "completed":
        return {"error": "Stagione già completata"}

    results = {"leagues_completed": 0, "tournaments_completed": 0}

    # Complete all active leagues for this season
    active_leagues = await leagues_col.find({
        "season_id": season_id,
        "status": {"$nin": ["completed", "cancelled"]}
    }, {"_id": 0, "id": 1, "name": 1}).to_list(200)

    for league in active_leagues:
        await complete_league(league["id"])
        results["leagues_completed"] += 1

    # Complete all active tournaments for this season
    active_tournaments = await tournaments_col.find({
        "season_id": season_id,
        "status": {"$nin": ["completed", "cancelled"]}
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)

    for tournament in active_tournaments:
        await tournaments_col.update_one({"id": tournament["id"]}, {"$set": {
            "status": "completed",
            "completed_at": now_utc()
        }})
        # Award tournament trophies
        try:
            from trophies import award_tournament_trophies
            await award_tournament_trophies(tournament["id"])
        except Exception as e:
            logger.error(f"[LIFECYCLE] Error awarding tournament trophies for {tournament['id']}: {e}")
        results["tournaments_completed"] += 1

    # Mark season as completed
    await seasons_col.update_one({"id": season_id}, {"$set": {
        "status": "completed",
        "is_active": False,
        "completed_at": now_utc()
    }})

    await log_audit(
        admin_user["id"], admin_user.get("username", "admin"),
        "COMPLETE_SEASON", "season", season_id,
        {"leagues_completed": results["leagues_completed"], "tournaments_completed": results["tournaments_completed"]}
    )

    logger.info(f"[LIFECYCLE] Season {season.get('name')} completed: {results}")
    return results
