"""Admin routes: seasons, matchdays, matches, leagues management, v3 console."""
from fastapi import APIRouter, HTTPException, Depends
import logging

from database import (
    leagues_col, memberships_col, matchdays_col, matches_col,
    predictions_col, score_summaries_col, seasons_col, users_col,
    payments_col, audit_logs_col
)
from database import joker_usages_col, standings_cache_col, champion_picks_col
from models import (
    SeasonCreate, AdminSeasonUpdate, MatchdayCreate, AdminMatchdayUpdate,
    MatchCreate, MatchUpdate, LiveUpdateRequest,
    new_id, now_utc
)
from auth import get_current_user
from permissions import require_permission
from scoring import calculate_match_points, calculate_matchday_total
from services import (
    NATIONAL_LEAGUE_ID, MAX_MATCHES_PER_MATCHDAY,
    VALID_TRANSITIONS, STATUS_ORDER,
    log_audit, _match_source_query, compute_matchday_status,
    recompute_matchday_kickoff, calculate_matchday_scores_full,
    create_notification_for_league, recalculate_matchday_scores
)

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])


@admin_router.get("/seasons")
async def admin_list_seasons(admin=Depends(require_permission("admin.seasons.manage"))):
    return await seasons_col.find({}, {"_id": 0}).to_list(100)


@admin_router.post("/seasons")
async def admin_create_season(req: SeasonCreate, admin=Depends(require_permission("admin.seasons.manage"))):
    season_id = new_id()
    season = {"id": season_id, "name": req.name, "year": req.year, "start_date": req.start_date, "end_date": req.end_date, "is_active": req.is_active, "created_at": now_utc()}
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


@admin_router.put("/seasons/{season_id}/current-matchday")
async def admin_set_current_matchday(season_id: str, matchday_id: str, admin=Depends(require_permission("admin.seasons.manage"))):
    season = await seasons_col.find_one({"id": season_id})
    if not season:
        raise HTTPException(404, "Season not found")
    matchday = await matchdays_col.find_one({"id": matchday_id, "season_id": season_id})
    if not matchday:
        raise HTTPException(404, "Matchday not found in this season")
    if matchday.get("league_id") != NATIONAL_LEAGUE_ID:
        raise HTTPException(400, "Solo le giornate della Lega Nazionale possono essere impostate come giornata corrente della stagione.")
    await seasons_col.update_one({"id": season_id}, {"$set": {"current_matchday_id": matchday_id}})
    await log_audit(admin["id"], admin["username"], "SET_CURRENT_MATCHDAY", "season", season_id, {"matchday_id": matchday_id, "matchday_number": matchday["number"]})
    return {"status": "success", "season_id": season_id, "current_matchday_id": matchday_id, "matchday_number": matchday["number"], "matchday_label": matchday.get("label", f"Giornata {matchday['number']}")}


@admin_router.get("/matchdays")
async def admin_list_matchdays(season_id: str = None, league_id: str = None, admin=Depends(require_permission("admin.matchdays.manage"))):
    query = {}
    if league_id and league_id != "all":
        query["league_id"] = league_id
    elif not league_id:
        query["league_id"] = NATIONAL_LEAGUE_ID
    if season_id:
        query["season_id"] = season_id
    matchdays = await matchdays_col.find(query, {"_id": 0}).sort("number", 1).to_list(500)
    for md in matchdays:
        if md.get("status") in ("OPEN", "LOCKED"):
            md["status"] = await compute_matchday_status(md, md.get("league_id", ""))
    return matchdays


@admin_router.post("/matchdays")
async def admin_create_matchday(req: MatchdayCreate, admin=Depends(require_permission("admin.matchdays.manage"))):
    md_id = new_id()
    target_league = req.league_id or NATIONAL_LEAGUE_ID
    md = {"id": md_id, "season_id": req.season_id, "number": req.number, "label": req.label or f"Giornata {req.number}", "half": req.half, "first_kickoff": req.first_kickoff, "status": req.status, "league_id": target_league, "created_at": now_utc()}
    await matchdays_col.insert_one(md)
    await log_audit(admin["id"], admin["username"], "CREATE", "matchday", md_id, {"number": req.number})
    md.pop("_id", None)
    return md


@admin_router.put("/matchdays/{matchday_id}")
async def admin_update_matchday(matchday_id: str, req: AdminMatchdayUpdate, admin=Depends(require_permission("admin.matchdays.manage"))):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates")
    if updates.get("status") == "OPEN":
        matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            season_id = matchday["season_id"]
            result = await matchdays_col.update_many({"season_id": season_id, "id": {"$ne": matchday_id}, "status": "OPEN"}, {"$set": {"status": "LOCKED"}})
            if result.modified_count > 0:
                await log_audit(admin["id"], admin["username"], "AUTO_LOCK", "matchday", season_id, {"locked_count": result.modified_count, "reason": f"New OPEN matchday {matchday_id}"})
    await matchdays_col.update_one({"id": matchday_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "matchday", matchday_id, updates)

    if updates.get("status") == "OPEN":
        matchday = matchday or await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            md_num = matchday.get("number", "?")
            league_id_for_notif = matchday.get("league_id", NATIONAL_LEAGUE_ID)
            leagues_using = await leagues_col.find({"$or": [{"id": league_id_for_notif}, {"league_type": "national"}]}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
            for lg in leagues_using:
                await create_notification_for_league(lg["id"], "matchday_open", f"Giornata {md_num} aperta!", f"I pronostici per la Giornata {md_num} sono ora aperti. Inserisci i tuoi pronostici!", link=f"/predictions?matchday={matchday_id}")

    if updates.get("status") == "COMPLETED":
        logger.info(f"[ADMIN] Matchday {matchday_id} set to COMPLETED - calculating scores...")
        await calculate_matchday_scores_full(matchday_id, admin)
        matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            md_num = matchday.get("number", "?")
            league_id_for_notif = matchday.get("league_id", NATIONAL_LEAGUE_ID)
            leagues_using = await leagues_col.find({"$or": [{"id": league_id_for_notif}, {"league_type": "national"}]}, {"_id": 0, "id": 1}).to_list(50)
            for lg in leagues_using:
                await create_notification_for_league(lg["id"], "standings_updated", f"Classifica aggiornata!", f"I risultati della Giornata {md_num} sono stati calcolati. Controlla la classifica!", link="/rankings")

    return await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})


@admin_router.delete("/leagues/{league_id}")
async def admin_delete_league(league_id: str, admin=Depends(require_permission("admin.leagues.manage"))):
    league = await leagues_col.find_one({"id": league_id})
    if not league:
        raise HTTPException(404, "League not found")
    if league.get("league_type") == "national":
        raise HTTPException(400, "La Lega Nazionale non puo essere eliminata")
    del_predictions = await predictions_col.delete_many({"league_id": league_id})
    del_scores = await score_summaries_col.delete_many({"league_id": league_id})
    del_standings = await standings_cache_col.delete_many({"league_id": league_id})
    del_champions = await champion_picks_col.delete_many({"league_id": league_id})
    del_jokers = await joker_usages_col.delete_many({"league_id": league_id})
    del_matches = await matches_col.delete_many({"league_id": league_id})
    del_matchdays = await matchdays_col.delete_many({"league_id": league_id})
    del_memberships = await memberships_col.delete_many({"league_id": league_id})
    await leagues_col.delete_one({"id": league_id})
    await log_audit(admin["id"], admin["username"], "DELETE", "league", league_id, {"league_name": league.get("name", ""), "deleted_matchdays": del_matchdays.deleted_count, "deleted_matches": del_matches.deleted_count, "deleted_predictions": del_predictions.deleted_count, "deleted_memberships": del_memberships.deleted_count, "deleted_scores": del_scores.deleted_count})
    return {"status": "deleted", "league_id": league_id, "deleted_matchdays": del_matchdays.deleted_count, "deleted_matches": del_matches.deleted_count, "deleted_predictions": del_predictions.deleted_count, "deleted_memberships": del_memberships.deleted_count}


@admin_router.delete("/matchdays/{matchday_id}")
async def admin_delete_matchday(matchday_id: str, admin=Depends(require_permission("admin.matchdays.manage"))):
    matchday = await matchdays_col.find_one({"id": matchday_id})
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    await matches_col.delete_many({"matchday_id": matchday_id})
    await predictions_col.delete_many({"matchday_id": matchday_id})
    await score_summaries_col.delete_many({"matchday_id": matchday_id})
    await joker_usages_col.delete_many({"matchday_id": matchday_id})
    await matchdays_col.delete_one({"id": matchday_id})
    await log_audit(admin["id"], admin["username"], "DELETE", "matchday", matchday_id, {})
    return {"status": "deleted", "matchday_id": matchday_id}


@admin_router.get("/matches")
async def admin_list_matches(matchday_id: str = None, admin=Depends(require_permission("admin.matches.manage"))):
    query = {}
    if matchday_id:
        query["matchday_id"] = matchday_id
    return await matches_col.find(query, {"_id": 0}).to_list(100)


@admin_router.post("/matches")
async def admin_create_match(req: MatchCreate, admin=Depends(require_permission("admin.matches.manage"))):
    matchday = await matchdays_col.find_one({"id": req.matchday_id}, {"_id": 0, "league_id": 1})
    match_league_id = matchday.get("league_id", NATIONAL_LEAGUE_ID) if matchday else NATIONAL_LEAGUE_ID
    current_count = await matches_col.count_documents({"matchday_id": req.matchday_id, "league_id": match_league_id})
    if current_count >= MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Limite massimo di {MAX_MATCHES_PER_MATCHDAY} partite per giornata raggiunto")
    match_id = new_id()
    match = {"id": match_id, "matchday_id": req.matchday_id, "league_id": match_league_id, "home_team": req.home_team, "away_team": req.away_team, "competition": req.competition, "start_time": req.start_time, "market_type": req.market_type, "status": req.status, "home_score": None, "away_score": None, "created_at": now_utc()}
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
    match = await matches_col.find_one({"id": match_id})
    if not match:
        raise HTTPException(404, "Match not found")
    deleted_predictions = await predictions_col.delete_many({"match_id": match_id})
    await matches_col.delete_one({"id": match_id})
    await log_audit(admin["id"], admin["username"], "DELETE", "match", match_id, {"teams": f"{match.get('home_team')} vs {match.get('away_team')}", "deleted_predictions": deleted_predictions.deleted_count})
    return {"status": "deleted", "match_id": match_id, "deleted_predictions": deleted_predictions.deleted_count}


@admin_router.post("/matches/{match_id}/special")
async def admin_set_special_match(match_id: str, body: dict = {}, user=Depends(get_current_user)):
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        match_league_id = match.get("league_id")
        if match_league_id:
            league_of_match = await leagues_col.find_one({"id": match_league_id}, {"_id": 0})
            if not league_of_match or league_of_match.get("owner_id") != user["id"]:
                raise HTTPException(403, "Solo il creatore della lega o un super admin può impostare X3")
        else:
            raise HTTPException(403, "Solo un super admin può impostare X3 sulle partite nazionali")
    new_special = body.get("is_special", not match.get("is_special", False))
    matchday_id = match.get("matchday_id")
    if new_special:
        await matches_col.update_many({"matchday_id": matchday_id, "is_special": True, "id": {"$ne": match_id}}, {"$set": {"is_special": False, "multiplier": 1.0}})
        await matches_col.update_one({"id": match_id}, {"$set": {"is_special": True, "multiplier": 3.0}})
        logger.info(f"[SPECIAL] Match {match_id} set as X3 special in matchday {matchday_id}")
    else:
        await matches_col.update_one({"id": match_id}, {"$set": {"is_special": False, "multiplier": 1.0}})
        logger.info(f"[SPECIAL] Match {match_id} unset as special in matchday {matchday_id}")
    return {"status": "ok", "match_id": match_id, "is_special": new_special, "multiplier": 3.0 if new_special else 1.0}


@admin_router.post("/matches/{match_id}/live-update")
async def admin_live_update(match_id: str, req: LiveUpdateRequest, admin=Depends(require_permission("admin.matches.manage"))):
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Match not found")
    updates = {"home_score": req.home_score, "away_score": req.away_score, "status": req.status}
    await matches_col.update_one({"id": match_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "LIVE_UPDATE", "match", match_id, updates)
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@admin_router.post("/matchdays/{matchday_id}/confirm")
async def admin_confirm_matchday(matchday_id: str, admin=Depends(require_permission("admin.matchdays.manage"))):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    users_scored = await calculate_matchday_scores_full(matchday_id, admin)
    await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status": "COMPLETED"}})
    await log_audit(admin["id"], admin["username"], "CONFIRM", "matchday", matchday_id, {"users_scored": users_scored})
    return {"message": "Matchday confirmed", "users_scored": users_scored}


@admin_router.post("/matchdays/{matchday_id}/recalc")
async def admin_recalc_standings(matchday_id: str, admin=Depends(require_permission("admin.matchdays.manage"))):
    return await admin_confirm_matchday(matchday_id, admin)


# ========================================
# ADMIN V3 – UNIFIED CONSOLE ENDPOINTS
# ========================================
from auth import get_current_user

@admin_router.get("/v3/leagues")
async def admin_v3_leagues(user=Depends(get_current_user)):
    is_super = user.get("role") in ("admin", "superadmin")
    results = []
    if is_super:
        nat = await leagues_col.find_one({"id": NATIONAL_LEAGUE_ID}, {"_id": 0})
        if nat:
            nat["_is_national"] = True
            results.append(nat)
    if is_super:
        privates = await leagues_col.find({"id": {"$ne": NATIONAL_LEAGUE_ID}}, {"_id": 0}).to_list(200)
    else:
        owned_ids = await memberships_col.find({"user_id": user["id"], "role": {"$in": ["owner", "admin"]}, "status": "active"}, {"league_id": 1, "_id": 0}).to_list(100)
        league_ids = [m["league_id"] for m in owned_ids]
        privates = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0}).to_list(100) if league_ids else []
    for lg in privates:
        lg["_is_national"] = False
        source = lg.get("match_source_type", "")
        lg["_can_manage_matches"] = source in ("manual", "custom", "api") or is_super
        lg["member_count"] = await memberships_col.count_documents({"league_id": lg["id"], "status": "active"})
        results.append(lg)
    if not is_super:
        results = [lg for lg in results if lg.get("_can_manage_matches", False)]
    return results


@admin_router.get("/v3/matchdays")
async def admin_v3_matchdays(league_id: str, season_id: str = None, user=Depends(get_current_user)):
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "role": {"$in": ["owner", "admin"]}, "status": "active"})
        if not mem:
            raise HTTPException(403, "Non hai i permessi per gestire questa lega")
    query = {"league_id": league_id}
    if season_id:
        query["season_id"] = season_id
    matchdays = await matchdays_col.find(query, {"_id": 0}).sort("number", 1).to_list(100)
    for md in matchdays:
        md_id = md["id"]
        md["match_count"] = await matches_col.count_documents({"matchday_id": md_id, "league_id": league_id})
        md["results_count"] = await matches_col.count_documents({"matchday_id": md_id, "league_id": league_id, "home_score": {"$ne": None}, "away_score": {"$ne": None}})
        pred_users = await predictions_col.distinct("user_id", {"matchday_id": md_id, "league_id": league_id})
        md["predictions_user_count"] = len(pred_users)
        effective_status = await compute_matchday_status(md, league_id)
        if effective_status != md.get("status"):
            md["status"] = effective_status
    return matchdays


@admin_router.post("/matchday/{matchday_id}/transition")
async def admin_v3_transition(matchday_id: str, body: dict, user=Depends(get_current_user)):
    league_id = body.get("league_id")
    target_status = body.get("target_status")
    if not league_id or not target_status:
        raise HTTPException(400, "league_id e target_status sono obbligatori")
    if target_status not in STATUS_ORDER:
        raise HTTPException(400, f"target_status non valido: {target_status}")
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        mem = await memberships_col.find_one({"user_id": user["id"], "league_id": league_id, "role": {"$in": ["owner", "admin"]}, "status": "active"})
        if not mem:
            raise HTTPException(403, "Non hai i permessi per gestire questa lega")
    matchday = await matchdays_col.find_one({"id": matchday_id, "league_id": league_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Giornata non trovata per questa lega")
    current_status = matchday.get("status", "DRAFT")
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise HTTPException(400, f"Transizione non permessa: {current_status} -> {target_status}. Le transizioni OPEN->LIVE e LIVE->COMPLETED sono automatiche.")
    match_count = await matches_col.count_documents({"matchday_id": matchday_id, "league_id": league_id})
    if target_status == "OPEN":
        if match_count < 1:
            raise HTTPException(400, "Impossibile pubblicare: inserisci almeno 1 partita")
        await recompute_matchday_kickoff(matchday_id, league_id)
    if target_status == "OPEN":
        season_id = matchday.get("season_id")
        if season_id:
            await matchdays_col.update_many({"season_id": season_id, "league_id": league_id, "id": {"$ne": matchday_id}, "status": "OPEN"}, {"$set": {"status": "DRAFT"}})
            await seasons_col.update_one({"id": season_id}, {"$set": {"current_matchday_id": matchday_id}})
            logger.info(f"[ADMIN_V3] Season {season_id} current_matchday_id -> {matchday_id}")
    await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status": target_status}, "$unset": {"status_override": ""}})
    admin_username = user.get("username", user.get("email", "unknown"))
    await log_audit(user["id"], admin_username, "TRANSITION", "matchday", matchday_id, {"from": current_status, "to": target_status, "league_id": league_id})
    return {"status": "ok", "matchday_id": matchday_id, "previous_status": current_status, "new_status": target_status, "league_id": league_id}


@admin_router.post("/matchday/{matchday_id}/override")
async def admin_v3_override(matchday_id: str, body: dict, user=Depends(get_current_user)):
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
        await matchdays_col.update_one({"id": matchday_id}, {"$unset": {"status_override": ""}})
        await log_audit(user["id"], admin_username, "OVERRIDE_CLEAR", "matchday", matchday_id, {"league_id": league_id})
        return {"status": "ok", "message": "Override rimosso", "matchday_id": matchday_id}
    if target_status not in ("DRAFT", "OPEN", "LIVE", "COMPLETED"):
        raise HTTPException(400, f"target_status non valido: {target_status}")
    await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status_override": target_status, "status": target_status}})
    if target_status == "COMPLETED":
        logger.info(f"[SUPER_ADMIN] Force COMPLETED matchday {matchday_id} — calculating scores")
        await recalculate_matchday_scores(matchday_id, league_id)
    await log_audit(user["id"], admin_username, "OVERRIDE", "matchday", matchday_id, {"target_status": target_status, "league_id": league_id})
    return {"status": "ok", "message": f"Override forzato a {target_status}", "matchday_id": matchday_id, "new_status": target_status}


@admin_router.post("/matchday/{matchday_id}/recalculate")
async def admin_v3_recalculate(matchday_id: str, body: dict, user=Depends(get_current_user)):
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
# PUSH NOTIFICATIONS (ADMIN)
# ========================================
@admin_router.post("/push/broadcast")
async def admin_push_broadcast(request_body: dict, admin=Depends(require_permission("admin.dashboard.view"))):
    """Send a push notification to all users or a specific league."""
    from services import create_notification, create_notification_for_league, PUSH_ENABLED

    title = request_body.get("title", "").strip()
    body = request_body.get("body", "").strip()
    target = request_body.get("target", "all")
    image_url = request_body.get("image_url", "").strip()
    if not title or not body:
        raise HTTPException(400, "Titolo e messaggio sono obbligatori")

    if not PUSH_ENABLED:
        raise HTTPException(503, "Push notifications non attive. Imposta PUSH_NOTIFICATIONS_ENABLED=true nel .env")

    sent_count = 0
    if target == "all":
        all_users = await users_col.find(
            {"is_deleted": {"$ne": True}, "is_disabled": {"$ne": True}},
            {"_id": 0, "id": 1}
        ).to_list(10000)
        for u in all_users:
            await create_notification(u["id"], "admin_broadcast", title, body, image=image_url)
            sent_count += 1
    else:
        league = await leagues_col.find_one({"id": target}, {"_id": 0})
        if not league:
            raise HTTPException(404, "Lega non trovata")
        members = await memberships_col.find(
            {"league_id": target, "status": "active"}, {"user_id": 1, "_id": 0}
        ).to_list(500)
        for m in members:
            await create_notification(m["user_id"], "admin_broadcast", title, body, image=image_url)
        sent_count = len(members)

    await log_audit(
        admin["id"], admin["username"], "PUSH_BROADCAST", "notification", "",
        {"title": title, "target": target, "sent_count": sent_count, "image_url": image_url or None},
    )
    return {"sent_count": sent_count, "target": target}


@admin_router.post("/push/user/{user_id}")
async def admin_push_to_user(user_id: str, request_body: dict, admin=Depends(require_permission("admin.users.manage"))):
    """Send a push notification to a specific user."""
    from services import create_notification, PUSH_ENABLED

    title = request_body.get("title", "").strip()
    body = request_body.get("body", "").strip()
    image_url = request_body.get("image_url", "").strip()
    if not title or not body:
        raise HTTPException(400, "Titolo e messaggio sono obbligatori")

    if not PUSH_ENABLED:
        raise HTTPException(503, "Push notifications non attive")

    target_user = await users_col.find_one({"id": user_id}, {"_id": 0, "id": 1, "username": 1})
    if not target_user:
        raise HTTPException(404, "Utente non trovato")

    await create_notification(user_id, "admin_message", title, body, image=image_url)

    await log_audit(
        admin["id"], admin["username"], "PUSH_USER", "notification", user_id,
        {"title": title, "target_username": target_user["username"], "image_url": image_url or None},
    )
    return {"sent": True, "user_id": user_id}


@admin_router.get("/push/history")
async def admin_push_history(limit: int = 50, admin=Depends(require_permission("admin.dashboard.view"))):
    """Get recent admin-sent notifications history."""
    from database import notifications_col
    notifs = await notifications_col.find(
        {"type": {"$in": ["admin_broadcast", "admin_message"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    user_ids = list(set(n.get("user_id", "") for n in notifs))
    users_map = {}
    if user_ids:
        users_list = await users_col.find(
            {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}
        ).to_list(len(user_ids))
        users_map = {u["id"]: u for u in users_list}

    result = []
    for n in notifs:
        u = users_map.get(n.get("user_id", ""))
        result.append({
            "id": n.get("id"),
            "type": n.get("type"),
            "title": n.get("title"),
            "message": n.get("message"),
            "image": n.get("image", ""),
            "user_id": n.get("user_id"),
            "username": u["username"] if u else "?",
            "email": u["email"] if u else "",
            "read": n.get("read", False),
            "created_at": n.get("created_at"),
        })
    return result


@admin_router.get("/push/reminders-status")
async def admin_reminders_status(admin=Depends(require_permission("admin.dashboard.view"))):
    """Get the status of automatic reminder notifications."""
    from services import PUSH_ENABLED, REMINDER_CHECK_INTERVAL
    from database import notifications_col

    recent_reminders = await notifications_col.find(
        {"type": {"$regex": "^reminder_"}},
        {"_id": 0, "id": 1, "type": 1, "title": 1, "message": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(10)

    return {
        "push_enabled": PUSH_ENABLED,
        "check_interval_seconds": REMINDER_CHECK_INTERVAL,
        "reminder_types": [
            {"type": "reminder_24h", "label": "24 ore prima della chiusura", "description": "Inviata a tutti i membri della lega quando mancano 24 ore"},
            {"type": "reminder_2h", "label": "2 ore prima della chiusura", "description": "Inviata solo a chi NON ha ancora inserito i pronostici"},
        ],
        "recent_reminders": recent_reminders,
    }

