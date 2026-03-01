"""
Backend API Tests for Auth Flow P0
Tests: /auth/register, /auth/forgot-password, /auth/login
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://dark-theme-overhaul-2.preview.emergentagent.com')


class TestAuthRegister:
    """Tests for /auth/register endpoint"""
    
    def test_register_success_with_all_fields(self):
        """Test successful registration with all required fields"""
        unique_email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "first_name": "Test",
            "last_name": "User",
            "date_of_birth": "1990-05-15",  # 34 years old, valid
            "address": "Via Roma 1",
            "city": "Milano",
            "country": "Italia",
            "postal_code": "20121",
            "password": "Password1",
            "accepted_privacy": True,
            "accepted_terms": True
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Should return 200 with token
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify tokens are returned
        assert "access_token" in data, "access_token missing in response"
        assert "refresh_token" in data, "refresh_token missing in response"
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 0
        
        # Verify user object
        assert "user" in data, "user object missing in response"
        user = data["user"]
        assert user["email"] == unique_email.lower(), "Email mismatch"
        assert user["first_name"] == "Test", "first_name mismatch"
        assert user["last_name"] == "User", "last_name mismatch"
        assert user["profile_completed"] == True, "profile_completed should be True"
        assert user["accepted_privacy"] == True, "accepted_privacy should be True"
        assert user["accepted_terms"] == True, "accepted_terms should be True"
        
        print(f"✓ Registration successful for {unique_email}, profile_completed={user['profile_completed']}")
    
    def test_register_under_18_returns_400(self):
        """Test registration with date_of_birth under 18 years returns 400 with Italian error"""
        unique_email = f"test_minor_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "first_name": "Minor",
            "last_name": "User",
            "date_of_birth": "2015-01-01",  # Under 18
            "address": "Via Test 1",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "password": "Password1",
            "accepted_privacy": True,
            "accepted_terms": True
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Should return 400 for age validation
        assert response.status_code == 400, f"Expected 400 for under-18, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check for Italian error message about age
        error_message = data.get("detail", "")
        assert "18" in error_message.lower() or "anni" in error_message.lower(), f"Expected Italian age error, got: {error_message}"
        
        print(f"✓ Under-18 registration correctly rejected with message: {error_message}")
    
    def test_register_without_privacy_returns_400(self):
        """Test registration with accepted_privacy=false returns 400"""
        unique_email = f"test_noprivacy_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "first_name": "NoPrivacy",
            "last_name": "User",
            "date_of_birth": "1990-01-01",
            "address": "Via Test 1",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "password": "Password1",
            "accepted_privacy": False,  # Not accepted
            "accepted_terms": True
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Should return 400 for missing privacy consent
        assert response.status_code == 400, f"Expected 400 for missing privacy, got {response.status_code}: {response.text}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "privacy" in error_message.lower(), f"Expected privacy error, got: {error_message}"
        
        print(f"✓ Missing privacy consent correctly rejected: {error_message}")
    
    def test_register_without_terms_returns_400(self):
        """Test registration with accepted_terms=false returns 400"""
        unique_email = f"test_noterms_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "first_name": "NoTerms",
            "last_name": "User",
            "date_of_birth": "1990-01-01",
            "address": "Via Test 1",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "password": "Password1",
            "accepted_privacy": True,
            "accepted_terms": False  # Not accepted
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Should return 400 for missing terms consent
        assert response.status_code == 400, f"Expected 400 for missing terms, got {response.status_code}: {response.text}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "termin" in error_message.lower(), f"Expected terms error, got: {error_message}"
        
        print(f"✓ Missing terms consent correctly rejected: {error_message}")


class TestAuthForgotPassword:
    """Tests for /auth/forgot-password endpoint"""
    
    def test_forgot_password_returns_200_with_italian_message(self):
        """Test forgot-password always returns 200 with generic Italian message"""
        payload = {
            "email": "any_email@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json=payload)
        
        # Should always return 200 (security - no email enumeration)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify Italian message
        assert "message" in data, "message field missing"
        message = data["message"]
        # Should contain Italian text about email instructions
        assert "email" in message.lower() or "istruzioni" in message.lower() or "registrata" in message.lower(), \
            f"Expected Italian message, got: {message}"
        
        print(f"✓ Forgot password returns Italian message: {message}")
    
    def test_forgot_password_with_nonexistent_email(self):
        """Test forgot-password with non-existent email also returns 200 (security)"""
        payload = {
            "email": "nonexistent_email_12345@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json=payload)
        
        # Should still return 200 (security - no email enumeration)
        assert response.status_code == 200, f"Expected 200 for non-existent email, got {response.status_code}"
        
        print("✓ Forgot password correctly returns 200 for non-existent email (security)")
    
    def test_forgot_password_with_existing_email(self):
        """Test forgot-password with existing email returns 200"""
        payload = {
            "email": "admin@fantapronostic.com"  # Existing user
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json=payload)
        
        assert response.status_code == 200, f"Expected 200 for existing email, got {response.status_code}"
        
        print("✓ Forgot password returns 200 for existing email")


class TestAuthLogin:
    """Tests for /auth/login endpoint"""
    
    def test_login_returns_profile_completed_field(self):
        """Test that login response includes profile_completed field"""
        payload = {
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify user object contains profile_completed
        assert "user" in data, "user object missing"
        user = data["user"]
        assert "profile_completed" in user, "profile_completed field missing in user object"
        
        print(f"✓ Login response includes profile_completed={user['profile_completed']}")
    
    def test_login_admin_user(self):
        """Test login with admin credentials"""
        payload = {
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert data["user"]["role"] == "admin", "Expected admin role"
        assert "access_token" in data
        assert "refresh_token" in data
        
        print(f"✓ Admin login successful, role={data['user']['role']}")
    
    def test_login_marco_user(self):
        """Test login with marco credentials"""
        payload = {
            "email": "marco@test.com",
            "password": "password123"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 200, f"Marco login failed: {response.text}"
        
        data = response.json()
        assert data["user"]["role"] == "user", "Expected user role"
        assert "profile_completed" in data["user"], "profile_completed missing for marco"
        
        print(f"✓ Marco login successful, profile_completed={data['user']['profile_completed']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        payload = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        
        print("✓ Invalid credentials correctly rejected with 401")


class TestCompleteProfile:
    """Tests for /users/me/complete-profile endpoint"""
    
    def test_complete_profile_requires_auth(self):
        """Test that complete-profile endpoint requires authentication"""
        payload = {
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = requests.post(f"{BASE_URL}/api/users/me/complete-profile", json=payload)
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        
        print("✓ Complete profile endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
