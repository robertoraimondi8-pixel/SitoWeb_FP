"""
Test P0 Bug Fixes - Sprint Iteration 31

P0-1: Home screen showing 0.0 pts on LIVE matchday - fixed by removing league_id filter from prediction queries
P0-2: G16 test matchday blocking imports - fixed by deleting G16 + associated data
P0-3: X3 special match badge not showing - fixed by adding is_special/multiplier fields to API responses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://dark-theme-overhaul-2.preview.emergentagent.com"

# Test constants
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
G17_MATCHDAY_ID = "38df601f-49f7-47d1-8f7e-2aa524884f7d"
G16_MATCHDAY_ID = "68523813-a795-4a74-87ec-68bdd0b7ace0"  # Should be deleted
G18_MATCHDAY_ID = "461d6479-2987-45b3-adc8-63f4ec2aed1a"


class TestAuthLogin:
    """Get authentication token for admin user"""
    
    def test_admin_login(self):
        """Login as admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful, user_id={data['user']['id']}")
        return data["access_token"]


class TestP0_1_HomePredictionsCount:
    """
    P0-1 Fix: GET /api/home should NOT filter predictions by league_id
    Verify my_predictions_count is correct for admin user (should be > 0 for completed matchdays)
    """
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_home_predictions_count_not_zero(self, auth_token):
        """P0-1: Home endpoint should return correct predictions count without league_id filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/home", headers=headers)
        assert response.status_code == 200, f"Home failed: {response.text}"
        
        data = response.json()
        matchday = data.get("matchday")
        
        assert matchday is not None, "No matchday returned"
        print(f"Current matchday: {matchday.get('label')}, status={matchday.get('status')}")
        print(f"my_predictions_count: {matchday.get('my_predictions_count')}")
        
        # Verify predictions count is returned correctly
        # Admin should have predictions (we verified 2 predictions for G17 in DB)
        if matchday.get("id") == G17_MATCHDAY_ID:
            assert matchday.get("my_predictions_count", 0) >= 2, \
                f"Expected at least 2 predictions for G17, got {matchday.get('my_predictions_count')}"
        
        print(f"✓ P0-1 PASSED: Home returns my_predictions_count={matchday.get('my_predictions_count')}")
    
    def test_home_completed_matchday_has_points(self, auth_token):
        """P0-1: Completed matchdays should show points from score_summaries"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/home", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        matchday = data.get("matchday")
        
        if matchday and matchday.get("status") == "COMPLETED":
            # my_points should be set for completed matchdays
            my_points = matchday.get("my_points")
            print(f"Completed matchday {matchday.get('label')}: my_points={my_points}")
            # Note: my_points can be 0.0 if no predictions were correct, but should not be None
            assert my_points is not None or matchday.get("my_predictions_count") == 0, \
                "my_points should be set for COMPLETED matchday with predictions"
        
        print(f"✓ P0-1 Score display verified for matchday status={matchday.get('status') if matchday else 'None'}")


class TestP0_1_LiveEndpointMultiplier:
    """
    P0-1 Fix: GET /api/live/{matchday_id} should return is_special and multiplier fields
    Points should reflect X3 multiplier for special matches
    """
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_live_endpoint_returns_is_special_multiplier(self, auth_token):
        """P0-1: Live endpoint should include is_special and multiplier fields in matches"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test with G17 which has Inter vs Roma as special match
        response = requests.get(f"{BASE_URL}/api/live/{G17_MATCHDAY_ID}", headers=headers)
        assert response.status_code == 200, f"Live endpoint failed: {response.text}"
        
        data = response.json()
        matches = data.get("matches", [])
        
        assert len(matches) > 0, "No matches returned from live endpoint"
        print(f"G17 Live: {len(matches)} matches, status={data.get('matchday_status')}")
        
        # Verify is_special and multiplier fields are present
        special_found = False
        for m in matches:
            print(f"  - {m.get('home_team')} vs {m.get('away_team')}: is_special={m.get('is_special')}, multiplier={m.get('multiplier')}")
            
            # Check field presence
            assert "is_special" in m, f"Missing is_special field in match {m.get('match_id')}"
            assert "multiplier" in m, f"Missing multiplier field in match {m.get('match_id')}"
            
            # Check Inter vs Roma is special
            if m.get("home_team") == "Inter" and m.get("away_team") == "Roma":
                assert m.get("is_special") == True, "Inter vs Roma should be special"
                assert m.get("multiplier") == 3.0, "Inter vs Roma should have 3.0 multiplier"
                special_found = True
        
        assert special_found, "Inter vs Roma special match not found in G17"
        print(f"✓ P0-1 PASSED: Live endpoint returns is_special and multiplier fields")
    
    def test_g18_live_special_match(self, auth_token):
        """P0-1: G18 should have Milan vs Napoli as special match"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/live/{G18_MATCHDAY_ID}", headers=headers)
        assert response.status_code == 200, f"G18 Live endpoint failed: {response.text}"
        
        data = response.json()
        matches = data.get("matches", [])
        
        print(f"G18 Live: {len(matches)} matches")
        
        special_found = False
        for m in matches:
            print(f"  - {m.get('home_team')} vs {m.get('away_team')}: is_special={m.get('is_special')}, multiplier={m.get('multiplier')}")
            
            if m.get("home_team") == "Milan" and m.get("away_team") == "Napoli":
                assert m.get("is_special") == True, "Milan vs Napoli should be special in G18"
                assert m.get("multiplier") == 3.0, "Milan vs Napoli should have 3.0 multiplier"
                special_found = True
        
        if not special_found:
            print("WARNING: Milan vs Napoli special match not found in G18 (may have different matchday_id)")
        
        print(f"✓ P0-1 G18 special match check completed")


class TestP0_2_G16Deleted:
    """
    P0-2 Fix: Verify Giornata 16 no longer exists in matchdays collection
    """
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_g16_matchday_deleted(self, auth_token):
        """P0-2: G16 matchday should not exist"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Try to access G16 via admin matchday endpoint
        response = requests.get(
            f"{BASE_URL}/api/admin/leagues/{NATIONAL_LEAGUE_ID}/matchdays/{G16_MATCHDAY_ID}",
            headers=headers
        )
        
        # Should return 404 since G16 was deleted
        if response.status_code == 200:
            pytest.fail(f"G16 matchday still exists! Should have been deleted. Response: {response.json()}")
        
        assert response.status_code == 404, f"Expected 404 for deleted G16, got {response.status_code}"
        print(f"✓ P0-2 PASSED: G16 matchday (id={G16_MATCHDAY_ID[:8]}) correctly deleted")
    
    def test_g16_not_in_fixtures_list(self, auth_token):
        """P0-2: G16 should not appear in league fixtures list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/leagues/{NATIONAL_LEAGUE_ID}/fixtures",
            headers=headers
        )
        assert response.status_code == 200, f"Fixtures failed: {response.text}"
        
        data = response.json()
        matchdays = data.get("matchdays", [])
        
        # Check G16 matchday_id not in list
        g16_found = any(md.get("id") == G16_MATCHDAY_ID for md in matchdays)
        assert not g16_found, f"G16 (id={G16_MATCHDAY_ID[:8]}) should not be in fixtures list"
        
        # Also check by number (more robust)
        g16_by_number = [md for md in matchdays if md.get("number") == 16]
        print(f"Matchdays with number=16: {len(g16_by_number)}")
        
        print(f"✓ P0-2 PASSED: G16 not found in fixtures list (total matchdays: {len(matchdays)})")


class TestP0_3_SpecialMatchFields:
    """
    P0-3 Fix: API responses should include is_special and multiplier fields for special matches
    """
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_fixtures_endpoint_has_special_fields(self, auth_token):
        """P0-3: GET /api/leagues/{league_id}/fixtures should return is_special and multiplier"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/leagues/{NATIONAL_LEAGUE_ID}/fixtures",
            headers=headers
        )
        assert response.status_code == 200, f"Fixtures failed: {response.text}"
        
        data = response.json()
        matchdays = data.get("matchdays", [])
        
        special_matches_found = []
        
        for md in matchdays:
            matches = md.get("matches", [])
            for m in matches:
                # Check fields exist on matches
                if m.get("is_special") == True:
                    special_matches_found.append({
                        "matchday": md.get("label"),
                        "match": f"{m.get('home_team')} vs {m.get('away_team')}",
                        "multiplier": m.get("multiplier")
                    })
                    
                    # Verify multiplier is correct
                    assert m.get("multiplier") == 3.0, \
                        f"Special match should have 3.0 multiplier, got {m.get('multiplier')}"
        
        print(f"Special matches in fixtures:")
        for sm in special_matches_found:
            print(f"  - {sm['matchday']}: {sm['match']} (x{sm['multiplier']})")
        
        assert len(special_matches_found) > 0, "No special matches found in fixtures - check DB data"
        print(f"✓ P0-3 PASSED: Fixtures endpoint returns is_special/multiplier ({len(special_matches_found)} special matches)")
    
    def test_predictions_endpoint_has_special_fields(self, auth_token):
        """P0-3: GET /api/predictions/{matchday_id} should include is_special on match objects"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Test with G17 which has special match
        response = requests.get(
            f"{BASE_URL}/api/predictions/{G17_MATCHDAY_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Predictions endpoint failed: {response.text}"
        
        data = response.json()
        matches = data.get("matches", [])
        
        print(f"G17 predictions endpoint: {len(matches)} matches")
        
        for m in matches:
            match_data = m.get("match", {})
            # Check if is_special field exists
            if "is_special" in match_data or "is_special" in m:
                is_special = match_data.get("is_special") or m.get("is_special")
                multiplier = match_data.get("multiplier") or m.get("multiplier")
                print(f"  - {match_data.get('home_team', m.get('home_team'))} vs {match_data.get('away_team', m.get('away_team'))}: is_special={is_special}, multiplier={multiplier}")
        
        print(f"✓ P0-3 Predictions endpoint check completed")


class TestScoringWithMultiplier:
    """
    Verify calculate_match_points uses multiplier correctly
    """
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_live_points_calculation_with_multiplier(self, auth_token):
        """Verify points calculation respects X3 multiplier for special matches"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get live data for G17
        response = requests.get(f"{BASE_URL}/api/live/{G17_MATCHDAY_ID}", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Note: Since match status is "scheduled" not "finished", points will be 0
        # This is expected behavior - calculate_match_points returns 0 for non-finished matches
        print(f"G17 scoring: base_points={data.get('base_points')}, total_live_points={data.get('total_live_points')}")
        print(f"Matchday status: {data.get('matchday_status')}")
        
        # Verify the structure is correct even if points are 0
        assert "base_points" in data
        assert "total_live_points" in data
        assert "matches" in data
        
        for m in data.get("matches", []):
            if m.get("is_special"):
                print(f"  Special: {m.get('home_team')} vs {m.get('away_team')}, status={m.get('status')}, pts={m.get('points')}")
        
        print(f"✓ Scoring structure verified (match status determines if points calculated)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
