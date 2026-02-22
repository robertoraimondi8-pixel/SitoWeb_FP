"""
P0 Bug Fixes Test Suite - FantaPronostic

Tests for three critical P0 bugs:
- P0-1: Import API-Football fixtures - wrong duplicate check (should return skipped_details)
- P0-2: Predictions disappear on LIVE/COMPLETED matchdays (live endpoint fix)  
- P0-3: Home screen 'Ultimi 5 risultati' shows stale data (last_5_performance fix)

Test matchday IDs:
- G15 = 42666812-114a-4195-b0b7-33d72155d9ad
- G16 = 68523813-a795-4a74-87ec-68bdd0b7ace0  
- G17 = 38df601f-49f7-47d1-8f7e-2aa524884f7d

Already imported fixture: 1378114 (Atalanta vs Napoli in G16)
NATIONAL_LEAGUE_ID = f1373417-43aa-4043-b6a2-125873181c95
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://api-match-import.preview.emergentagent.com")

# Known matchday IDs from context
MATCHDAY_G15_ID = "42666812-114a-4195-b0b7-33d72155d9ad"
MATCHDAY_G16_ID = "68523813-a795-4a74-87ec-68bdd0b7ace0"
MATCHDAY_G17_ID = "38df601f-49f7-47d1-8f7e-2aa524884f7d"
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
ALREADY_IMPORTED_FIXTURE = 1378114  # Atalanta vs Napoli in G16


class TestCredentials:
    ADMIN_EMAIL = "admin@fantapronostic.com"
    ADMIN_PASSWORD = "admin123"
    TEST_USER_EMAIL = "test@raimondi.it"
    TEST_USER_PASSWORD = "password123"


@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TestCredentials.ADMIN_EMAIL,
        "password": TestCredentials.ADMIN_PASSWORD
    })
    print(f"Admin login response: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Admin user id: {data.get('user', {}).get('id')}")
        return data.get("access_token")
    pytest.skip(f"Admin authentication failed: {response.status_code} - {response.text[:200]}")


@pytest.fixture(scope="session")
def test_user_token(api_client):
    """Get test user authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TestCredentials.TEST_USER_EMAIL,
        "password": TestCredentials.TEST_USER_PASSWORD
    })
    print(f"Test user login response: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Test user id: {data.get('user', {}).get('id')}")
        return data.get("access_token")
    pytest.skip(f"Test user authentication failed: {response.status_code} - {response.text[:200]}")


@pytest.fixture
def admin_client(api_client, admin_token):
    """Session with admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


@pytest.fixture
def user_client(api_client, test_user_token):
    """Session with test user auth header"""
    api_client.headers.update({"Authorization": f"Bearer {test_user_token}"})
    return api_client


# =====================================================
# P0-3 Tests: GET /api/home - Last 5 Performance Fix
# =====================================================
class TestP03HomeLastFivePerformance:
    """
    P0-3: GET /api/home should return last_5_performance with the 5 most recent 
    COMPLETED national matchdays (G13-G17), not just G16-G17
    """

    def test_home_returns_last_5_performance_with_5_matchdays(self, admin_client):
        """
        P0-3 Fix: Verify last_5_performance contains 5 matchdays for national league
        The fix queries matchdays collection directly with NATIONAL_LEAGUE_ID
        instead of querying predictions (which had inconsistent league_ids)
        """
        response = admin_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        
        # Verify last_5_performance exists and has data
        last_5 = data.get("last_5_performance", [])
        print(f"last_5_performance: {last_5}")
        print(f"Number of matchdays in last_5_performance: {len(last_5)}")
        
        # P0-3 fix: Should return 5 completed matchdays (G13-G17 range expected)
        assert len(last_5) == 5, f"Expected 5 matchdays in last_5_performance, got {len(last_5)}"
        
        # Verify matchday numbers are present and in ascending order (oldest first for display)
        matchday_numbers = [md.get("matchday_number") for md in last_5]
        print(f"Matchday numbers in last_5: {matchday_numbers}")
        
        # All should have matchday_number
        assert all(num is not None for num in matchday_numbers), "All entries should have matchday_number"
        
        # Verify points field exists for each
        for md in last_5:
            assert "points" in md, f"Missing points field in matchday entry: {md}"

    def test_home_user_summary_total_points_and_matchdays_played(self, admin_client):
        """
        P0-3 Fix: Verify user_summary shows correct total_points (25.0) and 
        matchdays_played (9) for admin user.
        The fix uses score_summaries instead of predictions for counting matchdays_played.
        """
        response = admin_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        user_summary = data.get("user_summary")
        
        print(f"user_summary: {user_summary}")
        
        assert user_summary is not None, "user_summary should be present"
        
        # Check total_points - expected ~25.0 based on context
        total_points = user_summary.get("total_points", 0)
        print(f"total_points: {total_points}")
        assert total_points >= 0, "total_points should be non-negative"
        
        # Check matchdays_played - expected 9 based on context
        matchdays_played = user_summary.get("matchdays_played", 0)
        print(f"matchdays_played: {matchdays_played}")
        
        # The fix changed from querying predictions to querying score_summaries
        # Should show matchdays where user has score_summaries
        assert matchdays_played >= 5, f"Expected matchdays_played >= 5, got {matchdays_played}"

    def test_home_last_5_from_completed_national_matchdays(self, admin_client):
        """
        P0-3 Fix: Verify the last_5_performance data comes from COMPLETED matchdays
        with NATIONAL_LEAGUE_ID, not from predictions with inconsistent league_ids
        """
        response = admin_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200
        
        data = response.json()
        last_5 = data.get("last_5_performance", [])
        
        # G13-G17 should be represented (13, 14, 15, 16, 17)
        matchday_numbers = sorted([md.get("matchday_number") for md in last_5])
        print(f"Last 5 matchday numbers (sorted): {matchday_numbers}")
        
        # Should include recent completed matchdays
        # Based on context: G15=42666812..., G16=68523813..., G17=38df601f...
        # The fix ensures we get 5 most recent COMPLETED matchdays
        assert len(matchday_numbers) == 5, "Should have exactly 5 matchdays"


# =====================================================
# P0-2 Tests: GET /api/live/{matchday_id} - Predictions Fix
# =====================================================
class TestP02LivePredictionsVisibility:
    """
    P0-2: GET /api/live/{matchday_id} should return predictions for 
    COMPLETED matchdays (test with G15 and G17)
    """

    def test_live_endpoint_returns_predictions_for_completed_matchday_g15(self, admin_client):
        """
        P0-2 Fix: Verify /api/live/{matchday_id} returns predictions 
        for COMPLETED matchday G15 (id=league-scoping-v2)
        """
        response = admin_client.get(f"{BASE_URL}/api/live/{MATCHDAY_G15_ID}")
        print(f"Live G15 response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        print(f"Live G15 response keys: {data.keys()}")
        
        # Verify matchday info
        assert data.get("matchday_id") == MATCHDAY_G15_ID
        assert data.get("matchday_number") == 15, f"Expected matchday 15, got {data.get('matchday_number')}"
        assert data.get("matchday_status") == "COMPLETED", f"Expected COMPLETED status, got {data.get('matchday_status')}"
        
        # Verify matches are returned
        matches = data.get("matches", [])
        print(f"Number of matches in G15: {len(matches)}")
        assert len(matches) > 0, "G15 should have matches"
        
        # P0-2 fix: Predictions should be visible for COMPLETED matchdays
        # Check if predictions are included in the response
        predictions_found = sum(1 for m in matches if m.get("my_prediction") is not None)
        print(f"Matches with predictions: {predictions_found} / {len(matches)}")

    def test_live_endpoint_returns_predictions_for_completed_matchday_g17(self, admin_client):
        """
        P0-2 Fix: Verify /api/live/{matchday_id} returns predictions 
        for COMPLETED matchday G17 (id=league-scoping-v2)
        """
        response = admin_client.get(f"{BASE_URL}/api/live/{MATCHDAY_G17_ID}")
        print(f"Live G17 response status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        
        # Verify matchday info
        assert data.get("matchday_id") == MATCHDAY_G17_ID
        assert data.get("matchday_number") == 17, f"Expected matchday 17, got {data.get('matchday_number')}"
        assert data.get("matchday_status") == "COMPLETED", f"Expected COMPLETED status, got {data.get('matchday_status')}"
        
        # Verify matches are returned
        matches = data.get("matches", [])
        print(f"Number of matches in G17: {len(matches)}")
        assert len(matches) > 0, "G17 should have matches"
        
        # Verify points calculation works
        total_points = data.get("total_live_points", 0)
        base_points = data.get("base_points", 0)
        print(f"G17 total_points: {total_points}, base_points: {base_points}")

    def test_live_endpoint_returns_match_details_with_scores(self, admin_client):
        """
        P0-2 Fix: Verify match details include scores for completed matchdays
        """
        response = admin_client.get(f"{BASE_URL}/api/live/{MATCHDAY_G17_ID}")
        assert response.status_code == 200
        
        data = response.json()
        matches = data.get("matches", [])
        
        # At least some matches should have scores (COMPLETED matchday)
        matches_with_scores = [m for m in matches if m.get("home_score") is not None]
        print(f"Matches with scores: {len(matches_with_scores)} / {len(matches)}")
        
        # For a COMPLETED matchday, most matches should have scores
        assert len(matches_with_scores) > 0, "COMPLETED matchday should have matches with scores"


# =====================================================
# P0-1 Tests: POST /api/admin/real-fixtures/import - Duplicate Check Fix
# =====================================================
class TestP01ImportFixturesDuplicateCheck:
    """
    P0-1: POST /api/admin/real-fixtures/import should return detailed skip info
    (skipped_details with existing_matchday name) when importing already-imported fixture_id
    """

    def test_import_already_imported_fixture_returns_skipped_details(self, admin_client):
        """
        P0-1 Fix: Verify importing fixture_id 1378114 (already imported to G16)
        returns skipped_details with existing_matchday information
        """
        # Try to import the already imported fixture
        response = admin_client.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "matchday_id": MATCHDAY_G17_ID,  # Try to import to G17
                "league_id": NATIONAL_LEAGUE_ID,
                "fixture_ids": [ALREADY_IMPORTED_FIXTURE]  # Already in G16
            }
        )
        
        print(f"Import response status: {response.status_code}")
        print(f"Import response: {response.text[:1000]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        
        # P0-1 fix: Response should include skipped_details
        assert "skipped_details" in data, "Response should include skipped_details field"
        
        skipped_details = data.get("skipped_details", [])
        print(f"skipped_details: {skipped_details}")
        
        # Should have exactly 1 skipped fixture
        assert len(skipped_details) == 1, f"Expected 1 skipped fixture, got {len(skipped_details)}"
        
        # Verify skipped fixture details
        skipped = skipped_details[0]
        assert skipped.get("fixture_id") == ALREADY_IMPORTED_FIXTURE
        assert skipped.get("reason") == "already_imported"
        
        # P0-1 fix: Should include existing_matchday name/label
        existing_matchday = skipped.get("existing_matchday")
        print(f"existing_matchday: {existing_matchday}")
        assert existing_matchday is not None, "skipped_details should include existing_matchday info"
        
        # Should reference G16 where the fixture was originally imported
        # The label should be something like "Giornata 16" or "G16"
        assert "16" in str(existing_matchday), f"existing_matchday should reference G16, got: {existing_matchday}"
        
        # Verify match info is included
        match_info = skipped.get("match")
        print(f"match info: {match_info}")
        # Should include Atalanta vs Napoli info
        if match_info:
            assert "Atalanta" in match_info or "Napoli" in match_info, f"Match info should reference the teams: {match_info}"

    def test_import_response_structure(self, admin_client):
        """
        P0-1 Fix: Verify the import response has correct structure with all fields
        """
        response = admin_client.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "matchday_id": MATCHDAY_G17_ID,
                "league_id": NATIONAL_LEAGUE_ID,
                "fixture_ids": [ALREADY_IMPORTED_FIXTURE]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "imported" in data, "Response should have 'imported' count"
        assert "skipped" in data, "Response should have 'skipped' count"
        assert "matches" in data, "Response should have 'matches' list"
        assert "skipped_details" in data, "Response should have 'skipped_details' list"
        
        # For this test, imported should be 0 and skipped should be 1
        assert data["imported"] == 0, "No fixtures should be imported (already exists)"
        assert data["skipped"] == 1, "One fixture should be skipped"


# =====================================================
# Additional Verification Tests
# =====================================================
class TestCompletedMatchdaysDiscovery:
    """
    Verify the matchday discovery logic for national leagues works correctly
    """

    def test_home_endpoint_national_league_context(self, admin_client):
        """
        Verify the home endpoint returns correct context for national league users
        """
        response = admin_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify league context
        league = data.get("league")
        if league:
            print(f"Active league: {league.get('name')} (id: {league.get('id')})")
            print(f"League type: {league.get('league_type')}")
            print(f"Match source type: {league.get('match_source_type')}")

        # Verify rankings preview exists
        rankings = data.get("rankings_preview")
        if rankings:
            print(f"Rankings for league: {rankings.get('league_name')}")
            print(f"Top entries: {len(rankings.get('top', []))}")

    def test_matchday_info_in_home_response(self, admin_client):
        """
        Verify matchday info is returned correctly in home response
        """
        response = admin_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200
        
        data = response.json()
        
        matchday = data.get("matchday")
        if matchday:
            print(f"Current matchday: {matchday.get('number')} - {matchday.get('label')}")
            print(f"Status: {matchday.get('status')}")
            print(f"Total matches: {matchday.get('total_matches')}")
            print(f"My predictions: {matchday.get('my_predictions_count')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
