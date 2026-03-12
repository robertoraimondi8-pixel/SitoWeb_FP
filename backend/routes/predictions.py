"""Prediction routes: get/save/confirm predictions, user transparency."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import logging

from database import (
    leagues_col, memberships_col, matchdays_col, matches_col,
    predictions_col, score_summaries_col, users_col
)
from database import joker_usages_col
from models import PredictionsBatchRequest, new_id, now_utc
from auth import get_current_user
from scoring import calculate_match_points
from services import (
    NATIONAL_LEAGUE_ID, MATCHES_PER_MATCHDAY,
    server_now, compute_matchday_status, validate_prediction,
    compute_matchday_points
)

logger = logging.getLogger(__name__)

prediction_router = APIRouter(prefix="/api/predictions", tags=["Predictions"])


@prediction_router.get("/{matchday_id}")
async def get_predictions(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})

    # Fallback: check tournament rounds
    is_tournament = False
    if not matchday:
        from database import tournament_rounds_col
        tourn_round = await tournament_rounds_col.find_one({"id": matchday_id}, {"_id": 0})
        if tourn_round:
            is_tournament = True
            matchday = {
                "id": tourn_round["id"],
                "number": tourn_round["round_number"],
                "label": tourn_round.get("label", f"Giornata {tourn_round['round_number']}"),
                "status": tourn_round["status"],
                "league_id": tourn_round["tournament_id"],
                "season_id": None,
                "half": 1,
                "first_kickoff": tourn_round.get("created_at"),
            }

    if not matchday:
        raise HTTPException(404, "Matchday not found")

    match_query = {"matchday_id": matchday_id}
    if is_tournament:
        match_query["league_id"] = matchday["league_id"]
    elif league_id:
        league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
        if league and league.get("match_source_type") in ("manual", "custom", "api"):
            match_query["league_id"] = league_id
    else:
        if matchday.get("league_id"):
            league = await leagues_col.find_one({"id": matchday["league_id"]}, {"_id": 0})
            if league and league.get("match_source_type") in ("manual", "custom", "api"):
                match_query["league_id"] = matchday["league_id"]

    matches = await matches_col.find(match_query, {"_id": 0}).to_list(20)
    preds = await predictions_col.find({"user_id": user["id"], "matchday_id": matchday_id, "league_id": league_id}, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    now = server_now()
    result = []
    for m in matches:
        start = datetime.fromisoformat(m["start_time"].replace("Z", "+00:00"))
        is_locked = now >= start
        pred = preds_dict.get(m["id"])
        result.append({"match": m, "prediction": pred, "is_locked": is_locked})

    effective_status = await compute_matchday_status(matchday, matchday.get("league_id", ""))
    matchday["status"] = effective_status

    return {"matchday": matchday, "predictions": result}


@prediction_router.post("/{matchday_id}")
async def save_predictions(matchday_id: str, req: PredictionsBatchRequest, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    is_tournament = False
    if not matchday:
        from database import tournament_rounds_col
        tourn_round = await tournament_rounds_col.find_one({"id": matchday_id}, {"_id": 0})
        if tourn_round:
            is_tournament = True
            matchday = {
                "id": tourn_round["id"],
                "number": tourn_round["round_number"],
                "label": tourn_round.get("label", f"Giornata {tourn_round['round_number']}"),
                "status": tourn_round["status"],
                "league_id": tourn_round["tournament_id"],
            }
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    if matchday["status"] in ("COMPLETED",):
        raise HTTPException(400, "Matchday is completed, cannot modify predictions")

    pred_league_id = req.league_id if req.league_id else None

    if is_tournament and pred_league_id:
        # For tournaments, check tournament registration instead of league membership
        from database import tournament_registrations_col
        reg = await tournament_registrations_col.find_one(
            {"tournament_id": pred_league_id, "user_id": user["id"], "status": "active"})
        if not reg:
            raise HTTPException(403, "Non sei iscritto a questo torneo")
    elif pred_league_id:
        user_membership = await memberships_col.find_one({"user_id": user["id"], "league_id": pred_league_id, "status": "active"})
        if not user_membership:
            raise HTTPException(403, "Non sei membro di questa lega")
        league_doc = await leagues_col.find_one({"id": pred_league_id}, {"_id": 0})
        if league_doc and league_doc.get("match_source_type") in ("manual", "custom", "api"):
            if matchday.get("league_id") != pred_league_id:
                raise HTTPException(400, "Questa giornata non appartiene alla tua lega")
    else:
        raise HTTPException(400, "league_id è obbligatorio per salvare i pronostici")

    now = server_now()

    all_matchday_matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(100)
    unlocked_match_ids = set()
    for m in all_matchday_matches:
        try:
            if m.get("start_time"):
                start = datetime.fromisoformat(m["start_time"].replace("Z", "+00:00"))
                if now < start:
                    unlocked_match_ids.add(m["id"])
            else:
                unlocked_match_ids.add(m["id"])
        except Exception:
            unlocked_match_ids.add(m["id"])

    if unlocked_match_ids:
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

    match_ids_in_payload = [p.match_id for p in req.predictions]
    if len(match_ids_in_payload) != len(set(match_ids_in_payload)):
        raise HTTPException(400, "Duplicate match_id in payload — only 1 market per match allowed")

    for p in req.predictions:
        match = await matches_col.find_one({"id": p.match_id, "matchday_id": matchday_id}, {"_id": 0})
        if not match:
            errors.append({"match_id": p.match_id, "error": "Match not found"})
            continue
        start = datetime.fromisoformat(match["start_time"].replace("Z", "+00:00"))
        if now >= start:
            errors.append({"match_id": p.match_id, "error": "Match locked (started)"})
            continue
        if p.market_type not in ("1X2", "GOAL_NOGOL", "OVER_UNDER_25", "EXACT_SCORE"):
            errors.append({"match_id": p.match_id, "error": f"Invalid market_type: {p.market_type}"})
            continue
        valid = validate_prediction(p.prediction_value, p.market_type)
        if not valid:
            errors.append({"match_id": p.match_id, "error": f"Invalid value '{p.prediction_value}' for market {p.market_type}"})
            continue

        existing = await predictions_col.find_one({"user_id": user["id"], "match_id": p.match_id, "league_id": pred_league_id})
        ts = now_utc()
        if existing:
            update_fields = {"market_type": p.market_type, "prediction_value": p.prediction_value, "updated_at": ts}
            await predictions_col.update_one({"user_id": user["id"], "match_id": p.match_id, "league_id": pred_league_id}, {"$set": update_fields})
        else:
            doc = {
                "id": new_id(), "user_id": user["id"], "match_id": p.match_id,
                "matchday_id": matchday_id, "league_id": pred_league_id,
                "market_type": p.market_type, "prediction_value": p.prediction_value,
                "points": None, "is_correct": None, "locked": False,
                "created_at": ts, "updated_at": ts,
            }
            await predictions_col.insert_one(doc)
        saved.append({"match_id": p.match_id, "market_type": p.market_type, "value": p.prediction_value})

    return {"saved_count": len(saved), "saved": saved, "errors": errors}


@prediction_router.post("/{matchday_id}/confirm")
async def confirm_predictions(matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    if matchday["status"] in ("COMPLETED",):
        raise HTTPException(400, "Matchday is completed")
    total_matches = await matches_col.count_documents({"matchday_id": matchday_id})
    required_matches = max(total_matches, MATCHES_PER_MATCHDAY)
    pred_filter = {"user_id": user["id"], "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    user_predictions = await predictions_col.count_documents(pred_filter)
    if user_predictions < required_matches:
        raise HTTPException(400, {
            "code": "NEED_11_PREDICTIONS",
            "message": f"Devi inserire tutti e {required_matches} i pronostici per confermare",
            "current": user_predictions, "required": required_matches,
        })
    return {"status": "confirmed", "predictions_count": user_predictions, "required": required_matches, "message": f"Hai inserito tutti i {required_matches} pronostici!"}


# ========================================
# TRANSPARENCY: View other user's predictions
# ========================================
@prediction_router.get("/user/{target_user_id}/{matchday_id}")
async def get_user_predictions_transparency(target_user_id: str, matchday_id: str, league_id: str = None, user=Depends(get_current_user)):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")

    effective_status = await compute_matchday_status(matchday, NATIONAL_LEAGUE_ID)
    matchday["status"] = effective_status

    if matchday["status"] not in ("LOCKED", "LIVE", "COMPLETED"):
        raise HTTPException(403, "Pronostici visibili solo dopo il lock della giornata")

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

    matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0}).to_list(20)
    matches_dict = {m["id"]: m for m in matches}

    pred_filter = {"user_id": target_user_id, "matchday_id": matchday_id}
    if league_id:
        pred_filter["league_id"] = league_id
    preds = await predictions_col.find(pred_filter, {"_id": 0}).to_list(20)
    preds_dict = {p["match_id"]: p for p in preds}

    joker = await joker_usages_col.find_one({"user_id": target_user_id, "matchday_id": matchday_id}, {"_id": 0})
    jolly_active = joker is not None and joker.get("is_active", False)

    ss_filter = {"user_id": target_user_id, "matchday_id": matchday_id}
    if league_id:
        ss_filter["league_id"] = league_id
    score_summary = await score_summaries_col.find_one(ss_filter, {"_id": 0})

    predictions_list = []
    total_base_points = 0.0

    for m in sorted(matches, key=lambda x: x.get("start_time", "")):
        pred = preds_dict.get(m["id"])
        outcome = "pending"
        points = 0.0

        final_match_status = m["status"]
        if matchday["status"] == "COMPLETED" and final_match_status in ("scheduled", "live"):
            final_match_status = "finished"

        if pred:
            if pred.get("is_correct") is True:
                outcome = "correct"
                points = pred.get("points", 0)
            elif pred.get("is_correct") is False:
                outcome = "wrong"
                points = 0
            elif final_match_status in ("finished", "void", "postponed", "cancelled", "live"):
                pts, is_correct = calculate_match_points(
                    pred["prediction_value"], pred.get("market_type", "1X2"),
                    m.get("home_score"), m.get("away_score"), final_match_status,
                    multiplier=m.get("multiplier", 1.0),
                )
                if is_correct is True:
                    outcome = "correct"
                    points = pts
                elif is_correct is False:
                    outcome = "wrong"
                    points = 0
                else:
                    outcome = "wrong" if matchday["status"] == "COMPLETED" else "pending"
            else:
                outcome = "wrong" if matchday["status"] == "COMPLETED" else "pending"

            if final_match_status in ("void", "postponed", "cancelled"):
                outcome = "void"
                points = 0
        else:
            outcome = "no_prediction"

        if final_match_status not in ("void", "postponed", "cancelled") and outcome in ("correct",):
            total_base_points += points

        predictions_list.append({
            "match_id": m["id"], "home_team": m["home_team"], "away_team": m["away_team"],
            "competition": m.get("competition", ""), "start_time": m["start_time"],
            "home_score": m.get("home_score"), "away_score": m.get("away_score"),
            "match_status": final_match_status,
            "market_type": pred.get("market_type") if pred else None,
            "prediction_value": pred.get("prediction_value") if pred else None,
            "outcome": outcome if pred else "no_prediction",
            "points": points,
            "is_special": m.get("is_special", False), "multiplier": m.get("multiplier", 1.0),
        })

    total_points = total_base_points * 2 if jolly_active else total_base_points
    joker_bonus = total_base_points if jolly_active else 0

    return {
        "user_id": target_user_id, "username": target_user["username"],
        "matchday_id": matchday_id, "matchday_number": matchday["number"],
        "matchday_label": matchday.get("label", f"Giornata {matchday['number']}"),
        "matchday_status": matchday["status"],
        "predictions": predictions_list, "jolly_active": jolly_active,
        "base_points": total_base_points, "joker_bonus": joker_bonus,
        "total_points": total_points, "score_summary": score_summary,
    }
