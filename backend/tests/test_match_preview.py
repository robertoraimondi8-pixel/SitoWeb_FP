"""
Test match preview API endpoint for the Statistiche feature.
Tests:
1. GET /api/stats/match-preview/{match_id} returns correct data for API-imported matches
2. Returns 400 for manual matches (no external_fixture_id)
3. Returns 404 for invalid match_id
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://message-feed.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "test@raimondi.it"
USER_PASSWORD = "password"

# Example API match ID for testing (Fiorentina vs Pisa, has external_fixture_id)
API_MATCH_ID = "a401140a-9c2d-4f0b-816f-0b6bc184e63b"


@pytest.fixture
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    # Try admin if user doesn't exist
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed - response: {response.status_code}")


class TestMatchPreviewAPI:
    """Tests for /api/stats/match-preview/{match_id} endpoint"""

    def test_match_preview_success(self, auth_token):
        """Test that match preview returns correct data for API-imported match"""
        response = requests.get(
            f"{BASE_URL}/api/stats/match-preview/{API_MATCH_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500] if response.text else 'Empty'}")
        
        # Should return 200 for valid API-imported match
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "home_team" in data, "Missing home_team in response"
        assert "away_team" in data, "Missing away_team in response"
        assert "home_form" in data, "Missing home_form in response"
        assert "away_form" in data, "Missing away_form in response"
        assert "h2h" in data, "Missing h2h (head-to-head) in response"
        
        # Verify home_form is a list with W/D/L results
        assert isinstance(data["home_form"], list), "home_form should be a list"
        if len(data["home_form"]) > 0:
            form_match = data["home_form"][0]
            assert "result" in form_match, "Form match should have result (W/D/L)"
            assert form_match["result"] in ["W", "D", "L"], f"Invalid result: {form_match['result']}"
            assert "home_team" in form_match, "Form match should have home_team"
            assert "away_team" in form_match, "Form match should have away_team"
            assert "home_goals" in form_match, "Form match should have home_goals"
            assert "away_goals" in form_match, "Form match should have away_goals"
        
        # Verify standings data (may be None if league not identified)
        if data.get("home_standing"):
            assert "rank" in data["home_standing"], "Home standing should have rank"
            assert "points" in data["home_standing"], "Home standing should have points"
        
        print("SUCCESS: Match preview API returned correct data structure")

    def test_match_preview_manual_match_returns_400(self, auth_token):
        """Test that manual matches (no external_fixture_id) return 400"""
        # We need to find a manual match - let's first check if one exists
        # Get leagues to find a manual league
        response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Could not get leagues")
        
        leagues = response.json()
        manual_league = None
        for league in leagues:
            if league.get("match_source_type") in ("manual", "custom"):
                manual_league = league
                break
        
        if not manual_league:
            pytest.skip("No manual league found for testing")
        
        # Get fixtures for manual league
        response = requests.get(
            f"{BASE_URL}/api/leagues/{manual_league['id']}/fixtures",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Could not get manual league fixtures")
        
        fixtures = response.json()
        matchdays = fixtures.get("matchdays", [])
        
        manual_match_id = None
        for md in matchdays:
            for match in md.get("matches", []):
                if not match.get("external_fixture_id"):
                    manual_match_id = match["id"]
                    break
            if manual_match_id:
                break
        
        if not manual_match_id:
            pytest.skip("No manual match found for testing")
        
        # Now test the preview endpoint with manual match
        response = requests.get(
            f"{BASE_URL}/api/stats/match-preview/{manual_match_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"Manual match preview - Status: {response.status_code}")
        
        # Should return 400 for manual matches
        assert response.status_code == 400, f"Expected 400 for manual match but got {response.status_code}"
        print("SUCCESS: Manual match correctly returns 400")

    def test_match_preview_invalid_match_returns_404(self, auth_token):
        """Test that invalid match_id returns 404"""
        invalid_match_id = "invalid-match-id-12345"
        
        response = requests.get(
            f"{BASE_URL}/api/stats/match-preview/{invalid_match_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        print(f"Invalid match preview - Status: {response.status_code}")
        
        # Should return 404 for invalid match_id
        assert response.status_code == 404, f"Expected 404 for invalid match but got {response.status_code}"
        print("SUCCESS: Invalid match correctly returns 404")

    def test_match_preview_requires_auth(self):
        """Test that match preview requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/stats/match-preview/{API_MATCH_ID}"
        )
        
        print(f"No auth preview - Status: {response.status_code}")
        
        # Should return 401 or 403 for unauthenticated requests
        assert response.status_code in [401, 403, 422], f"Expected auth error but got {response.status_code}"
        print("SUCCESS: Match preview correctly requires auth")


class TestMatchPreviewDataStructure:
    """Test that the match preview returns all required fields"""

    def test_home_form_structure(self, auth_token):
        """Test home_form array structure with W/D/L badges + scores"""
        response = requests.get(
            f"{BASE_URL}/api/stats/match-preview/{API_MATCH_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip(f"Match preview failed: {response.status_code}")
        
        data = response.json()
        home_form = data.get("home_form", [])
        
        print(f"home_form count: {len(home_form)}")
        
        # Should have up to 5 matches
        assert len(home_form) <= 5, "home_form should have at most 5 matches"
        
        for i, match in enumerate(home_form):
            print(f"  Match {i+1}: {match.get('home_team')} {match.get('home_goals')}-{match.get('away_goals')} {match.get('away_team')} ({match.get('result')})")
            assert "result" in match, f"Match {i} missing result"
            assert match["result"] in ["W", "D", "L"], f"Match {i} has invalid result: {match['result']}"
        
        print("SUCCESS: home_form structure is correct")

    def test_h2h_structure(self, auth_token):
        """Test h2h (head-to-head) array structure"""
        response = requests.get(
            f"{BASE_URL}/api/stats/match-preview/{API_MATCH_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip(f"Match preview failed: {response.status_code}")
        
        data = response.json()
        h2h = data.get("h2h", [])
        
        print(f"h2h count: {len(h2h)}")
        
        for i, match in enumerate(h2h):
            print(f"  H2H {i+1}: {match.get('home_team')} {match.get('home_goals')}-{match.get('away_goals')} {match.get('away_team')}")
            assert "home_team" in match, f"H2H match {i} missing home_team"
            assert "away_team" in match, f"H2H match {i} missing away_team"
        
        print("SUCCESS: h2h structure is correct")

    def test_standings_structure(self, auth_token):
        """Test standings position structure"""
        response = requests.get(
            f"{BASE_URL}/api/stats/match-preview/{API_MATCH_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip(f"Match preview failed: {response.status_code}")
        
        data = response.json()
        
        home_standing = data.get("home_standing")
        away_standing = data.get("away_standing")
        
        print(f"home_standing: {home_standing}")
        print(f"away_standing: {away_standing}")
        
        # Standings may be None if league not identified, but if present should have correct structure
        if home_standing:
            assert "rank" in home_standing, "home_standing missing rank"
            assert "points" in home_standing, "home_standing missing points"
            print(f"  Home team is #{home_standing['rank']} with {home_standing['points']} pts")
        
        if away_standing:
            assert "rank" in away_standing, "away_standing missing rank"
            assert "points" in away_standing, "away_standing missing points"
            print(f"  Away team is #{away_standing['rank']} with {away_standing['points']} pts")
        
        print("SUCCESS: Standings structure is correct (or None if league unknown)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
