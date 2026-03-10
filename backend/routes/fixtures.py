"""Fixtures routes: API-Football integration, import, live refresh."""
import os
import time
import asyncio
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel as PydanticBaseModel
import logging

from database import (
    leagues_col, matchdays_col, matches_col, audit_logs_col
)
from models import new_id, now_utc
from auth import get_current_user
from permissions import require_permission
from services import (
    MAX_MATCHES_PER_MATCHDAY, NATIONAL_LEAGUE_ID,
    log_audit, recompute_matchday_kickoff,
    get_apifootball, recalculate_match_predictions,
    calculate_matchday_scores_full,
    LIVE_SYNC_ENABLED, LIVE_REFRESH_INTERVAL,
    CIRCUIT_BREAKER_COOLDOWN
)
import services as _svc

logger = logging.getLogger(__name__)

fixtures_router = APIRouter(prefix="/api/fixtures", tags=["Fixtures"])


class ImportFixturesRequest(PydanticBaseModel):
    league_id: str
    matchday_id: str
    fixture_ids: List[int]


@fixtures_router.get("/leagues")
async def real_fixtures_leagues(user=Depends(get_current_user)):
    try:
        client = get_apifootball()
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
    try:
        client = get_apifootball()
        fixtures = await client.search_fixtures(league, season, date_from, date_to)
        return fixtures
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@fixtures_router.post("/import")
async def real_fixtures_import(req: ImportFixturesRequest, user=Depends(get_current_user)):
    from apifootball import map_api_status
    is_super = user.get("role") in ("admin", "superadmin")
    if not is_super:
        league_check = await leagues_col.find_one({"id": req.league_id}, {"_id": 0})
        if not league_check:
            raise HTTPException(404, "Lega non trovata")
        if league_check.get("owner_id") != user["id"]:
            raise HTTPException(403, "Solo il creatore della lega o un super admin può importare partite")
        if league_check.get("match_source_type") not in ("custom", "manual", "api"):
            raise HTTPException(400, "Questa lega usa le partite della Lega Nazionale")

    if len(req.fixture_ids) > MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Massimo {MAX_MATCHES_PER_MATCHDAY} partite per giornata")

    league = await leagues_col.find_one({"id": req.league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")
    matchday = await matchdays_col.find_one({"id": req.matchday_id}, {"_id": 0})
    if not matchday:
        raise HTTPException(404, "Giornata non trovata")

    existing = await matches_col.count_documents({"matchday_id": req.matchday_id, "league_id": req.league_id})
    if existing + len(req.fixture_ids) > MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Superato il limite di {MAX_MATCHES_PER_MATCHDAY} partite (già {existing} presenti)")

    already_imported = await matches_col.find(
        {"external_fixture_id": {"$in": req.fixture_ids}, "league_id": req.league_id, "matchday_id": req.matchday_id},
        {"_id": 0, "external_fixture_id": 1, "matchday_id": 1, "home_team": 1, "away_team": 1}
    ).to_list(100)
    already_dict = {m["external_fixture_id"]: m for m in already_imported}

    client = get_apifootball()
    imported = []
    skipped = []

    for fid in req.fixture_ids:
        if fid in already_dict:
            existing_m = already_dict[fid]
            existing_md = await matchdays_col.find_one({"id": existing_m["matchday_id"]}, {"_id": 0, "number": 1, "label": 1})
            skipped.append({"fixture_id": fid, "reason": "already_imported", "existing_matchday": existing_md.get("label", f"G{existing_md['number']}") if existing_md else existing_m["matchday_id"], "match": f"{existing_m.get('home_team', '?')} vs {existing_m.get('away_team', '?')}"})
            continue

        fx = await client.get_fixture_by_id(fid)
        if not fx:
            skipped.append({"fixture_id": fid, "reason": "not_found"})
            continue

        match_id = new_id()
        match = {
            "id": match_id, "matchday_id": req.matchday_id, "league_id": req.league_id,
            "home_team": fx["home_team"], "away_team": fx["away_team"],
            "home_logo": fx.get("home_logo"), "away_logo": fx.get("away_logo"),
            "competition": fx.get("league_name", ""), "start_time": fx["date"],
            "market_type": "1X2", "status": map_api_status(fx.get("status_short", "NS")),
            "home_score": fx.get("home_goals"), "away_score": fx.get("away_goals"),
            "external_provider": "api-football", "external_fixture_id": fx["fixture_id"],
            "created_at": now_utc(),
        }
        await matches_col.insert_one(match)
        match.pop("_id", None)
        imported.append(match)

    await log_audit(user["id"], user["username"], "IMPORT_FIXTURES", "match", req.matchday_id, {"imported_count": len(imported), "skipped_count": len(skipped), "fixture_ids": req.fixture_ids})
    if imported:
        await recompute_matchday_kickoff(req.matchday_id, req.league_id)
    return {"imported": len(imported), "skipped": len(skipped), "matches": imported, "skipped_details": skipped}


# ========================================
# LIVE FIXTURES BACKGROUND SCHEDULER
# ========================================
_live_task: Optional[asyncio.Task] = None


async def live_fixtures_loop():
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
    from apifootball import map_api_status

    if time.time() < _svc._circuit_open_until:
        remaining = int(_svc._circuit_open_until - time.time())
        logger.info(f"[LIVE-REFRESH] Circuit breaker open, skipping ({remaining}s remaining)")
        return

    live_matches = await matches_col.find(
        {"external_provider": "api-football", "external_fixture_id": {"$exists": True}, "status": {"$in": ["live", "scheduled"]}},
        {"_id": 0}
    ).to_list(200)

    if not live_matches:
        return

    client = get_apifootball()
    updated_count = 0
    finished_matchday_ids = set()

    for m in live_matches:
        fid = m["external_fixture_id"]
        try:
            fx = await client.get_fixture_by_id(fid)
        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "403" in err_msg or "suspended" in err_msg or "rate" in err_msg:
                _svc._circuit_open_until = time.time() + CIRCUIT_BREAKER_COOLDOWN
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
        if fx.get("elapsed") is not None:
            updates["elapsed"] = fx["elapsed"]
        if fx.get("home_logo") and not m.get("home_logo"):
            updates["home_logo"] = fx["home_logo"]
        if fx.get("away_logo") and not m.get("away_logo"):
            updates["away_logo"] = fx["away_logo"]

        if updates:
            await matches_col.update_one({"id": m["id"]}, {"$set": updates})
            updated_count += 1
            logger.info(f"[LIVE-REFRESH] Updated {m['home_team']} vs {m['away_team']}: {updates}")
            if new_status == "finished" and m["status"] != "finished":
                await recalculate_match_predictions(m["id"], m["league_id"])
                finished_matchday_ids.add(m["matchday_id"])

    for md_id in finished_matchday_ids:
        await _check_auto_complete_matchday(md_id)

    if updated_count > 0:
        logger.info(f"[LIVE-REFRESH] Updated {updated_count} matches")


async def _check_auto_complete_matchday(matchday_id: str):
    matchday = await matchdays_col.find_one({"id": matchday_id}, {"_id": 0})
    if not matchday or matchday.get("status") == "COMPLETED":
        return
    all_matches = await matches_col.find({"matchday_id": matchday_id}, {"_id": 0, "status": 1}).to_list(20)
    if not all_matches:
        return
    terminal_statuses = {"finished", "void", "postponed", "cancelled"}
    all_done = all(m["status"] in terminal_statuses for m in all_matches)
    if all_done:
        logger.info(f"[AUTO-COMPLETE] All matches finished for matchday {matchday_id} — auto-completing")
        await matchdays_col.update_one({"id": matchday_id}, {"$set": {"status": "COMPLETED"}})
        system_admin = {"id": "system", "username": "system-auto"}
        await calculate_matchday_scores_full(matchday_id, system_admin)
        await audit_logs_col.insert_one({
            "id": new_id(), "admin_id": "system", "admin_username": "system-auto",
            "action": "AUTO_COMPLETE", "entity_type": "matchday", "entity_id": matchday_id,
            "details": {"reason": "all_matches_finished_via_api_football"}, "created_at": now_utc(),
        })


@fixtures_router.post("/refresh-live")
async def real_fixtures_refresh_live(admin=Depends(require_permission("admin.matches.manage"))):
    try:
        await _refresh_live_fixtures()
        return {"status": "ok", "message": "Live refresh completato"}
    except Exception as e:
        raise HTTPException(502, f"Errore refresh: {e}")
