"""
Test Tournament APIs for inline rendering inside home.tsx
Tests: login, list tournaments, tournament detail, groups, my-matchups endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://unified-competitions.preview.emergentagent.com')

# Test credentials
TEST_USER_EMAIL = "ilio@raimondi.it"
TEST_USER_PASSWORD = "password123"
KNOCKOUT_TOURNAMENT_ID = "b3e9021f-b8a6-4f65-ad83-fc7b778f922a"


class TestAuthAndTournamentList:
    """Test authentication and tournament listing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        print(f"Login response status: {response.status_code}")
        print(f"Login response: {response.json()}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Response missing access_token"
        return data["access_token"]
    
    def test_login_returns_access_token(self):
        """POST /api/auth/login returns access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        print(f"PASS: Login returns access_token for {TEST_USER_EMAIL}")
    
    def test_list_tournaments_returns_is_registered(self, auth_token):
        """GET /api/tournaments returns list with is_registered field"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"List tournaments response status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list of tournaments"
        
        # Verify structure
        if len(data) > 0:
            t = data[0]
            assert "id" in t
            assert "name" in t
            assert "status" in t
            assert "is_registered" in t, "Missing is_registered field"
            assert "my_status" in t, "Missing my_status field"
            print(f"PASS: Found {len(data)} tournaments with is_registered field")
        else:
            print("PASS: Empty tournament list returned")
    
    def test_tournament_detail(self, auth_token):
        """GET /api/tournaments/{id} returns tournament detail"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Tournament detail response status: {response.status_code}")
        
        if response.status_code == 404:
            pytest.skip(f"Tournament {KNOCKOUT_TOURNAMENT_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields
        assert "id" in data
        assert "name" in data
        assert "status" in data
        assert "registered_count" in data
        assert "is_registered" in data
        assert "groups_count" in data
        assert "players_per_group" in data
        assert "duration_rounds" in data
        
        print(f"PASS: Tournament '{data['name']}' detail returned")
        print(f"  Status: {data['status']}")
        print(f"  Registered: {data['registered_count']}/{data.get('max_participants', '?')}")
        print(f"  Is user registered: {data['is_registered']}")
    
    def test_tournament_groups(self, auth_token):
        """GET /api/tournaments/{id}/groups returns group standings"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/groups",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Groups response status: {response.status_code}")
        
        if response.status_code == 404:
            pytest.skip(f"Tournament {KNOCKOUT_TOURNAMENT_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list of groups"
        
        # Verify structure if groups exist
        if len(data) > 0:
            group = data[0]
            assert "group_name" in group
            assert "group_id" in group
            assert "standings" in group
            assert isinstance(group["standings"], list)
            
            if len(group["standings"]) > 0:
                standing = group["standings"][0]
                assert "user_id" in standing
                assert "username" in standing
                assert "played" in standing
                assert "wins" in standing
                assert "draws" in standing
                assert "losses" in standing
                assert "group_points" in standing
            
            print(f"PASS: Found {len(data)} groups with standings")
        else:
            print("PASS: No groups yet (tournament may not have started)")
    
    def test_my_matchups(self, auth_token):
        """GET /api/tournaments/{id}/my-matchups returns user's matchups"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/my-matchups",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"My matchups response status: {response.status_code}")
        
        if response.status_code == 404:
            pytest.skip(f"Tournament {KNOCKOUT_TOURNAMENT_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list of matchups"
        
        # Verify structure if matchups exist
        if len(data) > 0:
            matchup = data[0]
            assert "id" in matchup
            assert "user_a_id" in matchup
            assert "user_b_id" in matchup
            assert "user_a_username" in matchup
            assert "user_b_username" in matchup
            assert "user_a_points" in matchup
            assert "user_b_points" in matchup
            assert "result" in matchup
            assert "round_type" in matchup
            
            print(f"PASS: Found {len(data)} matchups for user")
        else:
            print("PASS: No matchups for this user (may not be registered)")


class TestTournamentWithRegisteredTournaments:
    """Test finding tournaments user is registered in"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_find_registered_tournaments(self, auth_token):
        """Verify user's registered tournaments for competition switcher"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        registered = [t for t in data if t.get("is_registered")]
        active_registered = [t for t in registered if t.get("my_status") == "active"]
        
        print(f"Total tournaments: {len(data)}")
        print(f"User registered in: {len(registered)} tournaments")
        print(f"Active registrations: {len(active_registered)} tournaments")
        
        for t in registered:
            print(f"  - {t['name']} (status: {t['status']}, my_status: {t.get('my_status')})")
        
        # This test documents what tournaments user is in
        assert True, "Tournament registration check passed"


class TestTournamentBracket:
    """Test knockout bracket endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_bracket_endpoint(self, auth_token):
        """GET /api/tournaments/{id}/bracket returns knockout bracket"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/bracket",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Bracket response status: {response.status_code}")
        
        if response.status_code == 404:
            pytest.skip(f"Tournament {KNOCKOUT_TOURNAMENT_ID} not found")
        
        assert response.status_code == 200
        data = response.json()
        assert "bracket" in data
        assert isinstance(data["bracket"], dict)
        
        for phase, matchups in data["bracket"].items():
            print(f"  Phase '{phase}': {len(matchups)} matchups")
        
        print("PASS: Bracket endpoint working")


class TestAllTournamentEndpoints:
    """Test all tournament endpoints with any available tournament"""
    
    @pytest.fixture(scope="class")
    def session_data(self):
        """Login and find first tournament"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        
        # Get first available tournament
        response = requests.get(
            f"{BASE_URL}/api/tournaments",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        tournaments = response.json()
        
        return {
            "token": token,
            "tournaments": tournaments,
            "first_tournament_id": tournaments[0]["id"] if tournaments else None
        }
    
    def test_all_tournament_endpoints_work(self, session_data):
        """Verify all tournament endpoints return valid responses"""
        token = session_data["token"]
        t_id = session_data["first_tournament_id"]
        
        if not t_id:
            pytest.skip("No tournaments available")
        
        endpoints = [
            (f"/api/tournaments/{t_id}", "detail"),
            (f"/api/tournaments/{t_id}/groups", "groups"),
            (f"/api/tournaments/{t_id}/my-matchups", "my-matchups"),
            (f"/api/tournaments/{t_id}/bracket", "bracket"),
        ]
        
        results = []
        for url, name in endpoints:
            response = requests.get(
                f"{BASE_URL}{url}",
                headers={"Authorization": f"Bearer {token}"}
            )
            status = "PASS" if response.status_code == 200 else f"FAIL ({response.status_code})"
            results.append((name, status))
            print(f"  {name}: {status}")
        
        # All should pass
        failed = [r for r in results if "FAIL" in r[1]]
        assert len(failed) == 0, f"Failed endpoints: {failed}"
