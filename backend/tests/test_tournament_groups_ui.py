"""
Test suite for Tournament Groups UI improvements - iteration 98
Tests:
1. GET /api/tournaments/{id}/groups returns new format with groups array, advance_count, etc.
2. Each group has 'qualifies' field matching advance_count
3. Each standings entry includes tiebreak stats (total_correct, exact_hits, onextwo_hits)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://context-aware-tabs.preview.emergentagent.com')

# Test tournament ID from test data
TEST_TOURNAMENT_ID = "b3e9021f-b8a6-4f65-ad83-fc7b778f922a"


class TestTournamentGroupsAPI:
    """Tests for tournament groups API with new format"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        yield

    def test_groups_api_returns_object_with_groups_array(self):
        """GET /api/tournaments/{id}/groups returns object with 'groups' array"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200, f"Groups API failed: {resp.text}"
        data = resp.json()
        
        # Verify root-level structure
        assert "groups" in data, "Response must contain 'groups' key"
        assert isinstance(data["groups"], list), "'groups' must be an array"
        assert len(data["groups"]) > 0, "Should have at least one group"

    def test_groups_api_returns_advance_count(self):
        """GET /api/tournaments/{id}/groups returns advance_count at root level"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        assert "advance_count" in data, "Response must contain 'advance_count'"
        assert isinstance(data["advance_count"], int), "advance_count must be integer"
        assert data["advance_count"] == 2, f"advance_count should be 2, got {data['advance_count']}"

    def test_groups_api_returns_players_per_group(self):
        """GET /api/tournaments/{id}/groups returns players_per_group"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        assert "players_per_group" in data, "Response must contain 'players_per_group'"
        assert isinstance(data["players_per_group"], int)
        assert data["players_per_group"] == 4, f"players_per_group should be 4, got {data['players_per_group']}"

    def test_groups_api_returns_groups_count(self):
        """GET /api/tournaments/{id}/groups returns groups_count"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        assert "groups_count" in data, "Response must contain 'groups_count'"
        assert isinstance(data["groups_count"], int)
        assert data["groups_count"] == 2, f"groups_count should be 2, got {data['groups_count']}"

    def test_each_group_has_qualifies_field(self):
        """Each group must have 'qualifies' field matching advance_count"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        advance_count = data["advance_count"]
        for group in data["groups"]:
            assert "qualifies" in group, f"Group {group.get('group_name')} missing 'qualifies' field"
            assert group["qualifies"] == advance_count, \
                f"Group {group.get('group_name')} qualifies={group['qualifies']} should match advance_count={advance_count}"

    def test_standings_entry_has_tiebreak_stats(self):
        """Each standings entry must include total_correct, exact_hits, onextwo_hits"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        required_tiebreak_fields = ["total_correct", "exact_hits", "onextwo_hits"]
        
        for group in data["groups"]:
            for entry in group.get("standings", []):
                for field in required_tiebreak_fields:
                    assert field in entry, \
                        f"Standings entry for {entry.get('username')} in group {group.get('group_name')} missing '{field}'"
                    assert isinstance(entry[field], int), \
                        f"Field '{field}' for {entry.get('username')} should be integer"

    def test_groups_include_standard_standings_fields(self):
        """Standings entries must include standard fields: user_id, username, played, wins, draws, losses, group_points"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        required_fields = ["user_id", "username", "played", "wins", "draws", "losses", "group_points", "prediction_points"]
        
        for group in data["groups"]:
            for entry in group.get("standings", []):
                for field in required_fields:
                    assert field in entry, \
                        f"Standings entry for {entry.get('username')} missing '{field}'"

    def test_tournament_name_in_response(self):
        """Response should include tournament_name"""
        resp = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}/groups",
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        
        assert "tournament_name" in data, "Response should include 'tournament_name'"
        assert data["tournament_name"] == "TEST_LC_tb901", f"Expected 'TEST_LC_tb901', got {data['tournament_name']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
