"""
Test: /api/home matchday selection priority
Bug 1 (P0): LIVE mode inconsistency between national and private leagues

When LIVE matchday (Giornata 4) and LOCKED matchday (Giornata 7) coexist,
the home page should prioritize LIVE over LOCKED regardless of matchday number.

Priority order: LIVE > OPEN > LOCKED > last by number

Test credentials:
- National-type league owner: desiree@raimondi.it / Roberto95
- System Admin: admin@fantapronostic.com / admin123
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://matchday-fix.preview.emergentagent.com')

# Known constants
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"


class TestHomeMatchdayPriority:
    """Test /api/home matchday selection prioritizes LIVE over LOCKED"""
    
    @pytest.fixture(scope="class")
    def desiree_token(self):
        """Login as desiree@raimondi.it (national-type league member)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "desiree@raimondi.it",
            "password": "Roberto95"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin@fantapronostic.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data["access_token"]
    
    def test_desiree_login_success(self, desiree_token):
        """Verify desiree can login"""
        assert desiree_token is not None
        assert len(desiree_token) > 10
        print(f"[PASS] Desiree logged in successfully")
    
    def test_home_returns_live_matchday_not_locked(self, desiree_token):
        """
        CRITICAL BUG 1 TEST: /api/home should return LIVE matchday (Giornata 4)
        NOT LOCKED matchday (Giornata 7) even though 7 > 4 in number
        """
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {desiree_token}"}
        )
        assert response.status_code == 200, f"Home API failed: {response.text}"
        
        data = response.json()
        matchday = data.get("matchday")
        
        # Verify matchday is returned
        assert matchday is not None, "No matchday returned from /api/home"
        
        # CRITICAL: Status must be LIVE, not LOCKED
        status = matchday.get("status")
        number = matchday.get("number")
        
        print(f"[INFO] Returned matchday: Giornata {number}, status={status}")
        
        # This is the bug fix verification - LIVE should take priority
        assert status == "LIVE", f"Expected status=LIVE, got status={status}. Bug 1 NOT FIXED!"
        
        # Verify it's Giornata 4 specifically (the LIVE one)
        assert number == 4, f"Expected Giornata 4 (LIVE), got Giornata {number}"
        
        print(f"[PASS] Bug 1 FIXED: Home returns LIVE matchday (Giornata {number}) not LOCKED")
    
    def test_home_matchday_has_required_fields(self, desiree_token):
        """Verify matchday data structure is complete"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {desiree_token}"}
        )
        data = response.json()
        matchday = data.get("matchday")
        
        required_fields = ["id", "number", "status", "label", "total_matches", "my_predictions_count"]
        missing = [f for f in required_fields if f not in matchday]
        
        assert not missing, f"Missing fields in matchday: {missing}"
        print(f"[PASS] Matchday has all required fields")
    
    def test_home_league_is_national_type(self, desiree_token):
        """Verify Desiree's active league is national-type (uses national matchdays)"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {desiree_token}"}
        )
        data = response.json()
        league = data.get("league")
        
        assert league is not None, "No active league returned"
        
        match_source = league.get("match_source_type")
        print(f"[INFO] League: {league.get('name')}, match_source_type={match_source}")
        
        # Desiree's league "Desylega" should be national type
        assert match_source == "national", f"Expected match_source_type=national, got {match_source}"
        print(f"[PASS] League is national-type (uses national matchdays)")
    
    def test_admin_home_also_shows_live_matchday(self, admin_token):
        """Admin should also see LIVE matchday priority"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        matchday = data.get("matchday")
        
        if matchday:
            status = matchday.get("status")
            number = matchday.get("number")
            print(f"[INFO] Admin home matchday: Giornata {number}, status={status}")
            
            # If there's a LIVE matchday in the system, it should be shown
            if status in ("LIVE", "LOCKED"):
                # We know Giornata 4 is LIVE, so admin should see it too
                assert status == "LIVE", f"Admin also gets wrong matchday priority! Got {status}"
                print(f"[PASS] Admin also sees LIVE matchday correctly")
    
    def test_live_endpoint_accessible_for_matchday(self, desiree_token):
        """Verify /api/live/{matchday_id} works for the LIVE matchday"""
        # First get the LIVE matchday ID from home
        home_response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {desiree_token}"}
        )
        home_data = home_response.json()
        matchday_id = home_data.get("matchday", {}).get("id")
        league_id = home_data.get("league", {}).get("id")
        
        assert matchday_id, "No matchday ID returned from home"
        
        # Now test /api/live/{matchday_id}
        live_response = requests.get(
            f"{BASE_URL}/api/live/{matchday_id}?league_id={league_id}",
            headers={"Authorization": f"Bearer {desiree_token}"}
        )
        
        assert live_response.status_code == 200, f"Live API failed: {live_response.text}"
        
        live_data = live_response.json()
        print(f"[INFO] Live endpoint returned: matchday_status={live_data.get('matchday_status')}, matches={len(live_data.get('matches', []))}")
        
        # Verify live data structure
        assert "matches" in live_data, "No matches in live response"
        assert "matchday_status" in live_data, "No matchday_status in live response"
        
        print(f"[PASS] Live endpoint works for LIVE matchday")


class TestHomeWithDifferentLeagueTypes:
    """Test that different league types work correctly"""
    
    @pytest.fixture(scope="class")
    def ilio_token(self):
        """Login as ilio@raimondi.it (manual league owner)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ilio@raimondi.it",
            "password": "password123"
        })
        assert response.status_code == 200, f"Ilio login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_manual_league_user_home(self, ilio_token):
        """Manual league owner should get their own league's matchdays"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {ilio_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        league = data.get("league")
        
        if league:
            match_source = league.get("match_source_type")
            print(f"[INFO] Ilio's league: {league.get('name')}, match_source_type={match_source}")
            
            # Ilio has a manual league, should be manual or custom type
            if match_source in ("manual", "custom"):
                print(f"[PASS] Ilio's manual league detected correctly")
            else:
                print(f"[INFO] Ilio's league is {match_source} type")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
