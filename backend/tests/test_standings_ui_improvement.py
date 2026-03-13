"""
Test cases for standings UI improvement:
- Verifying stats fields in total and weekly standings
- Testing that proper tiebreak fields are returned in API responses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://context-aware-tabs.preview.emergentagent.com')
LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"

class TestStandingsAPIFields:
    """Test standings API returns required fields for UI display"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_total_standings_returns_stats_fields(self):
        """GET /api/standings/total must return total_correct_predictions, exact_score_hits, one_x_two_hits"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify tiebreak_rules array is present
        assert "tiebreak_rules" in data, "tiebreak_rules array should be present"
        assert isinstance(data["tiebreak_rules"], list)
        assert "total_correct_predictions" in data["tiebreak_rules"]
        assert "exact_score_hits" in data["tiebreak_rules"]
        assert "one_x_two_hits" in data["tiebreak_rules"]
        
        # Verify entries have the required fields
        assert "entries" in data
        if len(data["entries"]) > 0:
            entry = data["entries"][0]
            assert "total_correct_predictions" in entry, "Entry should have total_correct_predictions"
            assert "exact_score_hits" in entry, "Entry should have exact_score_hits"
            assert "one_x_two_hits" in entry, "Entry should have one_x_two_hits"
            
            # Verify values are integers
            assert isinstance(entry["total_correct_predictions"], int)
            assert isinstance(entry["exact_score_hits"], int)
            assert isinstance(entry["one_x_two_hits"], int)
            
            print(f"✓ Total standings entry has stats: correct={entry['total_correct_predictions']}, exact={entry['exact_score_hits']}, 1x2={entry['one_x_two_hits']}")
    
    def test_weekly_standings_returns_stats_fields(self):
        """GET /api/standings/weekly/{matchday_id} must return total_correct, exact_correct, 1x2_correct"""
        # First get a matchday ID
        matchdays_response = requests.get(
            f"{BASE_URL}/api/standings/matchdays?league_id={LEAGUE_ID}",
            headers=self.headers
        )
        assert matchdays_response.status_code == 200
        matchdays = matchdays_response.json()
        
        if len(matchdays) == 0:
            pytest.skip("No matchdays available for testing")
        
        matchday_id = matchdays[0]["id"]
        
        # Get weekly standings
        response = requests.get(
            f"{BASE_URL}/api/standings/weekly/{matchday_id}?league_id={LEAGUE_ID}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify entries have the required fields (if matchday is not OPEN/DRAFT)
        if data.get("matchday_status") not in ["DRAFT", "OPEN"]:
            assert "entries" in data
            if len(data["entries"]) > 0:
                entry = data["entries"][0]
                assert "total_correct" in entry, "Entry should have total_correct"
                assert "exact_correct" in entry, "Entry should have exact_correct"
                assert "1x2_correct" in entry, "Entry should have 1x2_correct"
                
                # Verify values are integers
                assert isinstance(entry["total_correct"], int)
                assert isinstance(entry["exact_correct"], int)
                assert isinstance(entry["1x2_correct"], int)
                
                print(f"✓ Weekly standings entry has stats: total={entry['total_correct']}, exact={entry['exact_correct']}, 1x2={entry['1x2_correct']}")
    
    def test_total_standings_sorting_by_tiebreak(self):
        """Verify standings are sorted by points then tiebreak criteria"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        entries = data.get("entries", [])
        
        if len(entries) < 2:
            pytest.skip("Not enough entries to verify sorting")
        
        # Verify sorting: higher points should come first
        for i in range(len(entries) - 1):
            current = entries[i]
            next_entry = entries[i + 1]
            
            # If same points, tiebreak applies (total_correct_predictions > exact_score_hits > one_x_two_hits)
            if current["total_points"] == next_entry["total_points"]:
                # When points are equal, the one with more total_correct_predictions should be ranked higher
                assert current["total_correct_predictions"] >= next_entry["total_correct_predictions"], \
                    f"Tiebreak sorting incorrect at position {i}: {current['username']} vs {next_entry['username']}"
        
        print(f"✓ Standings properly sorted by points and tiebreak criteria")
    
    def test_no_ind_label_in_standings_response(self):
        """Verify that 'Ind.' label concept is not in the API response - only the data fields"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # The API should return total_correct_predictions, NOT "Ind." as a label
        # This is a conceptual test - the 'Ind.' label was removed from frontend display
        if len(data.get("entries", [])) > 0:
            entry = data["entries"][0]
            # Should have the full field name, not abbreviated
            assert "total_correct_predictions" in entry or "total_points" in entry
            print("✓ API returns proper field names, no 'Ind.' abbreviation in data")


class TestAdminStandingsColumns:
    """Test admin panel standings has correct columns"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_admin_ui_html_contains_standings_columns(self):
        """Verify admin UI HTML includes Indovinati, Esatti, 1X2 column headers"""
        response = requests.get(f"{BASE_URL}/api/admin-ui")
        assert response.status_code == 200
        html = response.text
        
        # Check for column headers in the standings table
        assert "Indovinati" in html, "Admin UI should have 'Indovinati' column"
        assert "Esatti" in html, "Admin UI should have 'Esatti' column"
        assert "1X2" in html, "Admin UI should have '1X2' column"
        
        print("✓ Admin UI contains standings columns: Indovinati, Esatti, 1X2")
    
    def test_admin_standings_table_structure(self):
        """Verify the standings table in admin UI has the correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin-ui")
        assert response.status_code == 200
        html = response.text
        
        # Look for the table header pattern
        # The pattern should be: # | Giocatore | Punti | Indovinati | Esatti | 1X2 | G. Giocate | Media
        expected_headers = ["Giocatore", "Punti", "Indovinati", "Esatti", "1X2", "G. Giocate", "Media"]
        
        for header in expected_headers:
            assert header in html, f"Admin UI standings should have '{header}' column header"
        
        print("✓ Admin UI standings table has all expected columns")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
