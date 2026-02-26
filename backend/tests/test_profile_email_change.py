"""
Test suite for Profile Email Change Feature and Password Change Bug Fix
Tests: PUT /api/profile/email endpoint and PUT /api/profile/password endpoint

Features tested:
1. PUT /api/profile/email - success case (change email with correct password)
2. PUT /api/profile/email - wrong password returns 400
3. PUT /api/profile/email - same email returns 400  
4. PUT /api/profile/email - duplicate email returns 400
5. PUT /api/profile/email - no auth returns 401
6. PUT /api/profile/password - verify it still works (bug fix: now fetches password from DB)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "ilio@raimondi.it"
TEST_USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    data = resp.json()
    print(f"✓ Admin login successful: {ADMIN_EMAIL}")
    return data["access_token"]


@pytest.fixture(scope="module")
def test_user_token():
    """Get test user auth token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    assert resp.status_code == 200, f"Test user login failed: {resp.text}"
    data = resp.json()
    print(f"✓ Test user login successful: {TEST_USER_EMAIL}")
    return data["access_token"]


class TestEmailChangeEndpoint:
    """Tests for PUT /api/profile/email endpoint"""

    def test_email_change_no_auth_returns_401(self):
        """Test 1: PUT /api/profile/email without auth returns 401"""
        resp = requests.put(f"{BASE_URL}/api/profile/email", json={
            "new_email": "newemail@test.com",
            "password": "anypassword"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print("✓ PUT /api/profile/email without auth returns 401")

    def test_email_change_wrong_password_returns_400(self, admin_token):
        """Test 2: PUT /api/profile/email with wrong password returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/profile/email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "new_email": "newemail@test.com",
                "password": "wrongpassword123"
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "Password non corretta" in data.get("detail", ""), f"Unexpected error: {data}"
        print("✓ PUT /api/profile/email with wrong password returns 400")

    def test_email_change_same_email_returns_400(self, admin_token):
        """Test 3: PUT /api/profile/email with same email returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/profile/email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "new_email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "uguale" in data.get("detail", "").lower() or "attuale" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        print("✓ PUT /api/profile/email with same email returns 400")

    def test_email_change_duplicate_email_returns_400(self, admin_token):
        """Test 4: PUT /api/profile/email with email that belongs to another user returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/profile/email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "new_email": TEST_USER_EMAIL,  # This email already exists for another user
                "password": ADMIN_PASSWORD
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "già in uso" in data.get("detail", "").lower() or "already" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        print("✓ PUT /api/profile/email with duplicate email returns 400")

    def test_email_change_success_and_revert(self, admin_token):
        """Test 5: PUT /api/profile/email success case - change email and revert"""
        unique_suffix = str(uuid.uuid4())[:8]
        new_email = f"test_admin_{unique_suffix}@fantapronostic.com"
        
        # Step 1: Change email to new one
        resp = requests.put(
            f"{BASE_URL}/api/profile/email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "new_email": new_email,
                "password": ADMIN_PASSWORD
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("email") == new_email, f"Email not updated: {data}"
        print(f"✓ Email changed to: {new_email}")

        # Step 2: Verify email changed in profile
        profile_resp = requests.get(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert profile_resp.status_code == 200
        profile_data = profile_resp.json()
        assert profile_data["user"]["email"] == new_email, f"Email not persisted in profile: {profile_data}"
        print("✓ Email change persisted in profile")

        # Step 3: IMPORTANT - Revert email back to original
        revert_resp = requests.put(
            f"{BASE_URL}/api/profile/email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "new_email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD  # Password remains the same
            }
        )
        assert revert_resp.status_code == 200, f"Failed to revert email: {revert_resp.text}"
        print(f"✓ Email reverted back to: {ADMIN_EMAIL}")

        # Step 4: Verify revert
        verify_resp = requests.get(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["user"]["email"] == ADMIN_EMAIL, f"Email not reverted: {verify_data}"
        print("✓ Email successfully reverted and verified")


class TestPasswordChangeEndpoint:
    """Tests for PUT /api/profile/password endpoint - Bug fix verification
    
    Bug: password was not being fetched from DB because get_current_user() excludes it.
    Fix: endpoint now fetches password separately from users_col.
    """

    def test_password_change_no_auth_returns_401(self):
        """Test 6: PUT /api/profile/password without auth returns 401"""
        resp = requests.put(f"{BASE_URL}/api/profile/password", json={
            "current_password": "anypassword",
            "new_password": "newpassword123"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print("✓ PUT /api/profile/password without auth returns 401")

    def test_password_change_wrong_current_password_returns_400(self, test_user_token):
        """Test 7: PUT /api/profile/password with wrong current password returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/profile/password",
            headers={"Authorization": f"Bearer {test_user_token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "non corretta" in data.get("detail", "").lower() or "incorrect" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        print("✓ PUT /api/profile/password with wrong password returns 400")

    def test_password_change_success_and_revert(self, test_user_token):
        """Test 8: PUT /api/profile/password success case - change password and revert
        
        This test specifically verifies the bug fix: password is now correctly fetched from DB.
        """
        temp_password = "temppassword456"
        
        # Step 1: Change password to temp
        resp = requests.put(
            f"{BASE_URL}/api/profile/password",
            headers={"Authorization": f"Bearer {test_user_token}"},
            json={
                "current_password": TEST_USER_PASSWORD,
                "new_password": temp_password
            }
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "aggiornata" in data.get("message", "").lower() or "success" in data.get("message", "").lower(), f"Unexpected response: {data}"
        print(f"✓ Password changed successfully")

        # Step 2: Verify new password works for login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": temp_password
        })
        assert login_resp.status_code == 200, f"Failed to login with new password: {login_resp.text}"
        new_token = login_resp.json()["access_token"]
        print("✓ Login with new password successful")

        # Step 3: Verify old password no longer works
        old_login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert old_login_resp.status_code == 401, f"Old password should not work: {old_login_resp.text}"
        print("✓ Old password no longer works")

        # Step 4: IMPORTANT - Revert password back to original
        revert_resp = requests.put(
            f"{BASE_URL}/api/profile/password",
            headers={"Authorization": f"Bearer {new_token}"},
            json={
                "current_password": temp_password,
                "new_password": TEST_USER_PASSWORD
            }
        )
        assert revert_resp.status_code == 200, f"Failed to revert password: {revert_resp.text}"
        print(f"✓ Password reverted back to original")

        # Step 5: Verify original password works again
        final_login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert final_login_resp.status_code == 200, f"Original password should work again: {final_login_resp.text}"
        print("✓ Original password works - password successfully reverted")

    def test_password_change_too_short_returns_400(self, test_user_token):
        """Test 9: PUT /api/profile/password with too short new password returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/profile/password",
            headers={"Authorization": f"Bearer {test_user_token}"},
            json={
                "current_password": TEST_USER_PASSWORD,
                "new_password": "abc"  # Too short (< 6 chars)
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "6 caratteri" in data.get("detail", "").lower() or "short" in data.get("detail", "").lower(), f"Unexpected error: {data}"
        print("✓ PUT /api/profile/password with too short password returns 400")


class TestInvalidEmailFormats:
    """Additional tests for email validation"""

    def test_email_change_invalid_format_returns_400(self, admin_token):
        """Test 10: PUT /api/profile/email with invalid email format returns 400"""
        resp = requests.put(
            f"{BASE_URL}/api/profile/email",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "new_email": "notanemail",
                "password": ADMIN_PASSWORD
            }
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        print("✓ PUT /api/profile/email with invalid email format returns 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
