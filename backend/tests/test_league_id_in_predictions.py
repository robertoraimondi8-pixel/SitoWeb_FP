"""
Test: league_id isolation in predictions for national-type private leagues.
Bug fix: predictions now store league_id to isolate data per league.
Ticket: Private national leagues (Desylega) now start from 0.

Test scenarios:
  1. POST /api/predictions/{matchday_id} with league_id → prediction saved with league_id field
  2. GET /api/standings/matchdays?league_id=desylega_id → [] for new league (no predictions yet)
  3. After saving prediction with league_id → matchday appears in standings/matchdays
  4. After deleting test prediction → standings/matchdays returns [] again
  5. GET /api/standings/total?league_id=desylega_id → 0 pts, 0 matchdays for new league
  6. GET /api/home → last_5_performance=[] for user with no predictions
  7. GET /api/standings/weekly/{matchday_id}?league_id=desylega_id → only users with predictions shown
  8. Regression: ilio's manual league data unchanged (last_5: [0,0,4,2], total=6.0 pts)

Credentials:
  - desiree@raimondi.it / Roberto95 → Desylega (national-type private, no predictions)
  - ilio@raimondi.it / password123 → manual league (4 matchdays, 6.0 pts)

Test matchday for Desylega (OPEN, not locked, start_time 2026-04-01):
  - matchday_id: 4b8c8080-b3db-4376-b790-ee0e20e3c8d1
  - match_id: d696aed5-e51e-4f3f-afb2-9b4a25b1924d
"""

import pytest
import requests
import os
import pymongo

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "fantapronostic")

DESY_EMAIL = "desiree@raimondi.it"
DESY_PASS = "Roberto95"
DESY_LEAGUE_ID = "788c822f-325d-4934-87a6-cf989ff68c3e"

ILIO_EMAIL = "ilio@raimondi.it"
ILIO_PASS = "password123"
ILIO_LEAGUE_ID = "1762173a-31fe-463b-9668-d757114f440b"

# Open matchday provided by E1 (start_time 2026-04-01 → not locked in Feb 2026)
TEST_MATCHDAY_ID = "4b8c8080-b3db-4376-b790-ee0e20e3c8d1"
TEST_MATCH_ID = "d696aed5-e51e-4f3f-afb2-9b4a25b1924d"


def get_token(email: str, password: str) -> str:
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def get_user_id(token: str) -> str:
    resp = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert resp.status_code == 200, f"GET /me failed: {resp.text}"
    return resp.json()["id"]


def cleanup_test_predictions_mongo(user_id: str, matchday_id: str, league_id: str):
    """Cleanup test predictions directly from MongoDB using synchronous pymongo."""
    client = pymongo.MongoClient(MONGO_URL)
    db = client[DB_NAME]
    result = db.predictions.delete_many({
        "user_id": user_id,
        "matchday_id": matchday_id,
        "league_id": league_id,
    })
    client.close()
    print(f"[CLEANUP] Deleted {result.deleted_count} test predictions for user={user_id[:8]}, matchday={matchday_id[:8]}, league={league_id[:8]}")
    return result.deleted_count


# ─── CLASS 1: Desylega starts from 0 (no predictions) ───────────────────────

class TestDesylegaStartsFromZero:
    """Verify Desylega starts with empty standings before any predictions."""

    @pytest.fixture(scope="class")
    def desy_token(self):
        return get_token(DESY_EMAIL, DESY_PASS)

    def test_standings_matchdays_empty_for_new_league(self, desy_token):
        """standings/matchdays must be [] for new national-type league with no predictions."""
        resp = requests.get(
            f"{BASE_URL}/api/standings/matchdays",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) == 0, (
            f"FAIL: standings/matchdays should be [] for new league with no predictions. "
            f"Got {len(data)} matchdays: {data}. "
            f"Fix NOT working - historical national matchdays leaking."
        )
        print(f"PASS: standings/matchdays = [] for Desylega (no predictions yet)")

    def test_standings_total_zero_points_no_predictions(self, desy_token):
        """standings/total must show 0 pts, 0 matchdays_played for Desylega with no predictions."""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        entries = data.get("entries", [])
        assert len(entries) >= 1, "Desylega must have at least 1 member (Desy)"

        # Find Desy in entries
        user_id = get_user_id(desy_token)
        desy_entry = next((e for e in entries if e.get("user_id") == user_id), None)
        assert desy_entry is not None, f"Desy user_id={user_id[:8]} not found in entries: {entries}"

        total_pts = desy_entry.get("total_points", -1)
        assert total_pts == 0, f"Expected 0 pts, got {total_pts} (predictions leak?)"
        md_played = desy_entry.get("matchdays_played", -1)
        assert md_played == 0, f"Expected 0 matchdays_played, got {md_played} (score_summaries leak?)"
        print(f"PASS: Desy standings total_points={total_pts}, matchdays_played={md_played}")

    def test_home_last_5_empty_no_predictions(self, desy_token):
        """home last_5_performance must be [] when Desy has no predictions in Desylega."""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        last_5 = data.get("last_5_performance", "MISSING")
        assert last_5 != "MISSING", "last_5_performance key missing from home response"
        assert isinstance(last_5, list), f"Expected list, got {type(last_5)}"
        assert len(last_5) == 0, (
            f"FAIL: last_5_performance should be [] for user with no predictions. "
            f"Got {last_5}. Historical national matchdays leaking!"
        )
        print(f"PASS: home last_5_performance = [] for Desylega (no predictions)")


# ─── CLASS 2: Save prediction with league_id and verify isolation ─────────────

class TestSavePredictionWithLeagueId:
    """
    E2E test: save prediction with league_id → verify matchday appears → cleanup → verify empty again.
    """

    @pytest.fixture(scope="class")
    def desy_token(self):
        return get_token(DESY_EMAIL, DESY_PASS)

    @pytest.fixture(scope="class")
    def desy_user_id(self, desy_token):
        return get_user_id(desy_token)

    def test_save_prediction_returns_200(self, desy_token):
        """POST /api/predictions/{matchday_id} with league_id must return 200 and save prediction."""
        payload = {
            "predictions": [
                {
                    "match_id": TEST_MATCH_ID,
                    "prediction_value": "1",
                    "market_type": "1X2"
                }
            ],
            "league_id": DESY_LEAGUE_ID
        }
        resp = requests.post(
            f"{BASE_URL}/api/predictions/{TEST_MATCHDAY_ID}",
            json=payload,
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, (
            f"POST predictions failed: {resp.status_code} {resp.text}"
        )
        data = resp.json()
        saved_count = data.get("saved_count", 0)
        assert saved_count >= 1, f"Expected at least 1 prediction saved, got saved_count={saved_count}"
        errors = data.get("errors", [])
        assert len(errors) == 0, f"Unexpected errors in prediction save: {errors}"
        print(f"PASS: POST predictions saved_count={saved_count}, errors={errors}")

    def test_prediction_has_league_id_in_db(self, desy_user_id):
        """Verify prediction document in MongoDB has league_id=desylega_id field."""
        client = pymongo.MongoClient(MONGO_URL)
        db = client[DB_NAME]
        pred = db.predictions.find_one({
            "user_id": desy_user_id,
            "matchday_id": TEST_MATCHDAY_ID,
            "match_id": TEST_MATCH_ID,
        })
        client.close()
        assert pred is not None, (
            f"Prediction not found in DB for user={desy_user_id[:8]}, "
            f"matchday={TEST_MATCHDAY_ID[:8]}, match={TEST_MATCH_ID[:8]}"
        )
        saved_league_id = pred.get("league_id")
        assert saved_league_id == DESY_LEAGUE_ID, (
            f"FAIL: prediction.league_id should be {DESY_LEAGUE_ID[:8]}, "
            f"got {saved_league_id}. league_id not being saved in predictions!"
        )
        print(f"PASS: prediction.league_id = {saved_league_id[:8]}... (correct)")

    def test_standings_matchdays_shows_matchday_after_prediction(self, desy_token):
        """After saving prediction with league_id, standings/matchdays must return the matchday."""
        resp = requests.get(
            f"{BASE_URL}/api/standings/matchdays",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) >= 1, (
            f"FAIL: after saving prediction with league_id, standings/matchdays should "
            f"return at least 1 matchday. Got []. Fix NOT working!"
        )
        # Verify our test matchday is in the result
        md_ids = [m.get("id") for m in data]
        assert TEST_MATCHDAY_ID in md_ids, (
            f"FAIL: test matchday {TEST_MATCHDAY_ID[:8]} not found in standings/matchdays. "
            f"Got: {md_ids}"
        )
        print(f"PASS: standings/matchdays returns {len(data)} matchday(s) after prediction saved: {md_ids}")

    def test_weekly_standings_only_users_with_predictions(self, desy_token, desy_user_id):
        """standings/weekly for the test matchday should show only Desy (the only user who played)."""
        resp = requests.get(
            f"{BASE_URL}/api/standings/weekly/{TEST_MATCHDAY_ID}",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        entries = data.get("entries", [])
        # Only users who played this matchday for Desylega should appear
        user_ids_in_entries = [e.get("user_id") for e in entries]
        assert desy_user_id in user_ids_in_entries, (
            f"Desy (user_id={desy_user_id[:8]}) should be in weekly standings entries. Got: {user_ids_in_entries}"
        )
        # Should be exactly 1 entry (only Desy played this matchday for Desylega)
        assert len(entries) == 1, (
            f"Only 1 user played matchday for Desylega. Expected 1 entry, got {len(entries)}: {entries}"
        )
        print(f"PASS: weekly standings has exactly {len(entries)} user(s) (only those who played for Desylega)")

    def test_cleanup_predictions_and_standings_empty(self, desy_token, desy_user_id):
        """After deleting test predictions, standings/matchdays must return [] again."""
        # Cleanup via MongoDB
        deleted = cleanup_test_predictions_mongo(desy_user_id, TEST_MATCHDAY_ID, DESY_LEAGUE_ID)
        assert deleted >= 1, f"Expected to delete at least 1 test prediction, got {deleted}"
        print(f"[CLEANUP] Deleted {deleted} test prediction(s)")

        # Verify standings/matchdays is empty again
        resp = requests.get(
            f"{BASE_URL}/api/standings/matchdays",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) == 0, (
            f"FAIL: after deleting test predictions, standings/matchdays should be [] again. "
            f"Got {len(data)} matchdays: {data}"
        )
        print(f"PASS: standings/matchdays = [] after cleanup (no leaked matchdays)")

    def test_standings_total_still_zero_after_cleanup(self, desy_token, desy_user_id):
        """After cleanup, standings/total should show 0 pts, 0 matchdays again."""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        entries = data.get("entries", [])
        desy_entry = next((e for e in entries if e.get("user_id") == desy_user_id), None)
        if desy_entry:
            total_pts = desy_entry.get("total_points", -1)
            assert total_pts == 0, f"After cleanup, total_points should be 0, got {total_pts}"
            print(f"PASS: after cleanup, Desy total_points={total_pts} (correct)")
        else:
            print(f"INFO: Desy not found in standings after cleanup (expected for national-type with no predictions)")


# ─── CLASS 3: Regression - ilio's manual league ────────────────────────────

class TestIlioManualLeagueRegression:
    """
    Regression test: ilio's manual league must not be broken by the league_id fix.
    Expected: last_5=[{md:1,pts:0},{md:2,pts:0},{md:3,pts:4},{md:4,pts:2}], total=6.0pts
    """

    @pytest.fixture(scope="class")
    def ilio_token(self):
        return get_token(ILIO_EMAIL, ILIO_PASS)

    @pytest.fixture(scope="class")
    def ilio_user_id(self, ilio_token):
        return get_user_id(ilio_token)

    def test_home_returns_200(self, ilio_token):
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: GET /api/home returns 200 for ilio's manual league")

    def test_last_5_total_is_6_points(self, ilio_token):
        """ilio total of last_5 should be 6.0 pts (0+0+4+2)."""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        last_5 = data.get("last_5_performance", [])
        assert isinstance(last_5, list), f"Expected list, got {type(last_5)}"
        assert len(last_5) == 4, f"Expected 4 matchdays in last_5, got {len(last_5)}: {last_5}"
        total = sum(e["points"] for e in last_5)
        assert abs(total - 6.0) < 0.01, f"Expected total=6.0pts, got {total}. last_5={last_5}"
        print(f"PASS: ilio last_5 total={total} (expected 6.0)")

    def test_last_5_individual_matchday_points(self, ilio_token):
        """md1=0, md2=0, md3=4, md4=2."""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        last_5 = data.get("last_5_performance", [])
        pts_map = {entry["matchday_number"]: entry["points"] for entry in last_5}
        expected = {1: 0.0, 2: 0.0, 3: 4.0, 4: 2.0}
        for md_num, expected_pts in expected.items():
            actual = pts_map.get(md_num)
            assert actual is not None, f"Matchday {md_num} missing from last_5: {last_5}"
            assert abs(actual - expected_pts) < 0.01, (
                f"Matchday {md_num}: expected {expected_pts}pts, got {actual}"
            )
        print(f"PASS: ilio individual matchday pts: {pts_map}")

    def test_standings_total_ilio_6_points(self, ilio_token, ilio_user_id):
        """ilio should have 6.0 total points in standings."""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        entries = data.get("entries", [])
        ilio_entry = next((e for e in entries if e.get("user_id") == ilio_user_id), None)
        assert ilio_entry is not None, f"ilio not found in standings. entries={entries}"
        total_pts = ilio_entry.get("total_points", -1)
        assert abs(total_pts - 6.0) < 0.01, f"Expected ilio total_points=6.0, got {total_pts}"
        print(f"PASS: ilio standings total_points={total_pts}")

    def test_standings_matchdays_returns_ilio_matchdays(self, ilio_token):
        """ilio's manual league standings/matchdays should return 4 matchdays."""
        resp = requests.get(
            f"{BASE_URL}/api/standings/matchdays",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) >= 4, (
            f"Expected at least 4 matchdays for ilio's manual league, got {len(data)}: {data}"
        )
        print(f"PASS: ilio standings/matchdays returns {len(data)} matchday(s)")
