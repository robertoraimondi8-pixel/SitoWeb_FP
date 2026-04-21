"""
Test lifecycle management for Seasons, Leagues, and Tournaments.
- Season states: draft/active/completed/archived
- League states: draft/active/completed/cancelled
- League matchday range validation for retroactive prevention
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
ACTIVE_SEASON_ID = "19e329ae-4c6b-47ea-ab38-50a4d1baab1e"


class TestSeasonLifecycle:
    """Tests for Season lifecycle management endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_seasons_returns_status_field(self, admin_token):
        """GET /api/admin/seasons should return seasons with status field"""
        response = requests.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        seasons = response.json()
        assert len(seasons) >= 1, "At least one season should exist"
        
        # Find active season
        active_season = next((s for s in seasons if s["id"] == ACTIVE_SEASON_ID), None)
        assert active_season is not None, "Active season not found"
        assert "status" in active_season, "Season should have 'status' field"
        assert active_season["status"] == "active", f"Active season should have status='active', got {active_season['status']}"
        assert active_season["name"] == "Serie A 2025-2026", f"Season name should be '2025-2026', got {active_season['name']}"
    
    def test_archive_active_season_should_fail(self, admin_token):
        """POST /api/admin/seasons/{id}/archive should fail for active season"""
        response = requests.post(
            f"{BASE_URL}/api/admin/seasons/{ACTIVE_SEASON_ID}/archive",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert "completate" in data["detail"].lower() or "completed" in data["detail"].lower(), \
            f"Error message should mention completed requirement: {data['detail']}"
    
    def test_complete_season_endpoint_exists(self, admin_token):
        """POST /api/admin/seasons/{id}/complete endpoint should exist"""
        # Test with non-existent season to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/admin/seasons/nonexistent-id/complete",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 404 (not found) not 422 (validation) or 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404 for non-existent season, got {response.status_code}"


class TestLeagueMatchdayRange:
    """Tests for league matchday range validation (no retroactive leagues)"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_league_matchday_range_returns_correct_values(self, admin_token):
        """GET /api/admin/league-matchday-range should return first_selectable=26, last_matchday=26"""
        response = requests.get(
            f"{BASE_URL}/api/admin/league-matchday-range",
            params={"season_id": ACTIVE_SEASON_ID},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "first_selectable" in data, "Response should have first_selectable"
        assert "last_matchday" in data, "Response should have last_matchday"
        assert data["first_selectable"] == 26, f"first_selectable should be 26 (G1-G25 completed), got {data['first_selectable']}"
        assert data["last_matchday"] == 26, f"last_matchday should be 26, got {data['last_matchday']}"
    
    def test_create_league_with_invalid_start_matchday_fails(self, admin_token):
        """POST /api/rbac/leagues/create with start_matchday=1 should fail (retroactive)"""
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json={
                "name": "Test Invalid League G1",
                "season_id": ACTIVE_SEASON_ID,
                "start_matchday": 1,
                "end_matchday": 38
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400 for retroactive league, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        # Should mention that start matchday must be >= 26
        assert "26" in data["detail"], f"Error should mention minimum matchday 26: {data['detail']}"
    
    def test_create_league_with_valid_matchday_range_succeeds(self, admin_token):
        """POST /api/rbac/leagues/create with start_matchday=26, end_matchday=26 should succeed"""
        unique_name = f"Test League Valid G26 {int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json={
                "name": unique_name,
                "season_id": ACTIVE_SEASON_ID,
                "start_matchday": 26,
                "end_matchday": 26
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "league_id" in data, "Response should have league_id"
        assert "invite_code" in data, "Response should have invite_code"
        print(f"Created test league: {data['league_id']}")


class TestLeagueStatusField:
    """Tests for league status field in responses"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_leagues_includes_status_field(self, admin_token):
        """GET /api/rbac/leagues should include status field for each league"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        assert len(leagues) >= 1, "At least one league should exist"
        
        # Check first few leagues have status field
        for league in leagues[:5]:
            assert "status" in league, f"League {league.get('name')} missing status field"
            assert league["status"] in ["draft", "active", "completed", "cancelled"], \
                f"Invalid status '{league['status']}' for league {league.get('name')}"
        
        # Count status distribution
        status_counts = {}
        for league in leagues:
            status = league.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        print(f"League status distribution: {status_counts}")


class TestSeasonLifecycleValidation:
    """Tests for season lifecycle state transition validation"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_activate_endpoint_exists(self, admin_token):
        """POST /api/admin/seasons/{id}/activate endpoint should exist"""
        # The active season can't be activated again, but endpoint should exist
        response = requests.post(
            f"{BASE_URL}/api/admin/seasons/nonexistent-id/activate",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_unauthenticated_access_denied(self):
        """Season endpoints should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/seasons")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        
        response = requests.post(f"{BASE_URL}/api/admin/seasons/{ACTIVE_SEASON_ID}/complete")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestLeagueCompleteEndpoint:
    """Tests for manual league completion endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_complete_league_endpoint_exists(self, admin_token):
        """POST /api/admin/leagues/{id}/complete endpoint should exist"""
        response = requests.post(
            f"{BASE_URL}/api/admin/leagues/nonexistent-id/complete",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404 for non-existent league, got {response.status_code}"
    
    def test_complete_already_completed_league_fails(self, admin_token):
        """POST /api/admin/leagues/{id}/complete should fail for already completed league"""
        # First, find a completed league if any
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        leagues = response.json()
        completed = [l for l in leagues if l.get("status") == "completed"]
        
        if completed:
            league_id = completed[0]["id"]
            response = requests.post(
                f"{BASE_URL}/api/admin/leagues/{league_id}/complete",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 400, f"Expected 400 for already completed, got {response.status_code}"
        else:
            pytest.skip("No completed leagues to test")
