"""Live routes: live matchday data with polling support."""
from fastapi import APIRouter, HTTPException, Depends
import logging

from database import (
    matchdays_col, matches_col, predictions_col
)
from database import joker_usages_col
from models import LiveMatchData, LiveMatchdayResponse
from auth import get_current_user
from scoring import calculate_match_points, calculate_matchday_total
from services import (
    NATIONAL_LEAGUE_ID, server_now, _match_source_query,
    compute_matchday_status
)

logger = logging.getLogger(__name__)

live_router = APIRouter(prefix="/api/live", tags=["Live"])


@live_router.get("/{matchday_id}")
async def get_live_data(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    matches = await matches_col.find(
        _match_source_query(matchday_id, matchday.get("league_id")), {"_id": 0}
    ).to_list(20)

    pred_query = {"user_id": user["id"], "matchday_id": matchday_id}
    if league_id:
        pred_query["league_id"] = league_id
    preds = await predictions_col.find(pred_query, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    joker = await joker_usages_col.find_one({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0})
    joker_active = joker is not None and joker.get("is_active", False)

    matches_dict = {m["id"]: m for m in matches}
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
            "match_id": m["id"], "home_team": m["home_team"], "away_team": m["away_team"],
            "home_logo": m.get("home_logo"), "away_logo": m.get("away_logo"),
            "competition": m.get("competition", ""), "start_time": m["start_time"],
            "home_score": m.get("home_score"), "away_score": m.get("away_score"),
            "elapsed": m.get("elapsed"), "status": m["status"],
            "my_prediction": pred.get("prediction_value") if pred else None,
            "my_market": pred.get("market_type") if pred else None,
            "points": pts, "outcome": outcome if pred else "no_prediction",
            "is_special": m.get("is_special", False), "multiplier": m.get("multiplier", 1.0),
        })

    totals = calculate_matchday_total(match_pts, joker_active, matches_dict)

    return {
        "matchday_id": matchday_id, "matchday_number": matchday["number"],
        "matchday_label": matchday.get("label", f"Giornata {matchday['number']}"),
        "matchday_status": await compute_matchday_status(matchday, matchday.get("league_id", "")),
        "matches": live_matches, "jolly_active": joker_active,
        "base_points": totals["base_points"], "joker_bonus": totals["joker_bonus"],
        "total_live_points": totals["total_points"],
        "valid_matches": totals["valid_matches"], "void_matches": totals["void_matches"],
        "server_time": server_now().isoformat(),
    }


# Legacy endpoint
@live_router.get("/matchday/{matchday_id}")
async def get_live_matchday(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    source_lid = matchday.get("league_id") or NATIONAL_LEAGUE_ID
    matches = await matches_col.find(_match_source_query(matchday_id, source_lid), {"_id": 0}).to_list(20)
    pred_filter = {"user_id": user["id"], "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    joker = await joker_usages_col.find_one({"user_id": user["id"], "matchday_id": matchday_id}, {"_id": 0})
    joker_active = joker is not None and joker.get("is_active", False)

    matches_dict = {m["id"]: m for m in matches}
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
            match_id=m["id"], home_team=m["home_team"], away_team=m["away_team"],
            competition=m.get("competition", ""),
            home_score=m.get("home_score"), away_score=m.get("away_score"),
            status=m["status"], my_prediction=pred["prediction_value"] if pred else None,
            points=pts, is_joker=False,
        ))

    totals = calculate_matchday_total(match_pts, joker_active, matches_dict)
    return LiveMatchdayResponse(
        matchday_id=matchday_id, matchday_number=matchday["number"],
        status=matchday["status"], matches=live_matches,
        total_provisional_points=totals["total_points"], joker_applied=joker_active,
    )
