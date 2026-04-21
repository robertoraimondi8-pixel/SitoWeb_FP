"""
Test suite for Live Data Refresh admin endpoints (P0 bug fix).

Tests the 3 new admin endpoints for live refresh control:
- GET /api/admin/real-fixtures/live-status - diagnostic endpoint
- POST /api/admin/real-fixtures/refresh-live - manual refresh trigger
- POST /api/admin/real-fixtures/reset-circuit-breaker - circuit breaker reset

All endpoints require admin.matches.manage permission.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fanta-auth-fix.preview.emergentagent.com").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "ilio@raimondi.it"
USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in login response"
    return data["access_token"]


@pytest.fixture(scope="module")
def user_token():
    """Get standard user authentication token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD}
    )
    assert response.status_code == 200, f"User login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in login response"
    return data["access_token"]


class TestLiveStatusEndpoint:
    """Tests for GET /api/admin/real-fixtures/live-status"""

    def test_live_status_admin_success(self, admin_token):
        """Admin can access live-status endpoint and get expected fields."""
        response = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/live-status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "sync_enabled" in data, "Missing sync_enabled field"
        assert "circuit_breaker" in data, "Missing circuit_breaker field"
        assert "last_refresh" in data, "Missing last_refresh field"
        assert "matches_in_queue" in data, "Missing matches_in_queue field"
        
        # Verify circuit_breaker structure
        cb = data["circuit_breaker"]
        assert "is_open" in cb, "Missing circuit_breaker.is_open"
        assert "remaining_seconds" in cb, "Missing circuit_breaker.remaining_seconds"
        assert "consecutive_failures" in cb, "Missing circuit_breaker.consecutive_failures"
        assert "cooldown_base_seconds" in cb, "Missing circuit_breaker.cooldown_base_seconds"
        
        # Verify last_refresh structure
        lr = data["last_refresh"]
        assert "timestamp" in lr, "Missing last_refresh.timestamp"
        assert "status" in lr, "Missing last_refresh.status"
        
        # Verify matches_in_queue structure
        mq = data["matches_in_queue"]
        assert "live" in mq, "Missing matches_in_queue.live"
        assert "scheduled" in mq, "Missing matches_in_queue.scheduled"
        assert "total" in mq, "Missing matches_in_queue.total"
        
        # Verify data types
        assert isinstance(data["sync_enabled"], bool), "sync_enabled should be boolean"
        assert isinstance(cb["is_open"], bool), "circuit_breaker.is_open should be boolean"
        assert isinstance(cb["consecutive_failures"], int), "consecutive_failures should be int"
        assert isinstance(mq["total"], int), "matches_in_queue.total should be int"

    def test_live_status_unauthenticated(self):
        """Unauthenticated requests should be rejected."""
        response = requests.get(f"{BASE_URL}/api/admin/real-fixtures/live-status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Missing error detail"

    def test_live_status_standard_user_rejected(self, user_token):
        """Standard users without admin.matches.manage permission should be rejected."""
        response = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/live-status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Missing error detail"


class TestRefreshLiveEndpoint:
    """Tests for POST /api/admin/real-fixtures/refresh-live"""

    def test_refresh_live_admin_success(self, admin_token):
        """Admin can trigger manual refresh and get expected response fields."""
        response = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/refresh-live",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "status" in data, "Missing status field"
        assert "message" in data, "Missing message field"
        assert "last_status" in data, "Missing last_status field"
        assert "circuit_breaker_open" in data, "Missing circuit_breaker_open field"
        
        # Verify data types
        assert data["status"] == "ok", f"Expected status 'ok', got '{data['status']}'"
        assert isinstance(data["circuit_breaker_open"], bool), "circuit_breaker_open should be boolean"
        
        # Since there are no live matches in preview DB, expect ok_no_matches
        assert "ok" in data["last_status"] or "no_matches" in data["last_status"], \
            f"Unexpected last_status: {data['last_status']}"

    def test_refresh_live_unauthenticated(self):
        """Unauthenticated requests should be rejected."""
        response = requests.post(f"{BASE_URL}/api/admin/real-fixtures/refresh-live")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Missing error detail"

    def test_refresh_live_standard_user_rejected(self, user_token):
        """Standard users without admin.matches.manage permission should be rejected."""
        response = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/refresh-live",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Missing error detail"


class TestResetCircuitBreakerEndpoint:
    """Tests for POST /api/admin/real-fixtures/reset-circuit-breaker"""

    def test_reset_circuit_breaker_admin_success(self, admin_token):
        """Admin can reset circuit breaker and get expected response fields."""
        response = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/reset-circuit-breaker",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "status" in data, "Missing status field"
        assert "message" in data, "Missing message field"
        assert "was_open" in data, "Missing was_open field"
        assert "previous_failures" in data, "Missing previous_failures field"
        
        # Verify data types
        assert data["status"] == "ok", f"Expected status 'ok', got '{data['status']}'"
        assert isinstance(data["was_open"], bool), "was_open should be boolean"
        assert isinstance(data["previous_failures"], int), "previous_failures should be int"

    def test_reset_circuit_breaker_unauthenticated(self):
        """Unauthenticated requests should be rejected."""
        response = requests.post(f"{BASE_URL}/api/admin/real-fixtures/reset-circuit-breaker")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Missing error detail"

    def test_reset_circuit_breaker_standard_user_rejected(self, user_token):
        """Standard users without admin.matches.manage permission should be rejected."""
        response = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/reset-circuit-breaker",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Missing error detail"


class TestLiveRefreshIntegration:
    """Integration tests for live refresh workflow."""

    def test_refresh_then_check_status(self, admin_token):
        """After manual refresh, live-status should reflect the refresh."""
        # Trigger refresh
        refresh_response = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/refresh-live",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert refresh_response.status_code == 200
        
        # Check status
        status_response = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/live-status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert status_response.status_code == 200
        
        data = status_response.json()
        # After refresh, last_refresh.status should not be "never"
        assert data["last_refresh"]["status"] != "never", \
            "After refresh, last_refresh.status should not be 'never'"
        
        # timestamp should be set (non-zero)
        assert data["last_refresh"]["timestamp"] > 0, \
            "After refresh, last_refresh.timestamp should be > 0"

    def test_reset_then_check_status(self, admin_token):
        """After circuit breaker reset, status should show it's not open."""
        # Reset circuit breaker
        reset_response = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/reset-circuit-breaker",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert reset_response.status_code == 200
        
        # Check status
        status_response = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/live-status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert status_response.status_code == 200
        
        data = status_response.json()
        # After reset, circuit breaker should not be open
        assert data["circuit_breaker"]["is_open"] == False, \
            "After reset, circuit_breaker.is_open should be False"
        assert data["circuit_breaker"]["consecutive_failures"] == 0, \
            "After reset, consecutive_failures should be 0"
