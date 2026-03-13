"""
Test cases for League Matchday Range Bug Fix and Season Configuration Fields.

Tests:
1. GET /api/leagues/matchday-range - Returns first_selectable=26, last_matchday=38 for standard user
2. GET /api/admin/league-matchday-range?season_id=... - Returns first_selectable=26, last_matchday=38
3. POST /api/leagues with start_matchday=1 - Returns 400 (retroactive not allowed)
4. POST /api/leagues with start_matchday=26, end_matchday=38 - Succeeds
5. GET /api/admin/seasons - Returns total_matchdays and current_matchday fields
6. PUT /api/admin/seasons/{id} - Can update current_matchday and total_matchdays
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
ACTIVE_SEASON_ID = "19e329ae-4c6b-47ea-ab38-50a4d1baab1e"

# Credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "ilio@raimondi.it"
USER_PASSWORD = "password123"


class TestMatchdayRangeAPIs:
    """Test matchday range endpoints for both regular users and admins."""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get authentication token for standard user."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"User authentication failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get authentication token for admin user."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Admin authentication failed: {response.status_code}")
    
    def test_user_matchday_range_returns_26_38(self, user_token):
        """GET /api/leagues/matchday-range returns first_selectable=26, last_matchday=38."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/matchday-range",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "first_selectable" in data, "Response missing 'first_selectable'"
        assert "last_matchday" in data, "Response missing 'last_matchday'"
        
        # Per requirements: current_matchday=26, total_matchdays=38
        assert data["first_selectable"] == 26, f"Expected first_selectable=26, got {data['first_selectable']}"
        assert data["last_matchday"] == 38, f"Expected last_matchday=38, got {data['last_matchday']}"
        
        print(f"User matchday range: first_selectable={data['first_selectable']}, last_matchday={data['last_matchday']}")
    
    def test_admin_matchday_range_returns_26_38(self, admin_token):
        """GET /api/admin/league-matchday-range?season_id=... returns first_selectable=26, last_matchday=38."""
        response = requests.get(
            f"{BASE_URL}/api/admin/league-matchday-range?season_id={ACTIVE_SEASON_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "first_selectable" in data, "Response missing 'first_selectable'"
        assert "last_matchday" in data, "Response missing 'last_matchday'"
        
        # Per requirements: current_matchday=26, total_matchdays=38
        assert data["first_selectable"] == 26, f"Expected first_selectable=26, got {data['first_selectable']}"
        assert data["last_matchday"] == 38, f"Expected last_matchday=38, got {data['last_matchday']}"
        
        print(f"Admin matchday range: first_selectable={data['first_selectable']}, last_matchday={data['last_matchday']}")


class TestLeagueCreationValidation:
    """Test league creation with matchday range validation."""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get authentication token for standard user."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"User authentication failed: {response.status_code}")
    
    def test_league_creation_retroactive_fails(self, user_token):
        """POST /api/leagues with start_matchday=1 returns 400 (retroactive not allowed)."""
        response = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={
                "Authorization": f"Bearer {user_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "Test Retroactive Fail",
                "season_id": ACTIVE_SEASON_ID,
                "start_matchday": 1,  # Invalid - below first_selectable (26)
                "end_matchday": 38,
                "bet_deadline_minutes": 5,
                "match_source_type": "national",
                "scoring_config": {
                    "1x2": {"enabled": True, "points": 2},
                    "over_under": {"enabled": True, "points": 1},
                    "goal_no_goal": {"enabled": True, "points": 1},
                    "exact_score": {"enabled": True, "points": 5}
                },
                "include_championship_predictions": False
            }
        )
        
        # Should fail with 400 - retroactive league creation not allowed
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        # Validate error message mentions the constraint
        data = response.json()
        error_detail = data.get("detail", "")
        assert "26" in error_detail or "giornata" in error_detail.lower(), f"Error should mention first_selectable constraint: {error_detail}"
        
        print(f"Retroactive league creation correctly rejected: {error_detail}")
    
    def test_league_creation_valid_range_succeeds(self, user_token):
        """POST /api/leagues with start_matchday=26, end_matchday=38 succeeds."""
        import uuid
        unique_name = f"Test Valid G26-38 {uuid.uuid4().hex[:6]}"
        
        response = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={
                "Authorization": f"Bearer {user_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": unique_name,
                "season_id": ACTIVE_SEASON_ID,
                "start_matchday": 26,  # Valid - equals first_selectable
                "end_matchday": 38,     # Valid - equals last_matchday
                "bet_deadline_minutes": 5,
                "match_source_type": "national",
                "scoring_config": {
                    "1x2": {"enabled": True, "points": 2},
                    "over_under": {"enabled": True, "points": 1},
                    "goal_no_goal": {"enabled": True, "points": 1},
                    "exact_score": {"enabled": True, "points": 5}
                },
                "include_championship_predictions": False
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("name") == unique_name, f"League name mismatch"
        assert data.get("start_matchday") == 26, f"Expected start_matchday=26, got {data.get('start_matchday')}"
        assert data.get("end_matchday") == 38, f"Expected end_matchday=38, got {data.get('end_matchday')}"
        assert "invite_code" in data, "Response missing invite_code"
        
        print(f"League created successfully: {data.get('name')} (G{data['start_matchday']}-G{data['end_matchday']})")
        print(f"Invite code: {data.get('invite_code')}")


class TestSeasonConfigurationFields:
    """Test season model with total_matchdays and current_matchday fields."""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get authentication token for admin user."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip(f"Admin authentication failed: {response.status_code}")
    
    def test_admin_seasons_returns_matchday_fields(self, admin_token):
        """GET /api/admin/seasons returns total_matchdays and current_matchday fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        seasons = response.json()
        assert isinstance(seasons, list), "Response should be a list"
        assert len(seasons) > 0, "Expected at least one season"
        
        # Find active season
        active_season = next((s for s in seasons if s.get("is_active") or s.get("status") == "active"), None)
        assert active_season is not None, "Expected an active season"
        
        # Validate matchday fields exist
        assert "total_matchdays" in active_season, f"Season missing 'total_matchdays' field. Keys: {active_season.keys()}"
        assert "current_matchday" in active_season, f"Season missing 'current_matchday' field. Keys: {active_season.keys()}"
        
        # Validate expected values
        assert active_season["total_matchdays"] == 38, f"Expected total_matchdays=38, got {active_season['total_matchdays']}"
        assert active_season["current_matchday"] == 26, f"Expected current_matchday=26, got {active_season['current_matchday']}"
        
        print(f"Active season: {active_season.get('name')}")
        print(f"  total_matchdays: {active_season['total_matchdays']}")
        print(f"  current_matchday: {active_season['current_matchday']}")
    
    def test_admin_update_season_matchday_fields(self, admin_token):
        """PUT /api/admin/seasons/{id} can update current_matchday and total_matchdays."""
        # First, get current season state
        response = requests.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        seasons = response.json()
        active_season = next((s for s in seasons if s.get("id") == ACTIVE_SEASON_ID), None)
        
        if not active_season:
            pytest.skip("Active season not found")
        
        original_current_md = active_season.get("current_matchday", 26)
        original_total_md = active_season.get("total_matchdays", 38)
        
        # Update to test value
        test_current_md = 27
        test_total_md = 40
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/seasons/{ACTIVE_SEASON_ID}",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "current_matchday": test_current_md,
                "total_matchdays": test_total_md
            }
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.status_code}: {update_response.text}"
        
        updated_season = update_response.json()
        assert updated_season.get("current_matchday") == test_current_md, f"Expected current_matchday={test_current_md}"
        assert updated_season.get("total_matchdays") == test_total_md, f"Expected total_matchdays={test_total_md}"
        
        print(f"Season updated: current_matchday={updated_season['current_matchday']}, total_matchdays={updated_season['total_matchdays']}")
        
        # Revert to original values
        revert_response = requests.put(
            f"{BASE_URL}/api/admin/seasons/{ACTIVE_SEASON_ID}",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "current_matchday": original_current_md,
                "total_matchdays": original_total_md
            }
        )
        
        assert revert_response.status_code == 200, f"Revert failed: {revert_response.status_code}"
        print(f"Season reverted: current_matchday={original_current_md}, total_matchdays={original_total_md}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
