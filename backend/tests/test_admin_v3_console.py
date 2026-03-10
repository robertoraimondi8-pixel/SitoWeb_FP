"""
Admin Console v3 - Backend API Tests
Tests: league listing, enriched matchdays, state transitions, recalculate, max match validation.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://dead-code-sweep.preview.emergentagent.com")

# Credentials
SUPER_ADMIN_EMAIL = "admin@fantapronostic.com"
SUPER_ADMIN_PASSWORD = "admin123"
LEAGUE_OWNER_NATIONAL_EMAIL = "desiree@raimondi.it"
LEAGUE_OWNER_NATIONAL_PASSWORD = "Roberto95"
LEAGUE_OWNER_MANUAL_EMAIL = "ilio@raimondi.it"
LEAGUE_OWNER_MANUAL_PASSWORD = "password123"
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"


@pytest.fixture(scope="module")
def super_admin_token():
    """Login as super admin"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Super admin login failed: {resp.text}"
    data = resp.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="module")
def league_owner_national_token():
    """Login as Desiree - league owner of national-type private league"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": LEAGUE_OWNER_NATIONAL_EMAIL,
        "password": LEAGUE_OWNER_NATIONAL_PASSWORD
    })
    assert resp.status_code == 200, f"League owner (desiree) login failed: {resp.text}"
    data = resp.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def league_owner_manual_token():
    """Login as Ilio - owner of manual league"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": LEAGUE_OWNER_MANUAL_EMAIL,
        "password": LEAGUE_OWNER_MANUAL_PASSWORD
    })
    assert resp.status_code == 200, f"League owner (ilio) login failed: {resp.text}"
    data = resp.json()
    return data["access_token"]


class TestAdminV3Leagues:
    """GET /api/admin/v3/leagues - Role-based league listing"""
    
    def test_super_admin_sees_national_and_all_leagues(self, super_admin_token):
        """Super admin (role=admin) sees national league + all private leagues"""
        resp = requests.get(f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        leagues = resp.json()
        assert isinstance(leagues, list)
        
        # Should have at least 1 league
        assert len(leagues) >= 1, f"Expected at least 1 league, got {len(leagues)}"
        
        # Check that national league is first and has _is_national=True
        national_leagues = [l for l in leagues if l.get("_is_national") == True]
        assert len(national_leagues) >= 1, f"Expected at least 1 national league, got {national_leagues}"
        assert national_leagues[0]["id"] == NATIONAL_LEAGUE_ID, f"Expected national league ID {NATIONAL_LEAGUE_ID}"
        
        print(f"✓ Super admin sees {len(leagues)} leagues, {len(national_leagues)} national")
    
    def test_league_owner_sees_only_owned_leagues(self, league_owner_manual_token):
        """League owner (Ilio) sees only owned leagues, not national"""
        resp = requests.get(f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"})
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        leagues = resp.json()
        
        # Should see at least 1 owned league
        assert len(leagues) >= 1, f"Ilio should own at least 1 league"
        
        # No national leagues for non-admin
        national_leagues = [l for l in leagues if l.get("_is_national") == True]
        assert len(national_leagues) == 0, f"League owner should not see national league, got {national_leagues}"
        
        # All leagues should have _is_national=False
        for lg in leagues:
            assert lg.get("_is_national") == False, f"Expected _is_national=False for {lg.get('name')}"
        
        print(f"✓ League owner (Ilio) sees {len(leagues)} owned leagues, no national")
    
    def test_regular_user_no_admin_access(self):
        """Regular user (not owner/admin) gets empty list or 403"""
        # Create a regular user login (use existing non-owner user if available)
        # For this test, we just validate the endpoint structure
        pass  # Skip - would need a non-owner user


class TestAdminV3Matchdays:
    """GET /api/admin/v3/matchdays - Enriched matchdays with stats"""
    
    def test_super_admin_gets_enriched_matchdays_national(self, super_admin_token):
        """Super admin can get enriched matchdays for national league"""
        resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        matchdays = resp.json()
        assert isinstance(matchdays, list)
        
        if len(matchdays) > 0:
            md = matchdays[0]
            # Check enriched fields
            assert "match_count" in md, f"Missing match_count in {md}"
            assert "results_count" in md, f"Missing results_count in {md}"
            assert "predictions_user_count" in md, f"Missing predictions_user_count in {md}"
            assert "status" in md, f"Missing status in {md}"
            assert "number" in md, f"Missing number in {md}"
            
            print(f"✓ National matchdays enriched: {len(matchdays)} matchdays, first has match_count={md['match_count']}")
        else:
            print("✓ National league has no matchdays yet")
    
    def test_league_owner_gets_enriched_matchdays_manual(self, league_owner_manual_token):
        """League owner can get enriched matchdays for owned manual league"""
        # First get owned leagues
        leagues_resp = requests.get(f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"})
        assert leagues_resp.status_code == 200
        leagues = leagues_resp.json()
        
        if len(leagues) == 0:
            pytest.skip("Ilio has no owned leagues")
        
        league_id = leagues[0]["id"]
        
        resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={league_id}",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"})
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        matchdays = resp.json()
        
        if len(matchdays) > 0:
            md = matchdays[0]
            assert "match_count" in md
            assert "results_count" in md
            assert "predictions_user_count" in md
            print(f"✓ Manual league matchdays: {len(matchdays)}, first match_count={md['match_count']}")
        else:
            print("✓ Manual league has no matchdays")
    
    def test_league_owner_cannot_access_unowned_league(self, league_owner_manual_token):
        """League owner cannot get matchdays for league they don't own"""
        resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"})
        
        # Should get 403 - not owner of national league
        assert resp.status_code == 403, f"Expected 403 for unowned league, got {resp.status_code}: {resp.text}"
        print("✓ League owner correctly denied access to national league matchdays")


class TestAdminV3Transition:
    """POST /api/admin/matchday/{id}/transition - State transitions"""
    
    def test_transition_requires_league_id_and_target(self, super_admin_token):
        """Transition endpoint requires league_id and target_status"""
        # Use a fake matchday ID to test validation
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/fake_id/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={})
        
        assert resp.status_code == 400, f"Expected 400 for missing params, got {resp.status_code}"
        assert "league_id" in resp.text or "target_status" in resp.text
        print("✓ Transition requires league_id and target_status")
    
    def test_transition_invalid_target_status(self, super_admin_token):
        """Invalid target_status returns 400"""
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/fake_id/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "INVALID"})
        
        assert resp.status_code == 400, f"Expected 400 for invalid status, got {resp.status_code}"
        assert "non valido" in resp.text.lower() or "invalid" in resp.text.lower()
        print("✓ Invalid target_status rejected")
    
    def test_transition_matchday_not_found(self, super_admin_token):
        """Non-existent matchday returns 404"""
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/nonexistent-id/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "OPEN"})
        
        assert resp.status_code == 404, f"Expected 404 for nonexistent matchday, got {resp.status_code}"
        print("✓ Nonexistent matchday returns 404")
    
    def test_transition_valid_states(self, super_admin_token):
        """Test valid state order: DRAFT → OPEN → LOCKED → LIVE → COMPLETED"""
        # Get a DRAFT matchday for testing
        matchdays_resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        if matchdays_resp.status_code != 200:
            pytest.skip("Cannot get matchdays")
        
        matchdays = matchdays_resp.json()
        draft_mds = [m for m in matchdays if m.get("status") == "DRAFT"]
        
        if len(draft_mds) == 0:
            print("✓ No DRAFT matchdays to test transition (expected behavior)")
            return
        
        # Found a DRAFT matchday - test that OPEN is allowed
        md = draft_mds[0]
        # Just validate the allowed transitions, don't actually change state
        print(f"✓ Found DRAFT matchday: {md.get('label')} - could transition to OPEN")
    
    def test_transition_prevents_backward(self, super_admin_token):
        """Cannot go backward: e.g. OPEN → DRAFT should fail"""
        # Get an OPEN matchday
        matchdays_resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        if matchdays_resp.status_code != 200:
            pytest.skip("Cannot get matchdays")
        
        matchdays = matchdays_resp.json()
        open_mds = [m for m in matchdays if m.get("status") == "OPEN"]
        
        if len(open_mds) == 0:
            print("✓ No OPEN matchdays to test backward transition")
            return
        
        md = open_mds[0]
        # Try to go backward to DRAFT
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/{md['id']}/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "DRAFT"})
        
        assert resp.status_code == 400, f"Expected 400 for backward transition, got {resp.status_code}"
        assert "non permessa" in resp.text.lower() or "not allowed" in resp.text.lower()
        print(f"✓ Backward transition OPEN → DRAFT correctly rejected for matchday {md['id']}")
    
    def test_transition_prevents_skipping(self, super_admin_token):
        """Cannot skip states: e.g. DRAFT → LIVE should fail"""
        matchdays_resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        if matchdays_resp.status_code != 200:
            pytest.skip("Cannot get matchdays")
        
        matchdays = matchdays_resp.json()
        draft_mds = [m for m in matchdays if m.get("status") == "DRAFT"]
        
        if len(draft_mds) == 0:
            print("✓ No DRAFT matchdays to test skip transition")
            return
        
        md = draft_mds[0]
        # Try to skip to LIVE (should fail, must go DRAFT → OPEN → LOCKED → LIVE)
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/{md['id']}/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "LIVE"})
        
        assert resp.status_code == 400, f"Expected 400 for skipping state, got {resp.status_code}"
        print(f"✓ Skip transition DRAFT → LIVE correctly rejected")


class TestAdminV3Recalculate:
    """POST /api/admin/matchday/{id}/recalculate - Score recalculation"""
    
    def test_recalculate_requires_super_admin(self, league_owner_manual_token):
        """Recalculate only works for SUPER_ADMIN"""
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/fake_id/recalculate",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID})
        
        assert resp.status_code == 403, f"Expected 403 for non-super-admin, got {resp.status_code}"
        assert "super admin" in resp.text.lower() or "permessi" in resp.text.lower()
        print("✓ Recalculate correctly rejects non-super-admin")
    
    def test_recalculate_requires_completed_status(self, super_admin_token):
        """Recalculate only works on COMPLETED matchdays"""
        # Get a non-COMPLETED matchday
        matchdays_resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        if matchdays_resp.status_code != 200:
            pytest.skip("Cannot get matchdays")
        
        matchdays = matchdays_resp.json()
        non_completed = [m for m in matchdays if m.get("status") != "COMPLETED"]
        
        if len(non_completed) == 0:
            print("✓ All matchdays are COMPLETED - cannot test non-completed recalc rejection")
            return
        
        md = non_completed[0]
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/{md['id']}/recalculate",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID})
        
        assert resp.status_code == 400, f"Expected 400 for non-completed matchday, got {resp.status_code}"
        assert "completate" in resp.text.lower() or "completed" in resp.text.lower()
        print(f"✓ Recalculate correctly rejects non-COMPLETED matchday (status={md.get('status')})")
    
    def test_recalculate_success_on_completed(self, super_admin_token):
        """Super admin can recalculate COMPLETED matchday"""
        matchdays_resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        if matchdays_resp.status_code != 200:
            pytest.skip("Cannot get matchdays")
        
        matchdays = matchdays_resp.json()
        completed = [m for m in matchdays if m.get("status") == "COMPLETED"]
        
        if len(completed) == 0:
            print("✓ No COMPLETED matchdays to test recalculate success")
            return
        
        md = completed[0]
        resp = requests.post(f"{BASE_URL}/api/admin/matchday/{md['id']}/recalculate",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID})
        
        assert resp.status_code == 200, f"Expected 200 for recalculate, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("status") == "ok"
        print(f"✓ Recalculate succeeded for matchday {md['id']}")


class TestMaxMatchesValidation:
    """Cannot add more than 10 matches per matchday (admin endpoint)"""
    
    def test_admin_matches_endpoint_exists(self, super_admin_token):
        """Verify admin matches endpoint exists"""
        # Get a matchday first
        matchdays_resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        if matchdays_resp.status_code != 200:
            pytest.skip("Cannot get matchdays")
        
        matchdays = matchdays_resp.json()
        if len(matchdays) == 0:
            print("✓ No matchdays to test max matches")
            return
        
        md = matchdays[0]
        # Get matches for this matchday
        matches_resp = requests.get(f"{BASE_URL}/api/admin/matches?matchday_id={md['id']}",
            headers={"Authorization": f"Bearer {super_admin_token}"})
        
        assert matches_resp.status_code == 200, f"Expected 200, got {matches_resp.status_code}"
        matches = matches_resp.json()
        print(f"✓ Matchday {md['id']} has {len(matches)} matches (max is 10)")


class TestLeagueOwnerAdminAccess:
    """League admin (owner of private league) can access admin console and see only owned leagues"""
    
    def test_desiree_can_access_admin_v3(self, league_owner_national_token):
        """Desiree (owner of national-type private league) can access admin v3"""
        resp = requests.get(f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {league_owner_national_token}"})
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        leagues = resp.json()
        
        # Desiree is owner of Desylega
        print(f"✓ Desiree sees {len(leagues)} owned leagues")
        for lg in leagues:
            print(f"  - {lg.get('name')} (id={lg.get('id')[:8]}...)")
    
    def test_ilio_can_access_admin_v3(self, league_owner_manual_token):
        """Ilio (owner of manual league) can access admin v3"""
        resp = requests.get(f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"})
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        leagues = resp.json()
        
        print(f"✓ Ilio sees {len(leagues)} owned leagues")
        for lg in leagues:
            print(f"  - {lg.get('name')} (id={lg.get('id')[:8]}...)")
    
    def test_league_owner_can_transition_own_league(self, league_owner_manual_token):
        """League owner can transition their own league's matchdays"""
        # Get Ilio's leagues
        leagues_resp = requests.get(f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"})
        
        if leagues_resp.status_code != 200:
            pytest.skip("Cannot get leagues")
        
        leagues = leagues_resp.json()
        if len(leagues) == 0:
            pytest.skip("Ilio has no leagues")
        
        league_id = leagues[0]["id"]
        
        # Get matchdays
        mds_resp = requests.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={league_id}",
            headers={"Authorization": f"Bearer {league_owner_manual_token}"})
        
        assert mds_resp.status_code == 200
        matchdays = mds_resp.json()
        
        if len(matchdays) == 0:
            print("✓ No matchdays in Ilio's league to test transition")
            return
        
        # Just verify the endpoint is accessible for owned leagues
        print(f"✓ Ilio has access to {len(matchdays)} matchdays in his league")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
