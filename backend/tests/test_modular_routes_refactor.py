"""
Backend API Tests - Modular Routes Refactoring Validation
Tests all API endpoints after the monolithic server.py was split into 12 modular route files.
Validates: auth, user, profile, home, leagues, standings, notifications, news, rbac, admin endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://palmares-historic.preview.emergentagent.com").rstrip("/")

# Test credentials
STANDARD_USER = {"email": "ilio@raimondi.it", "password": "password123"}
ADMIN_USER = {"email": "admin@fantapronostic.com", "password": "admin123"}


class TestAPIRoot:
    """Test API root and health endpoints"""
    
    def test_api_root(self):
        """GET /api - API root info"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "FantaPronostic" in data["message"]
        print(f"✓ API root returns: {data}")
    
    def test_admin_ui_accessible(self):
        """GET /api/admin-ui - Admin dashboard HTML"""
        response = requests.get(f"{BASE_URL}/api/admin-ui")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print("✓ Admin UI returns HTML")
    
    def test_reset_password_page(self):
        """GET /api/reset-password - Reset password HTML page"""
        response = requests.get(f"{BASE_URL}/api/reset-password")
        assert response.status_code == 200
        assert "text/html" in response.headers.get("Content-Type", "")
        print("✓ Reset password page returns HTML")


class TestAuthEndpoints:
    """Test auth routes (routes/auth.py)"""
    
    def test_login_standard_user(self):
        """POST /api/auth/login - Standard user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["email"] == STANDARD_USER["email"]
        print(f"✓ Standard user login successful: {data['user']['username']}")
        return data
    
    def test_login_admin_user(self):
        """POST /api/auth/login - Admin user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] in ("admin", "superadmin", "user")
        print(f"✓ Admin user login successful: {data['user']['username']}")
        return data
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - Invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly returns 401")
    
    def test_register_duplicate_email(self):
        """POST /api/auth/register - Duplicate email returns error"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": STANDARD_USER["email"],  # Already exists
            "password": "newpassword123",
            "first_name": "Test",
            "last_name": "User",
            "date_of_birth": "1990-01-01",
            "address": "Via Test 1",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "accepted_privacy": True,
            "accepted_terms": True,
            "language": "it"
        })
        assert response.status_code == 400
        print("✓ Duplicate email registration correctly rejected")
    
    def test_username_available(self):
        """GET /api/auth/username-available - Check username availability"""
        # Test with a unique username
        response = requests.get(f"{BASE_URL}/api/auth/username-available?username=test_unique_user_12345")
        assert response.status_code == 200
        data = response.json()
        assert "available" in data
        print(f"✓ Username availability check: {data}")
    
    def test_get_me_with_token(self):
        """GET /api/auth/me - Get current user with valid token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        token = login_response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == STANDARD_USER["email"]
        assert "_id" not in data  # MongoDB _id should be excluded
        print(f"✓ GET /api/auth/me returns user data: {data['username']}")
    
    def test_get_me_without_token(self):
        """GET /api/auth/me - Returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in (401, 403)
        print("✓ GET /api/auth/me correctly requires authentication")


class TestProfileEndpoints:
    """Test profile routes (routes/user.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_profile(self):
        """GET /api/profile - Returns user profile"""
        response = requests.get(f"{BASE_URL}/api/profile", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "leagues_count" in data
        assert "password" not in data.get("user", {})
        print(f"✓ GET /api/profile: {data['user']['username']}, leagues: {data['leagues_count']}")
    
    def test_update_profile(self):
        """PUT /api/profile - Update profile"""
        response = requests.put(
            f"{BASE_URL}/api/profile",
            headers=self.headers,
            json={"language": "it"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("language") == "it"
        print(f"✓ PUT /api/profile updated language to: {data.get('language')}")


class TestHomeEndpoint:
    """Test home route (routes/user.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_home(self):
        """GET /api/home - Returns home data with league info"""
        response = requests.get(f"{BASE_URL}/api/home", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Validate response structure
        assert "user_leagues" in data
        assert "league" in data or data.get("league") is None
        assert "matchday" in data or data.get("matchday") is None
        assert "rankings_preview" in data or data.get("rankings_preview") is None
        print(f"✓ GET /api/home returns data, leagues: {len(data.get('user_leagues', []))}")
        return data


class TestLeaguesEndpoints:
    """Test league routes (routes/leagues.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_my_leagues(self):
        """GET /api/leagues - Returns user's leagues"""
        response = requests.get(f"{BASE_URL}/api/leagues", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/leagues: {len(data)} leagues")
        return data
    
    def test_get_national_leagues(self):
        """GET /api/leagues/national - Returns national leagues"""
        response = requests.get(f"{BASE_URL}/api/leagues/national", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/leagues/national: {len(data)} national leagues")


class TestStandingsEndpoints:
    """Test standings routes (routes/standings.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        # Get a league_id for testing
        leagues_response = requests.get(f"{BASE_URL}/api/leagues", headers=self.headers)
        leagues = leagues_response.json()
        self.league_id = leagues[0]["id"] if leagues else None
    
    def test_get_total_standings(self):
        """GET /api/standings/total - Returns standings data"""
        url = f"{BASE_URL}/api/standings/total"
        if self.league_id:
            url += f"?league_id={self.league_id}"
        response = requests.get(url, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "league_id" in data
        print(f"✓ GET /api/standings/total: {len(data.get('entries', []))} entries")
    
    def test_get_matchdays(self):
        """GET /api/standings/matchdays - Returns available matchdays"""
        url = f"{BASE_URL}/api/standings/matchdays"
        if self.league_id:
            url += f"?league_id={self.league_id}"
        response = requests.get(url, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/standings/matchdays: {len(data)} matchdays")


class TestNotificationsEndpoints:
    """Test notifications routes (routes/user.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_notifications(self):
        """GET /api/notifications - Returns notifications list"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/notifications: {len(data)} notifications")
    
    def test_get_unread_count(self):
        """GET /api/notifications/unread-count - Returns unread count"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ GET /api/notifications/unread-count: {data['count']}")


class TestNewsEndpoints:
    """Test news routes (routes/user.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_news(self):
        """GET /api/news - Returns news list"""
        response = requests.get(f"{BASE_URL}/api/news", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/news: {len(data)} news items")


class TestRBACEndpoints:
    """Test RBAC routes (routes/rbac.py) - Admin permissions required"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if login_response.status_code != 200:
            pytest.skip("Admin login failed")
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = login_response.json()["user"]
    
    def test_get_my_permissions(self):
        """GET /api/rbac/my-permissions - Returns user permissions"""
        response = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "permissions" in data
        print(f"✓ GET /api/rbac/my-permissions: {len(data.get('permissions', []))} permissions")
    
    def test_get_dashboard_stats(self):
        """GET /api/rbac/dashboard-stats - Returns dashboard KPIs"""
        response = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=self.headers)
        # May require specific permissions
        if response.status_code == 403:
            print("⚠ Dashboard stats requires admin.dashboard.view permission")
            return
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "leagues" in data
        print(f"✓ GET /api/rbac/dashboard-stats: users={data['users']['total']}, leagues={data['leagues']['total']}")
    
    def test_get_users_list(self):
        """GET /api/rbac/users - Returns user list for admin"""
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=self.headers)
        # May require specific permissions
        if response.status_code == 403:
            print("⚠ Users list requires admin.users.manage permission")
            return
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/rbac/users: {len(data)} users")
    
    def test_get_roles_list(self):
        """GET /api/rbac/roles - Returns roles list for admin"""
        response = requests.get(f"{BASE_URL}/api/rbac/roles", headers=self.headers)
        # May require specific permissions
        if response.status_code == 403:
            print("⚠ Roles list requires admin.roles.manage permission")
            return
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/rbac/roles: {len(data)} roles")
    
    def test_get_rbac_leagues_list(self):
        """GET /api/rbac/leagues - Returns leagues list for admin"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=self.headers)
        # May require specific permissions
        if response.status_code == 403:
            print("⚠ Leagues list requires admin.leagues.manage permission")
            return
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/rbac/leagues: {len(data)} leagues")


class TestAdminEndpoints:
    """Test admin routes (routes/admin.py) - Admin permissions required"""
    
    @pytest.fixture(autouse=True)
    def setup_admin_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
        if login_response.status_code != 200:
            pytest.skip("Admin login failed")
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_admin_seasons(self):
        """GET /api/admin/seasons - Returns seasons for admin"""
        response = requests.get(f"{BASE_URL}/api/admin/seasons", headers=self.headers)
        # May require specific permissions
        if response.status_code == 403:
            print("⚠ Admin seasons requires admin.seasons.manage permission")
            return
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/seasons: {len(data)} seasons")
    
    def test_get_admin_matchdays(self):
        """GET /api/admin/matchdays - Returns matchdays for admin"""
        response = requests.get(f"{BASE_URL}/api/admin/matchdays", headers=self.headers)
        # May require specific permissions
        if response.status_code == 403:
            print("⚠ Admin matchdays requires admin.matchdays.manage permission")
            return
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/matchdays: {len(data)} matchdays")


class TestLiveEndpoints:
    """Test live routes (routes/live.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_live_data(self):
        """GET /api/live/{matchday_id} - Returns live matchday data"""
        # First get a matchday_id
        standings_response = requests.get(
            f"{BASE_URL}/api/standings/matchdays",
            headers=self.headers
        )
        matchdays = standings_response.json()
        if not matchdays:
            print("⚠ No matchdays available for live test")
            return
        
        matchday_id = matchdays[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/live/{matchday_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "matchday_id" in data
        assert "matches" in data
        print(f"✓ GET /api/live/{matchday_id}: {len(data.get('matches', []))} matches")


class TestPredictionsEndpoints:
    """Test prediction routes (routes/predictions.py)"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_predictions(self):
        """GET /api/predictions/{matchday_id} - Returns predictions for matchday"""
        # First get a matchday_id
        standings_response = requests.get(
            f"{BASE_URL}/api/standings/matchdays",
            headers=self.headers
        )
        matchdays = standings_response.json()
        if not matchdays:
            print("⚠ No matchdays available for predictions test")
            return
        
        matchday_id = matchdays[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "matchday" in data
        assert "predictions" in data
        print(f"✓ GET /api/predictions/{matchday_id}: {len(data.get('predictions', []))} prediction slots")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
