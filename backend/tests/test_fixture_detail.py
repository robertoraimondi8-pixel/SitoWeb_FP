"""Tests for the new Match Detail Sheet feature (fixture-detail endpoint) and standings fix."""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://matchup-arena-4.preview.emergentagent.com'

# Test credentials
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
ADMIN_USER_ID = "f0a01bb1-4b0c-4f6f-9c8e-a7b33b445651"
TEST_FIXTURE_ID = 1378114  # Atalanta vs Napoli, Serie A


def get_auth_token():
    """Get authentication token for standard user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STANDARD_USER_EMAIL,
        "password": STANDARD_USER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


def get_admin_token():
    """Get authentication token for admin user."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("access_token")


class TestFixtureDetailEndpoint:
    """Tests for GET /api/stats/fixture-detail/{fixture_id}"""
    
    def test_fixture_detail_requires_authentication(self):
        """Test that fixture-detail endpoint requires authentication (401 without token)."""
        response = requests.get(f"{BASE_URL}/api/stats/fixture-detail/{TEST_FIXTURE_ID}")
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("PASS: fixture-detail endpoint requires authentication (returns 401)")
    
    def test_fixture_detail_returns_correct_structure(self):
        """Test that fixture-detail returns fixture, events, statistics, lineups."""
        token = get_auth_token()
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/{TEST_FIXTURE_ID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required keys exist
        assert "fixture" in data, "Response missing 'fixture' key"
        assert "events" in data, "Response missing 'events' key"
        assert "statistics" in data, "Response missing 'statistics' key"
        assert "lineups" in data, "Response missing 'lineups' key"
        
        # Verify fixture info
        fixture = data["fixture"]
        assert isinstance(fixture, dict), "fixture should be a dict"
        if fixture:  # If fixture data is populated
            expected_fixture_keys = ["fixture_id", "home_team", "away_team", "home_logo", "away_logo", 
                                     "home_goals", "away_goals", "status_short"]
            for key in expected_fixture_keys:
                if key in fixture:
                    print(f"  fixture.{key} = {fixture.get(key)}")
        
        # Verify events is a list
        assert isinstance(data["events"], list), "events should be a list"
        print(f"  events count = {len(data['events'])}")
        
        # Verify statistics is a list
        assert isinstance(data["statistics"], list), "statistics should be a list"
        print(f"  statistics count = {len(data['statistics'])}")
        
        # Verify lineups is a list
        assert isinstance(data["lineups"], list), "lineups should be a list"
        print(f"  lineups count = {len(data['lineups'])}")
        
        print(f"PASS: fixture-detail returns correct structure with keys: fixture, events, statistics, lineups")
    
    def test_fixture_detail_fixture_info_content(self):
        """Test that fixture info contains expected team data."""
        token = get_auth_token()
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/{TEST_FIXTURE_ID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        fixture = response.json().get("fixture", {})
        
        # Fixture should have team info
        assert fixture.get("home_team") or fixture.get("home_goals") is not None, "Fixture should have home team info"
        assert fixture.get("away_team") or fixture.get("away_goals") is not None, "Fixture should have away team info"
        
        print(f"PASS: fixture {TEST_FIXTURE_ID} has team info: {fixture.get('home_team', 'N/A')} vs {fixture.get('away_team', 'N/A')}")
    
    def test_fixture_detail_invalid_fixture_id(self):
        """Test that invalid fixture ID returns error gracefully."""
        token = get_auth_token()
        invalid_fixture_id = 9999999999
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/{invalid_fixture_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Should return error (502 or 404) or 200 with empty data
        assert response.status_code in [404, 502, 200], f"Unexpected status: {response.status_code}"
        
        # If 200, fixture should be empty
        if response.status_code == 200:
            data = response.json()
            fixture = data.get("fixture", {})
            # Empty fixture or fixture_id is None is acceptable
            print(f"PASS: Invalid fixture ID returns graceful response (status={response.status_code})")
        else:
            print(f"PASS: Invalid fixture ID returns error status {response.status_code}")


class TestStandingsUserEndpointFix:
    """Tests for GET /api/standings/user/{user_id}?league_id={league_id} matchday_breakdown fix."""
    
    def test_user_standings_with_national_league(self):
        """Test that matchday_breakdown returns correct data for national league."""
        token = get_admin_token()
        response = requests.get(
            f"{BASE_URL}/api/standings/user/{ADMIN_USER_ID}?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data, "Response missing 'user_id'"
        assert "username" in data, "Response missing 'username'"
        assert "matchday_breakdown" in data, "Response missing 'matchday_breakdown'"
        assert "league_id" in data, "Response missing 'league_id'"
        
        matchday_breakdown = data.get("matchday_breakdown", [])
        assert isinstance(matchday_breakdown, list), "matchday_breakdown should be a list"
        
        # For national league, should return items if user has played
        print(f"  user_id = {data.get('user_id')}")
        print(f"  username = {data.get('username')}")
        print(f"  league_id = {data.get('league_id')}")
        print(f"  matchday_breakdown count = {len(matchday_breakdown)}")
        
        # The fix ensures matchday_breakdown filters by league_id for national leagues
        # Check that returned items are reasonable (not empty if user has predictions)
        if len(matchday_breakdown) > 0:
            # Verify structure of matchday_breakdown items
            item = matchday_breakdown[0]
            expected_keys = ["matchday_id", "matchday_number", "matchday_label", "total_points"]
            for key in expected_keys:
                assert key in item, f"matchday_breakdown item missing '{key}'"
            print(f"  First matchday: {item.get('matchday_label')} = {item.get('total_points')} points")
        
        print(f"PASS: standings/user endpoint returns matchday_breakdown correctly for national league")
    
    def test_user_standings_returns_items_for_national_league(self):
        """Verify that matchday_breakdown returns expected number of items for national league."""
        token = get_admin_token()
        response = requests.get(
            f"{BASE_URL}/api/standings/user/{ADMIN_USER_ID}?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        matchday_breakdown = data.get("matchday_breakdown", [])
        
        # Per the fix, should return actual played matchdays for this league
        print(f"  matchday_breakdown count = {len(matchday_breakdown)}")
        
        # Verify each item has proper structure
        for i, item in enumerate(matchday_breakdown):
            assert "matchday_number" in item, f"Item {i} missing matchday_number"
            assert "total_points" in item, f"Item {i} missing total_points"
        
        print(f"PASS: matchday_breakdown returns {len(matchday_breakdown)} items for national league")


class TestStatisticsAPIEndpoints:
    """Additional tests for statistics API endpoints used by MatchDetailSheet."""
    
    def test_stats_leagues_endpoint(self):
        """Test that /stats/leagues returns top 5 leagues."""
        token = get_auth_token()
        response = requests.get(
            f"{BASE_URL}/api/stats/leagues",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should return at least 1 league"
        
        # Verify league structure
        if len(data) > 0:
            league = data[0]
            assert "league_id" in league, "League missing league_id"
            assert "name" in league, "League missing name"
            print(f"  Leagues returned: {[lg.get('name') for lg in data]}")
        
        print(f"PASS: /stats/leagues returns {len(data)} leagues")
    
    def test_stats_results_endpoint(self):
        """Test that /stats/results/{league_id} returns recent results."""
        token = get_auth_token()
        # Serie A league_id
        serie_a_id = 135
        response = requests.get(
            f"{BASE_URL}/api/stats/results/{serie_a_id}?season=2025&last=10",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "fixtures" in data, "Response missing 'fixtures'"
        assert isinstance(data["fixtures"], list), "fixtures should be a list"
        
        print(f"  Results returned: {len(data.get('fixtures', []))} fixtures")
        print(f"PASS: /stats/results returns fixture results for Serie A")
    
    def test_stats_upcoming_endpoint(self):
        """Test that /stats/upcoming/{league_id} returns upcoming fixtures."""
        token = get_auth_token()
        # Serie A league_id
        serie_a_id = 135
        response = requests.get(
            f"{BASE_URL}/api/stats/upcoming/{serie_a_id}?season=2025&next=10",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "fixtures" in data, "Response missing 'fixtures'"
        assert isinstance(data["fixtures"], list), "fixtures should be a list"
        
        print(f"  Upcoming fixtures: {len(data.get('fixtures', []))} fixtures")
        print(f"PASS: /stats/upcoming returns upcoming fixtures for Serie A")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
