"""
Test Admin Create User & Create League Features
Tests:
- POST /api/rbac/users/create - Admin creates new users
- POST /api/rbac/leagues/create - Admin creates new leagues
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dead-code-sweep.preview.emergentagent.com").rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
ACTIVE_SEASON_ID = "19e329ae-4c6b-47ea-ab38-50a4d1baab1e"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Admin request headers."""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ========================================
# USER CREATION TESTS
# ========================================
class TestAdminCreateUser:
    """Tests for POST /api/rbac/users/create endpoint."""

    def test_create_user_success(self, admin_headers):
        """Successfully create a user with all required fields."""
        timestamp = int(time.time())
        payload = {
            "first_name": "Test",
            "last_name": "AdminCreate",
            "email": f"testadmin_create_{timestamp}@test.com",
            "date_of_birth": "1990-01-15",
            "password": "TestPassword123!",
            "address": "Via Test 123",
            "city": "Milano",
            "country": "Italia",
            "postal_code": "20100"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create user failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "username" in data
        assert data["email"] == payload["email"]
        
        # Store user_id for cleanup later
        self.created_user_id = data["user_id"]
        self.created_email = data["email"]
        self.created_password = payload["password"]
        print(f"[PASS] Created user: {data['username']} ({data['email']})")

    def test_create_user_with_custom_username(self, admin_headers):
        """Create a user with a custom username."""
        timestamp = int(time.time())
        payload = {
            "first_name": "Custom",
            "last_name": "Username",
            "email": f"testadmin_custom_{timestamp}@test.com",
            "username": f"custom_user_{timestamp}",
            "date_of_birth": "1985-05-20",
            "password": "CustomPass123!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create user with username failed: {response.text}"
        data = response.json()
        assert data["username"] == payload["username"]
        print(f"[PASS] Created user with custom username: {data['username']}")

    def test_create_user_duplicate_email_rejected(self, admin_headers):
        """Duplicate email should be rejected with 409."""
        # Use admin's email which definitely exists
        payload = {
            "first_name": "Duplicate",
            "last_name": "Email",
            "email": ADMIN_EMAIL,  # Already exists
            "date_of_birth": "1990-01-01",
            "password": "TestPass123!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 409, f"Expected 409 for duplicate email, got {response.status_code}: {response.text}"
        print("[PASS] Duplicate email correctly rejected with 409")

    def test_create_user_missing_required_fields(self, admin_headers):
        """Missing required fields should return 400."""
        # Missing email
        payload = {
            "first_name": "Test",
            "last_name": "Missing",
            "date_of_birth": "1990-01-01",
            "password": "TestPass123!"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for missing email, got {response.status_code}"
        print("[PASS] Missing email correctly rejected with 400")

    def test_create_user_short_password_rejected(self, admin_headers):
        """Password shorter than 8 characters should be rejected."""
        timestamp = int(time.time())
        payload = {
            "first_name": "Short",
            "last_name": "Password",
            "email": f"shortpass_{timestamp}@test.com",
            "date_of_birth": "1990-01-01",
            "password": "short"  # < 8 chars
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for short password, got {response.status_code}: {response.text}"
        assert "8" in response.text or "caratteri" in response.text.lower()
        print("[PASS] Short password correctly rejected with 400")

    def test_created_user_can_login(self, admin_headers):
        """Verify that a newly created user can login."""
        timestamp = int(time.time())
        email = f"testlogin_{timestamp}@test.com"
        password = "LoginTest123!"
        
        # First create the user
        payload = {
            "first_name": "Login",
            "last_name": "Test",
            "email": email,
            "date_of_birth": "1990-01-01",
            "password": password
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json=payload,
            headers=admin_headers
        )
        assert create_response.status_code == 200, f"Failed to create user: {create_response.text}"
        
        # Now try to login with the created user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        
        assert login_response.status_code == 200, f"Created user login failed: {login_response.text}"
        login_data = login_response.json()
        assert "access_token" in login_data
        assert login_data["user"]["email"] == email
        print(f"[PASS] Created user can successfully login")


# ========================================
# LEAGUE CREATION TESTS
# ========================================
class TestAdminCreateLeague:
    """Tests for POST /api/rbac/leagues/create endpoint."""

    def test_create_league_success(self, admin_headers):
        """Successfully create a league with default settings."""
        timestamp = int(time.time())
        payload = {
            "name": f"Test League {timestamp}",
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "national"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create league failed: {response.text}"
        data = response.json()
        assert "league_id" in data
        assert "name" in data
        assert "invite_code" in data
        assert data["name"] == payload["name"]
        
        self.created_league_id = data["league_id"]
        print(f"[PASS] Created league: {data['name']} (invite_code: {data['invite_code']})")

    def test_create_league_with_all_options(self, admin_headers):
        """Create a league with all configuration options."""
        timestamp = int(time.time())
        payload = {
            "name": f"Full Config League {timestamp}",
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "custom",
            "bet_deadline_minutes": 10,
            "start_matchday": 5,
            "end_matchday": 30,
            "include_championship_predictions": True,
            "scoring_config": {
                "1x2": {"enabled": True, "points": 2},
                "over_under": {"enabled": True, "points": 1},
                "goal_no_goal": {"enabled": False, "points": 0},
                "exact_score": {"enabled": True, "points": 5}
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create full league failed: {response.text}"
        data = response.json()
        print(f"[PASS] Created full config league: {data['name']}")

    def test_create_league_short_name_rejected(self, admin_headers):
        """League name shorter than 3 chars should be rejected."""
        payload = {
            "name": "AB",  # < 3 chars
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "national"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for short name, got {response.status_code}: {response.text}"
        print("[PASS] Short league name correctly rejected with 400")

    def test_create_league_invalid_season_rejected(self, admin_headers):
        """Invalid season_id should be rejected."""
        timestamp = int(time.time())
        payload = {
            "name": f"Invalid Season League {timestamp}",
            "season_id": "invalid-season-id-12345",
            "match_source_type": "national"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid season, got {response.status_code}: {response.text}"
        print("[PASS] Invalid season correctly rejected with 400")

    def test_created_league_appears_in_list(self, admin_headers):
        """Verify that a created league appears in the leagues list."""
        timestamp = int(time.time())
        league_name = f"List Test League {timestamp}"
        
        # Create the league
        payload = {
            "name": league_name,
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "national"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json=payload,
            headers=admin_headers
        )
        assert create_response.status_code == 200, f"Failed to create league: {create_response.text}"
        created_data = create_response.json()
        league_id = created_data["league_id"]
        
        # Fetch leagues list
        list_response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers=admin_headers
        )
        assert list_response.status_code == 200, f"Failed to get leagues: {list_response.text}"
        leagues = list_response.json()
        
        # Check the created league is in the list
        found_league = next((l for l in leagues if l["id"] == league_id), None)
        assert found_league is not None, f"Created league {league_id} not found in list"
        assert found_league["name"] == league_name
        print(f"[PASS] Created league appears in list: {found_league['name']}")

    def test_created_league_has_admin_as_owner(self, admin_headers, admin_token):
        """Verify that the admin who created the league is the owner with active membership."""
        timestamp = int(time.time())
        
        # First get current user info
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=admin_headers
        )
        assert me_response.status_code == 200
        admin_user_id = me_response.json()["id"]
        
        # Create the league
        payload = {
            "name": f"Owner Test League {timestamp}",
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "national"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json=payload,
            headers=admin_headers
        )
        assert create_response.status_code == 200
        league_id = create_response.json()["league_id"]
        
        # Get the league details from the list
        list_response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers=admin_headers
        )
        leagues = list_response.json()
        created_league = next((l for l in leagues if l["id"] == league_id), None)
        
        assert created_league is not None
        assert created_league["owner_id"] == admin_user_id, f"Owner mismatch: expected {admin_user_id}, got {created_league.get('owner_id')}"
        print(f"[PASS] Created league has correct owner: {created_league['owner_id']}")

    def test_create_custom_league_source_type(self, admin_headers):
        """Create a custom source type league."""
        timestamp = int(time.time())
        payload = {
            "name": f"Custom Source League {timestamp}",
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "custom"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json=payload,
            headers=admin_headers
        )
        
        assert response.status_code == 200, f"Create custom league failed: {response.text}"
        data = response.json()
        
        # Verify the league has custom match_source_type
        list_response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers=admin_headers
        )
        leagues = list_response.json()
        created_league = next((l for l in leagues if l["id"] == data["league_id"]), None)
        
        assert created_league["match_source_type"] == "custom"
        print(f"[PASS] Custom source type league created successfully")


# ========================================
# NON-ADMIN ACCESS TESTS
# ========================================
class TestNonAdminAccess:
    """Tests to verify non-admin users cannot access these endpoints."""

    def test_non_admin_cannot_create_user(self):
        """Non-admin users should be denied access to create users."""
        # First create a regular user and login
        timestamp = int(time.time())
        
        # Login as admin to create a test user
        admin_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        admin_token = admin_response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        
        # Create a test user
        test_email = f"nonadmin_test_{timestamp}@test.com"
        test_password = "TestPass123!"
        create_response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json={
                "first_name": "NonAdmin",
                "last_name": "Test",
                "email": test_email,
                "date_of_birth": "1990-01-01",
                "password": test_password
            },
            headers=admin_headers
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test user")
        
        # Login as the non-admin user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": test_email, "password": test_password}
        )
        assert login_response.status_code == 200
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}
        
        # Try to create a user - should fail
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/create",
            json={
                "first_name": "Should",
                "last_name": "Fail",
                "email": f"should_fail_{timestamp}@test.com",
                "date_of_birth": "1990-01-01",
                "password": "FailPass123!"
            },
            headers=user_headers
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("[PASS] Non-admin correctly denied access to create user")

    def test_non_admin_cannot_create_league(self):
        """Non-admin users should be denied access to create leagues via admin endpoint."""
        # Try using a known non-admin user
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ilio@raimondi.it", "password": "password123"}
        )
        
        if login_response.status_code != 200:
            pytest.skip("Standard test user not available")
        
        user_token = login_response.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}
        
        timestamp = int(time.time())
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            json={
                "name": f"Should Fail League {timestamp}",
                "season_id": ACTIVE_SEASON_ID,
                "match_source_type": "national"
            },
            headers=user_headers
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("[PASS] Non-admin correctly denied access to create league")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
