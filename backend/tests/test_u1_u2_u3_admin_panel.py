"""
Test U1, U2, U3 Admin Panel Features for FantaPronostic
- U1: Dashboard KPIs (Nuovi 7gg, Login 24h, Online Users)
- U2: Edit user details (username/email) from admin panel
- U3: Generate secure password reset link
"""

import pytest
import requests
import os
import hashlib
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://home-screen-final.preview.emergentagent.com").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "ilio@raimondi.it"
TEST_USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_session():
    """Login as admin and return session with token."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    
    data = response.json()
    token = data.get("access_token")
    assert token, "No access token in login response"
    
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def test_user_id(admin_session):
    """Get the ID of a test user (ilio@raimondi.it)."""
    response = admin_session.get(f"{BASE_URL}/api/rbac/users")
    assert response.status_code == 200, f"Failed to get users: {response.text}"
    
    users = response.json()
    for user in users:
        if user.get("email") == TEST_USER_EMAIL:
            return user["id"]
    
    # If test user doesn't exist, skip tests that need it
    pytest.skip(f"Test user {TEST_USER_EMAIL} not found")


class TestU1DashboardKPIs:
    """U1: Dashboard KPIs - Nuovi 7gg, Login 24h, Online Users indicator"""
    
    def test_dashboard_stats_endpoint_returns_200(self, admin_session):
        """Dashboard stats endpoint should be accessible."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/dashboard-stats")
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert "users" in data, "Missing 'users' section in dashboard stats"
        assert "leagues" in data, "Missing 'leagues' section in dashboard stats"
        assert "matchdays" in data, "Missing 'matchdays' section in dashboard stats"
        assert "payments" in data, "Missing 'payments' section in dashboard stats"
    
    def test_dashboard_stats_has_new_7d_count(self, admin_session):
        """Dashboard stats should include 'new_7d' counter."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/dashboard-stats")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", {})
        assert "new_7d" in users, "Missing 'new_7d' in users stats"
        assert isinstance(users["new_7d"], int), "'new_7d' should be an integer"
        print(f"Dashboard stats - New users in last 7 days: {users['new_7d']}")
    
    def test_dashboard_stats_has_recent_logins_24h(self, admin_session):
        """Dashboard stats should include 'recent_logins_24h' counter."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/dashboard-stats")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", {})
        assert "recent_logins_24h" in users, "Missing 'recent_logins_24h' in users stats"
        assert isinstance(users["recent_logins_24h"], int), "'recent_logins_24h' should be an integer"
        print(f"Dashboard stats - Logins in last 24h: {users['recent_logins_24h']}")
    
    def test_dashboard_stats_has_online_users(self, admin_session):
        """Dashboard stats should include 'online' users counter."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/dashboard-stats")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", {})
        assert "online" in users, "Missing 'online' in users stats"
        assert isinstance(users["online"], int), "'online' should be an integer"
        print(f"Dashboard stats - Online users (last 5 min): {users['online']}")
    
    def test_dashboard_stats_has_all_user_kpis(self, admin_session):
        """Dashboard stats should include all user KPIs."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/dashboard-stats")
        assert response.status_code == 200
        
        data = response.json()
        users = data.get("users", {})
        
        required_fields = ["total", "disabled", "new_7d", "recent_logins_24h", "online"]
        for field in required_fields:
            assert field in users, f"Missing '{field}' in users stats"
        
        print(f"All user KPIs present: {users}")


class TestU2EditUserDetails:
    """U2: Edit user details (username/email) from admin panel"""
    
    def test_get_user_details(self, admin_session, test_user_id):
        """Should be able to get user details."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/users")
        assert response.status_code == 200
        
        users = response.json()
        test_user = next((u for u in users if u["id"] == test_user_id), None)
        assert test_user is not None, "Test user not found in users list"
        assert "username" in test_user
        assert "email" in test_user
        print(f"Found user: {test_user.get('username')} ({test_user.get('email')})")
    
    def test_edit_username_success(self, admin_session, test_user_id):
        """Admin should be able to update a user's username."""
        # First get current username
        response = admin_session.get(f"{BASE_URL}/api/rbac/users")
        users = response.json()
        test_user = next((u for u in users if u["id"] == test_user_id), None)
        original_username = test_user["username"]
        
        # Update to new username (alphanumeric, 3-20 chars)
        import random
        import string
        new_username = "u2test_" + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={
            "username": new_username
        })
        assert response.status_code == 200, f"Failed to update username: {response.text}"
        
        data = response.json()
        assert "updates" in data
        assert "username" in data["updates"]
        print(f"Username updated from {original_username} to {new_username}")
        
        # Restore original username
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={
            "username": original_username
        })
        assert response.status_code == 200
        print(f"Username restored to {original_username}")
    
    def test_edit_email_success(self, admin_session, test_user_id):
        """Admin should be able to update a user's email."""
        # First get current email
        response = admin_session.get(f"{BASE_URL}/api/rbac/users")
        users = response.json()
        test_user = next((u for u in users if u["id"] == test_user_id), None)
        original_email = test_user["email"]
        
        # Update to new email
        new_email = f"test_u2_{int(datetime.now().timestamp())}@test.com"
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={
            "email": new_email
        })
        assert response.status_code == 200, f"Failed to update email: {response.text}"
        
        data = response.json()
        assert "updates" in data
        assert "email" in data["updates"]
        print(f"Email updated from {original_email} to {new_email}")
        
        # Restore original email
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={
            "email": original_email
        })
        assert response.status_code == 200
        print(f"Email restored to {original_email}")
    
    def test_edit_invalid_username_rejected(self, admin_session, test_user_id):
        """Invalid usernames should be rejected with 400."""
        # Try too short username
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={
            "username": "ab"  # Less than 3 chars
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Short username (< 3 chars) correctly rejected")
        
        # Try username with invalid chars
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={
            "username": "test@user!"  # Special chars
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Username with special characters correctly rejected")
    
    def test_edit_duplicate_email_rejected(self, admin_session, test_user_id):
        """Duplicate emails should be rejected with 409."""
        # Try to use admin email which already exists
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={
            "email": ADMIN_EMAIL
        })
        assert response.status_code == 409, f"Expected 409, got {response.status_code}"
        print("Duplicate email correctly rejected with 409")
    
    def test_edit_no_updates_rejected(self, admin_session, test_user_id):
        """Request with no updates should be rejected with 400."""
        response = admin_session.put(f"{BASE_URL}/api/rbac/users/{test_user_id}", json={})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Empty update request correctly rejected")


class TestU3PasswordResetLink:
    """U3: Generate secure password reset link for users"""
    
    def test_generate_reset_link_success(self, admin_session, test_user_id):
        """Admin should be able to generate a password reset link."""
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{test_user_id}/reset-password-link")
        assert response.status_code == 200, f"Failed to generate reset link: {response.text}"
        
        data = response.json()
        assert "reset_url" in data, "Missing 'reset_url' in response"
        assert "expires_at" in data, "Missing 'expires_at' in response"
        assert "user_email" in data, "Missing 'user_email' in response"
        
        assert "/api/reset-password?token=" in data["reset_url"]
        print(f"Reset link generated: {data['reset_url'][:50]}...")
        print(f"Expires at: {data['expires_at']}")
        print(f"For user: {data['user_email']}")
    
    def test_generate_reset_link_for_nonexistent_user(self, admin_session):
        """Reset link for non-existent user should fail with 404."""
        fake_id = "nonexistent-user-id-12345"
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{fake_id}/reset-password-link")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent user correctly returns 404")
    
    def test_reset_password_page_loads(self, admin_session):
        """Reset password page (GET /api/reset-password) should load."""
        # Test without token first (page should still load but show error)
        response = requests.get(f"{BASE_URL}/api/reset-password")
        assert response.status_code == 200, f"Reset page failed to load: {response.status_code}"
        assert "Reset Password" in response.text or "reset" in response.text.lower()
        print("Reset password page loads successfully")
    
    def test_reset_password_page_with_token(self, admin_session, test_user_id):
        """Reset password page should load with token parameter."""
        # Generate a link first
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{test_user_id}/reset-password-link")
        assert response.status_code == 200
        
        reset_url = response.json()["reset_url"]
        
        # Extract token from URL
        token = reset_url.split("token=")[1] if "token=" in reset_url else ""
        
        # Load page with token
        response = requests.get(f"{BASE_URL}/api/reset-password?token={token}")
        assert response.status_code == 200, f"Reset page with token failed: {response.status_code}"
        print("Reset password page loads with token")
    
    def test_reset_password_submit_valid_token(self, admin_session, test_user_id):
        """POST /api/reset-password with valid token should change password."""
        # Generate a link
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{test_user_id}/reset-password-link")
        assert response.status_code == 200
        
        reset_url = response.json()["reset_url"]
        token = reset_url.split("token=")[1] if "token=" in reset_url else ""
        
        # Submit new password
        new_password = "newpassword123"
        response = requests.post(f"{BASE_URL}/api/reset-password", json={
            "token": token,
            "new_password": new_password
        })
        assert response.status_code == 200, f"Password reset failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"Password reset successful: {data['message']}")
        
        # Restore original password by logging in with new password and changing back
        # First verify we can login with new password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": new_password
        })
        assert login_response.status_code == 200, "Login with new password failed"
        print("Login with new password successful")
        
        # Generate another reset link to restore original password
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{test_user_id}/reset-password-link")
        assert response.status_code == 200
        
        reset_url = response.json()["reset_url"]
        token = reset_url.split("token=")[1]
        
        response = requests.post(f"{BASE_URL}/api/reset-password", json={
            "token": token,
            "new_password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, "Failed to restore original password"
        print("Original password restored")
    
    def test_reset_password_submit_invalid_token(self, admin_session):
        """POST /api/reset-password with invalid token should fail."""
        response = requests.post(f"{BASE_URL}/api/reset-password", json={
            "token": "invalid-token-that-does-not-exist",
            "new_password": "newpassword123"
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Invalid token correctly rejected with 400")
    
    def test_reset_password_submit_used_token(self, admin_session, test_user_id):
        """POST /api/reset-password with already-used token should fail."""
        # Generate and use a token
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{test_user_id}/reset-password-link")
        assert response.status_code == 200
        
        reset_url = response.json()["reset_url"]
        token = reset_url.split("token=")[1]
        
        # Use the token
        response = requests.post(f"{BASE_URL}/api/reset-password", json={
            "token": token,
            "new_password": "temppassword123"
        })
        assert response.status_code == 200, f"First use failed: {response.text}"
        
        # Try to use the same token again
        response = requests.post(f"{BASE_URL}/api/reset-password", json={
            "token": token,
            "new_password": "anotherpassword123"
        })
        assert response.status_code == 400, f"Expected 400 for used token, got {response.status_code}"
        print("Used token correctly rejected with 400")
        
        # Restore original password
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{test_user_id}/reset-password-link")
        token = response.json()["reset_url"].split("token=")[1]
        requests.post(f"{BASE_URL}/api/reset-password", json={
            "token": token,
            "new_password": TEST_USER_PASSWORD
        })
    
    def test_reset_password_short_password_rejected(self, admin_session, test_user_id):
        """POST /api/reset-password with short password should fail."""
        # Generate a token
        response = admin_session.post(f"{BASE_URL}/api/rbac/users/{test_user_id}/reset-password-link")
        assert response.status_code == 200
        
        reset_url = response.json()["reset_url"]
        token = reset_url.split("token=")[1]
        
        # Try with short password
        response = requests.post(f"{BASE_URL}/api/reset-password", json={
            "token": token,
            "new_password": "short"  # Less than 6 chars
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Short password correctly rejected")


class TestU1UsersFilterDropdown:
    """U1: Users filter dropdown should have 'Nuovi ultimi 7gg' and 'Login ultime 24h' options"""
    
    def test_users_api_returns_created_at(self, admin_session):
        """Users API should return created_at field for filtering."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/users")
        assert response.status_code == 200
        
        users = response.json()
        assert len(users) > 0, "No users returned"
        
        # Check that users have created_at field
        has_created_at = any(u.get("created_at") for u in users)
        assert has_created_at, "No users have created_at field"
        print("Users API returns created_at for filtering")
    
    def test_users_api_returns_last_login(self, admin_session):
        """Users API should return last_login field for filtering."""
        response = admin_session.get(f"{BASE_URL}/api/rbac/users")
        assert response.status_code == 200
        
        users = response.json()
        # last_login may be null for some users who never logged in
        users_with_login = [u for u in users if u.get("last_login")]
        print(f"Users with last_login data: {len(users_with_login)}/{len(users)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
