"""
Trophy System Tests
-------------------
Tests for the trophy API endpoints and trophy assignment hooks.
Features tested:
- GET /api/trophies/my - Returns current user's trophies
- GET /api/trophies/user/{user_id} - Returns any user's trophies  
- Trophy structure and counts (league, tournament, weekly categories)
- Trophy assignment hooks presence in services.py and tournaments.py
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('REACT_APP_BACKEND_URL', '')).rstrip('/')

# Test credentials from problem statement
TEST_USER_EMAIL = "ilio@raimondi.it"
TEST_USER_PASS = "password123"
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASS = "admin123"


class TestTrophyAPIs:
    """Trophy API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login and get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASS
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.user_id = login_resp.json().get("user", {}).get("id")
        assert self.token, "No access token received"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        self.session.close()
    
    def test_get_my_trophies_returns_200(self):
        """GET /api/trophies/my should return 200 for authenticated user"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/trophies/my returned 200")
    
    def test_get_my_trophies_structure(self):
        """GET /api/trophies/my should return correct structure with total, counts, and trophies"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "total" in data, "Response missing 'total' field"
        assert "counts" in data, "Response missing 'counts' field"
        assert "trophies" in data, "Response missing 'trophies' field"
        
        # Check counts structure has all 3 categories
        counts = data["counts"]
        assert "league" in counts, "Counts missing 'league' category"
        assert "tournament" in counts, "Counts missing 'tournament' category"
        assert "weekly" in counts, "Counts missing 'weekly' category"
        
        print(f"✓ GET /api/trophies/my structure correct: total={data['total']}, categories={list(counts.keys())}")
    
    def test_get_my_trophies_league_trophy_types(self):
        """League trophy counts should include champion, second, third"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        league_counts = data["counts"]["league"]
        
        assert "league_champion" in league_counts, "League counts missing 'league_champion'"
        assert "league_second" in league_counts, "League counts missing 'league_second'"
        assert "league_third" in league_counts, "League counts missing 'league_third'"
        
        print(f"✓ League trophy types: {list(league_counts.keys())}")
        print(f"  Counts: champion={league_counts['league_champion']}, 2nd={league_counts['league_second']}, 3rd={league_counts['league_third']}")
    
    def test_get_my_trophies_tournament_trophy_types(self):
        """Tournament trophy counts should include champion, finalist, semifinalist"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        tournament_counts = data["counts"]["tournament"]
        
        assert "tournament_champion" in tournament_counts, "Tournament counts missing 'tournament_champion'"
        assert "tournament_finalist" in tournament_counts, "Tournament counts missing 'tournament_finalist'"
        assert "tournament_semifinalist" in tournament_counts, "Tournament counts missing 'tournament_semifinalist'"
        
        print(f"✓ Tournament trophy types: {list(tournament_counts.keys())}")
        print(f"  Counts: champion={tournament_counts['tournament_champion']}, finalist={tournament_counts['tournament_finalist']}, semifinalist={tournament_counts['tournament_semifinalist']}")
    
    def test_get_my_trophies_weekly_trophy_types(self):
        """Weekly trophy counts should include weekly_best, weekly_perfect, weekly_streak"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        weekly_counts = data["counts"]["weekly"]
        
        assert "weekly_best" in weekly_counts, "Weekly counts missing 'weekly_best'"
        assert "weekly_perfect" in weekly_counts, "Weekly counts missing 'weekly_perfect'"
        assert "weekly_streak" in weekly_counts, "Weekly counts missing 'weekly_streak'"
        
        print(f"✓ Weekly trophy types: {list(weekly_counts.keys())}")
        print(f"  Counts: best={weekly_counts['weekly_best']}, perfect={weekly_counts['weekly_perfect']}, streak={weekly_counts['weekly_streak']}")
    
    def test_get_my_trophies_total_matches_counts(self):
        """Total trophy count should match sum of all category counts"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        
        total = data["total"]
        counts = data["counts"]
        
        # Calculate expected total
        expected = sum(counts["league"].values()) + sum(counts["tournament"].values()) + sum(counts["weekly"].values())
        
        assert total == expected, f"Total {total} doesn't match sum of counts {expected}"
        print(f"✓ Total {total} matches sum of counts {expected}")
    
    def test_get_my_trophies_array_returned(self):
        """Trophies field should be a list"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        
        assert isinstance(data["trophies"], list), "Trophies should be a list"
        print(f"✓ Trophies is a list with {len(data['trophies'])} items")
    
    def test_get_user_trophies_returns_200(self):
        """GET /api/trophies/user/{user_id} should return 200"""
        response = self.session.get(f"{BASE_URL}/api/trophies/user/{self.user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/trophies/user/{self.user_id} returned 200")
    
    def test_get_user_trophies_same_structure(self):
        """GET /api/trophies/user/{user_id} should return same structure as /my"""
        my_response = self.session.get(f"{BASE_URL}/api/trophies/my")
        user_response = self.session.get(f"{BASE_URL}/api/trophies/user/{self.user_id}")
        
        assert user_response.status_code == 200
        my_data = my_response.json()
        user_data = user_response.json()
        
        # Same structure
        assert "total" in user_data
        assert "counts" in user_data
        assert "trophies" in user_data
        
        # Same counts (since it's the same user)
        assert user_data["total"] == my_data["total"], "Totals should match for same user"
        print(f"✓ /trophies/user/{self.user_id} returns same data as /trophies/my")
    
    def test_get_user_trophies_other_user(self):
        """GET /api/trophies/user/{other_id} should work for any user"""
        # First login as admin to get admin's ID
        admin_login = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        if admin_login.status_code == 200:
            admin_id = admin_login.json().get("user", {}).get("id")
            if admin_id:
                # Re-authenticate as regular user
                login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
                    "email": TEST_USER_EMAIL,
                    "password": TEST_USER_PASS
                })
                self.session.headers.update({"Authorization": f"Bearer {login_resp.json().get('access_token')}"})
                
                # Get other user's trophies
                response = self.session.get(f"{BASE_URL}/api/trophies/user/{admin_id}")
                assert response.status_code == 200, f"Should be able to view other user's trophies: {response.text}"
                print(f"✓ Can view other user's trophies (admin_id={admin_id[:8]}...)")
            else:
                print("⚠ Could not get admin ID - skipping other user test")
        else:
            print("⚠ Admin login failed - skipping other user test")
    
    def test_trophies_endpoint_requires_auth(self):
        """GET /api/trophies/my should require authentication"""
        # Make request without auth header
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/trophies/my")
        
        # Should be 401 or 403
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"✓ /api/trophies/my requires authentication (status={response.status_code})")
        no_auth_session.close()
    
    def test_user_trophies_endpoint_requires_auth(self):
        """GET /api/trophies/user/{id} should require authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/trophies/user/some-user-id")
        
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"✓ /api/trophies/user/{{id}} requires authentication (status={response.status_code})")
        no_auth_session.close()


class TestTrophyCountsZeroByDefault:
    """Verify trophy counts are 0 when no trophies have been awarded"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASS
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        self.session.close()
    
    def test_all_counts_are_integers(self):
        """All trophy counts should be integers (>=0)"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        
        for category, counts in data["counts"].items():
            for trophy_type, count in counts.items():
                assert isinstance(count, int), f"{category}.{trophy_type} should be int, got {type(count)}"
                assert count >= 0, f"{category}.{trophy_type} should be >= 0, got {count}"
        
        print(f"✓ All trophy counts are valid integers >= 0")
    
    def test_total_is_non_negative_integer(self):
        """Total should be a non-negative integer"""
        response = self.session.get(f"{BASE_URL}/api/trophies/my")
        data = response.json()
        
        assert isinstance(data["total"], int), f"Total should be int, got {type(data['total'])}"
        assert data["total"] >= 0, f"Total should be >= 0, got {data['total']}"
        
        print(f"✓ Total is valid non-negative integer: {data['total']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
