"""
Login Screen Specific Tests - Google OAuth & Email Login

Tests cover:
- Email+Password login with seeded users
- Google OAuth session endpoint (POST /api/auth/google/session)
- Invalid session_id handling
"""
import pytest
import requests

BASE_URL = "https://match-import.preview.emergentagent.com"


class TestLoginEmailPassword:
    """Email+Password login flow tests"""
    
    def test_login_marco_returns_tokens(self):
        """Test email login with marco@test.com returns JWT tokens"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "marco@test.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["email"] == "marco@test.com"
        assert data["user"]["username"] == "Marco_FP"
        print(f"✓ Marco login successful: {data['user']['username']}")
    
    def test_login_admin_returns_tokens(self):
        """Test admin login returns tokens and correct role"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] in ("admin", "superadmin")
        print(f"✓ Admin login successful, role: {data['user']['role']}")
    
    def test_login_invalid_email_returns_401(self):
        """Test login with invalid email returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "password123"
        })
        assert response.status_code == 401
        print("✓ Invalid email correctly rejected with 401")
    
    def test_login_invalid_password_returns_401(self):
        """Test login with invalid password returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "marco@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected with 401")


class TestGoogleOAuthSession:
    """Google OAuth session endpoint tests"""
    
    def test_google_session_no_session_id_returns_400(self):
        """Test POST /api/auth/google/session without session_id returns 400"""
        response = requests.post(f"{BASE_URL}/api/auth/google/session", json={})
        assert response.status_code == 400
        print("✓ Missing session_id correctly returns 400")
    
    def test_google_session_invalid_session_id_returns_401(self):
        """Test POST /api/auth/google/session with invalid session_id returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/google/session", json={
            "session_id": "test_invalid_session_12345"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Invalid Google session" in data["detail"]
        print("✓ Invalid session_id correctly returns 401 with 'Invalid Google session' error")
    
    def test_google_session_empty_session_id_returns_400(self):
        """Test POST /api/auth/google/session with empty session_id"""
        response = requests.post(f"{BASE_URL}/api/auth/google/session", json={
            "session_id": ""
        })
        assert response.status_code == 400
        print("✓ Empty session_id correctly returns 400")


class TestAuthEndpointAvailability:
    """Verify auth endpoints are accessible"""
    
    def test_login_endpoint_exists(self):
        """Test POST /api/auth/login is accessible"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test"
        })
        # Should return 401 (not 404), meaning endpoint exists
        assert response.status_code in (200, 401)
        print("✓ Login endpoint is accessible")
    
    def test_register_endpoint_exists(self):
        """Test POST /api/auth/register is accessible"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "test@example.com",
            "username": "test",
            "password": "test",
            "language": "it"
        })
        # Should return 200, 400, or 422 (not 404), meaning endpoint exists
        assert response.status_code in (200, 400, 422)
        print("✓ Register endpoint is accessible")
    
    def test_google_session_endpoint_exists(self):
        """Test POST /api/auth/google/session endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/auth/google/session", json={
            "session_id": "test"
        })
        # Should return 401 or 400 (not 404), meaning endpoint exists
        assert response.status_code in (400, 401)
        print("✓ Google session endpoint is accessible")
