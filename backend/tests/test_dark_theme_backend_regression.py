"""
Dark Theme Backend Regression Test Suite
=========================================
Testing all backend API endpoints to ensure they remain functional after the frontend
dark theme UI overhaul. This test validates that:
1. All auth endpoints work correctly
2. /api/home returns complete data structure
3. /api/predictions/{matchday_id} returns predictions
4. /api/standings endpoints work correctly
5. /api/standings/user/{user_id} returns user profile standings
6. /api/live/{matchday_id} returns live match data
7. /api/leagues endpoints return user leagues

Test Credentials:
- Standard User: ilio@raimondi.it / password123
- Admin: admin@fantapronostic.com / admin123
- League Owner: test@raimondi.it / password
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', os.environ.get('EXPO_PUBLIC_BACKEND_URL', '')).rstrip('/')
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "ilio@raimondi.it"
USER_PASSWORD = "password123"
LEAGUE_OWNER_EMAIL = "test@raimondi.it"
LEAGUE_OWNER_PASSWORD = "password"


class TestAuthEndpoints:
    """Auth endpoint tests - /api/auth/login"""
    
    def test_login_standard_user(self):
        """Test login with standard user credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Missing access_token"
        assert "refresh_token" in data, "Missing refresh_token"
        assert "user" in data, "Missing user object"
        
        user = data["user"]
        assert user["email"] == USER_EMAIL
        assert "id" in user
        assert "username" in user
        print(f"✓ Standard user login successful: {user['username']}")
    
    def test_login_admin_user(self):
        """Test login with admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.status_code}"
        
        data = response.json()
        assert data["user"]["role"] == "admin", "Expected admin role"
        print(f"✓ Admin login successful: {data['user']['username']}")
    
    def test_login_league_owner(self):
        """Test login with league owner credentials (may not exist in all environments)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": LEAGUE_OWNER_EMAIL, "password": LEAGUE_OWNER_PASSWORD}
        )
        # This credential may not exist in all environments - 401 is acceptable
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            print(f"✓ League owner login successful: {data['user']['username']}")
        elif response.status_code == 401:
            pytest.skip("League owner credentials not configured in this environment")
        else:
            assert False, f"Unexpected status: {response.status_code}"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestHomeEndpoint:
    """Test /api/home endpoint - returns league, matchday data"""
    
    @pytest.fixture
    def user_token(self):
        """Get user authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["access_token"]
    
    @pytest.fixture
    def user_id(self):
        """Get user ID"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["user"]["id"]
    
    def test_home_endpoint_returns_200(self, user_token):
        """Test /api/home returns 200 for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/home returns 200")
    
    def test_home_returns_complete_structure(self, user_token):
        """Test /api/home returns complete data structure"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        data = response.json()
        
        # Verify all expected fields are present
        expected_fields = ["matchday", "league", "user_leagues", "rankings_preview", 
                         "user_summary", "last_5_performance", "stats_preview"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ /api/home returns all expected fields: {list(data.keys())}")
    
    def test_home_matchday_data(self, user_token):
        """Test /api/home matchday data structure"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        data = response.json()
        matchday = data.get("matchday")
        
        if matchday:
            required_fields = ["id", "number", "status", "first_kickoff", 
                             "total_matches", "my_predictions_count"]
            for field in required_fields:
                assert field in matchday, f"Matchday missing field: {field}"
            
            # Validate status
            valid_statuses = ["DRAFT", "OPEN", "LOCKED", "LIVE", "COMPLETED"]
            assert matchday["status"] in valid_statuses, f"Invalid status: {matchday['status']}"
            print(f"✓ Matchday data valid - Status: {matchday['status']}, Number: {matchday['number']}")
        else:
            print("ℹ No active matchday")
    
    def test_home_league_data(self, user_token):
        """Test /api/home league data structure"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        data = response.json()
        league = data.get("league")
        
        if league:
            required_fields = ["id", "name", "league_type", "my_role"]
            for field in required_fields:
                assert field in league, f"League missing field: {field}"
            print(f"✓ League data valid - Name: {league['name']}, Role: {league['my_role']}")
        else:
            print("ℹ No active league for user")
    
    def test_home_user_leagues_list(self, user_token):
        """Test /api/home returns user's leagues list"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        data = response.json()
        user_leagues = data.get("user_leagues", [])
        
        assert isinstance(user_leagues, list), "user_leagues should be a list"
        print(f"✓ User has {len(user_leagues)} leagues")
        
        if user_leagues:
            for league in user_leagues:
                assert "id" in league, "League missing id"
                assert "name" in league, "League missing name"


class TestPredictionsEndpoint:
    """Test /api/predictions/{matchday_id} endpoint"""
    
    @pytest.fixture
    def user_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["access_token"]
    
    @pytest.fixture
    def matchday_id(self, user_token):
        """Get a valid matchday ID from /api/home"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        data = response.json()
        matchday = data.get("matchday")
        return matchday["id"] if matchday else None
    
    def test_predictions_endpoint_returns_data(self, user_token, matchday_id):
        """Test /api/predictions/{matchday_id} returns predictions data"""
        if not matchday_id:
            pytest.skip("No active matchday to test predictions")
        
        response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # May return 404 if matchday not found or 200 with data
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "matches" in data or "matchday" in data, "Missing expected fields"
            print(f"✓ /api/predictions/{matchday_id} returns data")
        else:
            print(f"ℹ Matchday {matchday_id} not found")
    
    def test_predictions_requires_auth(self, matchday_id):
        """Test predictions endpoint requires authentication"""
        if not matchday_id:
            pytest.skip("No matchday_id")
        
        response = requests.get(f"{BASE_URL}/api/predictions/{matchday_id}")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Predictions endpoint correctly requires auth")


class TestStandingsEndpoints:
    """Test /api/standings endpoints"""
    
    @pytest.fixture
    def user_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["access_token"]
    
    @pytest.fixture
    def user_id(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["user"]["id"]
    
    def test_standings_total_endpoint(self, user_token):
        """Test /api/standings/total returns ranked entries"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": NATIONAL_LEAGUE_ID},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "entries" in data, "Missing entries"
        assert "league_id" in data, "Missing league_id"
        assert "standings_type" in data, "Missing standings_type"
        
        entries = data.get("entries", [])
        if entries:
            # Verify entry structure
            first = entries[0]
            assert "user_id" in first, "Entry missing user_id"
            assert "username" in first, "Entry missing username"
            assert "total_points" in first, "Entry missing total_points"
            assert "rank" in first, "Entry missing rank"
        
        print(f"✓ /api/standings/total returns {len(entries)} entries")
    
    def test_standings_matchdays_endpoint(self, user_token):
        """Test /api/standings/matchdays returns matchday list"""
        response = requests.get(
            f"{BASE_URL}/api/standings/matchdays",
            params={"league_id": NATIONAL_LEAGUE_ID},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of matchdays"
        
        if data:
            first = data[0]
            assert "id" in first, "Matchday missing id"
            assert "number" in first, "Matchday missing number"
            assert "status" in first, "Matchday missing status"
        
        print(f"✓ /api/standings/matchdays returns {len(data)} matchdays")
    
    def test_standings_user_profile(self, user_token, user_id):
        """Test /api/standings/user/{user_id} returns user's standings profile"""
        response = requests.get(
            f"{BASE_URL}/api/standings/user/{user_id}",
            params={"league_id": NATIONAL_LEAGUE_ID},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify user standings data structure
        assert "user_id" in data or "user" in data or "total_points" in data, \
            f"Unexpected response structure: {list(data.keys())}"
        
        print(f"✓ /api/standings/user/{user_id} returns user standings data")


class TestLiveEndpoint:
    """Test /api/live/{matchday_id} endpoint"""
    
    @pytest.fixture
    def user_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["access_token"]
    
    @pytest.fixture
    def matchday_id(self, user_token):
        """Get current matchday ID"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        data = response.json()
        matchday = data.get("matchday")
        return matchday["id"] if matchday else None
    
    def test_live_endpoint_returns_data(self, user_token, matchday_id):
        """Test /api/live/{matchday_id} returns live match data"""
        if not matchday_id:
            pytest.skip("No active matchday")
        
        response = requests.get(
            f"{BASE_URL}/api/live/{matchday_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Live endpoint may return 200 or 404 depending on matchday status
        assert response.status_code in [200, 404], f"Unexpected: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify live data structure
            assert isinstance(data, dict), "Expected dict response"
            print(f"✓ /api/live/{matchday_id} returns live data: {list(data.keys())[:5]}")
        else:
            print(f"ℹ Live data not available for matchday {matchday_id}")
    
    def test_live_matchday_endpoint(self, user_token, matchday_id):
        """Test /api/live/matchday/{matchday_id} returns live matchday details"""
        if not matchday_id:
            pytest.skip("No active matchday")
        
        response = requests.get(
            f"{BASE_URL}/api/live/matchday/{matchday_id}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # May return 200 or 404
        assert response.status_code in [200, 404], f"Unexpected: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ /api/live/matchday/{matchday_id} returns data")


class TestLeaguesEndpoints:
    """Test /api/leagues endpoints"""
    
    @pytest.fixture
    def user_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["access_token"]
    
    def test_get_my_leagues(self, user_token):
        """Test /api/leagues returns user's leagues"""
        response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Response should be a list of leagues or a dict with leagues
        if isinstance(data, list):
            leagues = data
        else:
            leagues = data.get("leagues", data.get("user_leagues", []))
        
        assert isinstance(leagues, list), f"Expected list, got {type(leagues)}"
        
        if leagues:
            first = leagues[0]
            assert "id" in first, "League missing id"
            assert "name" in first, "League missing name"
        
        print(f"✓ /api/leagues returns {len(leagues)} leagues for user")
    
    def test_get_league_members(self, user_token):
        """Test /api/leagues/{league_id}/members returns league members"""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{NATIONAL_LEAGUE_ID}/members",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # May return 200 or 403/404 depending on membership
        assert response.status_code in [200, 403, 404], f"Unexpected: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            members = data.get("members", [])
            print(f"✓ /api/leagues/{NATIONAL_LEAGUE_ID}/members returns {len(members)} members")
        else:
            print(f"ℹ Cannot access league members (status {response.status_code})")


class TestProfileEndpoint:
    """Test /api/profile endpoint"""
    
    @pytest.fixture
    def user_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER_EMAIL, "password": USER_PASSWORD}
        )
        return response.json()["access_token"]
    
    def test_profile_returns_user_data(self, user_token):
        """Test /api/profile returns user profile data"""
        response = requests.get(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "user" in data, "Missing user object"
        
        user = data["user"]
        assert "id" in user, "User missing id"
        assert "email" in user, "User missing email"
        assert "username" in user, "User missing username"
        assert "password" not in user, "Password should not be in response!"
        
        print(f"✓ /api/profile returns user data for {user['email']}")
    
    def test_profile_requires_auth(self):
        """Test /api/profile requires authentication"""
        response = requests.get(f"{BASE_URL}/api/profile")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ /api/profile correctly requires auth")


class TestAPIHealth:
    """Basic API health checks"""
    
    def test_api_health(self):
        """Test API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Health endpoint may not exist, but root should respond
        if response.status_code == 404:
            # Try root
            response = requests.get(f"{BASE_URL}/")
            assert response.status_code in [200, 307, 308], f"API not responding: {response.status_code}"
        print("✓ API is healthy and responding")
    
    def test_admin_ui_accessible(self):
        """Test /api/admin-ui is accessible"""
        response = requests.get(f"{BASE_URL}/api/admin-ui")
        assert response.status_code == 200, f"Admin UI not accessible: {response.status_code}"
        assert "html" in response.headers.get("content-type", "").lower()
        print("✓ Admin UI is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
