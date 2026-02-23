"""API-Football (API-Sports) client with TTL caching."""
import httpx
import logging
import time
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# In-memory TTL cache
_cache: Dict[str, Dict[str, Any]] = {}

CACHE_TTL_LEAGUES = 900       # 15 min
CACHE_TTL_FIXTURES = 300      # 5 min
CACHE_TTL_STANDINGS = 600     # 10 min
CACHE_TTL_PREVIEW = 1800      # 30 min (match preview / H2H)
CACHE_TTL_LIVE = 0            # never cache live (caller decides refresh interval)

# Top 5 leagues with their API-Football IDs
TOP_LEAGUES = [
    {"id": 135, "name": "Serie A", "country": "Italy"},
    {"id": 39, "name": "Premier League", "country": "England"},
    {"id": 140, "name": "La Liga", "country": "Spain"},
    {"id": 78, "name": "Bundesliga", "country": "Germany"},
    {"id": 61, "name": "Ligue 1", "country": "France"},
]


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and entry["expires"] > time.time():
        return entry["data"]
    if entry:
        del _cache[key]
    return None


def _cache_set(key: str, data: Any, ttl: int):
    if ttl > 0:
        _cache[key] = {"data": data, "expires": time.time() + ttl}


class APIFootballClient:
    BASE_URL = "https://v3.football.api-sports.io"

    def __init__(self, api_key: str):
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={"x-apisports-key": api_key},
            timeout=15.0,
        )

    async def close(self):
        await self._client.aclose()

    # ------------------------------------------------------------------
    async def _get(self, endpoint: str, params: dict = None) -> Dict[str, Any]:
        resp = await self._client.get(endpoint, params=params or {})
        resp.raise_for_status()
        data = resp.json()
        # Check for API-level errors (suspended account, rate limit, etc.)
        errors = data.get("errors", {})
        if errors:
            error_msg = "; ".join(f"{k}: {v}" for k, v in errors.items()) if isinstance(errors, dict) else str(errors)
            logger.error(f"[API-Football] API error: {error_msg}")
            raise Exception(f"API-Football error: {error_msg}")
        return data

    # ------------------------------------------------------------------
    async def get_top_leagues(self) -> List[Dict[str, Any]]:
        """Return top 5 leagues with current season info."""
        cached = _cache_get("top_leagues")
        if cached is not None:
            return cached

        results = []
        for lg in TOP_LEAGUES:
            data = await self._get("/leagues", {"id": lg["id"]})
            api_resp = data.get("response", [])
            if api_resp:
                league_info = api_resp[0]
                seasons = league_info.get("seasons", [])
                current_season = next((s for s in seasons if s.get("current")), None)
                results.append({
                    "league_id": lg["id"],
                    "name": lg["name"],
                    "country": lg["country"],
                    "logo": league_info.get("league", {}).get("logo"),
                    "current_season": current_season.get("year") if current_season else None,
                })

        _cache_set("top_leagues", results, CACHE_TTL_LEAGUES)
        return results

    # ------------------------------------------------------------------
    async def search_fixtures(
        self,
        league_id: int,
        season: int,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search fixtures filtered by league, season, and date range."""
        cache_key = f"fixtures:{league_id}:{season}:{date_from}:{date_to}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        params: Dict[str, Any] = {"league": league_id, "season": season}
        if date_from:
            params["from"] = date_from
        if date_to:
            params["to"] = date_to

        data = await self._get("/fixtures", params)
        fixtures = []
        for f in data.get("response", []):
            fix = f.get("fixture", {})
            teams = f.get("teams", {})
            goals = f.get("goals", {})
            league = f.get("league", {})
            fixtures.append({
                "fixture_id": fix.get("id"),
                "date": fix.get("date"),
                "timestamp": fix.get("timestamp"),
                "status_short": fix.get("status", {}).get("short"),
                "status_long": fix.get("status", {}).get("long"),
                "elapsed": fix.get("status", {}).get("elapsed"),
                "home_team": teams.get("home", {}).get("name"),
                "home_logo": teams.get("home", {}).get("logo"),
                "away_team": teams.get("away", {}).get("name"),
                "away_logo": teams.get("away", {}).get("logo"),
                "home_goals": goals.get("home"),
                "away_goals": goals.get("away"),
                "league_name": league.get("name"),
                "round": league.get("round"),
            })

        _cache_set(cache_key, fixtures, CACHE_TTL_FIXTURES)
        return fixtures

    # ------------------------------------------------------------------
    async def get_fixture_by_id(self, fixture_id: int) -> Optional[Dict[str, Any]]:
        """Fetch a single fixture by its ID (used for live updates)."""
        data = await self._get("/fixtures", {"id": fixture_id})
        resp = data.get("response", [])
        if not resp:
            return None
        f = resp[0]
        fix = f.get("fixture", {})
        teams = f.get("teams", {})
        goals = f.get("goals", {})
        league = f.get("league", {})
        return {
            "fixture_id": fix.get("id"),
            "date": fix.get("date"),
            "status_short": fix.get("status", {}).get("short"),
            "status_long": fix.get("status", {}).get("long"),
            "elapsed": fix.get("status", {}).get("elapsed"),
            "home_team": teams.get("home", {}).get("name"),
            "home_logo": teams.get("home", {}).get("logo"),
            "away_team": teams.get("away", {}).get("name"),
            "away_logo": teams.get("away", {}).get("logo"),
            "home_goals": goals.get("home"),
            "away_goals": goals.get("away"),
            "league_name": league.get("name", ""),
        }

    # ------------------------------------------------------------------
    async def get_standings(self, league_id: int, season: int) -> List[Dict[str, Any]]:
        """Get league table standings."""
        cache_key = f"standings:{league_id}:{season}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        data = await self._get("/standings", {"league": league_id, "season": season})
        resp = data.get("response", [])
        if not resp:
            return []

        standings_data = resp[0].get("league", {}).get("standings", [])
        if not standings_data:
            return []

        # standings_data is a list of groups; for single-group leagues take first
        group = standings_data[0] if standings_data else []
        entries = []
        for row in group:
            team = row.get("team", {})
            all_stats = row.get("all", {})
            entries.append({
                "rank": row.get("rank"),
                "team_name": team.get("name"),
                "team_logo": team.get("logo"),
                "points": row.get("points"),
                "played": all_stats.get("played"),
                "win": all_stats.get("win"),
                "draw": all_stats.get("draw"),
                "lose": all_stats.get("lose"),
                "goals_for": all_stats.get("goals", {}).get("for"),
                "goals_against": all_stats.get("goals", {}).get("against"),
                "goal_diff": row.get("goalsDiff"),
                "form": row.get("form"),
            })

        _cache_set(cache_key, entries, CACHE_TTL_STANDINGS)
        return entries

    # ------------------------------------------------------------------
    async def get_recent_results(self, league_id: int, season: int, last: int = 15) -> List[Dict[str, Any]]:
        """Get last N finished fixtures for a league."""
        cache_key = f"results:{league_id}:{season}:{last}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        data = await self._get("/fixtures", {"league": league_id, "season": season, "last": last, "status": "FT-AET-PEN"})
        fixtures = []
        for f in data.get("response", []):
            fix = f.get("fixture", {})
            teams = f.get("teams", {})
            goals = f.get("goals", {})
            league = f.get("league", {})
            fixtures.append({
                "fixture_id": fix.get("id"),
                "date": fix.get("date"),
                "home_team": teams.get("home", {}).get("name"),
                "home_logo": teams.get("home", {}).get("logo"),
                "away_team": teams.get("away", {}).get("name"),
                "away_logo": teams.get("away", {}).get("logo"),
                "home_goals": goals.get("home"),
                "away_goals": goals.get("away"),
                "round": league.get("round"),
            })

        _cache_set(cache_key, fixtures, CACHE_TTL_FIXTURES)
        return fixtures

    # ------------------------------------------------------------------
    async def get_upcoming_fixtures(self, league_id: int, season: int, next_count: int = 15) -> List[Dict[str, Any]]:
        """Get next N upcoming fixtures for a league."""
        cache_key = f"upcoming:{league_id}:{season}:{next_count}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        data = await self._get("/fixtures", {"league": league_id, "season": season, "next": next_count, "status": "NS-TBD"})
        fixtures = []
        for f in data.get("response", []):
            fix = f.get("fixture", {})
            teams = f.get("teams", {})
            league = f.get("league", {})
            fixtures.append({
                "fixture_id": fix.get("id"),
                "date": fix.get("date"),
                "home_team": teams.get("home", {}).get("name"),
                "home_logo": teams.get("home", {}).get("logo"),
                "away_team": teams.get("away", {}).get("name"),
                "away_logo": teams.get("away", {}).get("logo"),
                "round": league.get("round"),
            })

        _cache_set(cache_key, fixtures, CACHE_TTL_FIXTURES)
        return fixtures

    # ------------------------------------------------------------------
    async def get_team_last_matches(self, team_id: int, last: int = 5) -> List[Dict[str, Any]]:
        """Get last N finished matches for a team (all competitions)."""
        cache_key = f"team_last:{team_id}:{last}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        data = await self._get("/fixtures", {"team": team_id, "last": last, "status": "FT-AET-PEN"})
        matches = []
        for f in data.get("response", []):
            teams = f.get("teams", {})
            goals = f.get("goals", {})
            fix = f.get("fixture", {})
            league = f.get("league", {})
            home_id = teams.get("home", {}).get("id")
            is_home = home_id == team_id
            home_goals = goals.get("home", 0) or 0
            away_goals = goals.get("away", 0) or 0
            if is_home:
                result = "W" if home_goals > away_goals else ("D" if home_goals == away_goals else "L")
            else:
                result = "W" if away_goals > home_goals else ("D" if home_goals == away_goals else "L")
            matches.append({
                "date": fix.get("date"),
                "home_team": teams.get("home", {}).get("name"),
                "away_team": teams.get("away", {}).get("name"),
                "home_goals": home_goals,
                "away_goals": away_goals,
                "result": result,
                "competition": league.get("name", ""),
            })

        _cache_set(cache_key, matches, CACHE_TTL_PREVIEW)
        return matches

    # ------------------------------------------------------------------
    async def get_h2h(self, team1_id: int, team2_id: int, last: int = 5) -> List[Dict[str, Any]]:
        """Get head-to-head matches between two teams."""
        cache_key = f"h2h:{team1_id}-{team2_id}:{last}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        data = await self._get("/fixtures/headtohead", {"h2h": f"{team1_id}-{team2_id}", "last": last})
        matches = []
        for f in data.get("response", []):
            teams = f.get("teams", {})
            goals = f.get("goals", {})
            fix = f.get("fixture", {})
            matches.append({
                "date": fix.get("date"),
                "home_team": teams.get("home", {}).get("name"),
                "away_team": teams.get("away", {}).get("name"),
                "home_goals": goals.get("home"),
                "away_goals": goals.get("away"),
            })

        _cache_set(cache_key, matches, CACHE_TTL_PREVIEW)
        return matches

    # ------------------------------------------------------------------
    async def get_team_standing_position(self, team_id: int, league_id: int, season: int) -> Optional[Dict[str, Any]]:
        """Get a team's current position in a league's standings."""
        standings = await self.get_standings(league_id, season)
        for row in standings:
            logo = row.get("team_logo", "")
            if logo and f"/teams/{team_id}." in logo:
                return {"rank": row["rank"], "points": row["points"], "played": row["played"]}
            if row.get("team_id") == team_id:
                return {"rank": row["rank"], "points": row["points"], "played": row["played"]}
        return None

    # ------------------------------------------------------------------
    async def get_live_fixtures_by_ids(self, fixture_ids: List[int]) -> List[Dict[str, Any]]:
        """Batch fetch multiple fixtures (for live refresh)."""
        # API-Football accepts comma-separated IDs in the `ids` param (undocumented but works)
        # Fallback: fetch one by one
        results = []
        for fid in fixture_ids:
            fx = await self.get_fixture_by_id(fid)
            if fx:
                results.append(fx)
        return results


# API-Football status mapping → our internal status
# See https://www.api-football.com/documentation-v3#tag/Fixtures/operation/get-fixtures
STATUS_MAP_LIVE = {"1H", "2H", "HT", "ET", "P", "BT", "LIVE"}
STATUS_MAP_FINISHED = {"FT", "AET", "PEN"}
STATUS_MAP_NOT_STARTED = {"TBD", "NS"}
STATUS_MAP_POSTPONED = {"PST", "CANC", "ABD", "AWD", "WO", "INT", "SUSP"}


def map_api_status(short_status: str) -> str:
    """Map API-Football short status to our internal status."""
    if short_status in STATUS_MAP_LIVE:
        return "live"
    if short_status in STATUS_MAP_FINISHED:
        return "finished"
    if short_status in STATUS_MAP_NOT_STARTED:
        return "scheduled"
    if short_status in STATUS_MAP_POSTPONED:
        return "postponed"
    return "scheduled"
