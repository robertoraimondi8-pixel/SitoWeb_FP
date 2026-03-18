"""Admin routes: seasons, matchdays, matches, leagues management, v3 console."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel as PydanticBaseModel
import logging

from database import (
    leagues_col, memberships_col, matchdays_col, matches_col,
    predictions_col, score_summaries_col, seasons_col, users_col,
    payments_col, audit_logs_col, tournaments_col
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
import services
from services import (
    MAX_MATCHES_PER_MATCHDAY,
    VALID_TRANSITIONS, STATUS_ORDER,
    log_audit, _match_source_query, compute_matchday_status,
    recompute_matchday_kickoff, calculate_matchday_scores_full,
    create_notification_for_league, recalculate_matchday_scores,
    get_league_matchday_range, check_league_auto_completion, complete_season,
    complete_league, SEASON_STATES, LEAGUE_STATES
)

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/api/admin", tags=["Admin"])


@admin_router.get("/seasons")
async def admin_list_seasons(admin=Depends(require_permission("admin.seasons.manage"))):
    return await seasons_col.find({}, {"_id": 0}).to_list(100)


@admin_router.post("/seasons")
async def admin_create_season(req: SeasonCreate, admin=Depends(require_permission("admin.seasons.manage"))):
    season_id = new_id()
    season = {"id": season_id, "name": req.name, "year": req.year, "start_date": req.start_date, "end_date": req.end_date, "is_active": req.is_active, "status": "draft", "total_matchdays": req.total_matchdays, "current_matchday": req.current_matchday, "created_at": now_utc()}
    await seasons_col.insert_one(season)
    await log_audit(admin["id"], admin["username"], "CREATE", "season", season_id, {"name": req.name}, ip=admin.get("_request_ip"))
    season.pop("_id", None)
    return season


@admin_router.put("/seasons/{season_id}")
async def admin_update_season(season_id: str, req: AdminSeasonUpdate, admin=Depends(require_permission("admin.seasons.manage"))):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No updates provided")
    await seasons_col.update_one({"id": season_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "season", season_id, updates, ip=admin.get("_request_ip"))
    return await seasons_col.find_one({"id": season_id}, {"_id": 0})


@admin_router.put("/seasons/{season_id}/current-matchday")
async def admin_set_current_matchday(season_id: str, matchday_id: str, admin=Depends(require_permission("admin.seasons.manage"))):
    season = await seasons_col.find_one({"id": season_id})
    if not season:
        raise HTTPException(404, "Season not found")
    matchday = await matchdays_col.find_one({"id": matchday_id, "season_id": season_id})
    if not matchday:
        raise HTTPException(404, "Matchday not found in this season")
    if matchday.get("league_id") != services.NATIONAL_LEAGUE_ID:
        raise HTTPException(400, "Solo le giornate della Lega Nazionale possono essere impostate come giornata corrente della stagione.")
    await seasons_col.update_one({"id": season_id}, {"$set": {"current_matchday_id": matchday_id}})
    await log_audit(admin["id"], admin["username"], "SET_CURRENT_MATCHDAY", "season", season_id, {"matchday_id": matchday_id, "matchday_number": matchday["number"]}, ip=admin.get("_request_ip"))
    return {"status": "success", "season_id": season_id, "current_matchday_id": matchday_id, "matchday_number": matchday["number"], "matchday_label": matchday.get("label", f"Giornata {matchday['number']}")}


@admin_router.post("/seasons/{season_id}/activate")
async def admin_activate_season(season_id: str, admin=Depends(require_permission("admin.seasons.manage"))):
    """Activate a season (draft -> active). Deactivates all other seasons."""
    season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    if not season:
        raise HTTPException(404, "Stagione non trovata")
    current_status = season.get("status", "draft")
    if current_status not in ("draft",):
        raise HTTPException(400, f"Solo le stagioni in draft possono essere attivate. Stato attuale: {current_status}")
    # Deactivate other active seasons
    await seasons_col.update_many({"id": {"$ne": season_id}}, {"$set": {"is_active": False, "status": "draft"}})
    await seasons_col.update_one({"id": season_id}, {"$set": {"status": "active", "is_active": True}})
    await log_audit(admin["id"], admin["username"], "ACTIVATE_SEASON", "season", season_id, {"name": season.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True, "status": "active"}


@admin_router.post("/seasons/{season_id}/complete")
async def admin_complete_season(season_id: str, admin=Depends(require_permission("admin.seasons.manage"))):
    """Complete a season: close all competitions, freeze standings, update palmares."""
    season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    if not season:
        raise HTTPException(404, "Stagione non trovata")
    current_status = season.get("status", "active")
    if current_status == "completed":
        raise HTTPException(400, "Stagione già completata")
    if current_status == "archived":
        raise HTTPException(400, "Stagione già archiviata")
    results = await complete_season(season_id, admin)
    if "error" in results:
        raise HTTPException(400, results["error"])
    return {"ok": True, "status": "completed", **results}


@admin_router.post("/seasons/{season_id}/archive")
async def admin_archive_season(season_id: str, admin=Depends(require_permission("admin.seasons.manage"))):
    """Archive a completed season (completed -> archived)."""
    season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    if not season:
        raise HTTPException(404, "Stagione non trovata")
    current_status = season.get("status", "draft")
    if current_status != "completed":
        raise HTTPException(400, f"Solo le stagioni completate possono essere archiviate. Stato attuale: {current_status}")
    await seasons_col.update_one({"id": season_id}, {"$set": {"status": "archived"}})
    await log_audit(admin["id"], admin["username"], "ARCHIVE_SEASON", "season", season_id, {"name": season.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True, "status": "archived"}


@admin_router.delete("/seasons/{season_id}")
async def admin_delete_season(season_id: str, admin=Depends(require_permission("admin.seasons.manage"))):
    """Delete a season. Only draft/archived seasons without leagues can be deleted."""
    season = await seasons_col.find_one({"id": season_id}, {"_id": 0})
    if not season:
        raise HTTPException(404, "Stagione non trovata")
    current_status = season.get("status", "draft")
    if current_status == "active":
        raise HTTPException(400, "Non puoi eliminare una stagione attiva. Completala o disattivala prima.")
    league_count = await leagues_col.count_documents({"season_id": season_id})
    if league_count > 0:
        raise HTTPException(400, f"Non puoi eliminare questa stagione: ha {league_count} leghe collegate.")
    await seasons_col.delete_one({"id": season_id})
    await log_audit(admin["id"], admin["username"], "DELETE", "season", season_id, {"name": season.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True}


@admin_router.get("/league-matchday-range")
async def admin_league_matchday_range(season_id: str, admin=Depends(require_permission("admin.leagues.manage"))):
    """Get the valid selectable matchday range for league creation."""
    first_selectable, last_matchday = await get_league_matchday_range(season_id)
    return {"first_selectable": first_selectable, "last_matchday": last_matchday}


@admin_router.post("/leagues/{league_id}/complete")
async def admin_complete_league(league_id: str, admin=Depends(require_permission("admin.leagues.manage"))):
    """Manually complete a league."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    if league.get("status") == "completed":
        raise HTTPException(400, "Lega già completata")
    await complete_league(league_id)
    await log_audit(admin["id"], admin["username"], "COMPLETE_LEAGUE", "league", league_id, {"name": league.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True, "status": "completed"}


@admin_router.get("/matchdays")
async def admin_list_matchdays(season_id: str = None, league_id: str = None, admin=Depends(require_permission("admin.matchdays.manage"))):
    query = {}
    if league_id and league_id != "all":
        query["league_id"] = league_id
    elif not league_id:
        query["league_id"] = services.NATIONAL_LEAGUE_ID
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
    target_league = req.league_id or services.NATIONAL_LEAGUE_ID
    md = {"id": md_id, "season_id": req.season_id, "number": req.number, "label": req.label or f"Giornata {req.number}", "half": req.half, "first_kickoff": req.first_kickoff, "status": req.status, "league_id": target_league, "created_at": now_utc()}
    await matchdays_col.insert_one(md)
    await log_audit(admin["id"], admin["username"], "CREATE", "matchday", md_id, {"number": req.number}, ip=admin.get("_request_ip"))
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
                await log_audit(admin["id"], admin["username"], "AUTO_LOCK", "matchday", season_id, {"locked_count": result.modified_count, "reason": f"New OPEN matchday {matchday_id}"}, ip=admin.get("_request_ip"))
    await matchdays_col.update_one({"id": matchday_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "matchday", matchday_id, updates, ip=admin.get("_request_ip"))

    if updates.get("status") == "OPEN":
        matchday = matchday or await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            md_num = matchday.get("number", "?")
            league_id_for_notif = matchday.get("league_id", services.NATIONAL_LEAGUE_ID)
            leagues_using = await leagues_col.find({"$or": [{"id": league_id_for_notif}, {"league_type": "national"}]}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
            for lg in leagues_using:
                await create_notification_for_league(lg["id"], "matchday_open", f"Giornata {md_num} aperta!", f"I pronostici per la Giornata {md_num} sono ora aperti. Inserisci i tuoi pronostici!", link=f"/predictions?matchday={matchday_id}")

    if updates.get("status") == "COMPLETED":
        logger.info(f"[ADMIN] Matchday {matchday_id} set to COMPLETED - calculating scores...")
        await calculate_matchday_scores_full(matchday_id, admin)
        matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
        if matchday:
            md_num = matchday.get("number", "?")
            league_id_for_notif = matchday.get("league_id", services.NATIONAL_LEAGUE_ID)
            leagues_using = await leagues_col.find({"$or": [{"id": league_id_for_notif}, {"league_type": "national"}]}, {"_id": 0, "id": 1}).to_list(50)
            for lg in leagues_using:
                await create_notification_for_league(lg["id"], "standings_updated", f"Classifica aggiornata!", f"I risultati della Giornata {md_num} sono stati calcolati. Controlla la classifica!", link="/rankings")

        # Auto-complete leagues whose end_matchday matches this matchday
        try:
            await check_league_auto_completion(matchday_id, league_id_for_notif)
        except Exception as e:
            logger.error(f"[LIFECYCLE] Error checking auto-completion: {e}")

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
    await log_audit(admin["id"], admin["username"], "DELETE", "league", league_id, {"league_name": league.get("name", ""), "deleted_matchdays": del_matchdays.deleted_count, "deleted_matches": del_matches.deleted_count, "deleted_predictions": del_predictions.deleted_count, "deleted_memberships": del_memberships.deleted_count, "deleted_scores": del_scores.deleted_count}, ip=admin.get("_request_ip"))
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
    await log_audit(admin["id"], admin["username"], "DELETE", "matchday", matchday_id, {}, ip=admin.get("_request_ip"))
    return {"status": "deleted", "matchday_id": matchday_id}


@admin_router.get("/matches")
async def admin_list_matches(
    matchday_id: str = None,
    league_id: str = None,
    status: str = None,
    filter: str = None,
    admin=Depends(require_permission("admin.matches.manage"))
):
    query = {}
    if matchday_id:
        query["matchday_id"] = matchday_id
    if league_id:
        query["league_id"] = league_id
    if status:
        query["status"] = status

    # Special filters
    if filter == "inconsistent":
        completed_mds = await matchdays_col.find_one({}, {"_id": 0})  # check
        completed_mds_list = await matchdays_col.find({"status": "COMPLETED"}, {"_id": 0, "id": 1}).to_list(500)
        completed_ids = [md["id"] for md in completed_mds_list]
        query = {"matchday_id": {"$in": completed_ids}, "status": {"$in": ["scheduled", "live"]}}
    elif filter == "no_result":
        query = {"status": "finished", "$or": [{"home_score": None}, {"away_score": None}]}

    matches = await matches_col.find(query, {"_id": 0}).sort("kickoff", -1).to_list(300)

    # Enrich with matchday label and league name
    md_cache = {}
    league_cache = {}
    for m in matches:
        mid = m.get("matchday_id")
        if mid and mid not in md_cache:
            md_doc = await matchdays_col.find_one({"id": mid}, {"_id": 0, "label": 1, "league_id": 1, "status": 1})
            md_cache[mid] = md_doc or {}
        md_info = md_cache.get(mid, {})
        m["matchday_label"] = md_info.get("label", "?")
        m["matchday_status"] = md_info.get("status", "?")
        lid = m.get("league_id")
        if lid and lid not in league_cache:
            lg = await leagues_col.find_one({"id": lid}, {"_id": 0, "name": 1})
            if not lg:
                lg = await tournaments_col.find_one({"id": lid}, {"_id": 0, "name": 1})
            league_cache[lid] = lg or {}
        m["league_name"] = league_cache.get(lid, {}).get("name", lid[:12] if lid else "?")

    return {"count": len(matches), "matches": matches}


@admin_router.post("/matches")
async def admin_create_match(req: MatchCreate, admin=Depends(require_permission("admin.matches.manage"))):
    matchday = await matchdays_col.find_one({"id": req.matchday_id}, {"_id": 0, "league_id": 1})
    match_league_id = matchday.get("league_id", services.NATIONAL_LEAGUE_ID) if matchday else services.NATIONAL_LEAGUE_ID
    current_count = await matches_col.count_documents({"matchday_id": req.matchday_id, "league_id": match_league_id})
    if current_count >= MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Limite massimo di {MAX_MATCHES_PER_MATCHDAY} partite per giornata raggiunto")
    match_id = new_id()
    match = {"id": match_id, "matchday_id": req.matchday_id, "league_id": match_league_id, "home_team": req.home_team, "away_team": req.away_team, "competition": req.competition, "start_time": req.start_time, "market_type": req.market_type, "status": req.status, "home_score": None, "away_score": None, "created_at": now_utc()}
    await matches_col.insert_one(match)
    await log_audit(admin["id"], admin["username"], "CREATE", "match", match_id, {"teams": f"{req.home_team} vs {req.away_team}"}, ip=admin.get("_request_ip"))
    match.pop("_id", None)
    return match


@admin_router.put("/matches/{match_id}")
async def admin_update_match(match_id: str, body: dict = {}, admin=Depends(require_permission("admin.matches.manage"))):
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")
    allowed_fields = {"home_score", "away_score", "status", "kickoff", "home_team", "away_team", "competition", "start_time", "market_type"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}
    # Map kickoff -> start_time (the DB field)
    if "kickoff" in updates:
        updates["start_time"] = updates.pop("kickoff")
    if not updates:
        raise HTTPException(400, "Nessun campo valido da aggiornare")
    if "status" in updates and updates["status"] not in ("scheduled", "live", "finished", "suspended", "postponed", "cancelled", "void"):
        raise HTTPException(400, "Stato non valido. Valori ammessi: scheduled, live, finished")
    if "home_score" in updates and updates["home_score"] is not None:
        updates["home_score"] = int(updates["home_score"])
    if "away_score" in updates and updates["away_score"] is not None:
        updates["away_score"] = int(updates["away_score"])
    await matches_col.update_one({"id": match_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "match", match_id, updates, ip=admin.get("_request_ip"))
    return {"ok": True, "match_id": match_id, "updates": updates}


@admin_router.delete("/matches/{match_id}")
async def admin_delete_match(match_id: str, force: bool = False, admin=Depends(require_permission("admin.matches.manage"))):
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")
    pred_count = await predictions_col.count_documents({"match_id": match_id})
    if pred_count > 0 and not force:
        raise HTTPException(409, f"Questa partita ha {pred_count} pronostici. Usa force=true per eliminare comunque.")
    if pred_count > 0 and force:
        await predictions_col.delete_many({"match_id": match_id})
    await matches_col.delete_one({"id": match_id})
    await log_audit(admin["id"], admin["username"], "DELETE", "match", match_id, {"teams": f"{match.get('home_team')} vs {match.get('away_team')}", "predictions_deleted": pred_count if force else 0}, ip=admin.get("_request_ip"))
    return {"ok": True, "match_id": match_id, "predictions_deleted": pred_count if force else 0}


@admin_router.post("/matches/{match_id}/special")
async def admin_set_special_match(match_id: str, body: dict = {}, user=Depends(get_current_user)):
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")
    is_super = user.get("role") in ("admin", "superadmin") or user.get("is_super_admin")
    if not is_super:
        match_league_id = match.get("league_id")
        if match_league_id:
            # Check if it's a tournament match
            from database import tournaments_col
            tournament = await tournaments_col.find_one({"id": match_league_id}, {"_id": 0})
            if tournament:
                if tournament.get("created_by") != user["id"]:
                    raise HTTPException(403, "Solo il creatore del torneo o un super admin può impostare X3")
            else:
                league_of_match = await leagues_col.find_one({"id": match_league_id}, {"_id": 0})
                if not league_of_match or league_of_match.get("owner_id") != user["id"]:
                    raise HTTPException(403, "Solo il creatore della lega o un super admin può impostare X3")
        else:
            raise HTTPException(403, "Solo un super admin può impostare X3 sulle partite nazionali")
    new_special = body.get("is_special", not match.get("is_special", False))
    matchday_id = match.get("matchday_id")
    if new_special:
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
    await log_audit(admin["id"], admin["username"], "LIVE_UPDATE", "match", match_id, updates, ip=admin.get("_request_ip"))
    return await matches_col.find_one({"id": match_id}, {"_id": 0})


@admin_router.post("/matchdays/{matchday_id}/confirm")
async def admin_confirm_matchday(matchday_id: str, admin=Depends(require_permission("admin.matchdays.manage"))):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Matchday not found")
    users_scored = await calculate_matchday_scores_full(matchday_id, admin)
    await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status": "COMPLETED"}})
    await log_audit(admin["id"], admin["username"], "CONFIRM", "matchday", matchday_id, {"users_scored": users_scored}, ip=admin.get("_request_ip"))
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
        nat = await leagues_col.find_one({"id": services.NATIONAL_LEAGUE_ID}, {"_id": 0})
        if nat:
            nat["_is_national"] = True
            results.append(nat)
    if is_super:
        privates = await leagues_col.find({"id": {"$ne": services.NATIONAL_LEAGUE_ID}}, {"_id": 0}).to_list(200)
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
    await log_audit(user["id"], admin_username, "TRANSITION", "matchday", matchday_id, {"from": current_status, "to": target_status, "league_id": league_id}, ip=user.get("_request_ip"))
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
        await log_audit(user["id"], admin_username, "OVERRIDE_CLEAR", "matchday", matchday_id, {"league_id": league_id}, ip=user.get("_request_ip"))
        return {"status": "ok", "message": "Override rimosso", "matchday_id": matchday_id}
    if target_status not in ("DRAFT", "OPEN", "LIVE", "COMPLETED"):
        raise HTTPException(400, f"target_status non valido: {target_status}")
    await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status_override": target_status, "status": target_status}})
    if target_status == "COMPLETED":
        logger.info(f"[SUPER_ADMIN] Force COMPLETED matchday {matchday_id} — calculating scores")
        await recalculate_matchday_scores(matchday_id, league_id)
    await log_audit(user["id"], admin_username, "OVERRIDE", "matchday", matchday_id, {"target_status": target_status, "league_id": league_id}, ip=user.get("_request_ip"))
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
    await log_audit(user["id"], admin_username, "RECALCULATE", "matchday", matchday_id, {"league_id": league_id}, ip=user.get("_request_ip"))
    return {"status": "ok", "message": "Ricalcolo completato", "matchday_id": matchday_id}


@admin_router.get("/audit-logs")
async def admin_get_audit_logs(
    limit: int = 200,
    entity_type: str = "",
    action: str = "",
    search: str = "",
    admin=Depends(require_permission("admin.audit.view"))
):
    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    if search:
        query["$or"] = [
            {"entity_id": {"$regex": search, "$options": "i"}},
            {"admin_username": {"$regex": search, "$options": "i"}},
            {"details.name": {"$regex": search, "$options": "i"}},
            {"details.target_username": {"$regex": search, "$options": "i"}},
            {"details.league_name": {"$regex": search, "$options": "i"}},
        ]
    logs = await audit_logs_col.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs


@admin_router.get("/leagues")
async def admin_list_leagues(admin=Depends(require_permission("admin.leagues.manage"))):
    leagues = await leagues_col.find({}, {"_id": 0}).to_list(100)
    for l in leagues:
        l["member_count"] = await memberships_col.count_documents({"league_id": l["id"], "status": "active"})
    return leagues


@admin_router.get("/payments")
async def admin_list_payments(admin=Depends(require_permission("admin.payments.view"))):
    payments = await payments_col.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Enrich with user info and payment object
    user_ids = list(set(p.get("user_id", "") for p in payments if p.get("user_id")))
    league_ids = list(set(p.get("league_id", "") for p in payments if p.get("league_id")))
    tourn_ids = list(set(p.get("tournament_id", "") for p in payments if p.get("tournament_id")))
    users_map, leagues_map, tourns_map = {}, {}, {}
    if user_ids:
        users_list = await users_col.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}).to_list(len(user_ids))
        users_map = {u["id"]: u for u in users_list}
    if league_ids:
        from database import leagues_col
        leagues_list = await leagues_col.find({"id": {"$in": league_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(league_ids))
        leagues_map = {l["id"]: l for l in leagues_list}
    if tourn_ids:
        tourns_list = await tournaments_col.find({"id": {"$in": tourn_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(tourn_ids))
        tourns_map = {t["id"]: t for t in tourns_list}
    for p in payments:
        u = users_map.get(p.get("user_id", ""))
        p["username"] = u["username"] if u else ""
        p["user_email"] = u["email"] if u else ""
        lid = p.get("league_id", "")
        tid = p.get("tournament_id", "")
        meta_type = (p.get("metadata") or {}).get("type", "")
        if lid and lid in leagues_map:
            p["object_type"] = "League"
            p["object_name"] = leagues_map[lid]["name"]
        elif tid and tid in tourns_map:
            p["object_type"] = "Tournament"
            p["object_name"] = tourns_map[tid]["name"]
        elif meta_type:
            p["object_type"] = meta_type.replace("_", " ").title()
            p["object_name"] = ""
        else:
            p["object_type"] = ""
            p["object_name"] = ""
    return payments


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

    # Collect stats
    stats = {"recipients_total": 0, "push_tokens_found": 0, "tickets_ok": 0, "tickets_error": 0, "errors": []}

    if target == "all":
        all_users = await users_col.find(
            {"is_deleted": {"$ne": True}, "is_disabled": {"$ne": True}},
            {"_id": 0, "id": 1}
        ).to_list(10000)
        stats["recipients_total"] = len(all_users)
        for u in all_users:
            await create_notification(u["id"], "admin_broadcast", title, body, image=image_url)
    else:
        league = await leagues_col.find_one({"id": target}, {"_id": 0})
        if not league:
            raise HTTPException(404, "Lega non trovata")
        members = await memberships_col.find(
            {"league_id": target, "status": "active"}, {"user_id": 1, "_id": 0}
        ).to_list(500)
        stats["recipients_total"] = len(members)
        for m in members:
            await create_notification(m["user_id"], "admin_broadcast", title, body, image=image_url)

    # Count push tokens in DB for these users
    total_tokens = await push_tokens_col.count_documents({})
    stats["push_tokens_in_db"] = total_tokens

    # Log summary
    logger.info(f"[PUSH-BROADCAST] Summary: recipients={stats['recipients_total']}, tokens_in_db={total_tokens}, target={target}")

    await log_audit(
        admin["id"], admin["username"], "PUSH_BROADCAST", "notification", "",
        {"title": title, "target": target, **stats},
        ip=admin.get("_request_ip"),
    )
    return {"sent_count": stats["recipients_total"], "target": target, "push_stats": stats}


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
        ip=admin.get("_request_ip"),
    )
    return {"sent": True, "user_id": user_id}


@admin_router.get("/push/history")
async def admin_push_history(limit: int = 50, admin=Depends(require_permission("admin.dashboard.view"))):
    """Get recent notifications history (admin-sent + automatic)."""
    from database import notifications_col
    notifs = await notifications_col.find(
        {"type": {"$in": ["admin_broadcast", "admin_message", "reminder_2h", "reminder_30m", "matchday_open", "standings_updated"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)

    # Deduplicate auto notifications by (type, title, created_at minute) to avoid showing one per user
    seen_auto = set()
    deduped = []
    for n in notifs:
        if n.get("type") in ("admin_broadcast", "admin_message"):
            deduped.append(n)
        else:
            key = (n.get("type"), n.get("title", ""), n.get("created_at", "")[:16])
            if key not in seen_auto:
                seen_auto.add(key)
                deduped.append(n)

    user_ids = list(set(n.get("user_id", "") for n in deduped))
    users_map = {}
    if user_ids:
        users_list = await users_col.find(
            {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}
        ).to_list(len(user_ids))
        users_map = {u["id"]: u for u in users_list}

    result = []
    for n in deduped:
        u = users_map.get(n.get("user_id", ""))
        ntype = n.get("type", "")
        if ntype in ("admin_broadcast",):
            scope = "Tutti / Lega"
        elif ntype in ("admin_message",):
            scope = u["username"] if u else "?"
        elif ntype in ("reminder_2h", "reminder_30m"):
            scope = "Pronostici mancanti"
        elif ntype in ("matchday_open",):
            scope = "Lega"
        elif ntype in ("standings_updated",):
            scope = "Lega"
        else:
            scope = "?"
        result.append({
            "id": n.get("id"),
            "type": ntype,
            "title": n.get("title"),
            "message": n.get("message"),
            "image": n.get("image", ""),
            "user_id": n.get("user_id"),
            "username": u["username"] if u else "",
            "scope": scope,
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


@admin_router.get("/push/diagnostics")
async def admin_push_diagnostics(admin=Depends(require_permission("admin.dashboard.view"))):
    """Diagnostic endpoint to check push token registration status."""
    from services import PUSH_ENABLED
    from database import push_tokens_col

    # Count total tokens
    total_tokens = await push_tokens_col.count_documents({})

    # Get all tokens with user info
    tokens = await push_tokens_col.find({}, {"_id": 0}).to_list(100)

    # Get unique user IDs with tokens
    user_ids_with_tokens = list(set(t.get("user_id", "") for t in tokens))

    # Get all users
    all_users = await users_col.find(
        {"is_deleted": {"$ne": True}, "is_disabled": {"$ne": True}},
        {"_id": 0, "id": 1, "username": 1, "email": 1}
    ).to_list(10000)

    users_with_tokens = [u for u in all_users if u["id"] in user_ids_with_tokens]
    users_without_tokens = [u for u in all_users if u["id"] not in user_ids_with_tokens]

    # Check token format validity
    valid_tokens = [t for t in tokens if t.get("token", "").startswith("ExponentPushToken[")]
    invalid_tokens = [t for t in tokens if not t.get("token", "").startswith("ExponentPushToken[")]

    return {
        "push_enabled": PUSH_ENABLED,
        "total_tokens_in_db": total_tokens,
        "valid_tokens": len(valid_tokens),
        "invalid_tokens": len(invalid_tokens),
        "total_users": len(all_users),
        "users_with_push_tokens": len(users_with_tokens),
        "users_without_push_tokens": len(users_without_tokens),
        "token_details": [
            {
                "user_id": t.get("user_id", "")[:8] + "...",
                "token": t.get("token", "")[:35] + "..." if t.get("token") else "None",
                "device_type": t.get("device_type", "unknown"),
                "updated_at": t.get("updated_at", "N/A"),
            }
            for t in tokens
        ],
        "users_missing_tokens": [
            {"username": u.get("username", ""), "email": u.get("email", "")[:10] + "..."}
            for u in users_without_tokens[:20]
        ],
    }




# ========================================
# ADMIN: TOURNAMENT MANAGEMENT
# ========================================

@admin_router.get("/tournaments")
async def admin_list_tournaments(admin=Depends(require_permission("admin.tournaments.manage"))):
    """List all tournaments including drafts, with registration counts."""
    from database import tournaments_col, tournament_registrations_col
    tournaments = await tournaments_col.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for t in tournaments:
        count = await tournament_registrations_col.count_documents(
            {"tournament_id": t["id"], "status": "active"}
        )
        t["registered_count"] = count
        t["spots_left"] = t["max_participants"] - count
    return tournaments


@admin_router.delete("/tournaments/{tournament_id}")
async def admin_delete_tournament(tournament_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Delete a tournament and all related data."""
    from database import (
        tournaments_col, tournament_registrations_col,
        tournament_groups_col, tournament_rounds_col, tournament_matchups_col
    )
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    await tournament_matchups_col.delete_many({"tournament_id": tournament_id})
    await tournament_rounds_col.delete_many({"tournament_id": tournament_id})
    await tournament_groups_col.delete_many({"tournament_id": tournament_id})
    await tournament_registrations_col.delete_many({"tournament_id": tournament_id})
    await tournaments_col.delete_one({"id": tournament_id})
    await log_audit(admin["id"], admin["username"], "DELETE", "tournament", tournament_id, {"name": t.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True, "deleted": tournament_id}


@admin_router.post("/tournaments/{tournament_id}/force-start")
async def admin_force_start_tournament(tournament_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Force-start a tournament even without the full number of participants."""
    import random
    from database import (
        tournaments_col, tournament_registrations_col,
        tournament_groups_col, tournament_matchups_col
    )
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] not in ("registration", "draft"):
        raise HTTPException(400, f"Stato attuale: {t['status']}. Deve essere registration o draft.")

    regs = await tournament_registrations_col.find(
        {"tournament_id": tournament_id, "status": "active"}, {"_id": 0}
    ).to_list(200)

    if len(regs) < 2:
        raise HTTPException(400, "Servono almeno 2 iscritti per avviare il torneo")

    actual_count = len(regs)
    groups_count = t.get("groups_count", 1)
    players_per_group = actual_count // groups_count
    leftover = actual_count % groups_count

    # Recalculate groups to fit actual participants
    if players_per_group < 2:
        groups_count = max(1, actual_count // 2)
        players_per_group = actual_count // groups_count
        leftover = actual_count % groups_count

    random.shuffle(regs)
    group_names = [chr(65 + i) for i in range(groups_count)]
    groups = []
    idx = 0
    for i, gn in enumerate(group_names):
        size = players_per_group + (1 if i < leftover else 0)
        members = [{"user_id": r["user_id"], "username": r["username"]} for r in regs[idx:idx+size]]
        idx += size
        groups.append({
            "id": new_id(),
            "tournament_id": tournament_id,
            "group_name": gn,
            "members": members,
        })

    await tournament_groups_col.insert_many(groups)

    duration_rounds = t.get("duration_rounds", 3)
    all_matchups = []
    for g in groups:
        members = g["members"]
        n = len(members)
        # Circle method round-robin: guarantees each player plays exactly once per round
        # If odd number, add a "bye" player
        players = list(range(n))
        if n % 2 == 1:
            players.append(-1)  # bye
        num_players = len(players)
        num_rounds = num_players - 1

        for rnd in range(num_rounds):
            round_num = rnd + 1
            for i in range(num_players // 2):
                p1 = players[i]
                p2 = players[num_players - 1 - i]
                if p1 == -1 or p2 == -1:
                    continue  # bye round
                a = members[p1]
                b = members[p2]
                all_matchups.append({
                    "id": new_id(),
                    "tournament_id": tournament_id,
                    "group_id": g["id"],
                    "round_number": round_num,
                    "round_type": "group",
                    "user_a_id": a["user_id"],
                    "user_b_id": b["user_id"],
                    "user_a_username": a["username"],
                    "user_b_username": b["username"],
                    "user_a_points": 0.0,
                    "user_b_points": 0.0,
                    "result": "pending",
                    "winner_id": None,
                    "status": "pending",
                })
            # Rotate: fix first player, rotate the rest
            players = [players[0]] + [players[-1]] + players[1:-1]

    if all_matchups:
        await tournament_matchups_col.insert_many(all_matchups)

    await tournaments_col.update_one({"id": tournament_id}, {
        "$set": {
            "status": "groups",
            "started_at": now_utc(),
            "current_round": 1,
            "max_participants": actual_count,
            "groups_count": groups_count,
            "players_per_group": players_per_group,
        }
    })

    # Auto-create Round 1
    from database import tournament_rounds_col
    round_doc = {
        "id": new_id(),
        "tournament_id": tournament_id,
        "round_number": 1,
        "round_type": "group",
        "status": "PENDING",
        "label": "Giornata 1",
        "created_at": now_utc(),
    }
    await tournament_rounds_col.insert_one(round_doc)

    await log_audit(admin["id"], admin["username"], "FORCE_START", "tournament", tournament_id, {
        "name": t.get("name"), "participants": actual_count, "groups": groups_count
    }, ip=admin.get("_request_ip"))

    return {
        "ok": True,
        "status": "groups",
        "actual_participants": actual_count,
        "groups": groups_count,
        "matchups_created": len(all_matchups),
        "round_1_created": True,
    }


class AdminCreateTournamentReq(PydanticBaseModel):
    name: str
    max_participants: int = 16
    groups_count: int = 4
    players_per_group: int = 4
    advance_count: int = 2
    entry_fee: float = 0.0
    tournament_type: str = "groups_knockout"
    round_robin_type: str = "single"  # single = solo andata, double = andata e ritorno


@admin_router.post("/tournaments", response_model=None)
async def admin_create_tournament(req: AdminCreateTournamentReq, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Admin create tournament with extended options."""
    from database import tournaments_col
    import math

    if req.tournament_type == "groups_knockout":
        if req.max_participants != req.groups_count * req.players_per_group:
            raise HTTPException(400, f"Partecipanti ({req.max_participants}) != gironi ({req.groups_count}) x giocatori ({req.players_per_group})")
        if req.advance_count >= req.players_per_group:
            raise HTTPException(400, "Chi passa deve essere minore dei giocatori per girone")

    # Auto-calculate duration_rounds based on round-robin type
    ppg = req.players_per_group
    if req.round_robin_type == "double":
        duration_rounds = 2 * (ppg - 1)
    else:
        duration_rounds = ppg - 1

    # Calculate knockout info
    total_qualifiers = req.groups_count * req.advance_count
    knockout_rounds = int(math.log2(total_qualifiers)) if total_qualifiers > 0 and (total_qualifiers & (total_qualifiers - 1)) == 0 else 0

    doc = {
        "id": new_id(),
        "name": req.name,
        "status": "draft",
        "max_participants": req.max_participants,
        "duration_rounds": duration_rounds,
        "groups_count": req.groups_count,
        "players_per_group": req.players_per_group,
        "advance_count": req.advance_count,
        "entry_fee": req.entry_fee,
        "tournament_type": req.tournament_type,
        "round_robin_type": req.round_robin_type,
        "knockout_from_group": req.advance_count,
        "total_qualifiers": total_qualifiers,
        "knockout_rounds": knockout_rounds,
        "bracket_style": "champions_league",
        "current_round": 0,
        "created_by": admin["id"],
        "created_at": now_utc(),
        "started_at": None,
        "completed_at": None,
    }
    await tournaments_col.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(admin["id"], admin["username"], "CREATE", "tournament", doc["id"], {"name": req.name}, ip=admin.get("_request_ip"))
    return doc


@admin_router.put("/tournaments/{tournament_id}")
async def admin_update_tournament(tournament_id: str, body: dict = {}, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Update tournament configuration."""
    from database import tournaments_col
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    allowed = {"name", "entry_fee", "max_participants", "groups_count", "players_per_group",
               "advance_count", "round_robin_type", "tournament_type"}
    updates = {k: body[k] for k in allowed if k in body}
    if not updates:
        return t
    if t["status"] not in ("draft", "registration"):
        editable_live = {"name", "entry_fee"}
        updates = {k: v for k, v in updates.items() if k in editable_live}
        if not updates:
            raise HTTPException(400, "Torneo gia avviato: solo nome e prezzo modificabili")
    await tournaments_col.update_one({"id": tournament_id}, {"$set": updates})
    await log_audit(admin["id"], admin["username"], "UPDATE", "tournament", tournament_id, updates, ip=admin.get("_request_ip"))
    updated = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    return updated


@admin_router.get("/tournaments/{tournament_id}/participants")
async def admin_list_tournament_participants(tournament_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """List all registered participants for a tournament."""
    from database import tournament_registrations_col, users_col
    regs = await tournament_registrations_col.find(
        {"tournament_id": tournament_id, "status": "active"}, {"_id": 0}
    ).to_list(200)
    user_ids = [r["user_id"] for r in regs]
    users = await users_col.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}).to_list(200)
    user_map = {u["id"]: u for u in users}
    result = []
    for r in regs:
        u = user_map.get(r["user_id"], {})
        result.append({
            "reg_id": r["id"],
            "user_id": r["user_id"],
            "username": u.get("username", "???"),
            "email": u.get("email", ""),
            "registered_at": r.get("registered_at", r.get("created_at", "")),
        })
    return result


@admin_router.delete("/tournaments/{tournament_id}/participants/{user_id}")
async def admin_remove_tournament_participant(tournament_id: str, user_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Remove a participant from a tournament."""
    from database import tournament_registrations_col, tournaments_col
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] not in ("draft", "registration"):
        raise HTTPException(400, "Non si possono rimuovere partecipanti a torneo avviato")
    res = await tournament_registrations_col.delete_one({"tournament_id": tournament_id, "user_id": user_id, "status": "active"})
    if res.deleted_count == 0:
        raise HTTPException(404, "Partecipante non trovato")
    await log_audit(admin["id"], admin["username"], "REMOVE_PARTICIPANT", "tournament", tournament_id, {"user_id": user_id}, ip=admin.get("_request_ip"))
    return {"ok": True}


@admin_router.post("/tournaments/{tournament_id}/participants")
async def admin_add_tournament_participant(tournament_id: str, body: dict = {}, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Add a participant to a tournament by email or user_id."""
    import uuid
    from datetime import datetime, timezone
    from database import tournament_registrations_col, tournaments_col, users_col
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] not in ("draft", "registration"):
        raise HTTPException(400, "Non si possono aggiungere partecipanti a torneo avviato")
    count = await tournament_registrations_col.count_documents({"tournament_id": tournament_id, "status": "active"})
    if count >= t["max_participants"]:
        raise HTTPException(400, "Torneo pieno")
    user_id = body.get("user_id")
    email = body.get("email", "").strip()
    if not user_id and email:
        u = await users_col.find_one({"email": email}, {"_id": 0, "id": 1})
        if not u:
            raise HTTPException(404, f"Utente non trovato con email: {email}")
        user_id = u["id"]
    if not user_id:
        raise HTTPException(400, "Specifica user_id o email")
    existing = await tournament_registrations_col.find_one({"tournament_id": tournament_id, "user_id": user_id, "status": "active"})
    if existing:
        raise HTTPException(400, "Utente gia iscritto")
    reg = {
        "id": str(uuid.uuid4()),
        "tournament_id": tournament_id,
        "user_id": user_id,
        "status": "active",
        "registered_at": datetime.now(timezone.utc).isoformat(),
    }
    await tournament_registrations_col.insert_one(reg)
    reg.pop("_id", None)
    await log_audit(admin["id"], admin["username"], "ADD_PARTICIPANT", "tournament", tournament_id, {"user_id": user_id}, ip=admin.get("_request_ip"))
    return reg


@admin_router.post("/tournaments/{tournament_id}/reset-groups")
async def admin_reset_tournament_groups(tournament_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Reset tournament groups, matchups, and rounds (back to registration)."""
    from database import tournaments_col, tournament_groups_col, tournament_rounds_col, tournament_matchups_col, matches_col
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    await tournament_matchups_col.delete_many({"tournament_id": tournament_id})
    await tournament_rounds_col.delete_many({"tournament_id": tournament_id})
    await tournament_groups_col.delete_many({"tournament_id": tournament_id})
    await matches_col.delete_many({"league_id": tournament_id})
    await tournaments_col.update_one({"id": tournament_id}, {"$set": {"status": "registration", "current_round": 0, "started_at": None}})
    await log_audit(admin["id"], admin["username"], "RESET_GROUPS", "tournament", tournament_id, {"name": t.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True}


@admin_router.post("/tournaments/{tournament_id}/open-registration")
async def admin_open_registration(tournament_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Open registration for a tournament."""
    from database import tournaments_col, users_col
    from services import create_notification
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    if t["status"] != "draft":
        raise HTTPException(400, f"Stato attuale: {t['status']}. Deve essere draft.")
    await tournaments_col.update_one({"id": tournament_id}, {"$set": {"status": "registration"}})
    await log_audit(admin["id"], admin["username"], "OPEN_REGISTRATION", "tournament", tournament_id, {"name": t.get("name")}, ip=admin.get("_request_ip"))

    # Notify ALL users about the new tournament
    try:
        tournament_name = t.get("name", "Nuovo Torneo")
        all_users = await users_col.find(
            {"is_deleted": {"$ne": True}, "is_disabled": {"$ne": True}},
            {"_id": 0, "id": 1}
        ).to_list(10000)
        for u in all_users:
            await create_notification(
                u["id"], "tournament_open",
                f"Nuovo torneo: {tournament_name}!",
                f"Le iscrizioni per il torneo {tournament_name} sono aperte! Iscriviti subito per partecipare.",
                link="/tournament/join"
            )
        logger.info(f"[PUSH] Sent tournament registration notification to {len(all_users)} users for '{tournament_name}'")
    except Exception as e:
        logger.warning(f"[PUSH] Failed to send tournament notification: {e}")

    return {"ok": True, "status": "registration"}



@admin_router.get("/tournament-rounds/{tournament_id}")
async def admin_list_tournament_rounds(tournament_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """List all rounds for a tournament with match counts."""
    from database import tournament_rounds_col, matches_col
    rounds = await tournament_rounds_col.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort("round_number", 1).to_list(50)
    for r in rounds:
        r["match_count"] = await matches_col.count_documents(
            {"matchday_id": r["id"], "league_id": tournament_id}
        )
    return rounds


class AdminAddManualMatchReq(PydanticBaseModel):
    tournament_id: str
    round_id: str
    home_team: str
    away_team: str
    competition: str = "Torneo"
    start_time: str = ""


@admin_router.post("/tournament-matches")
async def admin_add_manual_match(req: AdminAddManualMatchReq, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Add a manual match to a tournament round."""
    from database import matches_col, tournament_rounds_col
    rnd = await tournament_rounds_col.find_one(
        {"id": req.round_id, "tournament_id": req.tournament_id}, {"_id": 0}
    )
    if not rnd:
        raise HTTPException(404, "Round non trovato")

    match_doc = {
        "id": new_id(),
        "matchday_id": req.round_id,
        "league_id": req.tournament_id,
        "tournament_id": req.tournament_id,
        "home_team": req.home_team,
        "away_team": req.away_team,
        "home_logo": None,
        "away_logo": None,
        "competition": req.competition,
        "competition_name": req.competition,
        "start_time": req.start_time or now_utc(),
        "home_score": None,
        "away_score": None,
        "status": "scheduled",
        "elapsed": None,
        "external_fixture_id": None,
        "created_at": now_utc(),
    }
    await matches_col.insert_one(match_doc)
    match_doc.pop("_id", None)
    await log_audit(admin["id"], admin["username"], "ADD_MATCH", "tournament_round", req.round_id, {
        "match": f"{req.home_team} vs {req.away_team}", "tournament": req.tournament_id
    }, ip=admin.get("_request_ip"))
    return match_doc



@admin_router.put("/tournament-rounds/{round_id}/status")
async def admin_update_tournament_round_status(round_id: str, body: dict = {}, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Update tournament round status (PENDING, OPEN, LOCKED, LIVE, COMPLETED)."""
    from database import tournament_rounds_col
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(400, "Stato mancante")
    rnd = await tournament_rounds_col.find_one({"id": round_id}, {"_id": 0})
    if not rnd:
        raise HTTPException(404, "Round non trovato")
    await tournament_rounds_col.update_one({"id": round_id}, {"$set": {"status": new_status}})
    await log_audit(admin["id"], admin["username"], "UPDATE_STATUS", "tournament_round", round_id, {"old_status": rnd["status"], "new_status": new_status}, ip=admin.get("_request_ip"))
    return {"ok": True, "status": new_status}


# ── Matches drill-down for dashboard ──────────────────────────────
@admin_router.get("/matches-overview")
async def matches_overview(filter: str = "all", admin=Depends(get_current_user)):
    """Return individual matches for dashboard drill-down.
    Filters: live, inconsistent, no_result, all
    """
    results = []

    if filter == "live":
        matches = await matches_col.find({"status": "live"}, {"_id": 0}).to_list(200)
        for m in matches:
            md = await matchdays_col.find_one({"id": m.get("matchday_id")}, {"_id": 0, "label": 1, "league_id": 1, "status": 1})
            league = await leagues_col.find_one({"id": m.get("league_id")}, {"_id": 0, "name": 1}) if m.get("league_id") else None
            results.append({
                "id": m["id"],
                "home_team": m.get("home_team", "?"),
                "away_team": m.get("away_team", "?"),
                "home_score": m.get("home_score"),
                "away_score": m.get("away_score"),
                "status": m.get("status"),
                "kickoff": m.get("kickoff"),
                "matchday_label": md.get("label") if md else "?",
                "matchday_status": md.get("status") if md else "?",
                "league_name": league.get("name") if league else m.get("league_id", "?")[:12],
                "issue": None,
            })

    elif filter == "inconsistent":
        # Definition: matches in COMPLETED matchdays that are NOT "finished"
        # OR matches marked "finished" without a valid score
        # OR matches marked "live" in a non-LIVE matchday
        completed_mds = await matchdays_col.find({"status": "COMPLETED"}, {"_id": 0, "id": 1, "label": 1, "league_id": 1}).to_list(500)
        completed_md_map = {md["id"]: md for md in completed_mds}

        # Matches in completed matchdays that are still scheduled or live
        bad_matches = await matches_col.find({
            "matchday_id": {"$in": list(completed_md_map.keys())},
            "status": {"$in": ["scheduled", "live"]}
        }, {"_id": 0}).to_list(500)

        for m in bad_matches:
            md = completed_md_map.get(m.get("matchday_id"), {})
            league = await leagues_col.find_one({"id": m.get("league_id")}, {"_id": 0, "name": 1}) if m.get("league_id") else None
            issue = f"Stato '{m.get('status')}' in giornata COMPLETED"
            results.append({
                "id": m["id"],
                "home_team": m.get("home_team", "?"),
                "away_team": m.get("away_team", "?"),
                "home_score": m.get("home_score"),
                "away_score": m.get("away_score"),
                "status": m.get("status"),
                "kickoff": m.get("kickoff"),
                "matchday_label": md.get("label", "?"),
                "matchday_status": "COMPLETED",
                "league_name": league.get("name") if league else m.get("league_id", "?")[:12],
                "issue": issue,
            })

        # Also: finished matches without scores
        no_score = await matches_col.find({
            "status": "finished",
            "$or": [{"home_score": None}, {"away_score": None}]
        }, {"_id": 0}).to_list(200)
        for m in no_score:
            md = await matchdays_col.find_one({"id": m.get("matchday_id")}, {"_id": 0, "label": 1})
            league = await leagues_col.find_one({"id": m.get("league_id")}, {"_id": 0, "name": 1}) if m.get("league_id") else None
            results.append({
                "id": m["id"],
                "home_team": m.get("home_team", "?"),
                "away_team": m.get("away_team", "?"),
                "home_score": m.get("home_score"),
                "away_score": m.get("away_score"),
                "status": m.get("status"),
                "kickoff": m.get("kickoff"),
                "matchday_label": md.get("label") if md else "?",
                "matchday_status": "?",
                "league_name": league.get("name") if league else m.get("league_id", "?")[:12],
                "issue": "Finita senza risultato",
            })

    elif filter == "no_result":
        matches = await matches_col.find({
            "status": "finished",
            "$or": [{"home_score": None}, {"away_score": None}]
        }, {"_id": 0}).to_list(200)
        for m in matches:
            md = await matchdays_col.find_one({"id": m.get("matchday_id")}, {"_id": 0, "label": 1})
            league = await leagues_col.find_one({"id": m.get("league_id")}, {"_id": 0, "name": 1}) if m.get("league_id") else None
            results.append({
                "id": m["id"],
                "home_team": m.get("home_team", "?"),
                "away_team": m.get("away_team", "?"),
                "home_score": m.get("home_score"),
                "away_score": m.get("away_score"),
                "status": m.get("status"),
                "kickoff": m.get("kickoff"),
                "matchday_label": md.get("label") if md else "?",
                "matchday_status": "?",
                "league_name": league.get("name") if league else m.get("league_id", "?")[:12],
                "issue": "Senza risultato",
            })

    return {"filter": filter, "count": len(results), "matches": results}


@admin_router.post("/impersonate/{user_id}")
async def admin_impersonate_user(user_id: str, admin=Depends(require_permission("admin.users.manage"))):
    """Generate an access token for the target user (super admin only)."""
    if not admin.get("is_super_admin"):
        raise HTTPException(403, "Solo i Super Admin possono impersonare utenti")
    target = await users_col.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Utente non trovato")
    if target.get("is_super_admin"):
        raise HTTPException(400, "Non puoi impersonare un altro Super Admin")
    from auth import create_access_token
    token = create_access_token(target["id"], target.get("role", "user"))
    await log_audit(admin["id"], admin["username"], "IMPERSONATE", "user", user_id, {
        "target_username": target.get("username", "?"),
        "target_email": target.get("email", "?"),
    }, ip=admin.get("_request_ip"))
    return {
        "access_token": token,
        "user": {
            "id": target["id"],
            "username": target.get("username"),
            "email": target.get("email"),
        }
    }


# ── Trophy Management ──────────────────────────────────────────────

@admin_router.post("/leagues/{league_id}/award-trophies")
async def admin_award_league_trophies(league_id: str, admin=Depends(require_permission("admin.leagues.manage"))):
    """Manually award champion trophies for a league."""
    from trophies import award_league_trophies
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    await award_league_trophies(league_id)
    await log_audit(admin["id"], admin["username"], "AWARD_TROPHIES", "league", league_id, {"name": league.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True, "message": f"Trofei assegnati per la lega {league.get('name')}"}


@admin_router.post("/tournaments/{tournament_id}/award-trophies")
async def admin_award_tournament_trophies(tournament_id: str, admin=Depends(require_permission("admin.tournaments.manage"))):
    """Manually award champion trophies for a tournament."""
    from trophies import award_tournament_trophies
    from database import tournament_rounds_col
    t = await tournaments_col.find_one({"id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Torneo non trovato")
    await award_tournament_trophies(tournament_id)
    await log_audit(admin["id"], admin["username"], "AWARD_TROPHIES", "tournament", tournament_id, {"name": t.get("name")}, ip=admin.get("_request_ip"))
    return {"ok": True, "message": f"Trofei assegnati per il torneo {t.get('name')}"}


@admin_router.post("/trophies/backfill")
async def admin_backfill_all_trophies(admin=Depends(require_permission("admin.leagues.manage"))):
    """Retroactively award weekly + champion trophies for all completed matchdays and leagues."""
    from trophies import award_weekly_trophies, award_league_trophies, award_tournament_trophies
    from database import tournament_rounds_col

    results = {"weekly_processed": 0, "league_champion_processed": 0, "tournament_champion_processed": 0, "errors": []}

    # 1. Weekly trophies: iterate all completed matchdays per league
    all_leagues = await leagues_col.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    for league in all_leagues:
        lid = league["id"]
        completed_mds = await matchdays_col.find(
            {"status": "COMPLETED", "league_id": lid},
            {"_id": 0, "id": 1}
        ).to_list(200)
        # Also check national matchdays if league uses national source
        if not completed_mds:
            completed_mds = await matchdays_col.find(
                {"status": "COMPLETED", "league_id": services.NATIONAL_LEAGUE_ID},
                {"_id": 0, "id": 1}
            ).to_list(200)
        for md in completed_mds:
            try:
                await award_weekly_trophies(md["id"], lid)
                results["weekly_processed"] += 1
            except Exception as e:
                results["errors"].append(f"weekly {md['id']}/{lid}: {str(e)[:80]}")

    # 2. League champion trophies for completed leagues
    completed_leagues = await leagues_col.find({"status": "completed"}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    for league in completed_leagues:
        try:
            await award_league_trophies(league["id"])
            results["league_champion_processed"] += 1
        except Exception as e:
            results["errors"].append(f"league_champion {league['id']}: {str(e)[:80]}")

    # 3. Tournament champion trophies for completed tournaments
    completed_tournaments = await tournaments_col.find({"status": "completed"}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    for t in completed_tournaments:
        try:
            await award_tournament_trophies(t["id"])
            results["tournament_champion_processed"] += 1
        except Exception as e:
            results["errors"].append(f"tournament_champion {t['id']}: {str(e)[:80]}")

    await log_audit(admin["id"], admin["username"], "BACKFILL_TROPHIES", "system", "all", {
        "weekly": results["weekly_processed"],
        "league_champion": results["league_champion_processed"],
        "tournament_champion": results["tournament_champion_processed"],
    }, ip=admin.get("_request_ip"))

    return {"ok": True, **results}


@admin_router.get("/trophies/stats")
async def admin_trophy_stats(admin=Depends(require_permission("admin.leagues.manage"))):
    """Get trophy statistics for admin dashboard."""
    from database import trophies_col
    pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    type_counts = await trophies_col.aggregate(pipeline).to_list(20)

    total = sum(t["count"] for t in type_counts)
    by_type = {t["_id"]: t["count"] for t in type_counts}

    # Recent trophies
    recent = await trophies_col.find({}, {"_id": 0}).sort("awarded_at", -1).to_list(20)

    return {
        "total": total,
        "by_type": by_type,
        "recent": recent,
    }



# ── Tiebreak Stats Backfill ──────────────────────────────────────

@admin_router.post("/backfill-tiebreak-stats")
async def admin_backfill_tiebreak_stats(admin=Depends(require_permission("admin.leagues.manage"))):
    """Recalculate tiebreak stats (total_correct_predictions, exact_score_hits, one_x_two_hits) for ALL existing score_summaries."""
    from database import score_summaries_col, predictions_col, matches_col
    from scoring import calculate_match_points

    summaries = await score_summaries_col.find({}, {"_id": 0}).to_list(10000)
    updated = 0
    errors = []

    for s in summaries:
        try:
            # Get all predictions for this user/matchday/league
            preds = await predictions_col.find(
                {"user_id": s["user_id"], "matchday_id": s["matchday_id"], "league_id": s["league_id"]},
                {"_id": 0}
            ).to_list(100)

            tcp = 0
            esh = 0
            oxth = 0
            ouh = 0
            gnh = 0

            for p in preds:
                # Use pre-calculated is_correct from predictions (already set by scoring system)
                if p.get("is_correct"):
                    tcp += 1
                    market = p.get("market_type", "1X2")
                    if market == "EXACT_SCORE":
                        esh += 1
                    elif market == "1X2":
                        oxth += 1
                    elif market == "OVER_UNDER_25":
                        ouh += 1
                    elif market == "GOAL_NOGOL":
                        gnh += 1

            await score_summaries_col.update_one(
                {"user_id": s["user_id"], "matchday_id": s["matchday_id"], "league_id": s["league_id"]},
                {"$set": {
                    "total_correct_predictions": tcp,
                    "exact_score_hits": esh,
                    "one_x_two_hits": oxth,
                    "over_under_hits": ouh,
                    "goal_nogol_hits": gnh,
                    "correct_matches": tcp,
                }}
            )
            updated += 1
        except Exception as e:
            errors.append(f"{s.get('user_id','?')[:8]}/{s.get('matchday_id','?')[:8]}: {str(e)[:80]}")

    # Now recalculate standings_cache for all user/league combinations
    from services import recalculate_user_total_standings
    cache_updated = 0
    unique_pairs = set()
    for s in summaries:
        pair = (s["user_id"], s["league_id"])
        if pair not in unique_pairs:
            unique_pairs.add(pair)
            try:
                await recalculate_user_total_standings(s["user_id"], s["league_id"])
                cache_updated += 1
            except Exception as e:
                errors.append(f"cache {s['user_id'][:8]}: {str(e)[:80]}")

    await log_audit(admin["id"], admin["username"], "BACKFILL_TIEBREAK", "system", "all", {
        "summaries_updated": updated, "cache_updated": cache_updated
    }, ip=admin.get("_request_ip"))

    return {"ok": True, "summaries_updated": updated, "cache_updated": cache_updated, "errors": errors[:20]}
