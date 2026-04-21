"""
Test: Pronostici Tab Dynamic Routing APIs
Verifies backend APIs used by the Pronostici tab routing logic
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')

# Test credentials
USER_EMAIL = "ilio@raimondi.it"
USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


class TestLoginFlow:
    """Test authentication flow works"""
    
    def test_login_with_standard_user(self):
        """Login with ilio@raimondi.it / password123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == USER_EMAIL


class TestHomeAPI:
    """Test /api/home returns correct data for Pronostici tab routing"""
    
    def test_home_returns_league_id(self, auth_token):
        """Verify /api/home returns league.id for routing"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify league data exists
        assert "league" in data, "Response missing 'league' field"
        assert data["league"] is not None, "league is null"
        assert "id" in data["league"], "league missing 'id'"
        assert data["league"]["id"] == "f1373417-43aa-4043-b6a2-125873181c95"
    
    def test_home_returns_matchday_with_live_status(self, auth_token):
        """Verify /api/home returns matchday with LIVE status"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify matchday data
        assert "matchday" in data, "Response missing 'matchday' field"
        assert data["matchday"] is not None, "matchday is null"
        assert "id" in data["matchday"], "matchday missing 'id'"
        assert "status" in data["matchday"], "matchday missing 'status'"
        assert data["matchday"]["status"] == "LIVE", f"Expected LIVE, got {data['matchday']['status']}"
        assert data["matchday"]["label"] == "Giornata 25"
    
    def test_home_matchday_id_for_live_routing(self, auth_token):
        """Verify matchday.id is correct for /live/{matchdayId} routing"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        # Verify matchday ID is the expected value for routing
        matchday_id = data["matchday"]["id"]
        league_id = data["league"]["id"]
        
        assert matchday_id == "040552b8-0e2a-4cd8-b52e-030e27d93560"
        assert league_id == "f1373417-43aa-4043-b6a2-125873181c95"
        
        # This is the expected route for LIVE status:
        # /live/040552b8-0e2a-4cd8-b52e-030e27d93560?league_id=fanta-auth-fix


class TestTournamentsAPI:
    """Test /api/tournaments returns list for navigation"""
    
    def test_tournaments_list(self, auth_token):
        """Verify /api/tournaments returns tournament list"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list), "Expected list of tournaments"
        assert len(data) >= 1, "Expected at least 1 tournament"
        
        # Check first tournament has required fields
        tournament = data[0]
        assert "id" in tournament
        assert "name" in tournament
        assert "status" in tournament
        assert "is_registered" in tournament
    
    def test_user_not_registered_for_tournaments(self, auth_token):
        """Verify test user is not registered for any tournaments"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        for tournament in data:
            # User ilio@raimondi.it should not be registered
            assert tournament["is_registered"] == False, f"User unexpectedly registered for {tournament['name']}"


class TestTournamentDetailAPI:
    """Test /api/tournaments/{id} returns current_round_info"""
    
    def test_tournament_detail(self, auth_token):
        """Verify /api/tournaments/{id} returns tournament detail"""
        tournament_id = "a0a60a06-65a3-4707-aa42-545a7da08dff"
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{tournament_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "name" in data
        assert data["name"] == "Torneo Redubull"
        assert "status" in data
        assert "current_round_info" in data  # This field is used for tab routing
    
    def test_tournament_current_round_info_null_when_not_registered(self, auth_token):
        """When user not registered, current_round_info should be null"""
        tournament_id = "a0a60a06-65a3-4707-aa42-545a7da08dff"
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{tournament_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        # User not registered, so current_round_info should be null
        assert data["current_round_info"] is None, \
            f"Expected null current_round_info for unregistered user, got: {data['current_round_info']}"


class TestLiveScreenAPI:
    """Test the live screen API used when Pronostici tab routes to /live/{matchdayId}"""
    
    def test_live_endpoint_exists(self, auth_token):
        """Verify /api/live/{matchdayId} endpoint works"""
        matchday_id = "040552b8-0e2a-4cd8-b52e-030e27d93560"
        league_id = "f1373417-43aa-4043-b6a2-125873181c95"
        
        response = requests.get(
            f"{BASE_URL}/api/live/{matchday_id}?league_id={league_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # API should return 200 with live data
        assert response.status_code == 200, f"Live endpoint returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "matchday" in data or "matches" in data, "Live response missing expected fields"
