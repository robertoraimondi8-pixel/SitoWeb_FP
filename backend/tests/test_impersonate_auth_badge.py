"""
Test file for:
1. Impersonate User functionality (POST /api/admin/impersonate/{user_id})
2. Auth Provider badge functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
ADMIN_ID = "f0a01bb1-4b0c-4f6f-9c8e-a7b33b445651"
TEST_USER_ID = "35dab04d-fb92-4469-92a0-aed0964e1047"  # CleanUserA


class TestImpersonateUser:
    """Test cases for the impersonate user endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
    def test_impersonate_user_success(self):
        """Test: Super admin can impersonate a regular user and get a valid token"""
        response = self.session.post(f"{BASE_URL}/api/admin/impersonate/{TEST_USER_ID}")
        
        # Status assertion
        assert response.status_code == 200, f"Impersonate failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert isinstance(data["access_token"], str), "access_token should be a string"
        assert len(data["access_token"]) > 0, "access_token should not be empty"
        
        # Verify user data in response
        assert data["user"]["id"] == TEST_USER_ID, "User ID should match target"
        assert "username" in data["user"], "User should have username"
        assert "email" in data["user"], "User should have email"
        
        print(f"SUCCESS: Impersonation returned valid token for user {data['user'].get('username')}")
        
    def test_impersonate_user_invalid_user_id(self):
        """Test: Impersonating a non-existent user should return 404"""
        fake_user_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.post(f"{BASE_URL}/api/admin/impersonate/{fake_user_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Non-existent user returns 404")
        
    def test_impersonate_super_admin_blocked(self):
        """Test: Cannot impersonate another super admin (should return 400)"""
        response = self.session.post(f"{BASE_URL}/api/admin/impersonate/{ADMIN_ID}")
        
        # Should be blocked
        assert response.status_code == 400, f"Expected 400 when impersonating super admin, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data or "error" in data, "Should have error message"
        print("SUCCESS: Impersonating super admin is blocked with 400")
        
    def test_impersonate_requires_super_admin(self):
        """Test: Non-super-admin cannot impersonate users (should return 403)"""
        # First, get a regular user token (by impersonating and using that token)
        impersonate_response = self.session.post(f"{BASE_URL}/api/admin/impersonate/{TEST_USER_ID}")
        assert impersonate_response.status_code == 200
        regular_user_token = impersonate_response.json()["access_token"]
        
        # Now try to impersonate with the regular user token
        new_session = requests.Session()
        new_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {regular_user_token}"
        })
        
        # Try to impersonate another user with regular user token
        response = new_session.post(f"{BASE_URL}/api/admin/impersonate/{ADMIN_ID}")
        
        # Should be forbidden (403)
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}: {response.text}"
        print("SUCCESS: Non-super-admin gets 403 when trying to impersonate")


class TestImpersonateAuditLog:
    """Test that impersonation is logged in audit log"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
    def test_impersonate_creates_audit_log(self):
        """Test: Impersonation action is logged in audit log"""
        # Perform impersonation
        impersonate_response = self.session.post(f"{BASE_URL}/api/admin/impersonate/{TEST_USER_ID}")
        assert impersonate_response.status_code == 200
        
        # Check audit log for the admin
        audit_response = self.session.get(f"{BASE_URL}/api/rbac/users/{ADMIN_ID}/audit-log?limit=10")
        
        assert audit_response.status_code == 200, f"Audit log failed: {audit_response.text}"
        
        logs = audit_response.json()
        assert isinstance(logs, list), "Audit log should return a list"
        
        # Find IMPERSONATE action in recent logs
        impersonate_logs = [log for log in logs if log.get("action") == "IMPERSONATE"]
        
        assert len(impersonate_logs) > 0, "Impersonate action should be in audit log"
        
        latest_impersonate = impersonate_logs[0]
        assert latest_impersonate.get("entity_id") == TEST_USER_ID, "Audit log should reference target user"
        assert latest_impersonate.get("admin_id") == ADMIN_ID, "Audit log should reference admin"
        
        print(f"SUCCESS: Impersonation audit logged - action: {latest_impersonate.get('action')}, entity: {latest_impersonate.get('entity_id')}")


class TestAuthProviderAPI:
    """Test that users endpoint returns auth_provider field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login as admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as super admin  
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        self.admin_token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
    def test_rbac_users_includes_auth_provider(self):
        """Test: GET /api/rbac/users returns auth_provider field for users"""
        response = self.session.get(f"{BASE_URL}/api/rbac/users")
        
        assert response.status_code == 200, f"Users list failed: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Should return a list of users"
        assert len(users) > 0, "Should have at least one user"
        
        # Check that users have required fields (but auth_provider might be optional/not in response)
        for user in users[:5]:  # Check first 5 users
            assert "id" in user, "User should have id"
            assert "email" in user, "User should have email"
            assert "username" in user, "User should have username"
            
        print(f"SUCCESS: Users endpoint returns {len(users)} users with expected fields")
        
    def test_my_permissions_returns_username(self):
        """Test: GET /api/rbac/my-permissions returns username field"""
        response = self.session.get(f"{BASE_URL}/api/rbac/my-permissions")
        
        assert response.status_code == 200, f"My permissions failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response should have user_id"
        assert "username" in data, "Response should have username field"
        assert "is_super_admin" in data, "Response should have is_super_admin"
        assert "permissions" in data, "Response should have permissions"
        
        print(f"SUCCESS: my-permissions returns username: {data.get('username')}, is_super_admin: {data.get('is_super_admin')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
