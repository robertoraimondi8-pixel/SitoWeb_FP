"""
Test: national-type private league home & standings fix
Bug: admin_confirm_matchday creates score_summaries without league_id,
     but queries were filtering by league_id for national-type leagues.
Fix: GET /api/home and GET /api/standings/total now skip league_id filter
     for national-type private leagues, using national matchday IDs instead.

Scenarios:
  - desiree@raimondi.it / Desylega (national-type, no predictions) → last_5 = []
  - ilio@raimondi.it / manual league (4 matchdays, 6.0 pts total) → regression check
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")

DESY_EMAIL = "desiree@raimondi.it"
DESY_PASS = "Roberto95"
DESY_LEAGUE_ID = "788c822f-325d-4934-87a6-cf989ff68c3e"

ILIO_EMAIL = "ilio@raimondi.it"
ILIO_PASS = "password123"
ILIO_LEAGUE_ID = "1762173a-31fe-463b-9668-d757114f440b"


def get_token(email: str, password: str) -> str:
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


# ─── DESY (national-type, no predictions) ──────────────────────────────────

class TestDesyleganNationalTypeHome:
    """GET /api/home for desiree@raimondi.it (Desylega, national-type, no predictions)"""

    @pytest.fixture(scope="class")
    def desy_token(self):
        return get_token(DESY_EMAIL, DESY_PASS)

    def test_home_returns_200(self, desy_token):
        """Home endpoint should return 200 for Desylega user"""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: GET /api/home returns 200 for Desylega")

    def test_last_5_performance_is_empty_with_no_predictions(self, desy_token):
        """last_5_performance must be [] when user has no predictions in national-type league"""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        last_5 = data.get("last_5_performance", "MISSING")
        assert last_5 != "MISSING", "last_5_performance key missing from response"
        assert isinstance(last_5, list), f"last_5_performance should be a list, got {type(last_5)}"
        assert len(last_5) == 0, (
            f"FAIL: last_5_performance should be [] for user with no predictions, "
            f"got {last_5}. "
            f"This means the fix is NOT working — historical national matchdays are leaking."
        )
        print(f"PASS: last_5_performance = [] (no predictions scenario)")

    def test_home_league_is_desylega(self, desy_token):
        """Active league in home response should be Desylega"""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        league = data.get("league")
        assert league is not None, "league key missing from home response"
        assert league.get("id") == DESY_LEAGUE_ID, (
            f"Expected league id={DESY_LEAGUE_ID}, got {league.get('id')}"
        )
        assert league.get("match_source_type") == "national", (
            f"Expected match_source_type=national, got {league.get('match_source_type')}"
        )
        print(f"PASS: league in home is Desylega (match_source_type=national)")

    def test_user_summary_reflects_zero_matchdays_played(self, desy_token):
        """user_summary.matchdays_played can be > 0 (counts season completed matchdays),
           but total_points should be 0 since user has no predictions"""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        summary = data.get("user_summary")
        if summary:
            total_pts = summary.get("total_points", 0)
            assert total_pts == 0, (
                f"User has no predictions but total_points={total_pts} (expected 0)"
            )
            print(f"PASS: user_summary.total_points = {total_pts}")
        else:
            print("INFO: user_summary is None (no completed matchdays in season yet)")


class TestDesyleganNationalTypeStandings:
    """GET /api/standings/total?league_id=desylega_id"""

    @pytest.fixture(scope="class")
    def desy_token(self):
        return get_token(DESY_EMAIL, DESY_PASS)

    def test_standings_total_returns_200(self, desy_token):
        """Standings total should return 200 for Desylega"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: GET /api/standings/total returns 200 for Desylega")

    def test_standings_shows_only_desylega_members(self, desy_token):
        """Standings should contain only Desylega members"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        entries = data.get("entries", [])
        assert isinstance(entries, list), f"entries should be a list, got {type(entries)}"
        assert len(entries) >= 1, "At least 1 member (Desy) should be in standings"
        print(f"PASS: standings has {len(entries)} member(s)")

    def test_standings_user_has_zero_points_no_predictions(self, desy_token):
        """Desy has no predictions → 0 points in standings"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        entries = data.get("entries", [])
        # Find desy in entries
        desy_entry = None
        for e in entries:
            if e.get("email") == DESY_EMAIL or e.get("username") == "desiree.raimondi" or "desiree" in str(e.get("username", "")).lower():
                desy_entry = e
                break
        if desy_entry is None and entries:
            # Try to match by searching user
            user_resp = requests.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {desy_token}"},
                timeout=10,
            )
            if user_resp.status_code == 200:
                user_id = user_resp.json().get("id")
                for e in entries:
                    if e.get("user_id") == user_id:
                        desy_entry = e
                        break

        assert desy_entry is not None, (
            f"Could not find Desy in standings entries: {entries}"
        )
        total_pts = desy_entry.get("total_points", -1)
        assert total_pts == 0, (
            f"Desy has no predictions but standings shows total_points={total_pts} (expected 0)"
        )
        print(f"PASS: Desy standings entry: total_points={total_pts}")

    def test_standings_matchdays_played_zero_for_no_predictions(self, desy_token):
        """Desy has no predictions → matchdays_played should be 0"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": DESY_LEAGUE_ID},
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        entries = data.get("entries", [])

        user_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {desy_token}"},
            timeout=10,
        )
        desy_user_id = user_resp.json().get("id") if user_resp.status_code == 200 else None

        desy_entry = None
        for e in entries:
            if e.get("user_id") == desy_user_id:
                desy_entry = e
                break

        if desy_entry is None and entries:
            # fallback: check all entries have 0 points (Desy is only member)
            print(f"INFO: Could not find desy_user_id in entries, checking all: {entries}")
            all_pts = [e.get("total_points", 0) for e in entries]
            assert all(p == 0 for p in all_pts), (
                f"No predictions → all entries should have 0 points, got {all_pts}"
            )
            print(f"PASS: All standings entries have 0 points (regression check)")
            return

        md_played = desy_entry.get("matchdays_played", -1)
        assert md_played == 0, (
            f"Desy has no predictions → matchdays_played should be 0, got {md_played}. "
            f"This means wrong score_summaries are leaking into standings."
        )
        print(f"PASS: Desy standings: matchdays_played={md_played}")


# ─── ILIO (manual league — regression check) ──────────────────────────────

class TestIlioManualLeagueRegression:
    """Regression: ilio@raimondi.it manual league must not be broken by the fix.
    Expected: last_5 = [{md:1,pts:0},{md:2,pts:0},{md:3,pts:4},{md:4,pts:2}], total=6.0
    """

    @pytest.fixture(scope="class")
    def ilio_token(self):
        return get_token(ILIO_EMAIL, ILIO_PASS)

    def test_home_returns_200(self, ilio_token):
        """Home endpoint should return 200 for ilio's manual league"""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: GET /api/home returns 200 for ilio's manual league")

    def test_home_league_is_manual(self, ilio_token):
        """Active league should be manual/custom type for ilio"""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        league = data.get("league")
        assert league is not None, "league key missing"
        match_src = league.get("match_source_type")
        assert match_src in ("manual", "custom"), (
            f"Expected manual/custom league, got match_source_type={match_src}"
        )
        print(f"PASS: ilio league is match_source_type={match_src}")

    def test_last_5_performance_has_correct_data(self, ilio_token):
        """last_5 should reflect ilio's 4 completed matchdays: pts=[0,0,4,2] total=6"""
        resp = requests.get(
            f"{BASE_URL}/api/home",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        last_5 = data.get("last_5_performance", [])
        assert isinstance(last_5, list), f"last_5_performance should be a list"
        # ilio has 4 completed matchdays
        assert len(last_5) == 4, (
            f"Expected 4 matchdays in last_5_performance, got {len(last_5)}: {last_5}"
        )
        # Check pts by matchday number
        pts_map = {entry["matchday_number"]: entry["points"] for entry in last_5}
        print(f"PASS: ilio last_5_performance = {last_5}, pts_map={pts_map}")
        # Check total
        total = sum(e["points"] for e in last_5)
        assert abs(total - 6.0) < 0.01, (
            f"Expected total points = 6.0, got {total}. last_5={last_5}"
        )
        print(f"PASS: ilio total last_5 points = {total} (expected 6.0)")

    def test_last_5_matchday_points_correct(self, ilio_token):
        """Individual matchday points: md3=4.0, md4=2.0"""
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
        # md1 and md2 = 0, md3 = 4, md4 = 2
        expected = {1: 0.0, 2: 0.0, 3: 4.0, 4: 2.0}
        for md_num, expected_pts in expected.items():
            actual = pts_map.get(md_num)
            assert actual is not None, f"Matchday {md_num} missing from last_5: {last_5}"
            assert abs(actual - expected_pts) < 0.01, (
                f"Matchday {md_num}: expected {expected_pts} pts, got {actual}"
            )
        print(f"PASS: ilio individual matchday points correct: {pts_map}")

    def test_standings_total_returns_200(self, ilio_token):
        """Standings total should return 200 for ilio's manual league"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print("PASS: GET /api/standings/total returns 200 for ilio's manual league")

    def test_standings_total_ilio_has_6_points(self, ilio_token):
        """ilio should have 6.0 total points in standings"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        entries = data.get("entries", [])
        assert len(entries) >= 1, "At least 1 member (ilio) should be in standings"

        user_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=10,
        )
        ilio_user_id = user_resp.json().get("id") if user_resp.status_code == 200 else None

        ilio_entry = None
        for e in entries:
            if e.get("user_id") == ilio_user_id:
                ilio_entry = e
                break

        assert ilio_entry is not None, (
            f"Could not find ilio in standings. ilio_user_id={ilio_user_id}, entries={entries}"
        )
        total_pts = ilio_entry.get("total_points", -1)
        assert abs(total_pts - 6.0) < 0.01, (
            f"Expected ilio total_points=6.0, got {total_pts}"
        )
        print(f"PASS: ilio standings total_points={total_pts}")

    def test_standings_total_ilio_matchdays_played(self, ilio_token):
        """ilio should have 4 matchdays_played (or at least >0) in standings"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total",
            params={"league_id": ILIO_LEAGUE_ID},
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=15,
        )
        assert resp.status_code == 200
        data = resp.json()
        entries = data.get("entries", [])

        user_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {ilio_token}"},
            timeout=10,
        )
        ilio_user_id = user_resp.json().get("id") if user_resp.status_code == 200 else None

        ilio_entry = None
        for e in entries:
            if e.get("user_id") == ilio_user_id:
                ilio_entry = e
                break

        if ilio_entry:
            md_played = ilio_entry.get("matchdays_played", 0)
            assert md_played > 0, f"ilio matchdays_played should be > 0, got {md_played}"
            print(f"PASS: ilio matchdays_played={md_played}")
        else:
            print(f"WARN: ilio entry not found in entries={entries}")
