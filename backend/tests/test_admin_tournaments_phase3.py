"""Admin Tournaments Console Tests - Phase 3
Tests admin-specific tournament endpoints: list with drafts, create, open registration.
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


class TestAuthSetup:
    """Authentication helpers"""
    
    @staticmethod
    def get_admin_token():
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
        return None
    
    @staticmethod
    def get_user_token():
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STANDARD_USER_EMAIL,
            "password": STANDARD_USER_PASSWORD
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
        return None


@pytest.fixture(scope="module")
def admin_token():
    token = TestAuthSetup.get_admin_token()
    if not token:
        pytest.skip("Admin authentication failed")
    return token


@pytest.fixture(scope="module")
def user_token():
    token = TestAuthSetup.get_user_token()
    if not token:
        pytest.skip("User authentication failed")
    return token


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


# ===========================
# Phase 3: Admin List Tournaments with Drafts
# ===========================

class TestAdminListTournamentsWithDrafts:
    """Test GET /api/tournaments?include_drafts=true for admin users"""
    
    def test_list_with_include_drafts_as_admin(self, admin_headers):
        """Admin with include_drafts=true gets all tournaments including drafts"""
        resp = requests.get(f"{BASE_URL}/api/tournaments?include_drafts=true", headers=admin_headers)
        assert resp.status_code == 200, f"List failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check that response contains expected fields
        if len(data) > 0:
            t = data[0]
            assert "id" in t, "Missing id field"
            assert "name" in t, "Missing name field"
            assert "status" in t, "Missing status field"
            assert "max_participants" in t, "Missing max_participants field"
            assert "registered_count" in t, "Missing registered_count field"
            assert "spots_left" in t, "Missing spots_left field"
        
        # Store for later verification
        TestAdminListTournamentsWithDrafts.all_tournaments = data
        print(f"Found {len(data)} tournaments (including drafts)")
    
    def test_list_without_include_drafts_excludes_drafts(self, admin_headers):
        """Without include_drafts, draft tournaments are excluded"""
        resp = requests.get(f"{BASE_URL}/api/tournaments", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify no drafts
        for t in data:
            assert t.get("status") != "draft", f"Draft tournament in list: {t.get('name')}"
    
    def test_standard_user_cannot_see_drafts(self, user_headers):
        """Standard user with include_drafts=true still doesn't see drafts"""
        resp = requests.get(f"{BASE_URL}/api/tournaments?include_drafts=true", headers=user_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Standard users should NOT see drafts even with include_drafts=true
        for t in data:
            assert t.get("status") != "draft", f"Draft visible to standard user: {t.get('name')}"


# ===========================
# Phase 3: Admin Create Tournament (draft status)
# ===========================

class TestAdminCreateTournamentDraft:
    """Test POST /api/tournaments creates in draft status"""
    
    def test_create_tournament_creates_in_draft_status(self, admin_headers):
        """Admin creates tournament which starts in draft status"""
        unique_name = f"TEST_AdminPhase3_{uuid.uuid4().hex[:8]}"
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=admin_headers, json={
            "name": unique_name,
            "max_participants": 8,
            "duration_rounds": 3,
            "groups_count": 2,
            "players_per_group": 4,
            "advance_count": 2,
            "entry_fee": 0.0
        })
        assert resp.status_code == 200, f"Create failed: {resp.text}"
        data = resp.json()
        
        # CRITICAL: New tournament must be in draft status
        assert data.get("status") == "draft", f"Expected draft status, got: {data.get('status')}"
        assert data.get("name") == unique_name
        assert data.get("max_participants") == 8
        assert data.get("groups_count") == 2
        assert data.get("players_per_group") == 4
        assert data.get("advance_count") == 2
        assert data.get("current_round") == 0
        
        # Store for cleanup and further tests
        TestAdminCreateTournamentDraft.created_id = data["id"]
        TestAdminCreateTournamentDraft.created_name = unique_name
        print(f"Created draft tournament: {unique_name} ({data['id']})")
    
    def test_newly_created_draft_not_in_default_list(self, admin_headers):
        """Newly created draft tournament shouldn't appear in default list"""
        created_id = getattr(TestAdminCreateTournamentDraft, 'created_id', None)
        if not created_id:
            pytest.skip("No tournament created in previous test")
        
        resp = requests.get(f"{BASE_URL}/api/tournaments", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        ids = [t["id"] for t in data]
        assert created_id not in ids, "Draft tournament should not appear in default list"
    
    def test_newly_created_draft_visible_with_include_drafts(self, admin_headers):
        """Newly created draft tournament appears with include_drafts=true"""
        created_id = getattr(TestAdminCreateTournamentDraft, 'created_id', None)
        if not created_id:
            pytest.skip("No tournament created in previous test")
        
        resp = requests.get(f"{BASE_URL}/api/tournaments?include_drafts=true", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        ids = [t["id"] for t in data]
        assert created_id in ids, "Draft tournament should appear with include_drafts=true"


# ===========================
# Phase 3: Admin Open Registration
# ===========================

class TestAdminOpenRegistrationPhase3:
    """Test POST /api/tournaments/{id}/open transitions draft -> registration"""
    
    def test_open_registration_on_draft_tournament(self, admin_headers):
        """Admin can open registration on a draft tournament"""
        created_id = getattr(TestAdminCreateTournamentDraft, 'created_id', None)
        if not created_id:
            pytest.skip("No tournament from create test")
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{created_id}/open", headers=admin_headers)
        assert resp.status_code == 200, f"Open registration failed: {resp.text}"
        data = resp.json()
        
        assert data.get("ok") == True
        assert data.get("status") == "registration", f"Expected registration status, got: {data.get('status')}"
        print(f"Opened registration for tournament: {created_id}")
    
    def test_after_open_tournament_visible_in_default_list(self, admin_headers):
        """After opening, tournament should appear in default list"""
        created_id = getattr(TestAdminCreateTournamentDraft, 'created_id', None)
        if not created_id:
            pytest.skip("No tournament from create test")
        
        resp = requests.get(f"{BASE_URL}/api/tournaments", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        ids = [t["id"] for t in data]
        assert created_id in ids, "Tournament should appear in default list after opening registration"
    
    def test_cannot_open_registration_twice(self, admin_headers):
        """Opening registration on already-open tournament fails"""
        created_id = getattr(TestAdminCreateTournamentDraft, 'created_id', None)
        if not created_id:
            pytest.skip("No tournament from create test")
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{created_id}/open", headers=admin_headers)
        assert resp.status_code == 400, f"Expected 400 for already open, got {resp.status_code}"


# ===========================
# Phase 3: Get Tournament Detail
# ===========================

class TestTournamentDetailPhase3:
    """Test GET /api/tournaments/{id} returns complete detail"""
    
    def test_get_tournament_detail_includes_rounds(self, admin_headers):
        """GET detail includes rounds array"""
        created_id = getattr(TestAdminCreateTournamentDraft, 'created_id', None)
        if not created_id:
            pytest.skip("No tournament from create test")
        
        resp = requests.get(f"{BASE_URL}/api/tournaments/{created_id}", headers=admin_headers)
        assert resp.status_code == 200, f"Get detail failed: {resp.text}"
        data = resp.json()
        
        assert "id" in data
        assert "name" in data
        assert "status" in data
        assert "rounds" in data, "Missing rounds field"
        assert isinstance(data["rounds"], list), "Rounds should be a list"
        
        # Check structure fields used by admin UI
        assert "groups_count" in data
        assert "players_per_group" in data
        assert "advance_count" in data
        assert "duration_rounds" in data
        assert "current_round" in data
        assert "registered_count" in data


# ===========================
# Phase 3: Standard user cannot perform admin actions
# ===========================

class TestStandardUserRestrictionsPhase3:
    """Verify standard users cannot perform admin tournament actions"""
    
    def test_user_cannot_create_tournament(self, user_headers):
        """Standard user gets 403 when creating tournament"""
        resp = requests.post(f"{BASE_URL}/api/tournaments", headers=user_headers, json={
            "name": "TEST_User_Should_Fail",
            "max_participants": 8,
            "duration_rounds": 3,
            "groups_count": 2,
            "players_per_group": 4,
            "advance_count": 2
        })
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
    
    def test_user_cannot_open_registration(self, user_headers):
        """Standard user cannot open registration"""
        created_id = getattr(TestAdminCreateTournamentDraft, 'created_id', None)
        if not created_id:
            pytest.skip("No tournament from create test")
        
        resp = requests.post(f"{BASE_URL}/api/tournaments/{created_id}/open", headers=user_headers)
        assert resp.status_code == 403


# ===========================
# Cleanup
# ===========================

class TestPhase3Cleanup:
    """Cleanup test data (documentation)"""
    
    def test_cleanup_note(self):
        """Note: TEST_ prefixed tournaments should be cleaned up periodically"""
        created_name = getattr(TestAdminCreateTournamentDraft, 'created_name', None)
        if created_name:
            print(f"Test created tournament: {created_name}")
        assert True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
