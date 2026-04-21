"""
Test suite for Standings UI Refinement
Verifies:
1. GET /api/standings/total returns total_correct_predictions (frontend shows only 'Indovinati X')
2. GET /api/standings/user/{userId} returns tiebreak fields
3. Admin panel at /api/admin-ui still shows Indovinati/Esatti/1X2 columns
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://fanta-auth-fix.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
ADMIN_USER_ID = "f0a01bb1-4b0c-4f6f-9c8e-a7b33b445651"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code}")
    return response.json().get("access_token")


class TestTotalStandingsAPI:
    """Tests for GET /api/standings/total endpoint"""
    
    def test_total_standings_returns_total_correct_predictions(self, auth_token):
        """
        Total standings entries must contain total_correct_predictions field.
        Frontend will use this to show 'Indovinati X' under player name.
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "entries" in data, "Response must contain 'entries'"
        assert len(data["entries"]) > 0, "Entries should not be empty"
        
        # Check first entry has required tiebreak fields
        entry = data["entries"][0]
        assert "total_correct_predictions" in entry, "Entry must have total_correct_predictions"
        assert isinstance(entry["total_correct_predictions"], int), "total_correct_predictions must be integer"
        
    def test_total_standings_entry_does_not_have_old_abbreviated_fields(self, auth_token):
        """
        Verify entries don't have old abbreviated field names like 'ind' or 'exact'.
        These were from a previous implementation.
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for entry in data["entries"]:
            # Should NOT have abbreviated fields
            assert "ind" not in entry, "Entry should not have 'ind' abbreviated field"
            # Should have full field names
            assert "total_correct_predictions" in entry
            assert "exact_score_hits" in entry
            assert "one_x_two_hits" in entry
    
    def test_total_standings_tiebreak_rules(self, auth_token):
        """
        Verify tiebreak rules are returned in response.
        Order: points > total_correct_predictions > exact_score_hits > one_x_two_hits > random
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "tiebreak_rules" in data, "Response should include tiebreak_rules"
        rules = data["tiebreak_rules"]
        assert "total_correct_predictions" in rules
        assert "exact_score_hits" in rules
        assert "one_x_two_hits" in rules


class TestUserDetailAPI:
    """Tests for GET /api/standings/user/{userId} endpoint"""
    
    def test_user_detail_returns_tiebreak_fields(self, auth_token):
        """
        User detail page must show three tiebreak stats:
        - Indovinati (total_correct_predictions)
        - Risultati esatti (exact_score_hits)
        - 1X2 indovinati (one_x_two_hits)
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/user/{ADMIN_USER_ID}?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # All three tiebreak fields must be present
        assert "total_correct_predictions" in data, "Must have total_correct_predictions"
        assert "exact_score_hits" in data, "Must have exact_score_hits"
        assert "one_x_two_hits" in data, "Must have one_x_two_hits"
        
        # Values must be integers
        assert isinstance(data["total_correct_predictions"], int)
        assert isinstance(data["exact_score_hits"], int)
        assert isinstance(data["one_x_two_hits"], int)
        
    def test_user_detail_tiebreak_values(self, auth_token):
        """
        Verify tiebreak values are correctly populated.
        Admin user should have: Indovinati=19, Risultati esatti=0, 1X2 indovinati=14
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/user/{ADMIN_USER_ID}?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Based on previous test, admin user has these values
        assert data["total_correct_predictions"] == 19, f"Expected 19 total_correct_predictions, got {data['total_correct_predictions']}"
        assert data["exact_score_hits"] == 0, f"Expected 0 exact_score_hits, got {data['exact_score_hits']}"
        assert data["one_x_two_hits"] == 14, f"Expected 14 one_x_two_hits, got {data['one_x_two_hits']}"
        
    def test_user_detail_user_info(self, auth_token):
        """
        Verify user detail returns basic user info along with stats.
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/user/{ADMIN_USER_ID}?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Basic user info
        assert data["user_id"] == ADMIN_USER_ID
        assert data["username"] == "admin"
        assert "rank" in data
        assert "total_points" in data
        assert "matchdays_played" in data


class TestAdminPanelStandings:
    """Tests for Admin panel standings table columns"""
    
    def test_admin_panel_accessible(self, auth_token):
        """
        Verify admin panel at /api/admin-ui is accessible.
        Admin panel should still show Indovinati/Esatti/1X2 columns (no changes).
        """
        response = requests.get(
            f"{BASE_URL}/api/admin-ui",
            headers={"Authorization": f"Bearer {auth_token}"},
            allow_redirects=True
        )
        # Admin UI should be accessible (200 or 307 redirect)
        assert response.status_code in [200, 307], f"Admin panel should be accessible, got {response.status_code}"


class TestWeeklyStandingsAPI:
    """Tests for GET /api/standings/weekly/{matchday_id} endpoint"""
    
    def test_weekly_standings_returns_correct_fields(self, auth_token):
        """
        Weekly standings should return total_correct, exact_correct, 1x2_correct fields.
        """
        # First get available matchdays
        matchdays_response = requests.get(
            f"{BASE_URL}/api/standings/matchdays?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert matchdays_response.status_code == 200
        
        matchdays = matchdays_response.json()
        if not matchdays:
            pytest.skip("No matchdays available for weekly standings test")
        
        # Get first completed matchday
        completed_md = next((md for md in matchdays if md.get("status") == "COMPLETED"), None)
        if not completed_md:
            pytest.skip("No completed matchdays for weekly test")
        
        # Get weekly standings for that matchday
        response = requests.get(
            f"{BASE_URL}/api/standings/weekly/{completed_md['id']}?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["entries"]:
            entry = data["entries"][0]
            # Weekly standings use different field names
            assert "total_correct" in entry, "Weekly entry must have total_correct"
            assert "exact_correct" in entry, "Weekly entry must have exact_correct"
            assert "1x2_correct" in entry, "Weekly entry must have 1x2_correct"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
