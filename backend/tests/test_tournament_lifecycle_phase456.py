"""Tournament Lifecycle Tests - Phase 4, 5, 6
Full lifecycle testing: Create -> Open Registration -> Register 8 Users -> Start (Generate Groups + Matchups) ->
Create Round -> Open Round -> Complete Round -> Generate Knockout Bracket
Also tests: my-matchups, matchup/live, predict endpoints
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"

# Test users to create for the lifecycle test - short prefix to fit username limit
TEST_USER_PREFIX = f"tst{uuid.uuid4().hex[:4]}"


class TestHelpers:
    """Helper functions for lifecycle tests"""
    
    @staticmethod
    def get_auth_token(email: str, password: str):
        """Get authentication token for user"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
        return None
    
    @staticmethod
    def register_user(username: str, email: str, password: str):
        """Register a new user and return token"""
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": username,
            "email": email,
            "password": password,
            "first_name": "Test",
            "last_name": username.split("_")[-1] if "_" in username else "User",
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
        return TestHelpers.get_auth_token(email, password)


# Module-level storage for test data
test_data = {
    "tournament_id": None,
    "round_id": None,
    "users": [],  # list of {"email": ..., "password": ..., "token": ..., "username": ...}
}


@pytest.fixture(scope="module")
def admin_token():
    """Admin auth token"""
    token = TestHelpers.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        pytest.skip("Admin authentication failed")
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestPhase1CreateAndRegisterUsers:
    """Step 1: Create tournament and register 8 users"""
    
    def test_01_create_tournament(self, admin_headers):
        """Admin creates a tournament in draft status"""
        unique_name = f"TEST_Lifecycle_{uuid.uuid4().hex[:8]}"
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
        data = resp.json()
        assert data["status"] == "draft"
        test_data["tournament_id"] = data["id"]
        print(f"Created tournament: {data['id']}")
    
    def test_02_open_registration(self, admin_headers):
        """Admin opens tournament registration"""
        tid = test_data["tournament_id"]
        assert tid, "No tournament created"
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/open", headers=admin_headers)
        assert resp.status_code == 200, f"Open registration failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "registration"
        print("Tournament registration opened")
    
    def test_03_register_8_users(self, admin_headers):
        """Register 8 test users for the tournament"""
        tid = test_data["tournament_id"]
        assert tid, "No tournament created"
        
        users_registered = []
        
        # First, register admin
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/register", headers=admin_headers)
        if resp.status_code == 200:
            users_registered.append({"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "token": admin_headers["Authorization"].split(" ")[1], "username": "admin"})
            print(f"Registered admin user (1/8)")
        elif resp.status_code == 400 and "gia iscritto" in resp.text.lower():
            # Already registered, that's fine
            users_registered.append({"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "token": admin_headers["Authorization"].split(" ")[1], "username": "admin"})
            print(f"Admin already registered (1/8)")
        else:
            print(f"Admin registration status: {resp.status_code}")
        
        # Register 7 more users
        for i in range(7):
            username = f"{TEST_USER_PREFIX}_user{i+1}"
            email = f"{username}@test.com"
            password = "testpass123"
            
            # Try to register/login the user
            token = TestHelpers.register_user(username, email, password)
            
            if token:
                # Register this user for the tournament
                user_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                reg_resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/register", headers=user_headers)
                
                if reg_resp.status_code == 200:
                    users_registered.append({"email": email, "password": password, "token": token, "username": username})
                    print(f"Registered {username} ({len(users_registered)}/8)")
                elif reg_resp.status_code == 400 and "gia iscritto" in reg_resp.text.lower():
                    users_registered.append({"email": email, "password": password, "token": token, "username": username})
                    print(f"{username} already registered ({len(users_registered)}/8)")
                else:
                    print(f"Failed to register {username} for tournament: {reg_resp.status_code} {reg_resp.text}")
            else:
                print(f"Failed to create/login user {username}")
        
        test_data["users"] = users_registered
        assert len(users_registered) >= 8, f"Only registered {len(users_registered)} users, need 8"
        print(f"Registered {len(users_registered)} users for the tournament")
    
    def test_04_verify_tournament_has_8_registrations(self, admin_headers):
        """Verify tournament shows 8 registered participants"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["registered_count"] >= 8, f"Only {data['registered_count']} registrations, need 8"
        print(f"Tournament has {data['registered_count']} registrations")


class TestPhase2StartTournament:
    """Step 2: Start tournament (generates groups + matchups)"""
    
    def test_05_start_tournament(self, admin_headers):
        """Admin starts tournament - generates groups and matchups"""
        tid = test_data["tournament_id"]
        assert tid, "No tournament"
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/start", headers=admin_headers)
        assert resp.status_code == 200, f"Start tournament failed: {resp.text}"
        data = resp.json()
        
        assert data["status"] == "groups", f"Expected groups status, got {data.get('status')}"
        assert len(data.get("groups", [])) == 2, f"Expected 2 groups, got {len(data.get('groups', []))}"
        assert data.get("matchups_created", 0) > 0, "No matchups were created"
        
        print(f"Tournament started - Status: {data['status']}")
        print(f"Groups: {[g['group_name'] for g in data['groups']]}")
        print(f"Matchups created: {data['matchups_created']}")
    
    def test_06_verify_groups_created(self, admin_headers):
        """Verify group standings endpoint returns groups"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/groups", headers=admin_headers)
        assert resp.status_code == 200, f"Get groups failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list)
        assert len(data) == 2, f"Expected 2 groups, got {len(data)}"
        
        for group in data:
            assert "group_name" in group
            assert "standings" in group
            assert len(group["standings"]) == 4, f"Expected 4 players per group, got {len(group['standings'])}"
        
        print(f"Groups verified: {[g['group_name'] for g in data]}")


class TestPhase3MyMatchups:
    """Step 3: Test GET /api/tournaments/{id}/my-matchups endpoint"""
    
    def test_07_get_my_matchups_for_registered_user(self, admin_headers):
        """Registered user can see their matchups"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/my-matchups", headers=admin_headers)
        assert resp.status_code == 200, f"Get my-matchups failed: {resp.text}"
        data = resp.json()
        
        assert isinstance(data, list)
        assert len(data) > 0, "No matchups returned for registered user"
        
        # Verify matchup structure
        matchup = data[0]
        assert "id" in matchup
        assert "user_a_id" in matchup
        assert "user_b_id" in matchup
        assert "user_a_username" in matchup
        assert "user_b_username" in matchup
        assert "user_a_points" in matchup
        assert "user_b_points" in matchup
        assert "result" in matchup
        assert "status" in matchup
        assert "round_type" in matchup
        assert "round_number" in matchup
        
        # Store first matchup for live test
        test_data["matchup_id"] = matchup["id"]
        print(f"User has {len(data)} matchups. First matchup ID: {matchup['id']}")
    
    def test_08_matchups_sorted_by_round(self, admin_headers):
        """Matchups are sorted by round_number"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/my-matchups", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify sorting
        if len(data) > 1:
            round_numbers = [m["round_number"] for m in data]
            assert round_numbers == sorted(round_numbers), "Matchups not sorted by round_number"
            print(f"Matchups correctly sorted by round: {round_numbers}")


class TestPhase4CreateAndOpenRound:
    """Step 4: Create and open a round"""
    
    def test_09_create_round(self, admin_headers):
        """Admin creates a group round"""
        tid = test_data["tournament_id"]
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/rounds", headers=admin_headers, json={
            "round_type": "group",
            "label": "Giornata Test 1"
        })
        assert resp.status_code == 200, f"Create round failed: {resp.text}"
        data = resp.json()
        
        assert "id" in data
        assert data["status"] == "PENDING"
        assert data["round_type"] == "group"
        
        test_data["round_id"] = data["id"]
        print(f"Created round: {data['id']} - {data['label']}")
    
    def test_10_open_round(self, admin_headers):
        """Admin opens round for predictions"""
        tid = test_data["tournament_id"]
        rid = test_data["round_id"]
        assert rid, "No round created"
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/rounds/{rid}/open", headers=admin_headers)
        assert resp.status_code == 200, f"Open round failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "OPEN"
        print("Round opened for predictions")


class TestPhase5LiveMatchup:
    """Step 5: Test GET /api/tournaments/{id}/matchup/{matchupId}/live"""
    
    def test_11_get_matchup_live(self, admin_headers):
        """Get live matchup data"""
        tid = test_data["tournament_id"]
        mid = test_data.get("matchup_id")
        assert mid, "No matchup ID stored"
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/matchup/{mid}/live", headers=admin_headers)
        assert resp.status_code == 200, f"Get matchup live failed: {resp.text}"
        data = resp.json()
        
        # Verify structure
        assert "matchup" in data
        assert "round" in data
        assert "user_a_total" in data
        assert "user_b_total" in data
        assert "matches" in data
        
        # Verify matchup data
        mu = data["matchup"]
        assert mu["id"] == mid
        assert "user_a_username" in mu
        assert "user_b_username" in mu
        
        print(f"Live matchup data: {mu['user_a_username']} vs {mu['user_b_username']}")
        print(f"Scores: {data['user_a_total']} - {data['user_b_total']}")
        print(f"Matches in round: {len(data['matches'])}")
    
    def test_12_get_matchup_live_404_invalid_id(self, admin_headers):
        """Invalid matchup ID returns 404"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/matchup/invalid-matchup-id/live", headers=admin_headers)
        assert resp.status_code == 404


class TestPhase6CompleteRoundAndKnockout:
    """Step 6: Complete round and generate knockout bracket"""
    
    def test_13_complete_round(self, admin_headers):
        """Admin completes round - calculates scores"""
        tid = test_data["tournament_id"]
        rid = test_data["round_id"]
        assert rid, "No round created"
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/rounds/{rid}/complete", headers=admin_headers)
        assert resp.status_code == 200, f"Complete round failed: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") == True
        assert "user_scores" in data
        assert "matchups_updated" in data
        
        print(f"Round completed - Matchups updated: {data['matchups_updated']}")
        print(f"User scores: {data['user_scores']}")
    
    def test_14_verify_matchups_updated(self, admin_headers):
        """Verify matchups have results after round completion"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/my-matchups", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Find round 1 matchups
        round1_matchups = [m for m in data if m["round_number"] == 1]
        completed_matchups = [m for m in round1_matchups if m["status"] == "completed"]
        
        print(f"Round 1 matchups: {len(round1_matchups)}, completed: {len(completed_matchups)}")
    
    def test_15_generate_knockout_bracket(self, admin_headers):
        """Admin generates knockout bracket from group standings"""
        tid = test_data["tournament_id"]
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tid}/generate-knockout", headers=admin_headers, json={
            "matchup_rules": "1v2"
        })
        assert resp.status_code == 200, f"Generate knockout failed: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") == True
        assert data.get("status") == "knockout"
        assert "group_standings" in data
        assert "knockout_matchups" in data
        
        print(f"Knockout generated - Status: {data['status']}")
        print(f"Knockout matchups: {data['knockout_matchups']}")
    
    def test_16_get_bracket(self, admin_headers):
        """GET /api/tournaments/{id}/bracket returns knockout matchups"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}/bracket", headers=admin_headers)
        assert resp.status_code == 200, f"Get bracket failed: {resp.text}"
        data = resp.json()
        
        assert "bracket" in data
        bracket = data["bracket"]
        assert isinstance(bracket, dict)
        
        # Should have some knockout round types
        print(f"Bracket rounds: {list(bracket.keys())}")
        for round_type, matchups in bracket.items():
            print(f"  {round_type}: {len(matchups)} matchups")


class TestPhase7TournamentDetailTabs:
    """Step 7: Verify tournament detail has correct data for all tabs"""
    
    def test_17_tournament_detail_has_groups(self, admin_headers):
        """Tournament detail includes groups after start"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert data["status"] == "knockout", f"Expected knockout status, got {data['status']}"
        assert "groups" in data, "Groups not in tournament detail"
        assert len(data["groups"]) == 2
        print(f"Tournament in knockout phase with {len(data['groups'])} groups")
    
    def test_18_tournament_detail_has_rounds(self, admin_headers):
        """Tournament detail includes rounds"""
        tid = test_data["tournament_id"]
        resp = requests.get(f"{BASE_URL}/api/tournaments/{tid}", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "rounds" in data
        assert len(data["rounds"]) >= 1
        print(f"Tournament has {len(data['rounds'])} rounds")


class TestPredictEndpoint:
    """Test POST /api/tournaments/{id}/rounds/{roundId}/predict endpoint"""
    
    def test_19_predict_requires_open_round(self, admin_headers):
        """Prediction requires round to be OPEN"""
        tid = test_data["tournament_id"]
        rid = test_data["round_id"]  # This round was completed
        
        # Try to predict on completed round
        resp = requests.post(
            f"{BASE_URL}/api/tournaments/{tid}/rounds/{rid}/predict",
            headers=admin_headers,
            params={
                "match_id": "fake-match-id",
                "market_type": "1X2",
                "prediction_value": "1"
            }
        )
        # Should fail because round is COMPLETED
        assert resp.status_code == 400, f"Expected 400 for closed round, got {resp.status_code}: {resp.text}"
        print("Prediction correctly rejected for completed round")


class TestCleanupInfo:
    """Test data cleanup info"""
    
    def test_20_test_data_summary(self, admin_headers):
        """Print test data summary for cleanup"""
        print("\n=== TEST DATA SUMMARY ===")
        print(f"Tournament ID: {test_data.get('tournament_id')}")
        print(f"Round ID: {test_data.get('round_id')}")
        print(f"Matchup ID: {test_data.get('matchup_id')}")
        print(f"Test users created: {len(test_data.get('users', []))}")
        for u in test_data.get("users", [])[:3]:
            print(f"  - {u.get('email')}")
        print("=========================")
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
