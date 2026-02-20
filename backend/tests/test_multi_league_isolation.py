"""
Test Suite for Multi-League Isolation Fix (Definitivo)
Testing the following bugs:
1) ISOLAMENTO FIXTURES: Lega manuale A mostra SOLO le sue partite (non quelle di Lega B o nazionali)
2) ISOLAMENTO FIXTURES: Lega manuale B mostra SOLO le sue partite (non quelle di Lega A o nazionali)
3) CREATOR CONSOLE: Owner della lega vede is_owner=true e pulsante gestione
4) CREATOR CONSOLE: Non-owner vede is_owner=false e NON vede pulsante gestione
5) PERMESSI: Non-owner riceve 403 su endpoint creator console
6) HOME ENDPOINT: Matchday restituito è SPECIFICO per la lega attiva (manual vs national)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fixture-hub-5.preview.emergentagent.com')

# Test credentials from review request
OWNER_EMAIL = "email@email.com"
OWNER_PASSWORD = "Roberto95"
NON_OWNER_EMAIL = "marco@test.com"
NON_OWNER_PASSWORD = "password123"

# Test leagues from review request
TEST_LEAGUE_A_ID = "14b7df99-9690-4bcb-9f58-09489f5f15ba"  # Test Lega A
TEST_LEAGUE_B_ID = "4e740b15-deab-4fd0-9ce8-418e5ac0c1ae"  # Test Lega B


@pytest.fixture(scope="module")
def owner_token():
    """Get authentication token for owner user (email@email.com)."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200, f"Owner login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in owner response"
    return data["access_token"]


@pytest.fixture(scope="module")
def non_owner_token():
    """Get authentication token for non-owner user (marco@test.com)."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": NON_OWNER_EMAIL, "password": NON_OWNER_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200, f"Non-owner login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in non-owner response"
    return data["access_token"]


@pytest.fixture(scope="module")
def owner_info(owner_token):
    """Get owner user info."""
    response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture(scope="module")
def non_owner_info(non_owner_token):
    """Get non-owner user info."""
    response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {non_owner_token}"}
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture(scope="module")
def league_a_matchday(owner_token):
    """Get matchday ID for Test Lega A."""
    response = requests.get(
        f"{BASE_URL}/api/leagues/{TEST_LEAGUE_A_ID}/matchdays",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert response.status_code == 200, f"Failed to get matchdays for league A: {response.text}"
    matchdays = response.json()
    assert len(matchdays) > 0, "League A has no matchdays"
    return matchdays[0]


@pytest.fixture(scope="module")
def league_b_matchday(owner_token):
    """Get matchday ID for Test Lega B."""
    response = requests.get(
        f"{BASE_URL}/api/leagues/{TEST_LEAGUE_B_ID}/matchdays",
        headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert response.status_code == 200, f"Failed to get matchdays for league B: {response.text}"
    matchdays = response.json()
    assert len(matchdays) > 0, "League B has no matchdays"
    return matchdays[0]


class TestFixtureIsolationLeagueA:
    """Test 1: ISOLAMENTO FIXTURES - Lega A mostra SOLO le sue partite."""
    
    def test_league_a_fixtures_only_show_league_a_matches(self, owner_token):
        """Verify /api/leagues/{league_a}/fixtures returns ONLY League A matches."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_A_ID}/fixtures",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Fixtures request failed: {response.text}"
        data = response.json()
        
        assert "matchdays" in data, "No matchdays in response"
        matchdays = data["matchdays"]
        assert len(matchdays) > 0, "No matchdays for League A"
        
        # Check all matches belong to League A
        for md in matchdays:
            matches = md.get("matches", [])
            for match in matches:
                # Manual league matches should have league_id
                match_league_id = match.get("league_id")
                assert match_league_id == TEST_LEAGUE_A_ID, \
                    f"Match '{match.get('home_team')} vs {match.get('away_team')}' has wrong league_id: {match_league_id}, expected {TEST_LEAGUE_A_ID}"
        
        # Verify expected match is present
        all_matches = [m for md in matchdays for m in md.get("matches", [])]
        match_names = [f"{m['home_team']} vs {m['away_team']}" for m in all_matches]
        assert any("SOLO_LEGA_A_HOME" in n for n in match_names) or any("Team" in m.get("home_team", "") for md in matchdays for m in md.get("matches", [])), \
            f"Expected League A specific match not found. Found: {match_names}"
        
        print(f"✓ League A fixtures isolation verified: {len(all_matches)} matches, all with correct league_id")
    
    def test_league_a_predictions_only_show_league_a_matches(self, owner_token, league_a_matchday):
        """Verify /api/predictions/{matchday}?league_id=A returns ONLY League A matches."""
        matchday_id = league_a_matchday["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}?league_id={TEST_LEAGUE_A_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Predictions request failed: {response.text}"
        data = response.json()
        
        predictions = data.get("predictions", [])
        assert len(predictions) > 0, "No predictions/matches returned for League A matchday"
        
        # Verify all matches have League A's league_id
        for pred in predictions:
            match = pred.get("match", {})
            match_league_id = match.get("league_id")
            assert match_league_id == TEST_LEAGUE_A_ID, \
                f"Match '{match.get('home_team')} vs {match.get('away_team')}' should be League A only, but has league_id: {match_league_id}"
        
        # Verify NO League B matches
        for pred in predictions:
            match = pred.get("match", {})
            assert match.get("league_id") != TEST_LEAGUE_B_ID, \
                f"BUG: League B match found in League A predictions: {match.get('home_team')} vs {match.get('away_team')}"
        
        print(f"✓ League A predictions isolation verified: {len(predictions)} matches, no League B matches")


class TestFixtureIsolationLeagueB:
    """Test 2: ISOLAMENTO FIXTURES - Lega B mostra SOLO le sue partite."""
    
    def test_league_b_fixtures_only_show_league_b_matches(self, owner_token):
        """Verify /api/leagues/{league_b}/fixtures returns ONLY League B matches."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_B_ID}/fixtures",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Fixtures request failed: {response.text}"
        data = response.json()
        
        matchdays = data.get("matchdays", [])
        assert len(matchdays) > 0, "No matchdays for League B"
        
        # Check all matches belong to League B
        for md in matchdays:
            matches = md.get("matches", [])
            for match in matches:
                match_league_id = match.get("league_id")
                assert match_league_id == TEST_LEAGUE_B_ID, \
                    f"Match '{match.get('home_team')} vs {match.get('away_team')}' has wrong league_id: {match_league_id}, expected {TEST_LEAGUE_B_ID}"
        
        all_matches = [m for md in matchdays for m in md.get("matches", [])]
        print(f"✓ League B fixtures isolation verified: {len(all_matches)} matches")
    
    def test_league_b_predictions_only_show_league_b_matches(self, owner_token, league_b_matchday):
        """Verify /api/predictions/{matchday}?league_id=B returns ONLY League B matches."""
        matchday_id = league_b_matchday["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}?league_id={TEST_LEAGUE_B_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Predictions request failed: {response.text}"
        data = response.json()
        
        predictions = data.get("predictions", [])
        assert len(predictions) > 0, "No predictions/matches returned for League B matchday"
        
        # Verify all matches have League B's league_id
        for pred in predictions:
            match = pred.get("match", {})
            match_league_id = match.get("league_id")
            assert match_league_id == TEST_LEAGUE_B_ID, \
                f"Match should be League B only, but has league_id: {match_league_id}"
        
        # Verify NO League A matches
        for pred in predictions:
            match = pred.get("match", {})
            assert match.get("league_id") != TEST_LEAGUE_A_ID, \
                f"BUG: League A match found in League B predictions: {match.get('home_team')} vs {match.get('away_team')}"
        
        print(f"✓ League B predictions isolation verified: {len(predictions)} matches, no League A matches")


class TestCreatorConsoleOwnerVisibility:
    """Test 3: CREATOR CONSOLE - Owner della lega vede is_owner=true e pulsante gestione."""
    
    def test_home_returns_is_owner_true_for_owner(self, owner_token, owner_info):
        """Verify /api/home returns is_owner=true for league owner."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_A_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Home request failed: {response.text}"
        data = response.json()
        
        league = data.get("league", {})
        assert league, "No league in home response"
        
        # Verify is_owner is present and true
        assert "is_owner" in league, "is_owner field missing from league response"
        assert league["is_owner"] == True, f"is_owner should be True for owner, got {league.get('is_owner')}"
        
        # Verify owner_id matches user id
        assert league.get("owner_id") == owner_info["id"], \
            f"owner_id mismatch: {league.get('owner_id')} != {owner_info['id']}"
        
        # Verify match_source_type is manual (required for settings button)
        assert league.get("match_source_type") == "manual", \
            f"Expected manual league, got {league.get('match_source_type')}"
        
        print(f"✓ Owner sees is_owner=True, can see settings button (match_source_type=manual)")
    
    def test_home_returns_my_role_admin_for_owner(self, owner_token):
        """Verify /api/home returns my_role='admin' for league owner."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_A_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        data = response.json()
        league = data.get("league", {})
        
        # my_role should be admin for the owner
        my_role = league.get("my_role")
        assert my_role == "admin", f"Expected my_role='admin' for owner, got {my_role}"
        
        print(f"✓ Owner has my_role=admin")


class TestCreatorConsoleNonOwnerVisibility:
    """Test 4: CREATOR CONSOLE - Non-owner vede is_owner=false e NON vede pulsante gestione."""
    
    def test_home_returns_is_owner_false_for_non_owner(self, non_owner_token, non_owner_info):
        """Verify /api/home returns is_owner=false for non-owner member."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_A_ID}",
            headers={"Authorization": f"Bearer {non_owner_token}"}
        )
        assert response.status_code == 200, f"Home request failed: {response.text}"
        data = response.json()
        
        league = data.get("league", {})
        assert league, "No league in home response"
        
        # Verify is_owner is present and false
        assert "is_owner" in league, "is_owner field missing from league response"
        assert league["is_owner"] == False, f"is_owner should be False for non-owner, got {league.get('is_owner')}"
        
        # Frontend logic: settings button only shows when is_owner=true AND match_source_type=manual
        # Non-owner should NOT see the button even if match_source_type=manual
        print(f"✓ Non-owner sees is_owner=False, settings button hidden")
    
    def test_home_returns_my_role_member_for_non_owner(self, non_owner_token):
        """Verify /api/home returns my_role='member' for non-owner."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_A_ID}",
            headers={"Authorization": f"Bearer {non_owner_token}"}
        )
        data = response.json()
        league = data.get("league", {})
        
        my_role = league.get("my_role")
        assert my_role == "member", f"Expected my_role='member' for non-owner, got {my_role}"
        
        print(f"✓ Non-owner has my_role=member")


class TestCreatorConsolePermissions:
    """Test 5: PERMESSI - Non-owner riceve 403 su endpoint creator console."""
    
    def test_non_owner_cannot_create_matchday(self, non_owner_token):
        """Verify non-owner receives 403 when trying to create matchday."""
        response = requests.post(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_A_ID}/matchdays",
            json={
                "number": 99,
                "label": "Non-owner Test",
                "half": 1,
                "first_kickoff": "2026-12-01T15:00:00",
                "season_id": "season-2024-2025"
            },
            headers={
                "Authorization": f"Bearer {non_owner_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 403, \
            f"Expected 403 Forbidden for non-owner creating matchday, got {response.status_code}: {response.text}"
        
        print(f"✓ Non-owner correctly gets 403 on POST /leagues/.../matchdays")
    
    def test_non_owner_cannot_create_match(self, non_owner_token, league_a_matchday):
        """Verify non-owner receives 403 when trying to create match."""
        matchday_id = league_a_matchday["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_A_ID}/matchdays/{matchday_id}/matches",
            json={
                "home_team": "Unauthorized Home",
                "away_team": "Unauthorized Away",
                "start_time": "2026-12-01T20:00:00",
                "competition": "Test",
                "market_type": "1X2",
                "status": "PENDING"
            },
            headers={
                "Authorization": f"Bearer {non_owner_token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 403, \
            f"Expected 403 Forbidden for non-owner creating match, got {response.status_code}: {response.text}"
        
        print(f"✓ Non-owner correctly gets 403 on POST /leagues/.../matchdays/.../matches")
    
    def test_non_owner_cannot_delete_matchday(self, non_owner_token, league_a_matchday):
        """Verify non-owner receives 403 when trying to delete matchday."""
        matchday_id = league_a_matchday["id"]
        
        response = requests.delete(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_A_ID}/matchdays/{matchday_id}",
            headers={"Authorization": f"Bearer {non_owner_token}"}
        )
        assert response.status_code == 403, \
            f"Expected 403 Forbidden for non-owner deleting matchday, got {response.status_code}: {response.text}"
        
        print(f"✓ Non-owner correctly gets 403 on DELETE /leagues/.../matchdays/...")


class TestHomeEndpointMatchdaySpecificity:
    """Test 6: HOME ENDPOINT - Matchday restituito è SPECIFICO per la lega attiva."""
    
    def test_home_returns_league_specific_matchday_for_manual_league(self, owner_token):
        """Verify /api/home with manual league returns matchday specific to that league."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_A_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        league = data.get("league", {})
        matchday = data.get("matchday")
        
        # Verify this is a manual league
        assert league.get("match_source_type") == "manual", "Expected manual league"
        
        # For manual leagues, matchday should come from the league's own matchdays
        if matchday:
            # The matchday should be associated with this league
            # We can verify by checking the matchday endpoint
            response2 = requests.get(
                f"{BASE_URL}/api/leagues/{TEST_LEAGUE_A_ID}/matchdays",
                headers={"Authorization": f"Bearer {owner_token}"}
            )
            league_matchdays = response2.json()
            league_matchday_ids = [md["id"] for md in league_matchdays]
            
            assert matchday["id"] in league_matchday_ids, \
                f"Matchday {matchday['id']} not in League A's matchdays: {league_matchday_ids}"
            
            print(f"✓ Manual league home returns league-specific matchday: {matchday.get('label', matchday.get('number'))}")
        else:
            print(f"✓ No matchday returned (may be expected if no matchdays exist)")
    
    def test_home_league_a_vs_league_b_different_matchdays(self, owner_token):
        """Verify switching leagues shows different matchdays."""
        # Get home for League A
        response_a = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_A_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        data_a = response_a.json()
        matchday_a = data_a.get("matchday")
        
        # Get home for League B
        response_b = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_B_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        data_b = response_b.json()
        matchday_b = data_b.get("matchday")
        
        # Both should have matchdays
        assert matchday_a, "League A should have a matchday"
        assert matchday_b, "League B should have a matchday"
        
        # Matchdays should be different (different IDs)
        assert matchday_a["id"] != matchday_b["id"], \
            f"League A and B should have different matchdays, both have: {matchday_a['id']}"
        
        print(f"✓ League A matchday: {matchday_a['id'][:8]}... | League B matchday: {matchday_b['id'][:8]}...")
        print(f"✓ Home endpoint correctly returns different matchdays for different leagues")


class TestCrossLeagueIsolation:
    """Additional test: Cross-league data should not leak."""
    
    def test_league_a_fixtures_do_not_contain_league_b_matches(self, owner_token, league_b_matchday):
        """Verify League A fixtures do not contain any League B matches."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_A_ID}/fixtures",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        data = response.json()
        
        all_matches = [m for md in data.get("matchdays", []) for m in md.get("matches", [])]
        
        for match in all_matches:
            # No match should have League B's league_id
            assert match.get("league_id") != TEST_LEAGUE_B_ID, \
                f"BUG: League B match leaked into League A fixtures: {match.get('home_team')} vs {match.get('away_team')}"
        
        print(f"✓ No League B matches in League A fixtures")
    
    def test_league_b_fixtures_do_not_contain_league_a_matches(self, owner_token, league_a_matchday):
        """Verify League B fixtures do not contain any League A matches."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_B_ID}/fixtures",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        data = response.json()
        
        all_matches = [m for md in data.get("matchdays", []) for m in md.get("matches", [])]
        
        for match in all_matches:
            # No match should have League A's league_id
            assert match.get("league_id") != TEST_LEAGUE_A_ID, \
                f"BUG: League A match leaked into League B fixtures: {match.get('home_team')} vs {match.get('away_team')}"
        
        print(f"✓ No League A matches in League B fixtures")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
