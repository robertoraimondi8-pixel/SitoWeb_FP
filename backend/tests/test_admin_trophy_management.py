"""
Admin Trophy Management Tests
-----------------------------
Tests for the admin trophy management endpoints and UI features:
- GET /api/admin/trophies/stats - trophy statistics
- POST /api/admin/leagues/{league_id}/award-trophies - award league trophies
- POST /api/admin/tournaments/{tournament_id}/award-trophies - tournament trophies
- POST /api/admin/trophies/backfill - retroactive backfill
- GET /api/trophies/my - user's personal trophies
- Duplicate prevention testing
"""
import pytest
import requests
import os

# Public URL for testing
BASE_URL = "https://context-aware-tabs.preview.emergentagent.com"

# Test credentials from problem statement
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASS = "admin123"
USER_EMAIL = "ilio@raimondi.it"
USER_PASS = "password123"

# Test IDs from problem statement
LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"  # Lega Nazionale FantaPronostic
TOURNAMENT_ID = "b3e9021f-b8a6-4f65-ad83-fc7b778f922a"  # TEST_LC_tb901 - knockout, NOT completed


class TestAdminTrophyStats:
    """Tests for GET /api/admin/trophies/stats endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Admin login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.admin_id = login_resp.json().get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_trophy_stats_returns_200(self):
        """GET /api/admin/trophies/stats should return 200"""
        response = self.session.get(f"{BASE_URL}/api/admin/trophies/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/admin/trophies/stats returned 200")
    
    def test_trophy_stats_structure(self):
        """Trophy stats should have total, by_type, and recent fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/trophies/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "total" in data, "Response missing 'total' field"
        assert "by_type" in data, "Response missing 'by_type' field"
        assert "recent" in data, "Response missing 'recent' field"
        
        assert isinstance(data["total"], int), "Total should be an integer"
        assert isinstance(data["by_type"], dict), "by_type should be a dict"
        assert isinstance(data["recent"], list), "recent should be a list"
        
        print(f"✓ Trophy stats structure correct: total={data['total']}, types={len(data['by_type'])}, recent={len(data['recent'])}")
    
    def test_trophy_stats_by_type_content(self):
        """by_type should contain trophy type counts"""
        response = self.session.get(f"{BASE_URL}/api/admin/trophies/stats")
        data = response.json()
        
        by_type = data["by_type"]
        
        # Check if expected trophy types are present (may be empty if no trophies)
        expected_types = ["weekly_best", "weekly_perfect", "league_champion", "league_second", "league_third"]
        
        for trophy_type, count in by_type.items():
            assert isinstance(count, int), f"Count for {trophy_type} should be int"
            assert count >= 0, f"Count for {trophy_type} should be >= 0"
        
        print(f"✓ by_type contains valid counts: {by_type}")
    
    def test_trophy_stats_recent_trophies(self):
        """Recent trophies should have proper trophy structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/trophies/stats")
        data = response.json()
        
        if data["recent"]:
            trophy = data["recent"][0]
            assert "id" in trophy, "Trophy missing 'id'"
            assert "user_id" in trophy, "Trophy missing 'user_id'"
            assert "type" in trophy, "Trophy missing 'type'"
            assert "awarded_at" in trophy, "Trophy missing 'awarded_at'"
            print(f"✓ Recent trophies have proper structure. First: {trophy['type']} to user {trophy['user_id'][:8]}...")
        else:
            print("✓ No recent trophies (empty list is valid)")


class TestAwardLeagueTrophies:
    """Tests for POST /api/admin/leagues/{league_id}/award-trophies"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_award_league_trophies_returns_success(self):
        """POST /api/admin/leagues/{league_id}/award-trophies should work"""
        response = self.session.post(f"{BASE_URL}/api/admin/leagues/{LEAGUE_ID}/award-trophies")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Response should have ok=True"
        assert "message" in data, "Response should have message"
        
        print(f"✓ Award league trophies successful: {data['message']}")
    
    def test_award_league_trophies_invalid_id(self):
        """Award trophies for non-existent league should return 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.post(f"{BASE_URL}/api/admin/leagues/{fake_id}/award-trophies")
        assert response.status_code == 404, f"Expected 404 for fake league, got {response.status_code}"
        print(f"✓ Award trophies for invalid league returns 404")
    
    def test_award_league_trophies_requires_admin(self):
        """Award league trophies should require admin permission"""
        # Login as regular user
        user_session = requests.Session()
        user_session.headers.update({"Content-Type": "application/json"})
        
        login_resp = user_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASS
        })
        assert login_resp.status_code == 200
        user_session.headers.update({"Authorization": f"Bearer {login_resp.json()['access_token']}"})
        
        response = user_session.post(f"{BASE_URL}/api/admin/leagues/{LEAGUE_ID}/award-trophies")
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        
        user_session.close()
        print(f"✓ Award league trophies requires admin permission")


class TestAwardTournamentTrophies:
    """Tests for POST /api/admin/tournaments/{tournament_id}/award-trophies"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_award_tournament_trophies_success(self):
        """POST /api/admin/tournaments/{tournament_id}/award-trophies should return 200"""
        # Note: TEST_LC_tb901 is status='knockout' (not completed), so no trophies will be awarded
        # but the endpoint should still return success
        response = self.session.post(f"{BASE_URL}/api/admin/tournaments/{TOURNAMENT_ID}/award-trophies")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Response should have ok=True"
        
        print(f"✓ Award tournament trophies endpoint works (tournament status: knockout)")
    
    def test_award_tournament_trophies_invalid_id(self):
        """Award trophies for non-existent tournament should return 404"""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.post(f"{BASE_URL}/api/admin/tournaments/{fake_id}/award-trophies")
        assert response.status_code == 404, f"Expected 404 for fake tournament, got {response.status_code}"
        print(f"✓ Award trophies for invalid tournament returns 404")


class TestTrophiesBackfill:
    """Tests for POST /api/admin/trophies/backfill"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_backfill_trophies_returns_success(self):
        """POST /api/admin/trophies/backfill should return 200 with results"""
        response = self.session.post(f"{BASE_URL}/api/admin/trophies/backfill")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Response should have ok=True"
        assert "weekly_processed" in data, "Response missing 'weekly_processed'"
        assert "league_champion_processed" in data, "Response missing 'league_champion_processed'"
        assert "tournament_champion_processed" in data, "Response missing 'tournament_champion_processed'"
        
        print(f"✓ Backfill successful: weekly={data['weekly_processed']}, league={data['league_champion_processed']}, tournament={data['tournament_champion_processed']}")
    
    def test_backfill_trophies_has_errors_field(self):
        """Backfill response should have errors field (even if empty)"""
        response = self.session.post(f"{BASE_URL}/api/admin/trophies/backfill")
        data = response.json()
        
        assert "errors" in data, "Response missing 'errors' field"
        assert isinstance(data["errors"], list), "errors should be a list"
        
        if data["errors"]:
            print(f"⚠ Backfill had {len(data['errors'])} errors: {data['errors'][:3]}...")
        else:
            print(f"✓ Backfill completed with no errors")


class TestUserTrophies:
    """Tests for GET /api/trophies/my - user's personal trophies"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup user session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASS
        })
        assert login_resp.status_code == 200, f"User login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.user_id = login_resp.json().get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_get_my_trophies_returns_200(self):
        """GET /api/trophies/my should return 200"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/trophies/my returned 200")
    
    def test_get_my_trophies_structure(self):
        """User trophies should have total, counts, and trophies fields"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        
        assert "total" in data, "Response missing 'total'"
        assert "counts" in data, "Response missing 'counts'"
        assert "trophies" in data, "Response missing 'trophies'"
        
        # Check counts structure
        counts = data["counts"]
        assert "league" in counts, "counts missing 'league'"
        assert "tournament" in counts, "counts missing 'tournament'"
        assert "weekly" in counts, "counts missing 'weekly'"
        
        print(f"✓ User trophies structure correct: total={data['total']}")
        print(f"  League: champion={counts['league'].get('league_champion', 0)}, 2nd={counts['league'].get('league_second', 0)}, 3rd={counts['league'].get('league_third', 0)}")
        print(f"  Weekly: best={counts['weekly'].get('weekly_best', 0)}, perfect={counts['weekly'].get('weekly_perfect', 0)}")


class TestDuplicatePrevention:
    """Tests for duplicate trophy prevention"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_award_trophies_twice_no_duplicates(self):
        """Calling award-trophies twice should NOT create duplicate trophies"""
        # Get initial trophy stats
        stats_before = self.session.get(f"{BASE_URL}/api/admin/trophies/stats").json()
        initial_total = stats_before["total"]
        
        # Award league trophies twice
        response1 = self.session.post(f"{BASE_URL}/api/admin/leagues/{LEAGUE_ID}/award-trophies")
        assert response1.status_code == 200
        
        stats_after_first = self.session.get(f"{BASE_URL}/api/admin/trophies/stats").json()
        total_after_first = stats_after_first["total"]
        
        response2 = self.session.post(f"{BASE_URL}/api/admin/leagues/{LEAGUE_ID}/award-trophies")
        assert response2.status_code == 200
        
        stats_after_second = self.session.get(f"{BASE_URL}/api/admin/trophies/stats").json()
        total_after_second = stats_after_second["total"]
        
        # Second call should not increase trophy count
        assert total_after_second == total_after_first, f"Trophy count increased after second call: {total_after_first} -> {total_after_second}"
        
        print(f"✓ Duplicate prevention works: initial={initial_total}, after_first={total_after_first}, after_second={total_after_second}")


class TestTrophyStatsAfterBackfill:
    """Test that trophy stats reflect backfill results"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_stats_total_matches_by_type_sum(self):
        """Total should equal sum of by_type counts"""
        response = self.session.get(f"{BASE_URL}/api/admin/trophies/stats")
        data = response.json()
        
        by_type_sum = sum(data["by_type"].values())
        assert data["total"] == by_type_sum, f"Total {data['total']} != by_type sum {by_type_sum}"
        
        print(f"✓ Total {data['total']} matches by_type sum {by_type_sum}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
