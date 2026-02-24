"""
Test Suite for Multi-League Bug Fixes
P0: Manual leagues show ONLY their own matches in predictions 
P1: /api/home returns owner_id for Creator Console visibility
P2: Redundant league list (already fixed in code)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://message-feed.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "email@email.com"
TEST_PASSWORD = "Roberto95"
MANUAL_LEAGUE_ID = "44565d61-b352-4289-a2dc-7d70c818e2a9"
MANUAL_MATCHDAY_ID = "f8ccfb0f-6d87-4092-8a53-c9ca40996361"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture(scope="module")
def user_info(auth_token):
    """Get current user info."""
    response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    return response.json()


class TestP1OwnerIdInHomeResponse:
    """P1: Verify /api/home returns owner_id in league data for Creator Console visibility."""
    
    def test_home_returns_owner_id_for_manual_league(self, auth_token, user_info):
        """Test that /api/home with league_id returns owner_id in league data."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={MANUAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Home request failed: {response.text}"
        data = response.json()
        
        # Verify league data exists
        assert "league" in data, "No league field in /api/home response"
        league = data["league"]
        
        # P1 FIX: owner_id must be present
        assert "owner_id" in league, "owner_id not present in league data - P1 BUG NOT FIXED"
        assert league["owner_id"] is not None, "owner_id is None"
        
        # Verify manual league has match_source_type
        assert league.get("match_source_type") == "manual", f"Expected manual league, got {league.get('match_source_type')}"
        
        # Verify user is owner (for this test user)
        assert league["owner_id"] == user_info["id"], f"User {user_info['id']} should be owner of league"
        
        print(f"✓ P1 FIX VERIFIED: owner_id={league['owner_id']} present in /api/home response")
    
    def test_home_owner_id_equals_user_id_for_league_creator(self, auth_token, user_info):
        """Verify logged-in user is the owner of the test manual league."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={MANUAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        league = data.get("league", {})
        
        # Frontend condition: data?.league?.owner_id === user?.id && match_source_type === 'manual'
        is_owner = league.get("owner_id") == user_info["id"]
        is_manual = league.get("match_source_type") == "manual"
        
        assert is_owner and is_manual, "User should see 'Gestisci lega' button"
        print(f"✓ User {user_info['username']} IS owner of manual league - 'Gestisci lega' button should be visible")


class TestP0ManualLeaguePredictions:
    """P0: Verify manual leagues show ONLY their own matches in predictions (not national fixtures)."""
    
    def test_predictions_with_league_id_returns_only_manual_matches(self, auth_token):
        """Test that GET /api/predictions/{matchday_id}?league_id={manual_league_id} returns only manual league matches."""
        response = requests.get(
            f"{BASE_URL}/api/predictions/{MANUAL_MATCHDAY_ID}?league_id={MANUAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Predictions request failed: {response.text}"
        data = response.json()
        
        # Verify matchday data
        assert "matchday" in data, "No matchday in response"
        assert "predictions" in data, "No predictions array in response"
        
        predictions = data["predictions"]
        assert len(predictions) > 0, "No matches returned for manual league matchday"
        
        # P0 FIX: All matches must have league_id matching the manual league
        for pred in predictions:
            match = pred.get("match", {})
            match_league_id = match.get("league_id")
            
            # CRITICAL: Each match's league_id must equal the manual league ID
            assert match_league_id == MANUAL_LEAGUE_ID, \
                f"Match {match.get('home_team')} vs {match.get('away_team')} has wrong league_id: {match_league_id}"
        
        # Verify we got the expected manual matches
        match_names = [f"{p['match']['home_team']} vs {p['match']['away_team']}" for p in predictions]
        print(f"✓ P0 FIX VERIFIED: {len(predictions)} matches returned, all with league_id={MANUAL_LEAGUE_ID}")
        print(f"  Matches: {match_names}")
    
    def test_manual_matches_have_expected_teams(self, auth_token):
        """Verify the manual league contains the expected test matches."""
        response = requests.get(
            f"{BASE_URL}/api/predictions/{MANUAL_MATCHDAY_ID}?league_id={MANUAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        predictions = data.get("predictions", [])
        
        # Expected teams from MDTest manual league
        expected_teams = {
            ("Team A Manual", "Team B Manual"),
            ("Team C Manual", "Team D Manual")
        }
        
        actual_teams = set()
        for pred in predictions:
            match = pred.get("match", {})
            actual_teams.add((match.get("home_team"), match.get("away_team")))
        
        assert actual_teams == expected_teams, f"Expected {expected_teams}, got {actual_teams}"
        print(f"✓ Manual league shows correct matches: {actual_teams}")
    
    def test_no_national_fixtures_in_manual_league_predictions(self, auth_token):
        """Verify national league matches are NOT included in manual league predictions."""
        response = requests.get(
            f"{BASE_URL}/api/predictions/{MANUAL_MATCHDAY_ID}?league_id={MANUAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        predictions = data.get("predictions", [])
        
        # Check no match has a different league_id (i.e., national league fixtures)
        for pred in predictions:
            match = pred.get("match", {})
            league_id = match.get("league_id")
            
            # Ensure no matches from other leagues
            assert league_id == MANUAL_LEAGUE_ID, \
                f"P0 BUG: National fixture found - {match.get('home_team')} vs {match.get('away_team')} (league_id: {league_id})"
        
        print(f"✓ No national fixtures in manual league predictions - P0 VERIFIED")


class TestCreatorConsoleAccess:
    """Test Creator Console accessibility for manual league owners."""
    
    def test_league_detail_for_owner(self, auth_token, user_info):
        """Verify owner can access league detail."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{MANUAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        league = response.json()
        
        assert league.get("owner_id") == user_info["id"]
        assert league.get("match_source_type") == "manual"
        print(f"✓ League detail accessible for owner")
    
    def test_league_matchdays_accessible_for_owner(self, auth_token):
        """Verify owner can access league matchdays."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{MANUAL_LEAGUE_ID}/matchdays",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        matchdays = response.json()
        assert isinstance(matchdays, list)
        print(f"✓ League matchdays accessible: {len(matchdays)} matchdays")


class TestLeagueSwitcher:
    """Test league switcher functionality."""
    
    def test_home_returns_user_leagues_list(self, auth_token):
        """Verify /api/home returns user_leagues array."""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # user_leagues should be present
        assert "user_leagues" in data, "No user_leagues in /api/home response"
        user_leagues = data["user_leagues"]
        
        assert isinstance(user_leagues, list)
        assert len(user_leagues) > 0, "User should have at least one league"
        
        # Each league should have required fields
        for league in user_leagues:
            assert "id" in league
            assert "name" in league
        
        print(f"✓ League switcher data present: {len(user_leagues)} leagues")
    
    def test_league_switch_via_home_endpoint(self, auth_token):
        """Verify switching league via /api/home?league_id works."""
        # First get all leagues
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        user_leagues = data.get("user_leagues", [])
        
        if len(user_leagues) < 2:
            pytest.skip("User has only one league, cannot test switching")
        
        # Switch to a different league
        other_league = next((l for l in user_leagues if l["id"] != MANUAL_LEAGUE_ID), None)
        if not other_league:
            pytest.skip("No other league to switch to")
        
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={other_league['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("league", {}).get("id") == other_league["id"]
        print(f"✓ League switch works: switched to {other_league['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
