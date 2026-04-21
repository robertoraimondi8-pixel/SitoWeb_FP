"""
Test suite for MatchDetailSheet component backend APIs
Tests fixture-detail endpoint with completed and upcoming fixtures
Verifies null safety handling for iOS crash fix
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')

class TestMatchDetailSheetAPIs:
    """Tests for MatchDetailSheet component backend APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ilio@raimondi.it", "password": "password123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token")
        assert self.token, "No access_token in login response"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # === Fixture Detail API Tests ===
    
    def test_fixture_detail_completed_match(self):
        """Test fixture-detail with completed match (Tottenham vs Atletico Madrid - ID 1528331)"""
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/1528331",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify fixture data
        fixture = data.get("fixture", {})
        assert fixture.get("home_team") == "Tottenham", f"Expected Tottenham, got {fixture.get('home_team')}"
        assert fixture.get("away_team") == "Atletico Madrid", f"Expected Atletico Madrid, got {fixture.get('away_team')}"
        
        # Verify scores are numbers (not null for completed match)
        assert fixture.get("home_goals") is not None, "home_goals should not be null for completed match"
        assert fixture.get("away_goals") is not None, "away_goals should not be null for completed match"
        assert isinstance(fixture.get("home_goals"), int), "home_goals should be integer"
        assert isinstance(fixture.get("away_goals"), int), "away_goals should be integer"
        
        # Verify halftime data
        halftime = fixture.get("halftime", {})
        assert halftime is not None, "halftime should exist"
        assert halftime.get("home") is not None, "halftime.home should not be null for completed match"
        assert halftime.get("away") is not None, "halftime.away should not be null for completed match"
        
        # Verify events exist
        events = data.get("events", [])
        assert isinstance(events, list), "events should be a list"
        assert len(events) > 0, "Completed match should have events"
        
        # Verify statistics exist
        statistics = data.get("statistics", [])
        assert isinstance(statistics, list), "statistics should be a list"
        assert len(statistics) == 2, "Should have statistics for both teams"
        
        # Verify lineups exist
        lineups = data.get("lineups", [])
        assert isinstance(lineups, list), "lineups should be a list"
        assert len(lineups) == 2, "Should have lineups for both teams"
    
    def test_fixture_detail_upcoming_match(self):
        """Test fixture-detail with upcoming match (Parma vs Cremonese - ID 1378162)"""
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/1378162",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify fixture data
        fixture = data.get("fixture", {})
        assert fixture.get("home_team") == "Parma", f"Expected Parma, got {fixture.get('home_team')}"
        assert fixture.get("away_team") == "Cremonese", f"Expected Cremonese, got {fixture.get('away_team')}"
        
        # Verify scores are null for upcoming match (this is what caused iOS crash)
        assert fixture.get("home_goals") is None, "home_goals should be null for upcoming match"
        assert fixture.get("away_goals") is None, "away_goals should be null for upcoming match"
        
        # Verify halftime is null or has null values
        halftime = fixture.get("halftime")
        if halftime:
            assert halftime.get("home") is None, "halftime.home should be null for upcoming match"
            assert halftime.get("away") is None, "halftime.away should be null for upcoming match"
        
        # Verify events are empty for upcoming match
        events = data.get("events", [])
        assert isinstance(events, list), "events should be a list"
        assert len(events) == 0, "Upcoming match should have no events"
        
        # Verify statistics are empty for upcoming match
        statistics = data.get("statistics", [])
        assert isinstance(statistics, list), "statistics should be a list"
        assert len(statistics) == 0, "Upcoming match should have no statistics"
        
        # Verify lineups are empty for upcoming match
        lineups = data.get("lineups", [])
        assert isinstance(lineups, list), "lineups should be a list"
        assert len(lineups) == 0, "Upcoming match should have no lineups"
        
        # Verify preview data exists for upcoming match
        preview = data.get("preview")
        assert preview is not None, "Upcoming match should have preview data"
    
    def test_fixture_detail_invalid_id(self):
        """Test fixture-detail with invalid fixture ID"""
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/999999999",
            headers=self.headers
        )
        # Should return 404 or empty data, not crash
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
    
    def test_fixture_detail_requires_auth(self):
        """Test fixture-detail requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/1528331"
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
    
    # === Results API Tests ===
    
    def test_results_endpoint(self):
        """Test GET /api/stats/results/{league_id} returns fixtures with fixture_id"""
        response = requests.get(
            f"{BASE_URL}/api/stats/results/135?season=2025&last=5",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        fixtures = data.get("fixtures", [])
        
        assert isinstance(fixtures, list), "fixtures should be a list"
        assert len(fixtures) > 0, "Should return at least one fixture"
        
        # Verify each fixture has required fields
        for fixture in fixtures:
            assert "fixture_id" in fixture, "Each fixture should have fixture_id"
            assert "home_team" in fixture, "Each fixture should have home_team"
            assert "away_team" in fixture, "Each fixture should have away_team"
            assert "home_goals" in fixture, "Each fixture should have home_goals"
            assert "away_goals" in fixture, "Each fixture should have away_goals"
            
            # Results should have scores (not null)
            assert fixture.get("home_goals") is not None, "Results should have home_goals"
            assert fixture.get("away_goals") is not None, "Results should have away_goals"
    
    # === Upcoming API Tests ===
    
    def test_upcoming_endpoint(self):
        """Test GET /api/stats/upcoming/{league_id} returns fixtures"""
        response = requests.get(
            f"{BASE_URL}/api/stats/upcoming/135?season=2025&next=5",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        fixtures = data.get("fixtures", [])
        
        assert isinstance(fixtures, list), "fixtures should be a list"
        assert len(fixtures) > 0, "Should return at least one fixture"
        
        # Verify each fixture has required fields
        for fixture in fixtures:
            assert "fixture_id" in fixture, "Each fixture should have fixture_id"
            assert "home_team" in fixture, "Each fixture should have home_team"
            assert "away_team" in fixture, "Each fixture should have away_team"
    
    # === Event Data Structure Tests ===
    
    def test_event_data_structure(self):
        """Test that events have proper structure for EventRow component"""
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/1528331",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        events = data.get("events", [])
        
        if len(events) > 0:
            event = events[0]
            # Verify event structure matches FixtureEvent type
            assert "time_elapsed" in event or event.get("time_elapsed") is None
            assert "team_name" in event
            assert "type" in event
            assert "detail" in event
    
    # === Statistics Data Structure Tests ===
    
    def test_statistics_data_structure(self):
        """Test that statistics have proper structure for StatsComparison component"""
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/1528331",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        statistics = data.get("statistics", [])
        
        if len(statistics) >= 2:
            home_stats = statistics[0]
            away_stats = statistics[1]
            
            # Verify structure matches TeamStat type
            assert "team_name" in home_stats
            assert "stats" in home_stats
            assert isinstance(home_stats.get("stats"), dict)
            
            assert "team_name" in away_stats
            assert "stats" in away_stats
            assert isinstance(away_stats.get("stats"), dict)
    
    # === Lineups Data Structure Tests ===
    
    def test_lineups_data_structure(self):
        """Test that lineups have proper structure for LineupsView component"""
        response = requests.get(
            f"{BASE_URL}/api/stats/fixture-detail/1528331",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        lineups = data.get("lineups", [])
        
        if len(lineups) >= 2:
            lineup = lineups[0]
            
            # Verify structure matches Lineup type
            assert "team_name" in lineup
            assert "starters" in lineup
            assert "substitutes" in lineup
            assert isinstance(lineup.get("starters"), list)
            assert isinstance(lineup.get("substitutes"), list)
            
            # Verify player structure
            if len(lineup.get("starters", [])) > 0:
                player = lineup["starters"][0]
                assert "name" in player


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
