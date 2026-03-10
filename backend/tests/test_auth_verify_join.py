"""
Test suite for FantaPronostic Auth/Onboarding Flow
Tests:
1. Registration with custom username
2. Username availability check
3. Email verification resend
4. Login with email/password
5. National league join-direct
6. Get user leagues after join
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://modular-routes-13.preview.emergentagent.com')

class TestUserRegistrationWithUsername:
    """Test registration flow with custom username"""
    
    def test_register_with_custom_username(self):
        """Registrazione completa: form con username custom (es. 'mariorossi99')"""
        unique_id = str(uuid.uuid4())[:8]
        test_username = f"mariotest{unique_id}"
        test_email = f"test_{unique_id}@example.com"
        
        payload = {
            "email": test_email,
            "username": test_username,
            "first_name": "Mario",
            "last_name": "Rossi",
            "date_of_birth": "1990-01-15",
            "address": "Via Roma 123",
            "city": "Milano",
            "country": "Italia",
            "postal_code": "20121",
            "password": "Password123!",
            "accepted_privacy": True,
            "accepted_terms": True,
            "language": "it"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Verify status code
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        
        # Verify username is returned as provided (not auto-generated)
        assert "user" in data, "Response must contain user object"
        assert data["user"]["username"] == test_username, f"Username mismatch: expected {test_username}, got {data['user']['username']}"
        assert data["user"]["email"] == test_email, "Email mismatch"
        
        # Verify tokens are returned
        assert "access_token" in data, "access_token must be in response"
        assert "refresh_token" in data, "refresh_token must be in response"
        
        # Verify profile_completed is True after full registration
        assert data["user"].get("profile_completed") == True, "profile_completed should be True"
        
        # Verify email_verified is False initially
        assert data["user"].get("email_verified") == False, "email_verified should be False initially"
        
        print(f"✓ Registration successful with username: {test_username}")
        return data

    def test_register_username_validation_format(self):
        """Test invalid username format is rejected"""
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "email": f"test_format_{unique_id}@example.com",
            "username": "ab",  # Too short (min 3 chars)
            "first_name": "Test",
            "last_name": "User",
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
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Should fail due to username too short
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Short username correctly rejected")


class TestUsernameAvailability:
    """Test username availability endpoint"""
    
    def test_username_available_true(self):
        """GET /api/auth/username-available?username=test returns {available: true}"""
        unique_username = f"uniqueuser{str(uuid.uuid4())[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/auth/username-available?username={unique_username}")
        
        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        assert data["available"] == True, f"Expected available=True for unused username"
        print(f"✓ Username '{unique_username}' is available")

    def test_username_available_false_existing(self):
        """GET /api/auth/username-available should return false for existing user"""
        # First register a user
        unique_id = str(uuid.uuid4())[:8]
        test_username = f"existuser{unique_id}"
        
        # Register the user first
        payload = {
            "email": f"exist_{unique_id}@example.com",
            "username": test_username,
            "first_name": "Test",
            "last_name": "Exist",
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
        
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        # Now check availability - should be False
        response = requests.get(f"{BASE_URL}/api/auth/username-available?username={test_username}")
        
        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        assert data["available"] == False, f"Expected available=False for existing username"
        print(f"✓ Username '{test_username}' correctly shows as unavailable")

    def test_username_too_short(self):
        """Username with less than 3 chars should return available=False"""
        response = requests.get(f"{BASE_URL}/api/auth/username-available?username=ab")
        
        assert response.status_code == 200
        data = response.json()
        assert data["available"] == False
        assert "reason" in data
        print("✓ Short username returns available=False with reason")


class TestEmailVerification:
    """Test email verification resend endpoint"""
    
    def test_resend_verification_existing_user(self):
        """POST /api/auth/resend-verification should work for unverified user"""
        # Register a new user
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"resend_{unique_id}@example.com"
        
        payload = {
            "email": test_email,
            "username": f"resenduser{unique_id}",
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
        
        requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        
        # Try resend verification
        resend_response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification",
            json={"email": test_email}
        )
        
        assert resend_response.status_code == 200
        data = resend_response.json()
        assert "message" in data
        # Message should be Italian
        print(f"✓ Resend verification response: {data['message']}")

    def test_resend_verification_nonexistent_email(self):
        """Resend for non-existent email should return 200 (security)"""
        fake_email = f"nonexistent_{uuid.uuid4()}@fake.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification",
            json={"email": fake_email}
        )
        
        # Should return 200 for security (no email enumeration)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Non-existent email returns 200 for security")


class TestLoginFlow:
    """Test login with existing credentials"""
    
    def test_login_marco_user(self):
        """Login email/password with marco@test.com / password123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "marco@test.com", "password": "password123"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["email"] == "marco@test.com"
        
        print(f"✓ Login successful for marco@test.com")
        return data["access_token"]

    def test_login_invalid_credentials(self):
        """Login with wrong password should return 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "marco@test.com", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401
        print("✓ Invalid credentials correctly return 401")


class TestNationalLeagueJoin:
    """Test national league join-direct flow"""
    
    def test_get_national_leagues(self):
        """GET /api/leagues/national should return available national leagues"""
        response = requests.get(f"{BASE_URL}/api/leagues/national")
        
        assert response.status_code == 200
        leagues = response.json()
        
        assert isinstance(leagues, list), "Response should be a list"
        
        if len(leagues) > 0:
            # Verify structure
            league = leagues[0]
            assert "id" in league
            assert "name" in league
            assert league.get("league_type") == "national"
            print(f"✓ Found {len(leagues)} national league(s): {[l['name'] for l in leagues]}")
            return leagues
        else:
            print("⚠ No national leagues found in database")
            return []
    
    def test_join_direct_national_league(self):
        """POST /api/leagues/{id}/join-direct should create membership"""
        # First, create a fresh user without leagues
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"join_{unique_id}@example.com"
        test_username = f"joinuser{unique_id}"
        
        # Register
        reg_payload = {
            "email": test_email,
            "username": test_username,
            "first_name": "Join",
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
        
        # Get national leagues
        nat_response = requests.get(f"{BASE_URL}/api/leagues/national")
        leagues = nat_response.json()
        
        if len(leagues) == 0:
            pytest.skip("No national leagues available for testing")
        
        league_id = leagues[0]["id"]
        
        # Join the league
        headers = {"Authorization": f"Bearer {access_token}"}
        join_response = requests.post(
            f"{BASE_URL}/api/leagues/{league_id}/join-direct",
            headers=headers
        )
        
        assert join_response.status_code == 200, f"Join failed: {join_response.text}"
        join_data = join_response.json()
        
        assert "message" in join_data
        print(f"✓ Join response: {join_data['message']}")
        
        # Verify user is now a member by getting their leagues
        my_leagues_response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers=headers
        )
        
        assert my_leagues_response.status_code == 200
        my_leagues = my_leagues_response.json()
        
        # User should have at least one league now
        assert len(my_leagues) >= 1, f"User should have at least 1 league after join, got {len(my_leagues)}"
        
        # Verify the joined league is in the list
        joined_league_ids = [l["id"] for l in my_leagues]
        assert league_id in joined_league_ids, f"Joined league {league_id} not in user's leagues"
        
        print(f"✓ User successfully joined national league and it appears in GET /api/leagues")
        return True

    def test_join_direct_already_member(self):
        """Join-direct for already member should return success with already_member flag"""
        # Login as existing user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        access_token = login_response.json()["access_token"]
        
        # Check existing leagues
        headers = {"Authorization": f"Bearer {access_token}"}
        leagues_response = requests.get(f"{BASE_URL}/api/leagues", headers=headers)
        existing_leagues = leagues_response.json()
        
        if len(existing_leagues) > 0:
            # Try to join a league user is already in
            league_id = existing_leagues[0]["id"]
            
            join_response = requests.post(
                f"{BASE_URL}/api/leagues/{league_id}/join-direct",
                headers=headers
            )
            
            assert join_response.status_code == 200
            data = join_response.json()
            assert data.get("already_member") == True
            print("✓ Already member case handled correctly")
        else:
            print("⚠ Admin has no leagues - skipping already_member test")


class TestHomeAfterJoin:
    """Test /api/home returns league data after joining"""
    
    def test_home_shows_user_leagues(self):
        """After join, /api/home should show the league in user_leagues"""
        # Login as admin who should have leagues
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        access_token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {access_token}"}
        home_response = requests.get(f"{BASE_URL}/api/home", headers=headers)
        
        assert home_response.status_code == 200
        data = home_response.json()
        
        assert "user_leagues" in data
        user_leagues = data["user_leagues"]
        print(f"✓ Home shows {len(user_leagues)} league(s) for admin user")
        
        if len(user_leagues) > 0:
            # Verify league structure
            league = user_leagues[0]
            assert "id" in league
            assert "name" in league


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
