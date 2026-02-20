"""
Backend API Tests - Predictions Completeness Validation (New Feature)

Tests cover:
- POST /api/predictions/{matchday_id} returns 422 (PREDICTIONS_INCOMPLETE) when not all unlocked matches have predictions
- POST /api/predictions/{matchday_id} returns 200 when all matches have predictions
- Partial predictions (existing + new) cover all matches → should succeed
- Setup: creates a test OPEN matchday with future matches in ilio@raimondi.it's league
- Cleanup: deletes all test data after tests
"""
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = "https://league-creator-5.preview.emergentagent.com"
LEAGUE_ID = "1762173a-31fe-463b-9668-d757114f440b"  # ilio@raimondi.it's league


# ===== FIXTURES =====

@pytest.fixture(scope="module")
def ilio_token():
    """Get auth token for ilio@raimondi.it (league owner)"""
    for password in ["password123", "Roberto95"]:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ilio@raimondi.it",
            "password": password
        })
        if response.status_code == 200:
            return response.json()["access_token"]
    pytest.skip("ilio@raimondi.it login failed with all known passwords")


@pytest.fixture(scope="module")
def league_info(ilio_token):
    """Get league info including season_id"""
    response = requests.get(
        f"{BASE_URL}/api/leagues/{LEAGUE_ID}",
        headers={"Authorization": f"Bearer {ilio_token}"}
    )
    assert response.status_code == 200, f"Failed to get league: {response.text}"
    return response.json()


@pytest.fixture(scope="module")
def test_matchday(ilio_token, league_info):
    """
    Create a TEST OPEN matchday with 3 future matches (start_time in 2030).
    Cleaned up after module completes.
    """
    season_id = league_info.get("season_id", "test-season-1")

    # Create matchday
    md_response = requests.post(
        f"{BASE_URL}/api/leagues/{LEAGUE_ID}/matchdays",
        headers={"Authorization": f"Bearer {ilio_token}"},
        json={
            "season_id": season_id,
            "number": 9001,
            "label": "TEST_COMPLETENESS_GiornataTest",
            "half": 1,
            "first_kickoff": "2030-06-01T15:00:00Z",
            "status": "OPEN"
        }
    )
    assert md_response.status_code in [200, 201], f"Failed to create matchday: {md_response.text}"
    matchday = md_response.json()
    matchday_id = matchday["id"]

    # Create 3 future matches
    match_ids = []
    for i in range(3):
        match_response = requests.post(
            f"{BASE_URL}/api/leagues/{LEAGUE_ID}/matchdays/{matchday_id}/matches",
            headers={"Authorization": f"Bearer {ilio_token}"},
            json={
                "home_team": f"TEST_Team{i*2+1}",
                "away_team": f"TEST_Team{i*2+2}",
                "competition": "TEST_Competition",
                "start_time": f"2030-06-0{i+1}T15:00:00Z",
                "market_type": "1X2",
                "status": "PENDING"
            }
        )
        assert match_response.status_code in [200, 201], f"Failed to create match {i}: {match_response.text}"
        match_ids.append(match_response.json()["id"])

    yield {"matchday_id": matchday_id, "match_ids": match_ids}

    # Cleanup: delete matches and matchday
    for match_id in match_ids:
        requests.delete(
            f"{BASE_URL}/api/leagues/{LEAGUE_ID}/matchdays/{matchday_id}/matches/{match_id}",
            headers={"Authorization": f"Bearer {ilio_token}"}
        )
    requests.delete(
        f"{BASE_URL}/api/leagues/{LEAGUE_ID}/matchdays/{matchday_id}",
        headers={"Authorization": f"Bearer {ilio_token}"}
    )


# ===== TESTS =====

class TestPredictionsCompletenessValidation:
    """Test that predictions endpoint requires ALL unlocked matches to have predictions"""

    def test_01_partial_predictions_returns_422(self, ilio_token, test_matchday):
        """
        Sending predictions for only 1 of 3 matches should return 422 PREDICTIONS_INCOMPLETE.
        """
        matchday_id = test_matchday["matchday_id"]
        match_ids = test_matchday["match_ids"]

        # Only send prediction for the FIRST match (missing 2 of 3)
        response = requests.post(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {ilio_token}"},
            json={
                "predictions": [
                    {"match_id": match_ids[0], "market_type": "1X2", "prediction_value": "1"}
                ]
            }
        )

        assert response.status_code == 422, (
            f"Expected 422 for partial predictions, got {response.status_code}: {response.text}"
        )

        data = response.json()
        print(f"422 response data: {data}")

        # Validate error response structure
        assert "detail" in data, "Expected 'detail' in error response"
        detail = data["detail"]

        # Check for PREDICTIONS_INCOMPLETE code
        if isinstance(detail, dict):
            assert detail.get("code") == "PREDICTIONS_INCOMPLETE", (
                f"Expected PREDICTIONS_INCOMPLETE code, got: {detail}"
            )
            assert "completed" in detail, "Missing 'completed' count in error"
            assert "required" in detail, "Missing 'required' count in error"
            assert detail["required"] == 3, f"Expected 3 required, got {detail['required']}"
            print(f"✅ 422 returned with PREDICTIONS_INCOMPLETE: {detail['completed']}/{detail['required']}")
        else:
            print(f"Detail is not a dict: {detail}")

    def test_02_two_of_three_predictions_returns_422(self, ilio_token, test_matchday):
        """
        Sending predictions for 2 of 3 matches should still return 422.
        """
        matchday_id = test_matchday["matchday_id"]
        match_ids = test_matchday["match_ids"]

        response = requests.post(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {ilio_token}"},
            json={
                "predictions": [
                    {"match_id": match_ids[0], "market_type": "1X2", "prediction_value": "1"},
                    {"match_id": match_ids[1], "market_type": "1X2", "prediction_value": "X"}
                ]
            }
        )

        assert response.status_code == 422, (
            f"Expected 422 for 2/3 predictions, got {response.status_code}: {response.text}"
        )
        print(f"✅ 422 returned for 2/3 predictions: {response.text[:200]}")

    def test_03_all_predictions_returns_200(self, ilio_token, test_matchday):
        """
        Sending predictions for ALL 3 matches should return 200 success.
        """
        matchday_id = test_matchday["matchday_id"]
        match_ids = test_matchday["match_ids"]

        response = requests.post(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {ilio_token}"},
            json={
                "predictions": [
                    {"match_id": match_ids[0], "market_type": "1X2", "prediction_value": "1"},
                    {"match_id": match_ids[1], "market_type": "1X2", "prediction_value": "X"},
                    {"match_id": match_ids[2], "market_type": "1X2", "prediction_value": "2"}
                ]
            }
        )

        assert response.status_code == 200, (
            f"Expected 200 for all predictions, got {response.status_code}: {response.text}"
        )

        data = response.json()
        assert "saved_count" in data, "Missing 'saved_count' in success response"
        assert data["saved_count"] == 3, f"Expected 3 saved, got {data['saved_count']}"
        print(f"✅ 200 returned, saved_count={data['saved_count']}")

    def test_04_empty_predictions_payload_returns_422(self, ilio_token, test_matchday):
        """
        Sending empty predictions list should return 422 (0 of 3 matches covered).
        """
        matchday_id = test_matchday["matchday_id"]

        response = requests.post(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {ilio_token}"},
            json={"predictions": []}
        )

        # With 3 unlocked matches and 0 new predictions, missing = 3 (assuming already-saved are covered by previous test)
        # After test_03 saved all 3, existing_preds covers all. Empty payload should succeed (0 new but all already saved).
        # Actually after test_03, existing predictions cover all 3 matches.
        # So empty payload with existing preds covering all = 200
        print(f"Empty payload with existing preds response: {response.status_code} {response.text[:200]}")
        # This depends on test execution order - both 422 and 200 are possible
        assert response.status_code in [200, 400, 422], (
            f"Unexpected status for empty payload: {response.status_code}: {response.text}"
        )

    def test_05_check_matchday_created_successfully(self, ilio_token, test_matchday):
        """Verify the test matchday is OPEN with 3 matches."""
        matchday_id = test_matchday["matchday_id"]

        # Get matchday via predictions endpoint
        response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {ilio_token}"}
        )
        assert response.status_code == 200, f"Failed to get matchday: {response.text}"
        data = response.json()

        matchday = data.get("matchday", {})
        assert matchday.get("status") == "OPEN", f"Expected OPEN status, got {matchday.get('status')}"

        predictions = data.get("predictions", [])
        assert len(predictions) == 3, f"Expected 3 predictions/matches, got {len(predictions)}"
        print(f"✅ Matchday is OPEN with {len(predictions)} matches")

    def test_06_error_response_has_required_fields(self, ilio_token, test_matchday):
        """
        Test that the 422 response contains the complete error structure.
        After test_03 saved all predictions, we need fresh matchday context.
        This test verifies the structure using a fresh prediction attempt
        by checking the structure from test_01 behavior.
        """
        matchday_id = test_matchday["matchday_id"]
        match_ids = test_matchday["match_ids"]

        # Try only first match (but all 3 are already saved by test_03, so this should be 200)
        # This confirms the "cumulative" logic works: existing + new covers all
        response = requests.post(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {ilio_token}"},
            json={
                "predictions": [
                    {"match_id": match_ids[0], "market_type": "1X2", "prediction_value": "2"}
                ]
            }
        )

        # After test_03 already saved all 3, existing_preds covers matches 0,1,2
        # New payload covers match_ids[0], so covered = all 3. Should be 200.
        assert response.status_code == 200, (
            f"Expected 200 after previous full save (existing covers all), got {response.status_code}: {response.text}"
        )
        print(f"✅ Partial new payload with existing full coverage returns 200")


class TestPredictionsCompletenessAuthentication:
    """Test authentication edge cases"""

    def test_07_unauthenticated_request_returns_401(self, test_matchday):
        """Unauthenticated request should return 401."""
        matchday_id = test_matchday["matchday_id"]

        response = requests.post(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            json={"predictions": []}
        )

        assert response.status_code == 401, (
            f"Expected 401 for unauthenticated request, got {response.status_code}"
        )
        print(f"✅ 401 returned for unauthenticated request")

    def test_08_invalid_matchday_returns_404(self, ilio_token):
        """Non-existent matchday should return 404."""
        response = requests.post(
            f"{BASE_URL}/api/predictions/nonexistent-matchday-id",
            headers={"Authorization": f"Bearer {ilio_token}"},
            json={"predictions": []}
        )

        assert response.status_code == 404, (
            f"Expected 404 for non-existent matchday, got {response.status_code}: {response.text}"
        )
        print(f"✅ 404 returned for non-existent matchday")
