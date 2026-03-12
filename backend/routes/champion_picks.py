"""Champion Picks routes: predict the championship winner."""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
import logging

from database import (
    champion_picks_col, leagues_col, memberships_col,
    seasons_col, users_col
)
from models import new_id, now_utc
from auth import get_current_user
from services import get_apifootball

logger = logging.getLogger(__name__)

champion_router = APIRouter(prefix="/api/champion-picks", tags=["ChampionPicks"])

# Map season name keywords to API-Football league IDs
COMPETITION_MAP = {
    "serie a": {"api_league_id": 135, "season": 2024, "name": "Serie A"},
    "premier league": {"api_league_id": 39, "season": 2024, "name": "Premier League"},
    "la liga": {"api_league_id": 140, "season": 2024, "name": "La Liga"},
    "bundesliga": {"api_league_id": 78, "season": 2024, "name": "Bundesliga"},
    "ligue 1": {"api_league_id": 61, "season": 2024, "name": "Ligue 1"},
}


async def _resolve_competition(league_id: str):
    """Resolve API-Football competition info from an app league."""
    league = await leagues_col.find_one({"id": league_id}, {"_id": 0})
    if not league:
        raise HTTPException(404, "Lega non trovata")

    # Find the season to determine competition
    season = await seasons_col.find_one({"id": league.get("season_id")}, {"_id": 0})
    season_name = (season.get("name", "") if season else "").lower()

    # Try to match from season name
    for keyword, info in COMPETITION_MAP.items():
        if keyword in season_name:
            return info, league

    # Default to Serie A for national leagues
    if league.get("league_type") == "national" or league.get("match_source_type") == "national":
        return COMPETITION_MAP["serie a"], league

    # For custom/manual leagues, also default to Serie A
    return COMPETITION_MAP["serie a"], league


@champion_router.get("/teams")
async def get_champion_teams(
    league_id: str = Query(...),
    user=Depends(get_current_user),
):
    """Get teams for championship prediction from API-Football standings."""
    comp_info, league = await _resolve_competition(league_id)

    try:
        client = get_apifootball()
        standings = await client.get_standings(comp_info["api_league_id"], comp_info["season"])
        return {
            "competition": comp_info["name"],
            "season": comp_info["season"],
            "teams": standings,
        }
    except Exception as e:
        logger.error(f"Error fetching champion teams: {e}")
        raise HTTPException(502, f"Errore nel caricamento squadre: {e}")


class ChampionPickRequest(BaseModel):
    league_id: str
    team_name: str
    team_logo: Optional[str] = None


@champion_router.post("")
async def save_champion_pick(
    req: ChampionPickRequest,
    user=Depends(get_current_user),
):
    """Save or update user's championship winner prediction."""
    comp_info, league = await _resolve_competition(req.league_id)

    # Verify membership
    mem = await memberships_col.find_one({
        "user_id": user["id"], "league_id": req.league_id, "status": "active"
    })
    if not mem:
        raise HTTPException(403, "Non sei membro di questa lega")

    season_id = league.get("season_id", "")

    # Upsert pick
    existing = await champion_picks_col.find_one({
        "user_id": user["id"],
        "season_id": season_id,
        "competition": comp_info["name"],
        "league_id": req.league_id,
    })

    if existing:
        await champion_picks_col.update_one(
            {"id": existing["id"]},
            {"$set": {
                "team_name": req.team_name,
                "team_logo": req.team_logo,
                "updated_at": now_utc(),
            }}
        )
        return {"status": "updated", "team_name": req.team_name}
    else:
        pick = {
            "id": new_id(),
            "user_id": user["id"],
            "league_id": req.league_id,
            "season_id": season_id,
            "competition": comp_info["name"],
            "team_name": req.team_name,
            "team_logo": req.team_logo,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        await champion_picks_col.insert_one(pick)
        return {"status": "created", "team_name": req.team_name}


@champion_router.get("/my")
async def get_my_champion_pick(
    league_id: str = Query(...),
    user=Depends(get_current_user),
):
    """Get user's current championship prediction for a league."""
    comp_info, league = await _resolve_competition(league_id)
    season_id = league.get("season_id", "")

    pick = await champion_picks_col.find_one({
        "user_id": user["id"],
        "season_id": season_id,
        "competition": comp_info["name"],
        "league_id": league_id,
    }, {"_id": 0})

    return {
        "competition": comp_info["name"],
        "pick": pick,
    }


@champion_router.get("/league")
async def get_league_champion_picks(
    league_id: str = Query(...),
    user=Depends(get_current_user),
):
    """Get all league members' championship predictions."""
    comp_info, league = await _resolve_competition(league_id)
    season_id = league.get("season_id", "")

    # Get all picks for this league
    picks = await champion_picks_col.find({
        "league_id": league_id,
        "season_id": season_id,
        "competition": comp_info["name"],
    }, {"_id": 0}).to_list(500)

    # Enrich with username
    user_ids = [p["user_id"] for p in picks]
    users = await users_col.find(
        {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1}
    ).to_list(500)
    user_map = {u["id"]: u["username"] for u in users}

    result = []
    for p in picks:
        result.append({
            "user_id": p["user_id"],
            "username": user_map.get(p["user_id"], "?"),
            "team_name": p["team_name"],
            "team_logo": p.get("team_logo"),
            "is_current_user": p["user_id"] == user["id"],
            "updated_at": p.get("updated_at"),
        })

    # Count picks per team for summary
    team_counts = {}
    for p in picks:
        tn = p["team_name"]
        if tn not in team_counts:
            team_counts[tn] = {"team_name": tn, "team_logo": p.get("team_logo"), "count": 0}
        team_counts[tn]["count"] += 1

    total_members = await memberships_col.count_documents({
        "league_id": league_id, "status": "active"
    })

    return {
        "competition": comp_info["name"],
        "total_members": total_members,
        "total_picks": len(picks),
        "picks": result,
        "team_summary": sorted(team_counts.values(), key=lambda x: -x["count"]),
    }
