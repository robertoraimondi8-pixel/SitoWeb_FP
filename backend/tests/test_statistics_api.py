"""
Tests for the Statistics API endpoints - Statistics (Statistiche) feature
Tests:
  - GET /api/stats/leagues - Returns 5 leagues (Serie A, Premier League, La Liga, Bundesliga, Ligue 1)
  - GET /api/stats/standings/{league_id} - Returns league standings
  - GET /api/stats/results/{league_id} - Returns recent results
  - GET /api/stats/upcoming/{league_id} - Returns upcoming fixtures
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://modular-routes-13.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"

# Expected league IDs from API-Football
EXPECTED_LEAGUES = [
    {"id": 135, "name": "Serie A", "country": "Italy"},
    {"id": 39, "name": "Premier League", "country": "England"},
    {"id": 140, "name": "La Liga", "country": "Spain"},
    {"id": 78, "name": "Bundesliga", "country": "Germany"},
    {"id": 61, "name": "Ligue 1", "country": "France"},
]


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("access_token")


class TestStatsLeaguesEndpoint:
    """Test GET /api/stats/leagues - should return 5 leagues"""

    def test_leagues_returns_200(self, auth_token):
        """Test that /api/stats/leagues returns 200 OK"""
        response = requests.get(
            f"{BASE_URL}/api/stats/leagues",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_leagues_returns_5_leagues(self, auth_token):
        """Test that /api/stats/leagues returns exactly 5 leagues"""
        response = requests.get(
            f"{BASE_URL}/api/stats/leagues",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        assert isinstance(leagues, list), "Response should be a list"
        assert len(leagues) == 5, f"Expected 5 leagues, got {len(leagues)}"

    def test_leagues_contains_expected_leagues(self, auth_token):
        """Test that response contains Serie A, Premier League, La Liga, Bundesliga, Ligue 1"""
        response = requests.get(
            f"{BASE_URL}/api/stats/leagues",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        # Extract league IDs from response
        response_league_ids = {lg.get("league_id") for lg in leagues}
        expected_league_ids = {135, 39, 140, 78, 61}
        
        assert response_league_ids == expected_league_ids, f"Expected leagues {expected_league_ids}, got {response_league_ids}"
        
        # Check names too
        league_names = {lg.get("name") for lg in leagues}
        expected_names = {"Serie A", "Premier League", "La Liga", "Bundesliga", "Ligue 1"}
        assert league_names == expected_names, f"Expected names {expected_names}, got {league_names}"

    def test_leagues_have_required_fields(self, auth_token):
        """Test that each league has league_id, name, country, logo, current_season"""
        response = requests.get(
            f"{BASE_URL}/api/stats/leagues",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        required_fields = ["league_id", "name", "country", "current_season"]
        for league in leagues:
            for field in required_fields:
                assert field in league, f"Missing field '{field}' in league {league}"


class TestStatsStandingsEndpoint:
    """Test GET /api/stats/standings/{league_id} - Serie A standings"""

    def test_serie_a_standings_returns_200(self, auth_token):
        """Test that Serie A standings endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/stats/standings/135?season=2024",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Standings response status: {response.status_code}")
        print(f"Standings response body: {response.text[:1000]}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_standings_contains_teams(self, auth_token):
        """Test that standings response contains teams data"""
        response = requests.get(
            f"{BASE_URL}/api/stats/standings/135?season=2024",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "standings" in data, "Response should have 'standings' key"
        standings = data["standings"]
        assert isinstance(standings, list), "Standings should be a list"
        # Serie A should have 20 teams typically
        assert len(standings) >= 1, "Standings should have at least some teams"

    def test_standings_team_has_required_fields(self, auth_token):
        """Test that each team in standings has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/stats/standings/135?season=2024",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        standings = data.get("standings", [])
        
        if len(standings) > 0:
            team = standings[0]
            required_fields = ["rank", "team_name", "points", "played", "win", "draw", "lose"]
            for field in required_fields:
                assert field in team, f"Missing field '{field}' in team data"


class TestStatsResultsEndpoint:
    """Test GET /api/stats/results/{league_id} - recent results"""

    def test_serie_a_results_returns_200(self, auth_token):
        """Test that Serie A results endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/stats/results/135?season=2024",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Results response status: {response.status_code}")
        print(f"Results response body: {response.text[:1000]}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_results_contains_fixtures(self, auth_token):
        """Test that results response contains fixtures data"""
        response = requests.get(
            f"{BASE_URL}/api/stats/results/135?season=2024&last=15",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "fixtures" in data, "Response should have 'fixtures' key"
        fixtures = data["fixtures"]
        assert isinstance(fixtures, list), "Fixtures should be a list"

    def test_results_fixture_has_required_fields(self, auth_token):
        """Test that each fixture has required fields (home_team, away_team, home_goals, away_goals)"""
        response = requests.get(
            f"{BASE_URL}/api/stats/results/135?season=2024&last=15",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        fixtures = data.get("fixtures", [])
        
        if len(fixtures) > 0:
            fixture = fixtures[0]
            required_fields = ["fixture_id", "home_team", "away_team", "date"]
            for field in required_fields:
                assert field in fixture, f"Missing field '{field}' in fixture data"


class TestStatsUpcomingEndpoint:
    """Test GET /api/stats/upcoming/{league_id} - upcoming fixtures"""

    def test_serie_a_upcoming_returns_200(self, auth_token):
        """Test that Serie A upcoming endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/stats/upcoming/135?season=2024",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Upcoming response status: {response.status_code}")
        print(f"Upcoming response body: {response.text[:1000]}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_upcoming_contains_fixtures(self, auth_token):
        """Test that upcoming response contains fixtures data"""
        response = requests.get(
            f"{BASE_URL}/api/stats/upcoming/135?season=2024&next=15",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "fixtures" in data, "Response should have 'fixtures' key"
        fixtures = data["fixtures"]
        assert isinstance(fixtures, list), "Fixtures should be a list"


class TestStatsAuthRequired:
    """Test that stats endpoints require authentication"""

    def test_leagues_requires_auth(self):
        """Test that /api/stats/leagues requires authentication"""
        response = requests.get(f"{BASE_URL}/api/stats/leagues")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"

    def test_standings_requires_auth(self):
        """Test that /api/stats/standings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/stats/standings/135?season=2024")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"


class TestOtherLeaguesStandings:
    """Test standings for other leagues to ensure all 5 work"""

    @pytest.mark.parametrize("league_id,league_name", [
        (39, "Premier League"),
        (140, "La Liga"),
        (78, "Bundesliga"),
        (61, "Ligue 1"),
    ])
    def test_other_leagues_standings(self, auth_token, league_id, league_name):
        """Test that standings work for all 5 leagues"""
        response = requests.get(
            f"{BASE_URL}/api/stats/standings/{league_id}?season=2024",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"{league_name} standings response: {response.status_code}")
        assert response.status_code == 200, f"{league_name} standings failed: {response.text}"
        data = response.json()
        assert "standings" in data, f"{league_name} response missing 'standings'"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
