"""Standings routes: total, weekly, matchdays, user standings."""
from fastapi import APIRouter, HTTPException, Depends
import logging

from database import (
    leagues_col, memberships_col, matchdays_col, predictions_col,
    score_summaries_col, seasons_col, users_col
)
from database import joker_usages_col, standings_cache_col
from auth import get_current_user
from services import (
    NATIONAL_LEAGUE_ID, compute_matchday_status, compute_matchday_points
)

logger = logging.getLogger(__name__)

standings_router = APIRouter(prefix="/api/standings", tags=["Standings"])


@standings_router.get("/total")
async def get_total_standings(league_id: str = None, user=Depends(get_current_user)):
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

    season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
    current_matchday = None
    if season:
        current_matchday = await matchdays_col.find_one(
            {"season_id": season["id"], "status": {"$in": ["OPEN", "LOCKED", "LIVE"]}}, {"_id": 0}, sort=[("number", -1)]
        )

    is_national_type = league_doc.get("match_source_type") not in ("manual", "custom", "api")
    if is_national_type:
        completed_mds = await matchdays_col.find({"league_id": NATIONAL_LEAGUE_ID, "status": "COMPLETED"}, {"_id": 0, "id": 1}).to_list(200)
        league_played_md_ids = [m["id"] for m in completed_mds]
        if not league_played_md_ids:
            entries = []
            for uid in member_user_ids:
                u = await users_col.find_one({"id": uid}, {"_id": 0, "password": 0})
                entries.append({"user_id": uid, "username": u["username"] if u else "Unknown", "total_points": 0, "current_week_points": 0, "matchdays_played": 0, "jolly_used": 0, "created_at": "", "is_current_user": uid == user["id"], "rank": None})
            for i, e in enumerate(entries):
                e["rank"] = i + 1
            my_pos = next((e for e in entries if e["is_current_user"]), None)
            return {"league_id": league_id, "league_name": league_doc["name"], "standings_type": "total", "entries": entries, "my_position": my_pos, "current_matchday": current_matchday["number"] if current_matchday else None}
        standings_match = {"user_id": {"$in": member_user_ids}, "matchday_id": {"$in": league_played_md_ids}, "league_id": league_id}
    else:
        standings_match = {"user_id": {"$in": member_user_ids}, "league_id": league_id}

    pipeline = [{"$match": standings_match}, {"$group": {"_id": "$user_id", "total_points": {"$sum": "$total_points"}, "matchdays_played": {"$sum": 1}, "created_at": {"$min": "$created_at"}}}]
    totals = await score_summaries_col.aggregate(pipeline).to_list(1000)
    totals_dict = {t["_id"]: t for t in totals}

    current_week_points = {}
    if current_matchday:
        current_scores = await score_summaries_col.find({"matchday_id": current_matchday["id"], "user_id": {"$in": member_user_ids}, "league_id": league_id}, {"_id": 0}).to_list(1000)
        current_week_points = {s["user_id"]: s["total_points"] for s in current_scores}

    jolly_counts = {}
    if season:
        jolly_pipeline = [{"$match": {"user_id": {"$in": member_user_ids}, "season_id": season["id"]}}, {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}]
        jolly_data = await joker_usages_col.aggregate(jolly_pipeline).to_list(1000)
        jolly_counts = {j["_id"]: j["count"] for j in jolly_data}

    entries = []
    for uid in member_user_ids:
        u = await users_col.find_one({"id": uid}, {"_id": 0, "password": 0})
        t = totals_dict.get(uid, {"total_points": 0, "matchdays_played": 0, "created_at": ""})
        entries.append({
            "user_id": uid, "username": u["username"] if u else "Unknown",
            "total_points": t["total_points"], "current_week_points": current_week_points.get(uid, 0),
            "matchdays_played": t["matchdays_played"], "jolly_used": jolly_counts.get(uid, 0),
            "created_at": t.get("created_at", ""), "is_current_user": uid == user["id"],
        })

    entries.sort(key=lambda x: (-x["total_points"], -x["current_week_points"], x["created_at"]))
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    my_pos = next((e for e in entries if e["is_current_user"]), None)
    return {
        "league_id": league_id, "league_name": league_doc["name"], "standings_type": "total",
        "entries": entries[:50], "my_position": my_pos,
        "current_matchday": current_matchday["number"] if current_matchday else None,
    }


@standings_router.get("/weekly/{matchday_id}")
async def get_weekly_standings(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
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

    is_manual = league_doc.get("match_source_type") in ("manual", "custom", "api")
    source_lid = league_id if is_manual else NATIONAL_LEAGUE_ID
    effective_status = await compute_matchday_status(matchday, source_lid)
    matchday["status"] = effective_status

    if effective_status in ("DRAFT", "OPEN"):
        return {
            "league_id": league_id, "league_name": league_doc["name"], "standings_type": "weekly",
            "matchday_id": matchday_id, "matchday_number": matchday.get("number"),
            "matchday_label": matchday.get("label"), "matchday_status": effective_status,
            "entries": [], "my_position": None,
        }

    members = await memberships_col.find({"league_id": league_id, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    pred_filter = {"matchday_id": matchday_id, "user_id": {"$in": member_user_ids}, "league_id": league_id}
    all_preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(10000)

    if not is_manual and matchday["status"] != "LIVE":
        users_who_played = {p["user_id"] for p in all_preds}
        member_user_ids = [uid for uid in member_user_ids if uid in users_who_played]

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

    entries = []
    for uid in member_user_ids:
        u = await users_col.find_one({"id": uid}, {"_id": 0, "password": 0})
        points_data = await compute_matchday_points(uid, matchday_id, league_id=league_id)
        stats = user_pred_stats.get(uid, {"total_correct": 0, "1x2_correct": 0})
        entries.append({
            "user_id": uid, "username": u["username"] if u else "Unknown",
            "matchday_points": points_data["total_points"],
            "base_points": points_data["base_points"], "joker_bonus": points_data["joker_bonus"],
            "total_correct": stats["total_correct"], "1x2_correct": stats["1x2_correct"],
            "jolly_active": points_data["joker_active"], "is_current_user": uid == user["id"],
        })

    entries.sort(key=lambda x: (-x["matchday_points"], -x["total_correct"], -x["1x2_correct"]))
    for i, e in enumerate(entries):
        e["rank"] = i + 1

    my_pos = next((e for e in entries if e["is_current_user"]), None)
    return {
        "league_id": league_id, "league_name": league_doc["name"], "standings_type": "weekly",
        "matchday_id": matchday_id, "matchday_number": matchday["number"],
        "matchday_label": matchday.get("label", f"Giornata {matchday['number']}"),
        "matchday_status": matchday["status"], "entries": entries[:50], "my_position": my_pos,
    }


@standings_router.get("/matchdays")
async def get_available_matchdays(league_id: str = None, user=Depends(get_current_user)):
    if league_id:
        league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
        if league:
            is_manual = league.get("match_source_type") in ("manual", "custom", "api")
            if is_manual:
                matchdays = await matchdays_col.find({"league_id": league_id}, {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}).sort("number", -1).to_list(50)
                return matchdays
            else:
                members = await memberships_col.find({"league_id": league_id, "status": "active"}, {"_id": 0, "user_id": 1}).to_list(1000)
                member_user_ids = [m["user_id"] for m in members]
                played_md_ids = await predictions_col.distinct("matchday_id", {"user_id": {"$in": member_user_ids}, "league_id": league_id})
                season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
                if season:
                    active_national_mds = await matchdays_col.find({"season_id": season["id"], "league_id": NATIONAL_LEAGUE_ID, "status": {"$in": ["OPEN", "LIVE", "LOCKED"]}}, {"_id": 0, "id": 1}).to_list(5)
                    for amd in active_national_mds:
                        if amd["id"] not in played_md_ids:
                            played_md_ids.append(amd["id"])
                if not played_md_ids:
                    return []
                matchdays = await matchdays_col.find({"id": {"$in": played_md_ids}, "status": {"$in": ["COMPLETED", "LIVE", "OPEN", "LOCKED"]}}, {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1, "first_kickoff": 1}).sort("number", -1).to_list(50)
                for md in matchdays:
                    if md["status"] in ("OPEN", "LOCKED"):
                        md["status"] = await compute_matchday_status(md, NATIONAL_LEAGUE_ID)
                    md.pop("first_kickoff", None)
                return matchdays

    season = await seasons_col.find_one({"is_active": True}, {"_id": 0})
    if not season:
        return []
    matchdays = await matchdays_col.find({"season_id": season["id"], "league_id": NATIONAL_LEAGUE_ID}, {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}).sort("number", -1).to_list(50)
    return matchdays


@standings_router.get("/user/{target_user_id}")
async def get_user_standings_profile(target_user_id: str, league_id: str = None, season_id: str = None, user=Depends(get_current_user)):
    if not league_id:
        my_memberships = await memberships_col.find({"user_id": user["id"], "status": "active"}).to_list(100)
        my_leagues = [m["league_id"] for m in my_memberships]
        target_membership = await memberships_col.find_one({"user_id": target_user_id, "status": "active", "league_id": {"$in": my_leagues}})
        if not target_membership:
            raise HTTPException(403, "Utente non nella stessa lega")
        league_id = target_membership["league_id"]
    else:
        my_mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "status": "active"})
        target_mem = await memberships_col.find_one({"user_id": target_user_id, "league_id": league_id, "status": "active"})
        if not my_mem or not target_mem:
            raise HTTPException(403, "Entrambi gli utenti devono essere nella stessa lega")

    target_user = await users_col.find_one({"id": target_user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(404, "User not found")
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})

    if season_id:
        season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    else:
        season = await seasons_col.find_one({"is_active": True}, {"_id": 0})

    pipeline = [
        {"$match": {"user_id": target_user_id, "league_id": league_id}},
        {"$group": {"_id": "$user_id", "total_points": {"$sum": "$total_points"}, "matchdays_played": {"$sum": 1}, "total_base_points": {"$sum": "$base_points"}, "total_joker_bonus": {"$sum": "$joker_bonus"}}}
    ]
    totals = await score_summaries_col.aggregate(pipeline).to_list(1)
    user_totals = totals[0] if totals else {"total_points": 0, "matchdays_played": 0, "total_base_points": 0, "total_joker_bonus": 0}

    current_matchday = None
    current_week_points = 0
    last_matchday_id = None
    if season:
        current_matchday = await matchdays_col.find_one(
            {"season_id": season["id"], "status": {"$in": ["OPEN", "LOCKED", "LIVE", "COMPLETED"]}}, {"_id": 0}, sort=[("number", -1)]
        )
        if current_matchday:
            last_matchday_id = current_matchday["id"]
            current_score = await score_summaries_col.find_one({"user_id": target_user_id, "matchday_id": current_matchday["id"], "league_id": league_id}, {"_id": 0})
            if current_score:
                current_week_points = current_score.get("total_points", 0)

    jolly_used = 0
    if season:
        jolly_used = await joker_usages_col.count_documents({"user_id": target_user_id, "season_id": season["id"]})

    members = await memberships_col.find({"league_id": league_id, "status": "active"}).to_list(1000)
    member_user_ids = [m["user_id"] for m in members]

    all_totals_pipeline = [
        {"$match": {"user_id": {"$in": member_user_ids}, "league_id": league_id}},
        {"$group": {"_id": "$user_id", "total_points": {"$sum": "$total_points"}}},
        {"$sort": {"total_points": -1}},
    ]
    all_totals = await score_summaries_col.aggregate(all_totals_pipeline).to_list(1000)
    rank = 1
    for i, t in enumerate(all_totals):
        if t["_id"] == target_user_id:
            rank = i + 1
            break

    matchday_breakdown = []
    if season:
        user_scores = await score_summaries_col.find({"user_id": target_user_id, "league_id": league_id}, {"_id": 0}).to_list(100)
        matchdays_list = await matchdays_col.find({"season_id": season["id"]}, {"_id": 0, "id": 1, "number": 1, "label": 1, "status": 1}).sort("number", 1).to_list(50)
        matchdays_dict = {m["id"]: m for m in matchdays_list}
        for score in user_scores:
            md = matchdays_dict.get(score.get("matchday_id"))
            if md:
                matchday_breakdown.append({
                    "matchday_id": score["matchday_id"], "matchday_number": md["number"],
                    "matchday_label": md.get("label", f"Giornata {md['number']}"), "status": md["status"],
                    "base_points": score.get("base_points", 0), "joker_bonus": score.get("joker_bonus", 0),
                    "total_points": score.get("total_points", 0),
                })
        matchday_breakdown.sort(key=lambda x: x["matchday_number"])

    return {
        "user_id": target_user_id, "username": target_user["username"],
        "email": target_user.get("email", ""), "league_id": league_id,
        "league_name": league["name"] if league else "",
        "rank": rank, "total_points": user_totals["total_points"],
        "matchdays_played": user_totals["matchdays_played"],
        "total_base_points": user_totals["total_base_points"],
        "total_joker_bonus": user_totals["total_joker_bonus"],
        "current_week_points": current_week_points,
        "current_matchday": current_matchday["number"] if current_matchday else None,
        "last_matchday_id": last_matchday_id, "jolly_used": jolly_used,
        "is_current_user": target_user_id == user["id"],
        "matchday_breakdown": matchday_breakdown,
    }


# Legacy endpoint
@standings_router.get("/leagues/{league_id}/matchdays/{matchday_id}/users/{user_id}/predictions")
async def view_user_predictions_legacy(league_id: str, matchday_id: str, user_id: str, user=Depends(get_current_user)):
    from routes.predictions import get_user_predictions_transparency
    return await get_user_predictions_transparency(user_id, matchday_id, league_id, user)
