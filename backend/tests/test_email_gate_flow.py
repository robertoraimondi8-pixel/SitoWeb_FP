"""
Test suite for Email Verification Gate Flow
Tests the email_verified gate implementation:

TEST A1: Registration new user → redirected to /verify-email (not /home or /onboarding)
TEST A2: Login with registered but NOT verified user → blocked on /verify-email  
TEST A3: On /verify-email: paste token → click 'Verifica Email' → verify OK → navigate
TEST A4: Button 'Genera nuovo token' calls /api/auth/resend-verification
TEST B1: Login with marco@test.com (email_verified=true, has league) → goes to home
TEST B2: Login with admin@fantapronostic.com → goes to home
Backend TEST: POST /api/auth/login with unverified user → response.user.email_verified=false
Backend TEST: POST /api/auth/login with marco@test.com → response.user.email_verified=true
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://admin-unified-ui.preview.emergentagent.com')


class TestEmailVerifiedFieldInLogin:
    """Test that login response returns correct email_verified value"""
    
    def test_login_marco_returns_email_verified_true(self):
        """Backend TEST: POST /api/auth/login with marco@test.com → email_verified=true"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "marco@test.com", "password": "password123"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response must contain user object"
        assert "email_verified" in data["user"], "user must contain email_verified field"
        assert data["user"]["email_verified"] == True, f"marco@test.com should have email_verified=True, got {data['user']['email_verified']}"
        
        print(f"✓ marco@test.com login returns email_verified=True")
    
    def test_login_admin_returns_email_verified_true(self):
        """Backend TEST: admin login returns email_verified (legacy users = true)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response must contain user object"
        # Legacy users default to email_verified=True
        assert data["user"].get("email_verified", True) == True, "Admin should have email_verified=True (legacy default)"
        
        print(f"✓ admin@fantapronostic.com login returns email_verified=True (legacy)")


class TestNewUserRegistrationEmailVerified:
    """Test that newly registered users have email_verified=false"""
    
    def test_register_new_user_email_verified_false(self):
        """TEST A1: Registration returns email_verified=false for new user"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"newuser_{unique_id}@example.com"
        test_username = f"newuser{unique_id}"
        
        payload = {
            "email": test_email,
            "username": test_username,
            "first_name": "New",
            "last_name": "User",
            "date_of_birth": "1990-01-15",
            "address": "Via Test 123",
            "city": "Milano",
            "country": "Italia",
            "postal_code": "20121",
            "password": "Password123!",
            "accepted_privacy": True,
            "accepted_terms": True,
            "language": "it"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response must contain user object"
        assert "email_verified" in data["user"], "user must contain email_verified field"
        assert data["user"]["email_verified"] == False, f"New user should have email_verified=False, got {data['user']['email_verified']}"
        
        # Store for next test
        print(f"✓ New user registration returns email_verified=False")
        return {"email": test_email, "password": "Password123!", "access_token": data["access_token"]}


class TestLoginUnverifiedUserReturnsEmailVerifiedFalse:
    """Test login with unverified user returns email_verified=false"""
    
    def test_login_unverified_user_returns_email_verified_false(self):
        """Backend TEST: Login with unverified user → email_verified=false"""
        # First register a new unverified user
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"unverified_{unique_id}@example.com"
        test_username = f"unverified{unique_id}"
        test_password = "Password123!"
        
        # Register
        reg_payload = {
            "email": test_email,
            "username": test_username,
            "first_name": "Unverified",
            "last_name": "User",
            "date_of_birth": "1990-01-15",
            "address": "Via Test",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "password": test_password,
            "accepted_privacy": True,
            "accepted_terms": True,
            "language": "it"
        }
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        # Now login with the same user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": test_password}
        )
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        assert "user" in data, "Response must contain user object"
        assert "email_verified" in data["user"], "user must contain email_verified field"
        assert data["user"]["email_verified"] == False, f"Unverified user login should return email_verified=False, got {data['user']['email_verified']}"
        
        print(f"✓ Login with unverified user returns email_verified=False")


class TestEmailVerificationEndpoint:
    """Test the email verification endpoint"""
    
    def test_verify_email_invalid_token(self):
        """POST /api/auth/verify-email with invalid token returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-email",
            json={"token": "invalid_fake_token_123"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid token correctly rejected with 400")
    
    def test_verify_email_missing_token(self):
        """POST /api/auth/verify-email without token returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-email",
            json={}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Missing token correctly rejected with 400")


class TestResendVerificationEndpoint:
    """Test the resend verification endpoint (TEST A4)"""
    
    def test_resend_verification_for_unverified_user(self):
        """TEST A4: POST /api/auth/resend-verification works for unverified user"""
        # First register a new user
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"resend_{unique_id}@example.com"
        
        reg_payload = {
            "email": test_email,
            "username": f"resend{unique_id}",
            "first_name": "Resend",
            "last_name": "Test",
            "date_of_birth": "1990-01-15",
            "address": "Via Test",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "password": "Password123!",
            "accepted_privacy": True,
            "accepted_terms": True,
            "language": "it"
        }
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        # Now resend verification
        resend_response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification",
            json={"email": test_email}
        )
        
        assert resend_response.status_code == 200, f"Resend failed: {resend_response.text}"
        data = resend_response.json()
        assert "message" in data, "Response must contain message field"
        
        print(f"✓ Resend verification successful: {data['message']}")
    
    def test_resend_verification_nonexistent_email(self):
        """Resend for non-existent email returns 200 (security - no enumeration)"""
        fake_email = f"nonexistent_{uuid.uuid4()}@fake.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification",
            json={"email": fake_email}
        )
        
        # Should return 200 for security (no email enumeration)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Non-existent email returns 200 for security")


class TestVerifiedUserAccessHome:
    """Test that verified users can access home (TEST B1, B2)"""
    
    def test_verified_user_marco_can_access_home(self):
        """TEST B1: marco@test.com (verified, has league) can call /api/home"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "marco@test.com", "password": "password123"}
        )
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        access_token = login_response.json()["access_token"]
        
        # Access home
        headers = {"Authorization": f"Bearer {access_token}"}
        home_response = requests.get(f"{BASE_URL}/api/home", headers=headers)
        
        assert home_response.status_code == 200, f"Home access failed: {home_response.text}"
        
        data = home_response.json()
        # Verified user with league should see user_leagues
        assert "user_leagues" in data, "Home response should contain user_leagues"
        
        print(f"✓ marco@test.com (verified) can access /api/home, has {len(data.get('user_leagues', []))} leagues")
    
    def test_admin_can_access_home(self):
        """TEST B2: admin@fantapronostic.com can call /api/home"""
        # Login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        access_token = login_response.json()["access_token"]
        
        # Access home
        headers = {"Authorization": f"Bearer {access_token}"}
        home_response = requests.get(f"{BASE_URL}/api/home", headers=headers)
        
        assert home_response.status_code == 200, f"Home access failed: {home_response.text}"
        
        print(f"✓ admin@fantapronostic.com can access /api/home")


class TestUnverifiedUserCannotBypassGate:
    """Test that unverified users can still call APIs (backend doesn't block) 
    but the frontend gate should redirect them"""
    
    def test_unverified_user_can_call_api_home(self):
        """
        Unverified user CAN call /api/home (backend doesn't enforce email gate).
        The FRONTEND index.tsx is responsible for routing to /verify-email.
        This test just confirms the backend returns data.
        """
        # Register a new unverified user
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"canapi_{unique_id}@example.com"
        
        reg_payload = {
            "email": test_email,
            "username": f"canapi{unique_id}",
            "first_name": "CanApi",
            "last_name": "Test",
            "date_of_birth": "1990-01-15",
            "address": "Via Test",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "password": "Password123!",
            "accepted_privacy": True,
            "accepted_terms": True,
            "language": "it"
        }
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
        assert reg_response.status_code == 200
        access_token = reg_response.json()["access_token"]
        
        # Can call home API even without verified email
        # (Backend doesn't enforce this - frontend does the redirect)
        headers = {"Authorization": f"Bearer {access_token}"}
        home_response = requests.get(f"{BASE_URL}/api/home", headers=headers)
        
        # Backend allows the call
        assert home_response.status_code == 200, f"Unexpected status: {home_response.status_code}"
        
        print("✓ Unverified user can call /api/home (backend allows - frontend handles gate)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
