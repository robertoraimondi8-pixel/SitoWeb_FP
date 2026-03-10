"""
Test file for new features:
1. Push notifications (admin endpoints)
2. Complete-profile endpoint with username field
3. National league free join
4. Admin UI push page
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matchup-arena-4.preview.emergentagent.com")

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_token():
    """Login as admin and get token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def standard_user_token():
    """Login as standard user and get token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": STANDARD_USER_EMAIL, "password": STANDARD_USER_PASSWORD}
    )
    assert response.status_code == 200, f"Standard user login failed: {response.text}"
    return response.json()


# ========================================
# PUSH NOTIFICATION TESTS
# ========================================
class TestPushNotificationEndpoints:
    """Test admin push notification endpoints."""
    
    def test_push_broadcast_all_users(self, admin_token):
        """POST /api/admin/push/broadcast - broadcast to all users."""
        response = requests.post(
            f"{BASE_URL}/api/admin/push/broadcast",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Test Push All",
                "body": "This is a test push notification to all users",
                "target": "all"
            }
        )
        print(f"Push broadcast all status: {response.status_code}")
        print(f"Push broadcast all response: {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert "sent_count" in data
        assert data["target"] == "all"
        print(f"✓ Sent to {data['sent_count']} users")
    
    def test_push_broadcast_specific_league(self, admin_token):
        """POST /api/admin/push/broadcast - broadcast to specific league."""
        # First get a league ID
        leagues_response = requests.get(
            f"{BASE_URL}/api/leagues/national",
        )
        if leagues_response.status_code == 200 and len(leagues_response.json()) > 0:
            league_id = leagues_response.json()[0]["id"]
            
            response = requests.post(
                f"{BASE_URL}/api/admin/push/broadcast",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "title": "Test Push League",
                    "body": "This is a test push notification to a specific league",
                    "target": league_id
                }
            )
            print(f"Push broadcast league status: {response.status_code}")
            print(f"Push broadcast league response: {response.text}")
            assert response.status_code == 200
            data = response.json()
            assert "sent_count" in data
            assert data["target"] == league_id
            print(f"✓ Sent to league {league_id[:8]}, {data['sent_count']} members")
        else:
            pytest.skip("No national leagues found")
    
    def test_push_to_specific_user(self, admin_token, standard_user_token):
        """POST /api/admin/push/user/{user_id} - send to specific user."""
        user_id = standard_user_token["user"]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/push/user/{user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Test Direct Push",
                "body": "This is a direct test push notification"
            }
        )
        print(f"Push to user status: {response.status_code}")
        print(f"Push to user response: {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert data["sent"] == True
        assert data["user_id"] == user_id
        print(f"✓ Sent to user {user_id[:8]}")
    
    def test_push_broadcast_missing_title(self, admin_token):
        """POST /api/admin/push/broadcast - should fail without title."""
        response = requests.post(
            f"{BASE_URL}/api/admin/push/broadcast",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "body": "Message without title",
                "target": "all"
            }
        )
        assert response.status_code == 400
        print("✓ Push broadcast fails without title (400)")
    
    def test_push_to_nonexistent_user(self, admin_token):
        """POST /api/admin/push/user/{user_id} - should fail for non-existent user."""
        response = requests.post(
            f"{BASE_URL}/api/admin/push/user/nonexistent-user-id",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Test",
                "body": "Test body"
            }
        )
        assert response.status_code == 404
        print("✓ Push to non-existent user returns 404")


# ========================================
# COMPLETE-PROFILE TESTS
# ========================================
class TestCompleteProfileEndpoint:
    """Test complete-profile dual endpoint with username field."""
    
    def test_complete_profile_post_with_username(self, standard_user_token):
        """POST /api/users/me/complete-profile with username field."""
        token = standard_user_token["access_token"]
        unique_username = f"test_user_{os.urandom(3).hex()}"
        
        response = requests.post(
            f"{BASE_URL}/api/users/me/complete-profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": unique_username,
                "first_name": "TestFirst",
                "last_name": "TestLast"
            }
        )
        print(f"Complete-profile POST status: {response.status_code}")
        print(f"Complete-profile POST response: {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        # The username should be updated
        print(f"✓ Complete-profile POST endpoint works with username")
    
    def test_complete_profile_patch_with_username(self, standard_user_token):
        """PATCH /api/profile/complete also works (dual endpoint)."""
        token = standard_user_token["access_token"]
        unique_username = f"test_patch_{os.urandom(3).hex()}"
        
        response = requests.patch(
            f"{BASE_URL}/api/profile/complete",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": unique_username,
                "first_name": "PatchFirst",
                "last_name": "PatchLast"
            }
        )
        print(f"Complete-profile PATCH status: {response.status_code}")
        print(f"Complete-profile PATCH response: {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        print(f"✓ Complete-profile PATCH endpoint works with username")
    
    def test_complete_profile_without_username(self, standard_user_token):
        """POST /api/users/me/complete-profile without username still works (optional field)."""
        token = standard_user_token["access_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/users/me/complete-profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "first_name": "FirstOnly",
                "last_name": "LastOnly"
            }
        )
        print(f"Complete-profile without username status: {response.status_code}")
        assert response.status_code == 200
        print("✓ Complete-profile works without username (optional)")
    
    def test_complete_profile_duplicate_username(self, admin_token, standard_user_token):
        """POST /api/users/me/complete-profile with duplicate username returns 409."""
        # First set admin's username
        admin_username = "admin"  # Admin already has this username
        
        # Try to set standard user's username to admin's username
        token = standard_user_token["access_token"]
        response = requests.post(
            f"{BASE_URL}/api/users/me/complete-profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": admin_username
            }
        )
        print(f"Duplicate username status: {response.status_code}")
        print(f"Duplicate username response: {response.text}")
        assert response.status_code == 409
        print("✓ Duplicate username returns 409")
    
    def test_complete_profile_invalid_username(self, standard_user_token):
        """POST /api/users/me/complete-profile with invalid username returns 400."""
        token = standard_user_token["access_token"]
        
        # Test with too short username
        response = requests.post(
            f"{BASE_URL}/api/users/me/complete-profile",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "username": "ab"  # Too short (less than 3 chars)
            }
        )
        print(f"Invalid username status: {response.status_code}")
        print(f"Invalid username response: {response.text}")
        assert response.status_code == 400
        print("✓ Invalid username returns 400")


# ========================================
# NATIONAL LEAGUE FREE JOIN TESTS
# ========================================
class TestNationalLeagueFreeJoin:
    """Test national league join without payment."""
    
    def test_get_national_leagues(self):
        """GET /api/leagues/national returns national leagues."""
        response = requests.get(f"{BASE_URL}/api/leagues/national")
        print(f"National leagues status: {response.status_code}")
        print(f"National leagues count: {len(response.json()) if response.status_code == 200 else 0}")
        assert response.status_code == 200
        leagues = response.json()
        assert isinstance(leagues, list)
        if len(leagues) > 0:
            league = leagues[0]
            assert "id" in league
            assert league.get("league_type") == "national"
            print(f"✓ National league found: {league.get('name')}")
        else:
            print("✓ National leagues endpoint works (no leagues yet)")
    
    def test_join_national_league_direct_free(self, standard_user_token):
        """POST /api/leagues/{league_id}/join-direct for national league works without payment."""
        token = standard_user_token["access_token"]
        
        # Get national league
        response = requests.get(f"{BASE_URL}/api/leagues/national")
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No national leagues found")
        
        league_id = response.json()[0]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/leagues/{league_id}/join-direct",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Join national league status: {response.status_code}")
        print(f"Join national league response: {response.text}")
        assert response.status_code == 200
        data = response.json()
        # Either successfully joined or already a member
        assert "message" in data
        print(f"✓ National league join works: {data.get('message')}")


# ========================================
# ADMIN UI TESTS
# ========================================
class TestAdminUI:
    """Test admin UI endpoints."""
    
    def test_admin_ui_returns_html(self):
        """GET /api/admin-ui returns 200 HTML."""
        response = requests.get(f"{BASE_URL}/api/admin-ui")
        print(f"Admin UI status: {response.status_code}")
        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type
        assert "<!DOCTYPE html>" in response.text or "<html" in response.text
        print("✓ Admin UI returns HTML")
    
    def test_reset_password_page_returns_html(self):
        """GET /api/reset-password returns 200 HTML (requires token param but still loads)."""
        response = requests.get(f"{BASE_URL}/api/reset-password")
        print(f"Reset password page status: {response.status_code}")
        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type
        print("✓ Reset password page returns HTML")


# ========================================
# SENDGRID EMAIL SERVICE (MOCKED) via Admin Reset Link
# ========================================
class TestSendGridEmailService:
    """Test email service via admin reset password link (SendGrid is mocked - API key empty)."""
    
    def test_admin_generate_reset_link_triggers_email(self, admin_token, standard_user_token):
        """POST /api/rbac/users/{user_id}/reset-password-link triggers email (SendGrid MOCKED)."""
        user_id = standard_user_token["user"]["id"]
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/{user_id}/reset-password-link",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"Admin generate reset link status: {response.status_code}")
        print(f"Admin generate reset link response: {response.text}")
        # Should return 200 with reset_url
        # SendGrid email will log a warning because API key is empty, but won't fail
        assert response.status_code == 200
        data = response.json()
        assert "reset_url" in data
        assert "/api/reset-password?token=" in data["reset_url"]
        print("✓ Admin reset link generation works (SendGrid MOCKED - logs warning)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
