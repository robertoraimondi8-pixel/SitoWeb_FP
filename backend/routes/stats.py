"""Statistics routes: API-Football public data (standings, results, upcoming, preview)."""
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
import logging

from database import matches_col
from auth import get_current_user
from services import get_apifootball

logger = logging.getLogger(__name__)

stats_router = APIRouter(prefix="/api/stats", tags=["Statistics"])


@stats_router.get("/leagues")
async def stats_available_leagues(user=Depends(get_current_user)):
    """Return the 5 fixed leagues with current season info."""
    try:
        client = get_apifootball()
        leagues = await client.get_top_leagues()
        return leagues
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@stats_router.get("/standings/{league_id}")
async def stats_league_standings(
    league_id: int,
    season: int = Query(2025, description="Season year"),
    user=Depends(get_current_user),
):
    """Get league table standings from API-Football."""
    from apifootball import TOP_LEAGUES
    try:
        client = get_apifootball()
        entries = await client.get_standings(league_id, season)
        league_info = next((lg for lg in TOP_LEAGUES if lg["id"] == league_id), None)
        return {
            "league_id": league_id,
            "league_name": league_info["name"] if league_info else str(league_id),
            "season": season,
            "standings": entries,
        }
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@stats_router.get("/results/{league_id}")
async def stats_recent_results(
    league_id: int,
    season: int = Query(2025, description="Season year"),
    last: int = Query(15, ge=1, le=30),
    user=Depends(get_current_user),
):
    """Get recent finished fixtures from API-Football."""
    from apifootball import TOP_LEAGUES
    try:
        client = get_apifootball()
        fixtures = await client.get_recent_results(league_id, season, last)
        league_info = next((lg for lg in TOP_LEAGUES if lg["id"] == league_id), None)
        return {
            "league_id": league_id,
            "league_name": league_info["name"] if league_info else str(league_id),
            "season": season,
            "fixtures": fixtures,
        }
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


@stats_router.get("/upcoming/{league_id}")
async def stats_upcoming_fixtures(
    league_id: int,
    season: int = Query(2025, description="Season year"),
    next_count: int = Query(15, ge=1, le=30, alias="next"),
    user=Depends(get_current_user),
):
    """Get upcoming fixtures from API-Football."""
    from apifootball import TOP_LEAGUES
    try:
        client = get_apifootball()
        fixtures = await client.get_upcoming_fixtures(league_id, season, next_count)
        league_info = next((lg for lg in TOP_LEAGUES if lg["id"] == league_id), None)
        return {
            "league_id": league_id,
            "league_name": league_info["name"] if league_info else str(league_id),
            "season": season,
            "fixtures": fixtures,
        }
    except Exception as e:
        raise HTTPException(502, f"Errore API-Football: {e}")


def _extract_team_id_from_logo(logo_url: str) -> Optional[int]:
    """Extract API-Football team ID from logo URL like .../teams/502.png"""
    if not logo_url:
        return None
    m = re.search(r'/teams/(\d+)', logo_url)
    return int(m.group(1)) if m else None


@stats_router.get("/fixture-detail/{fixture_id}")
async def stats_fixture_detail(fixture_id: int, user=Depends(get_current_user)):
    """Get full fixture detail: events, statistics, lineups from API-Football.
    For NS (not started) matches, also includes pre-match preview (form, H2H)."""
    try:
        client = get_apifootball()
        detail = await client.get_fixture_detail(fixture_id)

        # If match not started, add pre-match preview data
        fx_status = detail.get("fixture", {}).get("status_short", "")
        if fx_status in ("NS", "TBD", "PST"):
            try:
                home_id = detail.get("teams", {}).get("home", {}).get("id")
                away_id = detail.get("teams", {}).get("away", {}).get("id")
                if home_id and away_id:
                    home_form = await client.get_team_last_matches(home_id, 5)
                    away_form = await client.get_team_last_matches(away_id, 5)
                    h2h = await client.get_h2h(home_id, away_id, 5)
                    detail["preview"] = {
                        "home_form": home_form,
                        "away_form": away_form,
                        "h2h": h2h,
                    }
            except Exception:
                pass

        return detail
    except Exception as e:
        raise HTTPException(502, f"Dettagli partita non disponibili: {e}")


@stats_router.get("/match-preview/{match_id}")
async def stats_match_preview(match_id: str, user=Depends(get_current_user)):
    """Get match preview stats: team form, H2H, standings position."""
    from apifootball import TOP_LEAGUES
    match = await matches_col.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Partita non trovata")

    if not match.get("external_fixture_id"):
        raise HTTPException(400, "Statistiche disponibili solo per partite API")

    home_team_id = _extract_team_id_from_logo(match.get("home_logo", ""))
    away_team_id = _extract_team_id_from_logo(match.get("away_logo", ""))
    if not home_team_id or not away_team_id:
        raise HTTPException(400, "ID squadre non disponibili")

    client = get_apifootball()

    api_league_id = None
    season = 2025
    competition = (match.get("competition") or "").lower()
    for lg in TOP_LEAGUES:
        if lg["name"].lower() in competition or competition in lg["name"].lower():
            api_league_id = lg["id"]
            break

    try:
        home_form = await client.get_team_last_matches(home_team_id, 5)
        away_form = await client.get_team_last_matches(away_team_id, 5)
        h2h = await client.get_h2h(home_team_id, away_team_id, 5)

        home_standing = None
        away_standing = None
        if api_league_id:
            home_standing = await client.get_team_standing_position(home_team_id, api_league_id, season)
            away_standing = await client.get_team_standing_position(away_team_id, api_league_id, season)

        return {
            "match_id": match_id,
            "home_team": match.get("home_team"),
            "away_team": match.get("away_team"),
            "home_logo": match.get("home_logo"),
            "away_logo": match.get("away_logo"),
            "home_form": home_form,
            "away_form": away_form,
            "h2h": h2h,
            "home_standing": home_standing,
            "away_standing": away_standing,
        }
    except Exception as e:
        raise HTTPException(502, f"Statistiche non disponibili: {e}")
