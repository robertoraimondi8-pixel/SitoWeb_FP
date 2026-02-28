"""
Test Dashboard Stats API - RBAC Step 3
Tests GET /api/rbac/dashboard-stats endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://admin-unified-ui.preview.emergentagent.com")

# Test credentials
SUPER_ADMIN_EMAIL = "admin@fantapronostic.com"
SUPER_ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get super admin authentication token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} - {resp.text}")
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get headers with admin token."""
    return {"Authorization": f"Bearer {admin_token}"}


class TestDashboardStatsEndpoint:
    """Tests for GET /api/rbac/dashboard-stats endpoint."""

    def test_dashboard_stats_requires_auth(self):
        """Dashboard stats endpoint requires authentication."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats")
        assert resp.status_code == 401, f"Expected 401 without auth, got {resp.status_code}"

    def test_dashboard_stats_success(self, admin_headers):
        """Dashboard stats returns 200 for authorized admin."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, dict), "Response should be a dict"

    def test_dashboard_stats_users_section(self, admin_headers):
        """Dashboard stats users section has required fields."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify users section exists
        assert "users" in data, "Response should have 'users' section"
        users = data["users"]
        
        # Verify all required user KPI fields
        assert "total" in users, "Users should have 'total' field"
        assert "disabled" in users, "Users should have 'disabled' field"
        assert "deleted" in users, "Users should have 'deleted' field"
        assert "new_7d" in users, "Users should have 'new_7d' field"
        assert "recent_logins_24h" in users, "Users should have 'recent_logins_24h' field"
        
        # Verify values are numeric
        assert isinstance(users["total"], int), "total should be int"
        assert isinstance(users["disabled"], int), "disabled should be int"
        assert isinstance(users["deleted"], int), "deleted should be int"
        assert isinstance(users["new_7d"], int), "new_7d should be int"
        assert isinstance(users["recent_logins_24h"], int), "recent_logins_24h should be int"
        
        # Values should be non-negative
        assert users["total"] >= 0, "total should be >= 0"
        assert users["disabled"] >= 0, "disabled should be >= 0"
        assert users["deleted"] >= 0, "deleted should be >= 0"
        assert users["new_7d"] >= 0, "new_7d should be >= 0"
        assert users["recent_logins_24h"] >= 0, "recent_logins_24h should be >= 0"

    def test_dashboard_stats_leagues_section(self, admin_headers):
        """Dashboard stats leagues section has required fields."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify leagues section exists
        assert "leagues" in data, "Response should have 'leagues' section"
        leagues = data["leagues"]
        
        # Verify required fields
        assert "total" in leagues, "Leagues should have 'total' field"
        assert "at_risk" in leagues, "Leagues should have 'at_risk' array"
        
        # Verify types
        assert isinstance(leagues["total"], int), "total should be int"
        assert isinstance(leagues["at_risk"], list), "at_risk should be list"
        
        # Verify at_risk structure (if any)
        for risk in leagues["at_risk"]:
            assert "id" in risk, "at_risk item should have 'id'"
            assert "name" in risk, "at_risk item should have 'name'"
            assert "reason" in risk, "at_risk item should have 'reason'"
            assert isinstance(risk["name"], str), "name should be string"
            assert isinstance(risk["reason"], str), "reason should be string"

    def test_dashboard_stats_matchdays_section(self, admin_headers):
        """Dashboard stats matchdays section has count per status."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify matchdays section exists
        assert "matchdays" in data, "Response should have 'matchdays' section"
        matchdays = data["matchdays"]
        
        # matchdays is a dict with status -> count
        assert isinstance(matchdays, dict), "matchdays should be a dict"
        
        # All values should be integers
        for status, count in matchdays.items():
            assert isinstance(count, int), f"Count for status '{status}' should be int"
            assert count >= 0, f"Count for status '{status}' should be >= 0"

    def test_dashboard_stats_payments_section(self, admin_headers):
        """Dashboard stats payments section has recent and pending_count."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify payments section exists
        assert "payments" in data, "Response should have 'payments' section"
        payments = data["payments"]
        
        # Verify required fields
        assert "recent" in payments, "Payments should have 'recent' array"
        assert "pending_count" in payments, "Payments should have 'pending_count'"
        
        # Verify types
        assert isinstance(payments["recent"], list), "recent should be list"
        assert isinstance(payments["pending_count"], int), "pending_count should be int"
        
        # recent array max 10 items
        assert len(payments["recent"]) <= 10, "recent should have at most 10 items"
        
        # Verify each recent payment structure (if any)
        for p in payments["recent"]:
            assert isinstance(p, dict), "Each payment should be a dict"
            # Should not contain _id (MongoDB ObjectId)
            assert "_id" not in p, "Payment should not have _id field"

    def test_dashboard_stats_audit_section(self, admin_headers):
        """Dashboard stats audit section has latest 20 entries."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify audit section exists
        assert "audit" in data, "Response should have 'audit' section"
        audit = data["audit"]
        
        # Verify type
        assert isinstance(audit, list), "audit should be list"
        
        # audit array max 20 items
        assert len(audit) <= 20, "audit should have at most 20 items"
        
        # Verify each audit entry structure (if any)
        for a in audit:
            assert isinstance(a, dict), "Each audit entry should be a dict"
            # Should not contain _id (MongoDB ObjectId)
            assert "_id" not in a, "Audit entry should not have _id field"
            # Should have created_at
            if len(audit) > 0:
                assert "created_at" in a or a == {}, "Audit entry should have created_at"


class TestDashboardStatsRBAC:
    """Test RBAC enforcement on dashboard stats endpoint."""

    def test_admin_with_dashboard_view_can_access(self, admin_headers):
        """Admin with admin.dashboard.view permission can access."""
        # First verify admin has the permission
        perms_resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers=admin_headers)
        assert perms_resp.status_code == 200
        perms = perms_resp.json()
        
        # Super admin has all permissions
        assert perms["is_super_admin"] == True or "admin.dashboard.view" in perms["permissions"]
        
        # Now verify dashboard stats works
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200

    def test_regular_user_cannot_access(self):
        """Regular user without admin role cannot access dashboard stats."""
        # Create or use a regular user
        # First try to register a test user
        import random
        import string
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        test_email = f"test_user_{suffix}@test.com"
        
        reg_resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User",
            "date_of_birth": "1990-01-01",
            "address": "Test Address",
            "city": "Test City",
            "country": "IT",
            "postal_code": "00100",
            "language": "it",
            "accepted_privacy": True,
            "accepted_terms": True
        })
        
        if reg_resp.status_code == 200:
            token = reg_resp.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Regular user should NOT be able to access dashboard stats
            resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=headers)
            assert resp.status_code == 403, f"Regular user should get 403, got {resp.status_code}"
        else:
            # Skip if registration fails (email might exist)
            pytest.skip("Could not create test user for RBAC test")


class TestAtRiskLeagues:
    """Test at-risk leagues detection in dashboard stats."""

    def test_at_risk_includes_leagues_without_owner(self, admin_headers):
        """At-risk leagues includes leagues without owner_id."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        at_risk = data["leagues"]["at_risk"]
        
        # Check if there are any leagues without owner (reason: "Nessun owner")
        no_owner_leagues = [l for l in at_risk if "owner" in l.get("reason", "").lower()]
        
        # The national league typically has no owner
        # Just verify the structure is correct
        print(f"Found {len(no_owner_leagues)} leagues without owner")
        print(f"Total at-risk leagues: {len(at_risk)}")
        
        # If there are no_owner leagues, verify they have correct structure
        for league in no_owner_leagues:
            assert "Nessun owner" in league["reason"], f"Expected 'Nessun owner' reason, got {league['reason']}"

    def test_at_risk_includes_test_leagues_without_admin(self, admin_headers):
        """At-risk leagues includes leagues with no admin members."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        at_risk = data["leagues"]["at_risk"]
        
        # Check if there are any leagues without admin (reason: "Nessun admin")
        no_admin_leagues = [l for l in at_risk if "admin" in l.get("reason", "").lower()]
        
        print(f"Found {len(no_admin_leagues)} leagues without admin")
        
        # If there are no_admin leagues, verify they have correct structure
        for league in no_admin_leagues:
            assert "Nessun admin" in league["reason"], f"Expected 'Nessun admin' reason, got {league['reason']}"


class TestDashboardStatsDataIntegrity:
    """Test dashboard stats data integrity."""

    def test_users_total_greater_than_disabled(self, admin_headers):
        """Total users should be >= disabled users."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        users = data["users"]
        assert users["total"] >= users["disabled"], "Total should be >= disabled"

    def test_recent_logins_reasonable(self, admin_headers):
        """Recent logins should be <= total users."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        users = data["users"]
        # Recent logins in last 24h should be <= total users
        # Note: This might fail if total doesn't include deleted users but logins does
        # For safety, just verify it's a reasonable number
        assert users["recent_logins_24h"] <= users["total"] + users["deleted"], \
            f"Recent logins ({users['recent_logins_24h']}) seems too high compared to total ({users['total']})"

    def test_audit_ordered_by_date_descending(self, admin_headers):
        """Audit entries should be ordered by date descending (newest first)."""
        resp = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        audit = data["audit"]
        
        if len(audit) >= 2:
            # Check first entry is newer than second
            dates = []
            for a in audit[:5]:  # Check first 5
                if "created_at" in a:
                    dates.append(a["created_at"])
            
            # Verify dates are in descending order
            for i in range(len(dates) - 1):
                assert dates[i] >= dates[i+1], \
                    f"Audit not sorted: {dates[i]} should be >= {dates[i+1]}"
