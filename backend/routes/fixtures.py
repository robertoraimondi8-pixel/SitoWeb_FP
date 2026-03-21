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
import services
from services import (
    MAX_MATCHES_PER_MATCHDAY,
    log_audit, recompute_matchday_kickoff,
    get_apifootball, recalculate_match_predictions,
    calculate_matchday_scores_full,
    create_notification_for_league,
    LIVE_SYNC_ENABLED, LIVE_REFRESH_INTERVAL,
    CIRCUIT_BREAKER_COOLDOWN
)
import services as _svc

logger = logging.getLogger(__name__)

fixtures_router = APIRouter(prefix="/api/admin/real-fixtures", tags=["Real Fixtures"])


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
    is_super = user.get("is_super_admin") or user.get("role") in ("admin", "superadmin")

    # Determine if this is a league or tournament context
    league = await leagues_col.find_one({"id": req.league_id}, {"_id": 0})
    is_tournament = False
    if not league:
        from database import tournaments_col as t_col
        tournament = await t_col.find_one({"id": req.league_id}, {"_id": 0})
        if not tournament:
            raise HTTPException(404, "Lega o torneo non trovato")
        is_tournament = True
    else:
        # League permission check (skip for super admin, national league, and tournaments)
        is_national = league.get("league_type") == "national"
        if not is_super and not is_national:
            if league.get("owner_id") != user["id"]:
                raise HTTPException(403, "Solo il creatore della lega o un super admin puo importare partite")
            if league.get("match_source_type") not in ("custom", "manual", "api"):
                raise HTTPException(400, "Questa lega usa le partite della Lega Nazionale")

    if len(req.fixture_ids) > MAX_MATCHES_PER_MATCHDAY:
        raise HTTPException(400, f"Massimo {MAX_MATCHES_PER_MATCHDAY} partite per giornata")

    # Find the matchday - check both regular matchdays and tournament rounds
    matchday = await matchdays_col.find_one({"id": req.matchday_id}, {"_id": 0})
    if not matchday and is_tournament:
        from database import tournament_rounds_col
        matchday = await tournament_rounds_col.find_one({"id": req.matchday_id}, {"_id": 0})
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

        # Auto-notify league members when matches are imported into an OPEN matchday
        try:
            matchday_doc = await matchdays_col.find_one({"id": req.matchday_id}, {"_id": 0, "status": 1, "number": 1, "label": 1})
            if matchday_doc and matchday_doc.get("status") == "OPEN":
                md_label = matchday_doc.get("label") or f"Giornata {matchday_doc.get('number', '?')}"
                match_count = len(imported)
                # For national league, notify all leagues that use national matches
                if league and league.get("league_type") == "national":
                    leagues_using = await leagues_col.find(
                        {"$or": [{"id": req.league_id}, {"league_type": "national"}]},
                        {"_id": 0, "id": 1}
                    ).to_list(50)
                    for lg in leagues_using:
                        await create_notification_for_league(
                            lg["id"], "matches_added",
                            f"{md_label}: {match_count} partite da pronosticare!",
                            f"Sono state aggiunte {match_count} partite. Inserisci subito i tuoi pronostici!",
                            link=f"/predictions?matchday={req.matchday_id}"
                        )
                else:
                    await create_notification_for_league(
                        req.league_id, "matches_added",
                        f"{md_label}: {match_count} partite da pronosticare!",
                        f"Sono state aggiunte {match_count} partite. Inserisci subito i tuoi pronostici!",
                        link=f"/predictions?matchday={req.matchday_id}"
                    )
                logger.info(f"[PUSH] Sent match notification for matchday {req.matchday_id} ({match_count} matches)")
        except Exception as e:
            logger.warning(f"[PUSH] Failed to send match notification: {e}")

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
    logger.info(f"[LIVE-REFRESH] Sync enabled, interval={LIVE_REFRESH_INTERVAL}s, circuit_breaker_cooldown={CIRCUIT_BREAKER_COOLDOWN}s")
    while True:
        try:
            await asyncio.sleep(LIVE_REFRESH_INTERVAL)
            await _refresh_live_fixtures()
        except asyncio.CancelledError:
            logger.info("[LIVE-REFRESH] Task cancelled")
            break
        except Exception as e:
            _svc._last_live_refresh_status = f"loop_error: {e}"
            _svc._last_live_error = str(e)
            logger.error(f"[LIVE-REFRESH] Unhandled error in loop: {e}", exc_info=True)


async def _refresh_live_fixtures():
    from apifootball import map_api_status

    now = time.time()

    # Circuit breaker check with progressive backoff
    if now < _svc._circuit_open_until:
        remaining = int(_svc._circuit_open_until - now)
        logger.info(f"[LIVE-REFRESH] Circuit breaker open ({remaining}s remaining, failures={_svc._circuit_fail_count})")
        _svc._last_live_refresh_status = f"circuit_breaker_open ({remaining}s left)"
        return

    # Query matches that need updating: live OR scheduled with external fixture
    live_matches = await matches_col.find(
        {
            "external_provider": "api-football",
            "external_fixture_id": {"$exists": True},
            "status": {"$in": ["live", "scheduled"]},
        },
        {"_id": 0}
    ).to_list(200)

    _svc._last_live_refresh_at = now

    if not live_matches:
        _svc._last_live_refresh_status = "ok_no_matches"
        logger.debug("[LIVE-REFRESH] No live/scheduled matches found in DB")
        return

    logger.info(f"[LIVE-REFRESH] Found {len(live_matches)} matches to check "
                f"(live={sum(1 for m in live_matches if m['status'] == 'live')}, "
                f"scheduled={sum(1 for m in live_matches if m['status'] == 'scheduled')})")

    client = get_apifootball()
    updated_count = 0
    api_errors = 0
    finished_matchday_ids = set()

    for m in live_matches:
        fid = m["external_fixture_id"]
        match_label = f"{m.get('home_team', '?')} vs {m.get('away_team', '?')} (fid={fid})"
        try:
            fx = await client.get_fixture_by_id(fid)
        except Exception as e:
            api_errors += 1
            err_msg = str(e).lower()
            if "429" in err_msg or "403" in err_msg or "suspended" in err_msg or "rate" in err_msg:
                _svc._circuit_fail_count += 1
                # Progressive backoff: base cooldown * 2^(failures-1), capped at 1 hour
                backoff = min(CIRCUIT_BREAKER_COOLDOWN * (2 ** (_svc._circuit_fail_count - 1)), 3600)
                _svc._circuit_open_until = time.time() + backoff
                _svc._last_live_refresh_status = f"circuit_breaker_triggered (backoff={backoff}s, failures={_svc._circuit_fail_count})"
                _svc._last_live_error = str(e)
                logger.warning(f"[LIVE-REFRESH] Circuit breaker OPEN for {backoff}s (failure #{_svc._circuit_fail_count}): {e}")
                return
            logger.warning(f"[LIVE-REFRESH] API error for {match_label}: {e}")
            _svc._last_live_error = f"fixture {fid}: {e}"
            continue

        if not fx:
            logger.warning(f"[LIVE-REFRESH] No data returned for {match_label}")
            continue

        # Reset circuit breaker on successful API call
        if _svc._circuit_fail_count > 0:
            logger.info(f"[LIVE-REFRESH] API call succeeded, resetting circuit breaker (was at {_svc._circuit_fail_count} failures)")
            _svc._circuit_fail_count = 0
            _svc._circuit_open_until = 0

        new_status = map_api_status(fx.get("status_short", "NS"))
        updates = {}

        # Always update scores if available (even if same — ensures consistency)
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

        # Track when this match was last refreshed
        updates["last_live_update"] = now_utc()

        if updates:
            await matches_col.update_one({"id": m["id"]}, {"$set": updates})
            updated_count += 1
            if new_status != m["status"] or fx.get("home_goals") != m.get("home_score") or fx.get("away_goals") != m.get("away_score"):
                logger.info(f"[LIVE-REFRESH] {match_label}: "
                            f"status={m['status']}->{new_status}, "
                            f"score={m.get('home_score')}-{m.get('away_score')}->"
                            f"{fx.get('home_goals')}-{fx.get('away_goals')}, "
                            f"elapsed={fx.get('elapsed')}'")

            if new_status == "finished" and m["status"] != "finished":
                logger.info(f"[LIVE-REFRESH] Match FINISHED: {match_label} → recalculating predictions")
                await recalculate_match_predictions(m["id"], m["league_id"])
                finished_matchday_ids.add(m["matchday_id"])

    for md_id in finished_matchday_ids:
        await _check_auto_complete_matchday(md_id)

    _svc._last_live_refresh_status = f"ok_updated={updated_count}_of_{len(live_matches)}"
    if api_errors > 0:
        _svc._last_live_refresh_status += f"_errors={api_errors}"
    logger.info(f"[LIVE-REFRESH] Cycle done: {updated_count}/{len(live_matches)} updated, {api_errors} API errors")


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


# ========================================
# ADMIN ENDPOINTS: LIVE REFRESH CONTROL
# ========================================

@fixtures_router.post("/refresh-live")
async def real_fixtures_refresh_live(admin=Depends(require_permission("admin.matches.manage"))):
    try:
        await _refresh_live_fixtures()
        return {
            "status": "ok",
            "message": "Live refresh completato",
            "last_status": _svc._last_live_refresh_status,
            "circuit_breaker_open": time.time() < _svc._circuit_open_until,
        }
    except Exception as e:
        raise HTTPException(502, f"Errore refresh: {e}")


@fixtures_router.get("/live-status")
async def live_refresh_status(admin=Depends(require_permission("admin.matches.manage"))):
    """Diagnostic endpoint: check the state of the live refresh system."""
    now = time.time()
    cb_open = now < _svc._circuit_open_until
    cb_remaining = int(_svc._circuit_open_until - now) if cb_open else 0

    # Count matches that would be refreshed
    live_count = await matches_col.count_documents(
        {"external_provider": "api-football", "external_fixture_id": {"$exists": True}, "status": "live"}
    )
    scheduled_count = await matches_col.count_documents(
        {"external_provider": "api-football", "external_fixture_id": {"$exists": True}, "status": "scheduled"}
    )

    # Find most recently updated match
    latest_match = await matches_col.find_one(
        {"last_live_update": {"$exists": True}},
        {"_id": 0, "home_team": 1, "away_team": 1, "home_score": 1, "away_score": 1, "elapsed": 1, "status": 1, "last_live_update": 1},
        sort=[("last_live_update", -1)]
    )

    return {
        "sync_enabled": LIVE_SYNC_ENABLED,
        "refresh_interval_seconds": LIVE_REFRESH_INTERVAL,
        "circuit_breaker": {
            "is_open": cb_open,
            "remaining_seconds": cb_remaining,
            "consecutive_failures": _svc._circuit_fail_count,
            "cooldown_base_seconds": CIRCUIT_BREAKER_COOLDOWN,
        },
        "last_refresh": {
            "timestamp": _svc._last_live_refresh_at,
            "seconds_ago": int(now - _svc._last_live_refresh_at) if _svc._last_live_refresh_at else None,
            "status": _svc._last_live_refresh_status,
            "last_error": _svc._last_live_error or None,
        },
        "matches_in_queue": {
            "live": live_count,
            "scheduled": scheduled_count,
            "total": live_count + scheduled_count,
        },
        "latest_updated_match": {
            "label": f"{latest_match['home_team']} vs {latest_match['away_team']}" if latest_match else None,
            "score": f"{latest_match.get('home_score')}-{latest_match.get('away_score')}" if latest_match else None,
            "elapsed": latest_match.get("elapsed") if latest_match else None,
            "status": latest_match.get("status") if latest_match else None,
            "updated_at": str(latest_match.get("last_live_update")) if latest_match else None,
        } if latest_match else None,
    }


@fixtures_router.post("/reset-circuit-breaker")
async def reset_circuit_breaker(admin=Depends(require_permission("admin.matches.manage"))):
    """Manually reset the circuit breaker to resume live updates immediately."""
    was_open = time.time() < _svc._circuit_open_until
    old_failures = _svc._circuit_fail_count
    _svc._circuit_open_until = 0
    _svc._circuit_fail_count = 0
    _svc._last_live_error = ""
    logger.info(f"[LIVE-REFRESH] Circuit breaker manually reset by admin (was_open={was_open}, failures={old_failures})")
    return {
        "status": "ok",
        "message": "Circuit breaker resettato",
        "was_open": was_open,
        "previous_failures": old_failures,
    }
