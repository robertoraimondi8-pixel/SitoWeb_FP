"""Shared utility and domain service functions."""
import random
import string
import logging
from datetime import datetime, timezone
from typing import Optional

from database import (
    matchdays_col, matches_col, predictions_col,
    score_summaries_col, standings_cache_col, audit_logs_col
)
from models import new_id, now_utc
from scoring import calculate_match_points

logger = logging.getLogger(__name__)


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
