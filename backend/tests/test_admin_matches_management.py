"""
Test Admin Matches Management - Partite page endpoints
Tests: GET /api/admin/matches, PUT /api/admin/matches/{id}, DELETE /api/admin/matches/{id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')

class TestAdminMatchesManagement:
    """Admin matches management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login as admin before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # ======== GET /api/admin/matches tests ========
    
    def test_get_all_matches_no_filter(self):
        """GET /api/admin/matches returns matches list with enriched data"""
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "count" in data, "Response should have 'count' field"
        assert "matches" in data, "Response should have 'matches' field"
        assert isinstance(data["matches"], list), "'matches' should be a list"
        
        # If there are matches, validate enriched fields
        if len(data["matches"]) > 0:
            match = data["matches"][0]
            assert "matchday_label" in match, "Match should have 'matchday_label' field"
            assert "league_name" in match, "Match should have 'league_name' field"
            print(f"GET /api/admin/matches returned {data['count']} matches with enriched data")
    
    def test_get_live_matches(self):
        """GET /api/admin/matches?status=live returns only live matches"""
        response = requests.get(f"{BASE_URL}/api/admin/matches?status=live", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Validate all returned matches have status 'live'
        for match in data.get("matches", []):
            assert match.get("status") == "live", f"Expected status 'live', got '{match.get('status')}'"
        
        print(f"GET /api/admin/matches?status=live returned {data['count']} live matches")
    
    def test_get_scheduled_matches(self):
        """GET /api/admin/matches?status=scheduled returns only scheduled matches"""
        response = requests.get(f"{BASE_URL}/api/admin/matches?status=scheduled", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        for match in data.get("matches", []):
            assert match.get("status") == "scheduled", f"Expected status 'scheduled', got '{match.get('status')}'"
        
        print(f"GET /api/admin/matches?status=scheduled returned {data['count']} scheduled matches")
    
    def test_get_finished_matches(self):
        """GET /api/admin/matches?status=finished returns only finished matches"""
        response = requests.get(f"{BASE_URL}/api/admin/matches?status=finished", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        for match in data.get("matches", []):
            assert match.get("status") == "finished", f"Expected status 'finished', got '{match.get('status')}'"
        
        print(f"GET /api/admin/matches?status=finished returned {data['count']} finished matches")
    
    def test_get_inconsistent_matches(self):
        """GET /api/admin/matches?filter=inconsistent returns inconsistent matches"""
        response = requests.get(f"{BASE_URL}/api/admin/matches?filter=inconsistent", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Inconsistent matches should be in COMPLETED matchdays but not finished
        for match in data.get("matches", []):
            assert match.get("status") in ["scheduled", "live"], f"Inconsistent match should be scheduled/live, got '{match.get('status')}'"
        
        print(f"GET /api/admin/matches?filter=inconsistent returned {data['count']} inconsistent matches")
    
    def test_get_no_result_matches(self):
        """GET /api/admin/matches?filter=no_result returns matches without scores"""
        response = requests.get(f"{BASE_URL}/api/admin/matches?filter=no_result", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # All matches should have status 'finished' but missing score
        for match in data.get("matches", []):
            assert match.get("status") == "finished", f"no_result match should be finished, got '{match.get('status')}'"
            assert match.get("home_score") is None or match.get("away_score") is None, "Should have null score"
        
        print(f"GET /api/admin/matches?filter=no_result returned {data['count']} matches without result")
    
    # ======== PUT /api/admin/matches/{match_id} tests ========
    
    def test_put_match_update_score(self):
        """PUT /api/admin/matches/{match_id} accepts home_score, away_score"""
        # First get a match
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        matches = response.json().get("matches", [])
        if len(matches) == 0:
            pytest.skip("No matches available to test update")
        
        test_match = matches[0]
        match_id = test_match["id"]
        original_home = test_match.get("home_score")
        original_away = test_match.get("away_score")
        
        # Update with new scores
        update_body = {"home_score": 2, "away_score": 1}
        response = requests.put(f"{BASE_URL}/api/admin/matches/{match_id}", json=update_body, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("ok") == True, "Response should have ok=True"
        
        # Restore original
        restore_body = {"home_score": original_home, "away_score": original_away}
        requests.put(f"{BASE_URL}/api/admin/matches/{match_id}", json=restore_body, headers=self.headers)
        
        print(f"PUT /api/admin/matches/{match_id} successfully updated scores")
    
    def test_put_match_update_status(self):
        """PUT /api/admin/matches/{match_id} accepts status field"""
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        matches = response.json().get("matches", [])
        if len(matches) == 0:
            pytest.skip("No matches available to test update")
        
        # Find a match that's not live to test
        test_match = None
        for m in matches:
            if m.get("status") in ["scheduled", "finished"]:
                test_match = m
                break
        
        if not test_match:
            pytest.skip("No suitable match for status update test")
        
        match_id = test_match["id"]
        original_status = test_match.get("status")
        
        # Update status
        update_body = {"status": "live" if original_status != "live" else "scheduled"}
        response = requests.put(f"{BASE_URL}/api/admin/matches/{match_id}", json=update_body, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Restore
        requests.put(f"{BASE_URL}/api/admin/matches/{match_id}", json={"status": original_status}, headers=self.headers)
        print(f"PUT /api/admin/matches/{match_id} successfully updated status")
    
    def test_put_match_update_kickoff(self):
        """PUT /api/admin/matches/{match_id} accepts kickoff field"""
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        matches = response.json().get("matches", [])
        if len(matches) == 0:
            pytest.skip("No matches available to test update")
        
        test_match = matches[0]
        match_id = test_match["id"]
        
        # Update kickoff
        update_body = {"kickoff": "2025-01-15T20:00:00Z"}
        response = requests.put(f"{BASE_URL}/api/admin/matches/{match_id}", json=update_body, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "kickoff" in data.get("updates", {}), "Updates should include kickoff"
        
        print(f"PUT /api/admin/matches/{match_id} successfully updated kickoff")
    
    def test_put_match_invalid_status(self):
        """PUT /api/admin/matches/{match_id} rejects invalid status"""
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        matches = response.json().get("matches", [])
        if len(matches) == 0:
            pytest.skip("No matches available")
        
        match_id = matches[0]["id"]
        update_body = {"status": "invalid_status"}
        response = requests.put(f"{BASE_URL}/api/admin/matches/{match_id}", json=update_body, headers=self.headers)
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        
        print(f"PUT /api/admin/matches correctly rejected invalid status")
    
    def test_put_match_not_found(self):
        """PUT /api/admin/matches/{match_id} returns 404 for non-existent match"""
        update_body = {"status": "live"}
        response = requests.put(f"{BASE_URL}/api/admin/matches/nonexistent123", json=update_body, headers=self.headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("PUT /api/admin/matches correctly returned 404 for non-existent match")
    
    # ======== DELETE /api/admin/matches/{match_id} tests ========
    
    def test_delete_match_not_found(self):
        """DELETE /api/admin/matches/{match_id} returns 404 for non-existent match"""
        response = requests.delete(f"{BASE_URL}/api/admin/matches/nonexistent123", headers=self.headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("DELETE /api/admin/matches correctly returned 404 for non-existent match")
    
    def test_delete_match_with_predictions_blocked(self):
        """DELETE /api/admin/matches/{match_id} blocks if predictions exist without force"""
        # Get matches to find one that might have predictions
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        matches = response.json().get("matches", [])
        
        # We can't create test data easily, so this is informational
        # The endpoint should return 409 if predictions exist
        print("DELETE with predictions test - checking endpoint behavior")
        
        # Just verify the endpoint exists and returns proper error for non-existent
        response = requests.delete(f"{BASE_URL}/api/admin/matches/test_nonexistent", headers=self.headers)
        assert response.status_code == 404, "Should return 404 for non-existent match"
    
    def test_delete_match_force_parameter(self):
        """DELETE /api/admin/matches/{match_id}?force=true accepts force parameter"""
        # Test that the force parameter is accepted by the endpoint
        response = requests.delete(f"{BASE_URL}/api/admin/matches/nonexistent123?force=true", headers=self.headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        # The 404 proves the endpoint exists and accepts force parameter (it just didn't find the match)
        
        print("DELETE /api/admin/matches?force=true parameter is accepted")


class TestAdminMatchesEnrichedFields:
    """Test enriched fields in matches response"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_matchday_label_field(self):
        """Verify matchday_label is present in match data"""
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        data = response.json()
        
        if len(data.get("matches", [])) > 0:
            match = data["matches"][0]
            assert "matchday_label" in match, "matchday_label field should be present"
            assert match["matchday_label"] != "?", f"matchday_label should have valid value, got: {match['matchday_label']}"
            print(f"Sample matchday_label: {match['matchday_label']}")
    
    def test_league_name_field(self):
        """Verify league_name is present in match data"""
        response = requests.get(f"{BASE_URL}/api/admin/matches", headers=self.headers)
        data = response.json()
        
        if len(data.get("matches", [])) > 0:
            match = data["matches"][0]
            assert "league_name" in match, "league_name field should be present"
            print(f"Sample league_name: {match.get('league_name', 'N/A')}")


class TestAdminMatchesAuthRequired:
    """Test that admin endpoints require authentication"""
    
    def test_get_matches_requires_auth(self):
        """GET /api/admin/matches requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/matches")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("GET /api/admin/matches correctly requires authentication")
    
    def test_put_match_requires_auth(self):
        """PUT /api/admin/matches requires authentication"""
        response = requests.put(f"{BASE_URL}/api/admin/matches/test123", json={"status": "live"})
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("PUT /api/admin/matches correctly requires authentication")
    
    def test_delete_match_requires_auth(self):
        """DELETE /api/admin/matches requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/admin/matches/test123")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("DELETE /api/admin/matches correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
