"""Tournament Module Tests - Phase 1 Backend
Tests all tournament CRUD operations, registration flow, and admin operations.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"

# Existing tournament for testing
EXISTING_TOURNAMENT_ID = "f5177cbd-29bf-4974-8046-e4d4a898531c"


class TestAuthenticationSetup:
    """Authentication helpers for tournament tests"""
    
    @staticmethod
    def get_admin_token():
        """Get admin authentication token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
        return None
    
    @staticmethod
    def get_user_token():
        """Get standard user authentication token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STANDARD_USER_EMAIL,
            "password": STANDARD_USER_PASSWORD
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
        return None


@pytest.fixture(scope="module")
def admin_token():
    """Module-scoped admin token fixture"""
    token = TestAuthenticationSetup.get_admin_token()
    if not token:
        pytest.skip("Admin authentication failed")
    return token


@pytest.fixture(scope="module")
def user_token():
    """Module-scoped user token fixture"""
    token = TestAuthenticationSetup.get_user_token()
    if not token:
        pytest.skip("User authentication failed")
    return token


@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def user_headers(user_token):
    """Headers with user auth"""
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


# ===========================
# REGRESSION: Auth still works
# ===========================

class TestAuthRegression:
    """Verify existing auth endpoints still work"""
    
    def test_login_works_for_admin(self):
        """Verify admin login still works"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        # Note: is_super_admin is not returned in login response but exists in DB
        # The get_current_user middleware will fetch it from DB for tournament checks
        assert data.get("user", {}).get("role") == "admin"
    
    def test_login_works_for_standard_user(self):
        """Verify standard user login still works"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STANDARD_USER_EMAIL,
            "password": STANDARD_USER_PASSWORD
        })
        assert resp.status_code == 200, f"User login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data


# ===========================
# ADMIN: Tournament CRUD
# ===========================

class TestAdminCreateTournament:
    """Test admin tournament creation endpoint"""
    
    def test_create_tournament_requires_admin(self, user_headers):
        """Non-admin gets 403 when creating tournament"""
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=user_headers, json={
            "name": "TEST_User_Tournament",
            "max_participants": 8,
            "duration_rounds": 3,
            "groups_count": 2,
            "players_per_group": 4,
            "advance_count": 2,
            "entry_fee": 0.0
        })
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
    
    def test_create_tournament_success(self, admin_headers):
        """Admin can create a tournament"""
        unique_name = f"TEST_Tournament_{uuid.uuid4().hex[:8]}"
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
        
        # Validate structure
        assert "id" in data
        assert data["name"] == unique_name
        assert data["status"] == "draft"
        assert data["max_participants"] == 8
        assert data["groups_count"] == 2
        assert data["players_per_group"] == 4
        assert data["advance_count"] == 2
        assert data["current_round"] == 0
        
        # Store for cleanup
        TestAdminCreateTournament.created_tournament_id = data["id"]
    
    def test_create_tournament_validation_fails_bad_participant_count(self, admin_headers):
        """Validation: max_participants != groups_count * players_per_group"""
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=admin_headers, json={
            "name": "TEST_BadCount",
            "max_participants": 10,  # Should be 8 = 2*4
            "duration_rounds": 3,
            "groups_count": 2,
            "players_per_group": 4,
            "advance_count": 2,
            "entry_fee": 0.0
        })
        assert resp.status_code == 400, f"Expected 400 validation error, got {resp.status_code}"
    
    def test_create_tournament_validation_fails_advance_count(self, admin_headers):
        """Validation: advance_count >= players_per_group should fail"""
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=admin_headers, json={
            "name": "TEST_BadAdvance",
            "max_participants": 8,
            "duration_rounds": 3,
            "groups_count": 2,
            "players_per_group": 4,
            "advance_count": 4,  # Should be < 4
            "entry_fee": 0.0
        })
        assert resp.status_code == 400, f"Expected 400 validation error, got {resp.status_code}"


class TestAdminOpenRegistration:
    """Test opening tournament for registration"""
    
    def test_open_registration_requires_admin(self, user_headers):
        """Non-admin cannot open registration"""
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/open", headers=user_headers)
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
    
    def test_open_registration_success(self, admin_headers):
        """Admin can open registration for a draft tournament"""
        # First create a fresh tournament
        unique_name = f"TEST_OpenReg_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/tournaments", headers=admin_headers, json={
            "name": unique_name,
            "max_participants": 8,
            "duration_rounds": 3,
            "groups_count": 2,
            "players_per_group": 4,
            "advance_count": 2,
            "entry_fee": 0.0
        })
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        tournament_id = create_resp.json()["id"]
        
        # Now open registration
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/open", headers=admin_headers)
        assert resp.status_code == 200, f"Open registration failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
        assert data.get("status") == "registration"
        
        # Store for later tests
        TestAdminOpenRegistration.open_tournament_id = tournament_id
    
    def test_open_registration_fails_if_not_draft(self, admin_headers):
        """Cannot open registration if not in draft status"""
        # EXISTING_TOURNAMENT_ID is already in registration status
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/open", headers=admin_headers)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"


# ===========================
# LIST & DETAIL
# ===========================

class TestListTournaments:
    """Test tournament listing endpoint"""
    
    def test_list_tournaments_requires_auth(self):
        """Listing tournaments requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/tournaments")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
    
    def test_list_tournaments_excludes_drafts(self, user_headers):
        """GET /api/tournaments excludes draft tournaments"""
        resp = requests.get(f"{BASE_URL}/api/tournaments", headers=user_headers)
        assert resp.status_code == 200, f"List failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        
        # Verify no drafts in list
        for t in data:
            assert t.get("status") != "draft", f"Draft tournament in list: {t.get('name')}"
            # Verify enriched fields
            assert "registered_count" in t
            assert "spots_left" in t
            assert "is_registered" in t
    
    def test_existing_tournament_in_list(self, user_headers):
        """Verify existing tournament appears in list"""
        resp = requests.get(f"{BASE_URL}/api/tournaments", headers=user_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        tournament_ids = [t["id"] for t in data]
        assert EXISTING_TOURNAMENT_ID in tournament_ids, "Existing tournament not in list"


class TestTournamentDetail:
    """Test tournament detail endpoint"""
    
    def test_get_tournament_detail(self, user_headers):
        """GET /api/tournaments/{id} returns full detail"""
        resp = requests.get(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}", headers=user_headers)
        assert resp.status_code == 200, f"Get detail failed: {resp.text}"
        data = resp.json()
        
        # Verify structure
        assert data["id"] == EXISTING_TOURNAMENT_ID
        assert "name" in data
        assert "status" in data
        assert "max_participants" in data
        assert "registered_count" in data
        assert "spots_left" in data
        assert "is_registered" in data
        assert "rounds" in data
    
    def test_get_nonexistent_tournament(self, user_headers):
        """GET /api/tournaments/{fake_id} returns 404"""
        resp = requests.get(f"{BASE_URL}/api/tournaments/nonexistent-id-123", headers=user_headers)
        assert resp.status_code == 404


# ===========================
# REGISTRATION
# ===========================

class TestTournamentRegistration:
    """Test user registration flow"""
    
    def test_register_requires_auth(self):
        """Registration requires authentication"""
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/register")
        assert resp.status_code == 401
    
    def test_register_for_tournament(self, admin_headers):
        """Admin can register for a tournament"""
        # First create and open a fresh tournament
        unique_name = f"TEST_RegFlow_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/tournaments", headers=admin_headers, json={
            "name": unique_name,
            "max_participants": 8,
            "duration_rounds": 3,
            "groups_count": 2,
            "players_per_group": 4,
            "advance_count": 2,
            "entry_fee": 0.0
        })
        tournament_id = create_resp.json()["id"]
        
        # Open registration
        requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/open", headers=admin_headers)
        
        # Register
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/register", headers=admin_headers)
        assert resp.status_code == 200, f"Registration failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
        assert "registration" in data
        assert data["registration"]["status"] == "active"
        
        # Store for later
        TestTournamentRegistration.reg_tournament_id = tournament_id
    
    def test_duplicate_registration_fails(self, admin_headers):
        """Duplicate registration returns 400"""
        tournament_id = getattr(TestTournamentRegistration, 'reg_tournament_id', None)
        if not tournament_id:
            pytest.skip("No tournament from previous test")
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/register", headers=admin_headers)
        assert resp.status_code == 400, f"Expected 400 for duplicate, got {resp.status_code}"
    
    def test_unregister_from_tournament(self, admin_headers):
        """User can unregister during registration phase"""
        tournament_id = getattr(TestTournamentRegistration, 'reg_tournament_id', None)
        if not tournament_id:
            pytest.skip("No tournament from previous test")
        
        resp = requests.delete(f"{BASE_URL}/api/tournaments/{tournament_id}/register", headers=admin_headers)
        assert resp.status_code == 200, f"Unregister failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True
    
    def test_unregister_when_not_registered(self, admin_headers):
        """Unregister when not registered returns 404"""
        tournament_id = getattr(TestTournamentRegistration, 'reg_tournament_id', None)
        if not tournament_id:
            pytest.skip("No tournament from previous test")
        
        resp = requests.delete(f"{BASE_URL}/api/tournaments/{tournament_id}/register", headers=admin_headers)
        assert resp.status_code == 404


# ===========================
# START TOURNAMENT (Generate Groups)
# ===========================

class TestStartTournament:
    """Test tournament start flow"""
    
    def test_start_requires_admin(self, user_headers):
        """Non-admin cannot start tournament"""
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/start", headers=user_headers)
        assert resp.status_code == 403
    
    def test_start_requires_enough_participants(self, admin_headers):
        """Starting tournament with insufficient participants fails"""
        # EXISTING_TOURNAMENT_ID has 2 participants, needs 8
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/start", headers=admin_headers)
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        # Verify error message mentions participant count
        assert "iscritti" in resp.text.lower() or "servono" in resp.text.lower()


# ===========================
# GROUP STANDINGS
# ===========================

class TestGroupStandings:
    """Test group standings endpoint"""
    
    def test_get_groups_requires_auth(self):
        """Group standings requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/groups")
        assert resp.status_code == 401
    
    def test_get_groups_empty_for_registration_phase(self, user_headers):
        """Groups endpoint returns empty for tournament not yet started"""
        resp = requests.get(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/groups", headers=user_headers)
        assert resp.status_code == 200, f"Get groups failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
        # Since tournament is in registration phase, no groups yet
        assert len(data) == 0, "Expected no groups for registration-phase tournament"


# ===========================
# ROUNDS
# ===========================

class TestTournamentRounds:
    """Test round creation and management"""
    
    def test_create_round_requires_admin(self, user_headers):
        """Non-admin cannot create round"""
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/rounds", 
                           headers=user_headers, 
                           json={"round_type": "group"})
        assert resp.status_code == 403
    
    def test_create_round_fails_for_registration_phase(self, admin_headers):
        """Cannot create round when tournament is in registration phase"""
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/rounds",
                           headers=admin_headers,
                           json={"round_type": "group"})
        # Tournament is in registration status, rounds only created for groups/knockout
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"


class TestOpenRound:
    """Test round opening for predictions"""
    
    def test_open_round_nonexistent(self, admin_headers):
        """Opening nonexistent round returns 404"""
        resp = requests.post(f"{BASE_URL}/api/tournaments/{EXISTING_TOURNAMENT_ID}/rounds/fake-round-id/open",
                           headers=admin_headers)
        assert resp.status_code == 404


# ===========================
# REGRESSION: League endpoints still work
# ===========================

class TestLeagueRegression:
    """Verify existing league endpoints still work"""
    
    def test_list_leagues_still_works(self, user_headers):
        """GET /api/leagues still returns leagues"""
        resp = requests.get(f"{BASE_URL}/api/leagues", headers=user_headers)
        assert resp.status_code == 200, f"List leagues failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
    
    def test_api_root_still_works(self):
        """GET /api returns API status"""
        resp = requests.get(f"{BASE_URL}/api")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "running"


# ===========================
# CLEANUP
# ===========================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_note(self):
        """Note: Test tournaments prefixed with TEST_ should be cleaned up periodically"""
        # This is just a documentation test
        # Real cleanup would require a dedicated endpoint or direct DB access
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
