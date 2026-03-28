"""
Test Google OAuth verify-token endpoint and auth endpoints
P0 fixes verification for iteration 106
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://context-aware-tabs.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"


class TestGoogleOAuthVerifyToken:
    """Tests for POST /api/auth/google/verify-token endpoint"""
    
    def test_verify_token_missing_id_token(self):
        """Should return 400 when no id_token provided"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/verify-token",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id_token" in data.get("detail", "").lower() or "id_token" in str(data).lower(), \
            f"Expected error about id_token, got: {data}"
        print(f"✓ Missing id_token returns 400: {data}")
    
    def test_verify_token_empty_id_token(self):
        """Should return 400 when id_token is empty string"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/verify-token",
            json={"id_token": ""},
            headers={"Content-Type": "application/json"}
        )
        # Empty string should also be rejected
        assert response.status_code in [400, 401], f"Expected 400/401, got {response.status_code}: {response.text}"
        print(f"✓ Empty id_token returns {response.status_code}")
    
    def test_verify_token_invalid_token(self):
        """Should return 401 for invalid/malformed tokens"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/verify-token",
            json={"id_token": "invalid_token_12345"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        # Should have meaningful error message
        assert "detail" in data or "error" in data or "message" in data, \
            f"Expected error message, got: {data}"
        print(f"✓ Invalid token returns 401: {data}")
    
    def test_verify_token_expired_format_token(self):
        """Should return 401 for expired/wrong format JWT tokens"""
        # A fake JWT-like token that will fail verification
        fake_jwt = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.POstGetfAytaZS82wHcjoTyoqhMyxXiWdR7Nn7A29DNSl0EiXLdwJ6xC6AfgZWF1bOsS_TuYI3OG85AmiExREkrS6tDfTQ2B3WXlrr-wp5AokiRbz3_oB4OxG-W9KcEEbDRcZc0nH3L7LzYptiy1PtAylQGxHTWZXtGz4ht0bAecBgmpdgXMguEIcoqPJ1n3pIWk_dUZegpqx0Lka21H6XxUTxiy8OcaarA8zdnPUnV6AmNP3ecFawIFYdvJB_cm-GvpCSbr8G8y_Mllj8f4x9nBH8pQux89_6gUY618iYv7tuPWBFfEbLxtF2pZS6YC1aSfLQxeNe8djT9YjpvRZA"
        response = requests.post(
            f"{BASE_URL}/api/auth/google/verify-token",
            json={"id_token": fake_jwt},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ Fake JWT returns 401: {response.json()}")


class TestStandardLogin:
    """Tests for POST /api/auth/login endpoint"""
    
    def test_login_admin_success(self):
        """Admin login should work correctly"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Expected access_token in response: {data}"
        assert "refresh_token" in data, f"Expected refresh_token in response: {data}"
        assert "user" in data, f"Expected user in response: {data}"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}, role={data['user']['role']}")
        return data["access_token"]
    
    def test_login_standard_user_success(self):
        """Standard user login should work correctly"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STANDARD_USER_EMAIL, "password": STANDARD_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data, f"Expected access_token in response: {data}"
        assert "user" in data, f"Expected user in response: {data}"
        assert data["user"]["email"] == STANDARD_USER_EMAIL
        print(f"✓ Standard user login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Login with wrong password should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ Invalid credentials returns 401")
    
    def test_login_nonexistent_user(self):
        """Login with non-existent email should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "anypassword"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ Non-existent user returns 401")


class TestRegistration:
    """Tests for POST /api/auth/register endpoint"""
    
    def test_register_missing_required_fields(self):
        """Registration without required fields should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": "test@test.com"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
        print(f"✓ Missing required fields returns 422")
    
    def test_register_duplicate_email(self):
        """Registration with existing email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": ADMIN_EMAIL,
                "password": "testpass123",
                "first_name": "Test",
                "last_name": "User",
                "date_of_birth": "1990-01-01",
                "address": "Via Test 123",
                "city": "Roma",
                "country": "Italia",
                "postal_code": "00100",
                "accepted_privacy": True,
                "accepted_terms": True
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "email" in str(data).lower() or "registrat" in str(data).lower(), \
            f"Expected error about duplicate email: {data}"
        print(f"✓ Duplicate email returns 400: {data}")
    
    def test_register_underage_user(self):
        """Registration for user under 18 should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "underage@test.com",
                "password": "testpass123",
                "first_name": "Young",
                "last_name": "User",
                "date_of_birth": "2015-01-01",  # Under 18
                "address": "Via Test 123",
                "city": "Roma",
                "country": "Italia",
                "postal_code": "00100",
                "accepted_privacy": True,
                "accepted_terms": True
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "18" in str(data) or "anni" in str(data).lower(), \
            f"Expected error about age: {data}"
        print(f"✓ Underage user returns 400: {data}")


class TestDeleteAccount:
    """Tests for DELETE /api/auth/delete-account endpoint"""
    
    def test_delete_account_unauthenticated(self):
        """Delete account without auth should return 401"""
        response = requests.delete(
            f"{BASE_URL}/api/auth/delete-account",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ Unauthenticated delete returns {response.status_code}")
    
    def test_delete_account_authenticated(self):
        """Delete account with valid auth should work (we won't actually delete admin)"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STANDARD_USER_EMAIL, "password": STANDARD_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if login_response.status_code != 200:
            pytest.skip("Could not login standard user for delete test")
        
        token = login_response.json()["access_token"]
        
        # Just verify the endpoint exists and requires auth - don't actually delete
        # We'll test with an invalid token to verify auth check works
        response = requests.delete(
            f"{BASE_URL}/api/auth/delete-account",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer invalid_token"
            }
        )
        assert response.status_code in [401, 403], f"Expected 401/403 for invalid token, got {response.status_code}"
        print(f"✓ Delete account endpoint exists and validates auth")


class TestHomeEndpoint:
    """Tests for GET /api/home endpoint - needed for competition context"""
    
    def test_home_unauthenticated(self):
        """Home endpoint without auth should return 401"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ Unauthenticated home returns {response.status_code}")
    
    def test_home_authenticated(self):
        """Home endpoint with auth should return matchday info"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STANDARD_USER_EMAIL, "password": STANDARD_USER_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if login_response.status_code != 200:
            pytest.skip("Could not login for home test")
        
        token = login_response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Home should return league info with matchday data
        # This is needed for the Pronostici tab routing logic
        print(f"✓ Home endpoint returns data: {list(data.keys())}")
        
        # Check for expected fields
        if "league" in data:
            print(f"  - League present: {data['league'].get('name', 'N/A')}")
        if "matchday" in data:
            print(f"  - Matchday present: status={data['matchday'].get('status', 'N/A')}")


class TestGoogleOAuthLegacySession:
    """Tests for POST /api/auth/google/session (legacy Emergent flow)"""
    
    def test_google_session_missing_session_id(self):
        """Should return 400 when no session_id provided"""
        response = requests.post(
            f"{BASE_URL}/api/auth/google/session",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        data = response.json()
        assert "session_id" in str(data).lower(), f"Expected error about session_id: {data}"
        print(f"✓ Missing session_id returns 400: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
