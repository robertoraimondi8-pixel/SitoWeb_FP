"""Tournament Lifecycle Tests - Phase 4, 5, 6
Full lifecycle testing for tournament features.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL environment variable must be set"

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"

# Short prefix for usernames (must be 3-20 chars)
PREFIX = f"t{uuid.uuid4().hex[:4]}"


def get_auth_token(email: str, password: str):
    """Get authentication token for user"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    if resp.status_code == 200:
        return resp.json().get("access_token")
    return None


def register_user(username: str, email: str, password: str = "testpass123"):
    """Register a new user and return token"""
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
        "first_name": "Test",
        "last_name": f"User{username[-1]}",
        "date_of_birth": "1990-01-15",
        "address": "Via Test 1",
        "city": "Rome",
        "country": "Italy",
        "postal_code": "00100",
        "accepted_privacy": True,
        "accepted_terms": True
    })
    if resp.status_code == 200:
        return resp.json().get("access_token")
    # Maybe already exists, try login
    return get_auth_token(email, password)


@pytest.fixture(scope="session")
def admin_token():
    """Admin auth token"""
    token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        pytest.skip("Admin authentication failed")
    return token


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def test_users():
    """Create and return 8 test users with tokens"""
    users = []
    
    # Admin counts as user 1
    admin_token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if admin_token:
        users.append({
            "username": "admin", 
            "email": ADMIN_EMAIL, 
            "token": admin_token,
            "headers": {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        })
    
    # Create 7 more users
    for i in range(1, 8):
        username = f"{PREFIX}u{i}"  # e.g. "t1234u1" - 7 chars
        email = f"{username}@test.com"
        token = register_user(username, email)
        if token:
            users.append({
                "username": username,
                "email": email,
                "token": token,
                "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            })
            print(f"Created user {username}")
        else:
            print(f"Failed to create user {username}")
    
    return users


@pytest.fixture(scope="session")
def lifecycle_tournament(admin_headers, test_users):
    """Create a tournament with 8 participants and start it"""
    # Step 1: Create tournament
    unique_name = f"TEST_LC_{PREFIX}"
    resp = requests.post(f"{BASE_URL}/api/tournaments", headers=admin_headers, json={
        "name": unique_name,
        "max_participants": 8,
        "duration_rounds": 3,
        "groups_count": 2,
        "players_per_group": 4,
        "advance_count": 2,
        "entry_fee": 0.0
    })
    assert resp.status_code == 200, f"Create tournament failed: {resp.text}"
    tournament = resp.json()
    tournament_id = tournament["id"]
    print(f"Created tournament: {tournament_id}")
    
    # Step 2: Open registration
    resp = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/open", headers=admin_headers)
    assert resp.status_code == 200, f"Open registration failed: {resp.text}"
    print("Registration opened")
    
    # Step 3: Register all test users
    registered_count = 0
    for user in test_users[:8]:  # Only need 8
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/register", headers=user["headers"])
        if resp.status_code == 200:
            registered_count += 1
            print(f"Registered {user['username']} ({registered_count}/8)")
        elif resp.status_code == 400 and "gia iscritto" in resp.text.lower():
            registered_count += 1
            print(f"{user['username']} already registered ({registered_count}/8)")
        else:
            print(f"Failed to register {user['username']}: {resp.status_code} {resp.text}")
    
    assert registered_count >= 8, f"Only registered {registered_count}/8 users"
    
    # Step 4: Start tournament (generates groups and matchups)
    resp = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/start", headers=admin_headers)
    assert resp.status_code == 200, f"Start tournament failed: {resp.text}"
    data = resp.json()
    assert data["status"] == "groups", f"Expected groups status, got {data.get('status')}"
    print(f"Tournament started with {len(data.get('groups', []))} groups, {data.get('matchups_created', 0)} matchups")
    
    return {
        "id": tournament_id,
        "name": unique_name,
        "groups": data.get("groups", []),
        "matchups_created": data.get("matchups_created", 0)
    }


# =======================
# Phase 4-6 Tests
# =======================

class TestMyMatchupsEndpoint:
    """Test GET /api/tournaments/{id}/my-matchups"""
    
    def test_my_matchups_returns_list(self, admin_headers, lifecycle_tournament):
        """Registered user can get their matchups"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/my-matchups", headers=admin_headers)
        assert resp.status_code == 200, f"Get my-matchups failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list)
        assert len(data) > 0, "No matchups returned for registered user"
        print(f"User has {len(data)} matchups")
    
    def test_matchup_structure(self, admin_headers, lifecycle_tournament):
        """Matchup has all required fields"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/my-matchups", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        matchup = data[0]
        required_fields = ["id", "user_a_id", "user_b_id", "user_a_username", "user_b_username",
                          "user_a_points", "user_b_points", "result", "status", "round_type", "round_number"]
        for field in required_fields:
            assert field in matchup, f"Missing field: {field}"
        print(f"Matchup structure valid: {matchup['user_a_username']} vs {matchup['user_b_username']}")
    
    def test_matchups_sorted_by_round(self, admin_headers, lifecycle_tournament):
        """Matchups are sorted by round_number"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/my-matchups", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        round_numbers = [m["round_number"] for m in data]
        assert round_numbers == sorted(round_numbers), "Matchups not sorted by round"


class TestLiveMatchupEndpoint:
    """Test GET /api/tournaments/{id}/matchup/{matchupId}/live"""
    
    def test_live_matchup_returns_data(self, admin_headers, lifecycle_tournament):
        """Get live matchup data"""
        tid = lifecycle_tournament["id"]
        
        # First get a matchup ID
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/my-matchups", headers=admin_headers)
        assert resp.status_code == 200
        matchups = resp.json()
        assert len(matchups) > 0, "No matchups to test"
        
        matchup_id = matchups[0]["id"]
        
        # Get live data
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/matchup/{matchup_id}/live", headers=admin_headers)
        assert resp.status_code == 200, f"Get matchup live failed: {resp.text}"
        data = resp.json()
        
        # Verify structure
        assert "matchup" in data
        assert "round" in data
        assert "user_a_total" in data
        assert "user_b_total" in data
        assert "matches" in data
        
        print(f"Live: {data['matchup']['user_a_username']} ({data['user_a_total']}) vs {data['matchup']['user_b_username']} ({data['user_b_total']})")
    
    def test_live_matchup_404_invalid_id(self, admin_headers, lifecycle_tournament):
        """Invalid matchup ID returns 404"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/matchup/invalid-id/live", headers=admin_headers)
        assert resp.status_code == 404


class TestRoundManagement:
    """Test round creation and opening"""
    
    def test_create_round(self, admin_headers, lifecycle_tournament):
        """Admin can create a group round"""
        tid = lifecycle_tournament["id"]
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/rounds", headers=admin_headers, json={
            "round_type": "group",
            "label": "Test Giornata 1"
        })
        assert resp.status_code == 200, f"Create round failed: {resp.text}"
        data = resp.json()
        
        assert "id" in data
        assert data["status"] == "PENDING"
        lifecycle_tournament["round_id"] = data["id"]
        print(f"Created round: {data['id']}")
    
    def test_open_round(self, admin_headers, lifecycle_tournament):
        """Admin can open a round for predictions"""
        tid = lifecycle_tournament["id"]
        rid = lifecycle_tournament.get("round_id")
        if not rid:
            pytest.skip("No round created")
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/rounds/{rid}/open", headers=admin_headers)
        assert resp.status_code == 200, f"Open round failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "OPEN"
        print("Round opened for predictions")


class TestCompleteRoundAndKnockout:
    """Test round completion and knockout generation"""
    
    def test_complete_round(self, admin_headers, lifecycle_tournament):
        """Admin can complete a round"""
        tid = lifecycle_tournament["id"]
        rid = lifecycle_tournament.get("round_id")
        if not rid:
            pytest.skip("No round created")
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/rounds/{rid}/complete", headers=admin_headers)
        assert resp.status_code == 200, f"Complete round failed: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") == True
        assert "user_scores" in data
        print(f"Round completed - Matchups updated: {data.get('matchups_updated', 0)}")
    
    def test_generate_knockout(self, admin_headers, lifecycle_tournament):
        """Admin can generate knockout bracket"""
        tid = lifecycle_tournament["id"]
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/generate-knockout", headers=admin_headers, json={
            "matchup_rules": "1v2"
        })
        assert resp.status_code == 200, f"Generate knockout failed: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") == True
        assert data.get("status") == "knockout"
        print(f"Knockout generated - {len(data.get('knockout_matchups', []))} matchups")
    
    def test_get_bracket(self, admin_headers, lifecycle_tournament):
        """GET /api/tournaments/{id}/bracket returns knockout matchups"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/bracket", headers=admin_headers)
        assert resp.status_code == 200, f"Get bracket failed: {resp.text}"
        data = resp.json()
        
        assert "bracket" in data
        print(f"Bracket rounds: {list(data['bracket'].keys())}")


class TestGroupStandings:
    """Test group standings endpoint"""
    
    def test_get_groups(self, admin_headers, lifecycle_tournament):
        """GET /api/tournaments/{id}/groups returns standings"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/groups", headers=admin_headers)
        assert resp.status_code == 200, f"Get groups failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list)
        assert len(data) == 2, f"Expected 2 groups, got {len(data)}"
        
        for g in data:
            assert "group_name" in g
            assert "standings" in g
            assert len(g["standings"]) == 4
        print(f"Groups: {[g['group_name'] for g in data]}")


class TestTournamentDetail:
    """Test tournament detail endpoint after lifecycle"""
    
    def test_tournament_detail_has_groups(self, admin_headers, lifecycle_tournament):
        """Tournament detail includes groups"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "groups" in data
        assert len(data["groups"]) == 2
    
    def test_tournament_detail_has_rounds(self, admin_headers, lifecycle_tournament):
        """Tournament detail includes rounds"""
        tid = lifecycle_tournament["id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "rounds" in data
        print(f"Tournament has {len(data['rounds'])} rounds")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
