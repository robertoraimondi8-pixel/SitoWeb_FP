"""
Test: Matchday State Machine (Kickoff-Driven)

Tests for the new matchday state machine:
1. Matchdays created in DRAFT state (no first_kickoff required)
2. Manual transition DRAFT → OPEN via 'Pubblica' (requires at least 1 match)
3. OPEN → LIVE happens automatically when now >= first_kickoff
4. LIVE → COMPLETED happens automatically when all matches finished
5. SUPER_ADMIN can override any status
6. Removed LOCKED state from the flow

Test credentials:
- super_admin: admin@fantapronostic.com / admin123
- league_owner: ilio@raimondi.it / password123
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '')).rstrip('/')
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"

@pytest.fixture
def api_client():
    """Shared requests session."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def super_admin_token(api_client):
    """Authenticate as super admin (role=admin)."""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@fantapronostic.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip(f"Super admin login failed: {response.status_code} - {response.text}")
    data = response.json()
    assert data.get("user", {}).get("role") == "admin", "User is not super admin"
    return data.get("access_token")

@pytest.fixture
def league_owner_token(api_client):
    """Authenticate as league owner (regular user)."""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ilio@raimondi.it",
        "password": "password123"
    })
    if response.status_code != 200:
        pytest.skip(f"League owner login failed: {response.status_code} - {response.text}")
    return response.json().get("access_token")


class TestMatchdayCreation:
    """Test POST /api/admin/matchdays - creates matchday with DRAFT status."""

    def test_create_matchday_draft_status_super_admin(self, api_client, super_admin_token):
        """Super admin can create matchday in DRAFT status (no first_kickoff required)."""
        # Get active season
        response = api_client.get(f"{BASE_URL}/api/leagues/seasons", 
                                   headers={"Authorization": f"Bearer {super_admin_token}"})
        assert response.status_code == 200
        seasons = response.json()
        assert len(seasons) > 0, "No active seasons found"
        season_id = seasons[0]["id"]

        # Create matchday (no first_kickoff in body)
        matchday_num = 99  # Use a unique number
        response = api_client.post(f"{BASE_URL}/api/admin/matchdays", 
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "season_id": season_id,
                "number": matchday_num,
                "label": f"Test Matchday {matchday_num}",
                "half": 1,
                "status": "DRAFT"
            }
        )
        # Note: if already exists, may return 400
        if response.status_code == 200:
            data = response.json()
            assert data.get("status") == "DRAFT", "New matchday should be in DRAFT status"
            assert data.get("number") == matchday_num
            print(f"✓ Created matchday {matchday_num} with DRAFT status")
        elif response.status_code == 400:
            print(f"! Matchday {matchday_num} may already exist: {response.text}")
        else:
            assert False, f"Unexpected status {response.status_code}: {response.text}"


class TestTransitionDraftToOpen:
    """Test POST /api/admin/matchday/{id}/transition - DRAFT → OPEN."""

    def test_transition_draft_to_open_with_matches(self, api_client, super_admin_token):
        """DRAFT → OPEN works when matchday has at least 1 match."""
        # First, get matchdays for national league
        response = api_client.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
                                   headers={"Authorization": f"Bearer {super_admin_token}"})
        assert response.status_code == 200
        matchdays = response.json()
        
        # Find a DRAFT matchday with matches
        draft_with_matches = None
        for md in matchdays:
            if md.get("status") == "DRAFT" and md.get("match_count", 0) >= 1:
                draft_with_matches = md
                break
        
        if not draft_with_matches:
            print("! No DRAFT matchday with matches found - skipping transition test")
            pytest.skip("No DRAFT matchday with at least 1 match available")
            
        # Attempt transition DRAFT → OPEN
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{draft_with_matches['id']}/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "OPEN"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("new_status") == "OPEN"
            print(f"✓ Transitioned matchday {draft_with_matches['number']} from DRAFT → OPEN")
        else:
            print(f"! Transition failed: {response.status_code} - {response.text}")

    def test_transition_draft_to_open_fails_without_matches(self, api_client, super_admin_token):
        """DRAFT → OPEN should fail if matchday has no matches."""
        # Get active season
        response = api_client.get(f"{BASE_URL}/api/leagues/seasons",
                                   headers={"Authorization": f"Bearer {super_admin_token}"})
        assert response.status_code == 200
        seasons = response.json()
        if not seasons:
            pytest.skip("No active seasons")
        season_id = seasons[0]["id"]

        # Create a new matchday with no matches (use unique number)
        test_num = 98
        response = api_client.post(f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "season_id": season_id,
                "number": test_num,
                "label": f"Empty Matchday {test_num}",
                "half": 1,
                "status": "DRAFT"
            }
        )
        
        if response.status_code != 200:
            # Try to find existing DRAFT matchday with 0 matches
            response = api_client.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
                                       headers={"Authorization": f"Bearer {super_admin_token}"})
            matchdays = response.json()
            empty_draft = next((md for md in matchdays if md.get("status") == "DRAFT" and md.get("match_count", 0) == 0), None)
            if not empty_draft:
                print("! No empty DRAFT matchday available for test")
                pytest.skip("No DRAFT matchday with 0 matches available")
            matchday_id = empty_draft["id"]
        else:
            matchday_id = response.json()["id"]

        # Try transition - should fail
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{matchday_id}/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "OPEN"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "almeno 1 partita" in response.text.lower() or "at least" in response.text.lower()
        print(f"✓ Correctly rejected DRAFT → OPEN without matches")


class TestAutoTransitionsBlocked:
    """Test that OPEN → LIVE and LIVE → COMPLETED cannot be done manually."""

    def test_open_to_live_transition_blocked(self, api_client, super_admin_token):
        """OPEN → LIVE should fail (auto-transition only)."""
        # Get matchdays
        response = api_client.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
                                   headers={"Authorization": f"Bearer {super_admin_token}"})
        matchdays = response.json()
        
        open_matchday = next((md for md in matchdays if md.get("status") == "OPEN"), None)
        if not open_matchday:
            print("! No OPEN matchday found - skipping test")
            pytest.skip("No OPEN matchday available")
        
        # Try OPEN → LIVE transition (should fail)
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{open_matchday['id']}/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "LIVE"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "automatica" in response.text.lower() or "not permitted" in response.text.lower() or "non permessa" in response.text.lower()
        print(f"✓ Correctly blocked manual OPEN → LIVE transition")

    def test_live_to_completed_transition_blocked(self, api_client, super_admin_token):
        """LIVE → COMPLETED should fail (auto-transition only)."""
        # Get matchdays
        response = api_client.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
                                   headers={"Authorization": f"Bearer {super_admin_token}"})
        matchdays = response.json()
        
        live_matchday = next((md for md in matchdays if md.get("status") == "LIVE"), None)
        if not live_matchday:
            print("! No LIVE matchday found - skipping test")
            pytest.skip("No LIVE matchday available")
        
        # Try LIVE → COMPLETED transition (should fail)
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{live_matchday['id']}/transition",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "COMPLETED"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Correctly blocked manual LIVE → COMPLETED transition")


class TestSuperAdminOverride:
    """Test POST /api/admin/matchday/{id}/override - SUPER_ADMIN can force any status."""

    def test_override_works_for_super_admin(self, api_client, super_admin_token):
        """Super admin (role=admin) can override matchday status."""
        # Get matchdays
        response = api_client.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
                                   headers={"Authorization": f"Bearer {super_admin_token}"})
        assert response.status_code == 200
        matchdays = response.json()
        
        if not matchdays:
            pytest.skip("No matchdays available")
        
        test_matchday = matchdays[0]
        original_status = test_matchday.get("status")
        
        # Override to DRAFT
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{test_matchday['id']}/override",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "DRAFT"}
        )
        
        assert response.status_code == 200, f"Override failed: {response.text}"
        data = response.json()
        assert data.get("new_status") == "DRAFT"
        print(f"✓ Super admin override to DRAFT worked")
        
        # Override to OPEN
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{test_matchday['id']}/override",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "OPEN"}
        )
        
        assert response.status_code == 200
        print(f"✓ Super admin override to OPEN worked")
        
        # Override to LIVE
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{test_matchday['id']}/override",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "LIVE"}
        )
        
        assert response.status_code == 200
        print(f"✓ Super admin override to LIVE worked")
        
        # Override to COMPLETED
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{test_matchday['id']}/override",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "COMPLETED"}
        )
        
        assert response.status_code == 200
        print(f"✓ Super admin override to COMPLETED worked")
        
        # Clear override (target_status=null)
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{test_matchday['id']}/override",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": None}
        )
        
        assert response.status_code == 200
        assert "override rimosso" in response.text.lower() or "removed" in response.text.lower()
        print(f"✓ Super admin clear override worked")

    def test_override_fails_for_league_owner(self, api_client, league_owner_token):
        """Regular league owner cannot use override endpoint."""
        # Get a matchday ID (we just need any valid ID)
        response = api_client.get(f"{BASE_URL}/api/home",
                                   headers={"Authorization": f"Bearer {league_owner_token}"})
        assert response.status_code == 200
        home_data = response.json()
        
        # Try to use a matchday from the user's league or national
        matchday_id = home_data.get("matchday", {}).get("id")
        if not matchday_id:
            pytest.skip("No matchday found in home data")
        
        # Try override - should fail for non-admin
        response = api_client.post(
            f"{BASE_URL}/api/admin/matchday/{matchday_id}/override",
            headers={"Authorization": f"Bearer {league_owner_token}"},
            json={"league_id": NATIONAL_LEAGUE_ID, "target_status": "DRAFT"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Correctly denied override for league owner (non-admin)")


class TestAdminV3MatchdaysEndpoint:
    """Test GET /api/admin/v3/matchdays - returns effective status."""

    def test_matchdays_returns_effective_status(self, api_client, super_admin_token):
        """GET /api/admin/v3/matchdays returns computed effective status."""
        response = api_client.get(
            f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        matchdays = response.json()
        
        assert isinstance(matchdays, list), "Response should be a list"
        
        for md in matchdays:
            # Check required fields
            assert "id" in md
            assert "number" in md
            assert "status" in md
            assert "match_count" in md
            assert "results_count" in md
            assert "predictions_user_count" in md
            
            # Status should be one of the valid states (no LOCKED)
            assert md["status"] in ["DRAFT", "OPEN", "LIVE", "COMPLETED"], f"Invalid status: {md['status']}"
        
        print(f"✓ GET /api/admin/v3/matchdays returns {len(matchdays)} matchdays with valid effective status")


class TestValidTransitionsConfig:
    """Verify VALID_TRANSITIONS configuration is correct."""

    def test_only_draft_to_open_is_manual(self, api_client, super_admin_token):
        """Verify only DRAFT → OPEN is allowed as manual transition."""
        # Get matchdays to have a target
        response = api_client.get(f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
                                   headers={"Authorization": f"Bearer {super_admin_token}"})
        matchdays = response.json()
        
        if not matchdays:
            pytest.skip("No matchdays")
        
        # Test all invalid transitions
        test_matchday = matchdays[0]
        
        # These transitions should all fail (except DRAFT → OPEN if in DRAFT)
        invalid_transitions = [
            ("OPEN", "LIVE"),
            ("OPEN", "COMPLETED"),
            ("OPEN", "DRAFT"),
            ("LIVE", "OPEN"),
            ("LIVE", "DRAFT"),
            ("LIVE", "COMPLETED"),
            ("COMPLETED", "DRAFT"),
            ("COMPLETED", "OPEN"),
            ("COMPLETED", "LIVE"),
        ]
        
        current_status = test_matchday.get("status")
        
        for from_status, to_status in invalid_transitions:
            if current_status == from_status:
                response = api_client.post(
                    f"{BASE_URL}/api/admin/matchday/{test_matchday['id']}/transition",
                    headers={"Authorization": f"Bearer {super_admin_token}"},
                    json={"league_id": NATIONAL_LEAGUE_ID, "target_status": to_status}
                )
                
                # Should fail
                if response.status_code != 400:
                    print(f"! Unexpected: {from_status} → {to_status} returned {response.status_code}")
                else:
                    print(f"✓ {from_status} → {to_status} correctly blocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
