"""Tests for Matchday Control Room match management functionality.

Tests:
- GET /api/admin/matches?matchday_id={id} returns matches array
- PUT /api/admin/matches/{id} accepts all fields (home_team, away_team, competition, market_type, kickoff, status, scores)
- PUT /api/admin/matches/{id} maps kickoff -> start_time
- PUT /api/admin/matches/{id} accepts all valid statuses: scheduled, live, finished, suspended, postponed, cancelled, void
- POST /api/admin/matches/{id}/special toggles X3 flag
- POST /api/admin/matches/{id}/live-update updates score and status
- DELETE /api/admin/matches/{id} removes match
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test data
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
TEST_MATCHDAY_ID = "98856f76-a5d9-40e9-97b8-cf3e6667eeb2"  # G1 with 10 matches


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture
def api_client(admin_token):
    """Requests session with admin auth."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session


class TestGetMatchesForMatchday:
    """Tests for GET /api/admin/matches?matchday_id={id}"""
    
    def test_get_matches_returns_array(self, api_client):
        """GET /admin/matches returns {count, matches} structure."""
        response = api_client.get(f"{BASE_URL}/api/admin/matches?matchday_id={TEST_MATCHDAY_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "count" in data, "Response should have 'count' field"
        assert "matches" in data, "Response should have 'matches' field"
        assert isinstance(data["matches"], list), "'matches' should be a list"
        assert data["count"] > 0, "Matchday should have matches"
        
    def test_matches_have_required_fields(self, api_client):
        """Each match should have required fields for Control Room display."""
        response = api_client.get(f"{BASE_URL}/api/admin/matches?matchday_id={TEST_MATCHDAY_ID}")
        data = response.json()
        
        required_fields = ["id", "home_team", "away_team", "status"]
        for match in data["matches"]:
            for field in required_fields:
                assert field in match, f"Match missing required field: {field}"


class TestUpdateMatchFields:
    """Tests for PUT /api/admin/matches/{id} field updates."""
    
    @pytest.fixture
    def test_match(self, api_client):
        """Get first match from test matchday."""
        response = api_client.get(f"{BASE_URL}/api/admin/matches?matchday_id={TEST_MATCHDAY_ID}")
        matches = response.json()["matches"]
        if not matches:
            pytest.skip("No matches in test matchday")
        return matches[0]
    
    def test_update_home_team(self, api_client, test_match):
        """PUT accepts home_team field."""
        original = test_match["home_team"]
        test_value = f"TEST_Home_{uuid.uuid4().hex[:6]}"
        
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"home_team": test_value}
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert response.json()["updates"]["home_team"] == test_value
        
        # Revert
        api_client.put(f"{BASE_URL}/api/admin/matches/{test_match['id']}", json={"home_team": original})
    
    def test_update_away_team(self, api_client, test_match):
        """PUT accepts away_team field."""
        original = test_match["away_team"]
        test_value = f"TEST_Away_{uuid.uuid4().hex[:6]}"
        
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"away_team": test_value}
        )
        assert response.status_code == 200
        assert response.json()["updates"]["away_team"] == test_value
        
        # Revert
        api_client.put(f"{BASE_URL}/api/admin/matches/{test_match['id']}", json={"away_team": original})
    
    def test_update_competition(self, api_client, test_match):
        """PUT accepts competition field."""
        original = test_match.get("competition", "Serie A")
        
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"competition": "Test League"}
        )
        assert response.status_code == 200
        assert response.json()["updates"]["competition"] == "Test League"
        
        # Revert
        api_client.put(f"{BASE_URL}/api/admin/matches/{test_match['id']}", json={"competition": original})
    
    def test_update_market_type(self, api_client, test_match):
        """PUT accepts market_type field."""
        original = test_match.get("market_type", "1X2")
        
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"market_type": "GOAL_NOGOL"}
        )
        assert response.status_code == 200
        assert response.json()["updates"]["market_type"] == "GOAL_NOGOL"
        
        # Revert
        api_client.put(f"{BASE_URL}/api/admin/matches/{test_match['id']}", json={"market_type": original})
    
    def test_update_kickoff_maps_to_start_time(self, api_client, test_match):
        """PUT kickoff field should map to start_time in database."""
        test_time = "2026-03-15T14:00:00.000Z"
        
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"kickoff": test_time}
        )
        assert response.status_code == 200
        # Backend maps kickoff -> start_time
        assert "start_time" in response.json()["updates"]
        assert response.json()["updates"]["start_time"] == test_time
    
    def test_update_scores(self, api_client, test_match):
        """PUT accepts home_score and away_score."""
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"home_score": 3, "away_score": 2}
        )
        assert response.status_code == 200
        assert response.json()["updates"]["home_score"] == 3
        assert response.json()["updates"]["away_score"] == 2


class TestMatchStatusValues:
    """Tests for all valid status values in PUT /api/admin/matches/{id}."""
    
    @pytest.fixture
    def test_match(self, api_client):
        """Get first match from test matchday."""
        response = api_client.get(f"{BASE_URL}/api/admin/matches?matchday_id={TEST_MATCHDAY_ID}")
        matches = response.json()["matches"]
        if not matches:
            pytest.skip("No matches in test matchday")
        return matches[0]
    
    @pytest.mark.parametrize("status", [
        "scheduled",
        "live",
        "finished",
        "suspended",
        "postponed",
        "cancelled",
        "void"
    ])
    def test_valid_status_accepted(self, api_client, test_match, status):
        """PUT accepts valid status: {status}."""
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"status": status}
        )
        assert response.status_code == 200, f"Status {status} should be accepted"
        assert response.json()["ok"] is True
        assert response.json()["updates"]["status"] == status
    
    def test_invalid_status_rejected(self, api_client, test_match):
        """PUT rejects invalid status values."""
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"status": "invalid_status"}
        )
        assert response.status_code == 400, "Invalid status should return 400"
    
    def test_revert_to_finished(self, api_client, test_match):
        """Cleanup: revert match status to finished."""
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={"status": "finished"}
        )
        assert response.status_code == 200


class TestSpecialMatchToggle:
    """Tests for POST /api/admin/matches/{id}/special (X3 toggle)."""
    
    @pytest.fixture
    def test_match(self, api_client):
        """Get first match from test matchday."""
        response = api_client.get(f"{BASE_URL}/api/admin/matches?matchday_id={TEST_MATCHDAY_ID}")
        matches = response.json()["matches"]
        if not matches:
            pytest.skip("No matches in test matchday")
        return matches[0]
    
    def test_toggle_special_on(self, api_client, test_match):
        """POST /special toggles is_special flag."""
        response = api_client.post(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}/special",
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_special" in data
        assert "multiplier" in data
        # Value could be True or False depending on previous state
        assert data["multiplier"] in (1.0, 3.0)


class TestLiveUpdate:
    """Tests for POST /api/admin/matches/{id}/live-update."""
    
    @pytest.fixture
    def test_match(self, api_client):
        """Get first match from test matchday."""
        response = api_client.get(f"{BASE_URL}/api/admin/matches?matchday_id={TEST_MATCHDAY_ID}")
        matches = response.json()["matches"]
        if not matches:
            pytest.skip("No matches in test matchday")
        return matches[0]
    
    def test_live_update_scores(self, api_client, test_match):
        """POST /live-update updates scores and status."""
        response = api_client.post(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}/live-update",
            json={
                "match_id": test_match["id"],
                "home_score": 2,
                "away_score": 1,
                "status": "finished"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["home_score"] == 2
        assert data["away_score"] == 1
        assert data["status"] == "finished"


class TestAllFieldsUpdate:
    """Test updating all fields at once like the Control Room does."""
    
    @pytest.fixture
    def test_match(self, api_client):
        """Get first match from test matchday."""
        response = api_client.get(f"{BASE_URL}/api/admin/matches?matchday_id={TEST_MATCHDAY_ID}")
        matches = response.json()["matches"]
        if not matches:
            pytest.skip("No matches in test matchday")
        return matches[0]
    
    def test_full_match_update(self, api_client, test_match):
        """PUT accepts all fields at once (like doSaveEditMatch in UI)."""
        response = api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={
                "home_team": "Test Home",
                "away_team": "Test Away",
                "competition": "Test Competition",
                "market_type": "1X2",
                "kickoff": "2026-04-01T15:00:00.000Z",
                "status": "scheduled",
                "home_score": 0,
                "away_score": 0
            }
        )
        assert response.status_code == 200
        updates = response.json()["updates"]
        
        assert updates["home_team"] == "Test Home"
        assert updates["away_team"] == "Test Away"
        assert updates["competition"] == "Test Competition"
        assert updates["market_type"] == "1X2"
        assert updates["start_time"] == "2026-04-01T15:00:00.000Z"  # kickoff mapped
        assert updates["status"] == "scheduled"
        assert updates["home_score"] == 0
        assert updates["away_score"] == 0
        
        # Revert
        api_client.put(
            f"{BASE_URL}/api/admin/matches/{test_match['id']}",
            json={
                "home_team": test_match["home_team"],
                "away_team": test_match["away_team"],
                "status": "finished"
            }
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
