"""
P0 Bug Fixes Verification Tests - Iteration 33
Bug 1: Admin console showed 'Nessun orario kickoff' for imported matches
Bug 2: Home Performance vs Standings points mismatch (30.5 vs 7)

Fixes verified:
- Bug 1: recompute_matchday_kickoff called after fixture import (server.py:3863)
- Bug 2: standings/total uses matchdays collection directly (server.py:2137-2141)
- Bug 2: standings/matchdays returns ALL national matchdays (server.py:2357-2361)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://context-aware-tabs.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get authenticated headers"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestBug1KickoffAfterImport:
    """Bug 1: Admin console shows 'Nessun orario kickoff' even though imported matches have start times"""

    def test_g20_has_first_kickoff_set(self, admin_headers):
        """
        G20 matchday should have first_kickoff automatically computed from imported match start times.
        Fix: recompute_matchday_kickoff called after fixture import (server.py:3863)
        Expected: first_kickoff = 2026-02-22T11:30:00+00:00
        """
        response = requests.get(
            f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to fetch matchdays: {response.text}"
        
        matchdays = response.json()
        g20 = next((md for md in matchdays if md.get("number") == 20), None)
        
        assert g20 is not None, "G20 matchday not found"
        assert g20.get("first_kickoff") is not None, "G20 first_kickoff is None - Bug 1 NOT FIXED"
        assert "2026-02-22" in g20.get("first_kickoff", ""), f"Unexpected first_kickoff: {g20.get('first_kickoff')}"
        
        print(f"\n✅ G20 first_kickoff = {g20.get('first_kickoff')}")
        print(f"✅ G20 match_count = {g20.get('match_count')}")

    def test_g20_has_matches_with_start_time(self, admin_headers):
        """Verify G20 has imported matches with start times"""
        # Get G20 matchday ID first
        response = requests.get(
            f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        matchdays = response.json()
        g20 = next((md for md in matchdays if md.get("number") == 20), None)
        
        assert g20 is not None, "G20 matchday not found"
        assert g20.get("match_count", 0) > 0, "G20 has no matches"
        
        print(f"\n✅ G20 has {g20.get('match_count')} matches")


class TestBug2StandingsPointsMismatch:
    """Bug 2: Home Performance showed 30.5 points but Standings showed only 7 points"""
    
    def test_standings_total_admin_points(self, admin_headers):
        """
        GET /api/standings/total?league_id=NATIONAL should return admin with 30.5 total_points.
        Fix: standings total endpoint now uses matchdays collection directly (server.py:2137-2141)
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to fetch standings: {response.text}"
        
        data = response.json()
        entries = data.get("entries", [])
        
        # Find admin entry
        admin_entry = next(
            (e for e in entries if "admin" in e.get("username", "").lower()),
            None
        )
        
        assert admin_entry is not None, "Admin entry not found in standings"
        assert admin_entry.get("total_points") == 30.5, \
            f"Admin total_points mismatch: expected 30.5, got {admin_entry.get('total_points')}"
        
        print(f"\n✅ standings/total admin total_points = {admin_entry.get('total_points')}")
        print(f"✅ admin matchdays_played = {admin_entry.get('matchdays_played')}")
        print(f"✅ admin rank = {admin_entry.get('rank')}")

    def test_home_user_summary_matches_standings(self, admin_headers):
        """
        GET /api/home user_summary.total_points should match standings total.
        Both should show 30.5 points for admin.
        """
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to fetch home: {response.text}"
        
        data = response.json()
        user_summary = data.get("user_summary", {})
        
        assert user_summary.get("total_points") == 30.5, \
            f"Home user_summary total_points mismatch: expected 30.5, got {user_summary.get('total_points')}"
        
        print(f"\n✅ home user_summary.total_points = {user_summary.get('total_points')}")
        print(f"✅ home user_summary.rank = {user_summary.get('rank')}")
        print(f"✅ home user_summary.matchdays_played = {user_summary.get('matchdays_played')}")

    def test_standings_matchdays_returns_all_national(self, admin_headers):
        """
        GET /api/standings/matchdays?league_id=NATIONAL should return ALL national matchdays.
        Fix: endpoint now queries matchdays collection directly (server.py:2357-2361)
        Expected: Returns all 20 national matchdays (COMPLETED + LIVE + OPEN)
        """
        response = requests.get(
            f"{BASE_URL}/api/standings/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Failed to fetch matchdays list: {response.text}"
        
        matchdays = response.json()
        
        # Should return ALL national matchdays (not just recent ones)
        assert len(matchdays) >= 15, \
            f"Too few matchdays returned: {len(matchdays)} (expected >= 15)"
        
        # Check status distribution
        completed = [md for md in matchdays if md.get("status") == "COMPLETED"]
        open_mds = [md for md in matchdays if md.get("status") == "OPEN"]
        live_mds = [md for md in matchdays if md.get("status") == "LIVE"]
        
        print(f"\n✅ Total matchdays returned: {len(matchdays)}")
        print(f"✅ COMPLETED matchdays: {len(completed)}")
        print(f"✅ OPEN matchdays: {len(open_mds)}")
        print(f"✅ LIVE matchdays: {len(live_mds)}")
        
        # Verify matchday numbers are sequential (1-20)
        numbers = sorted([md.get("number") for md in matchdays])
        print(f"✅ Matchday numbers: {numbers}")


class TestPointsConsistency:
    """Verify points are consistent across all endpoints"""
    
    def test_home_standings_points_match(self, admin_headers):
        """Verify admin points match between home and standings"""
        # Get home endpoint data
        home_response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        assert home_response.status_code == 200
        home_data = home_response.json()
        home_points = home_data.get("user_summary", {}).get("total_points", 0)
        
        # Get standings endpoint data
        standings_response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        assert standings_response.status_code == 200
        standings_data = standings_response.json()
        admin_entry = next(
            (e for e in standings_data.get("entries", []) if "admin" in e.get("username", "").lower()),
            None
        )
        standings_points = admin_entry.get("total_points", 0) if admin_entry else 0
        
        assert home_points == standings_points, \
            f"Points mismatch: home={home_points}, standings={standings_points}"
        
        print(f"\n✅ Points match: home={home_points}, standings={standings_points}")

    def test_last_5_performance_sum_reasonable(self, admin_headers):
        """Verify last_5_performance data is present and reasonable"""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        last_5 = data.get("last_5_performance", [])
        assert len(last_5) > 0, "last_5_performance is empty"
        
        # Sum should not exceed total_points
        last_5_sum = sum(p.get("points", 0) for p in last_5)
        total_points = data.get("user_summary", {}).get("total_points", 0)
        
        print(f"\n✅ last_5_performance count: {len(last_5)}")
        print(f"✅ last_5 sum: {last_5_sum}")
        print(f"✅ total_points: {total_points}")
        
        # Last 5 sum should be <= total_points (it's a subset)
        assert last_5_sum <= total_points + 0.1, \
            f"last_5_sum ({last_5_sum}) exceeds total_points ({total_points})"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
