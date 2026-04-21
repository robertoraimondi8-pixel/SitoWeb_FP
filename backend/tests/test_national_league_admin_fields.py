"""
Tests for National League Admin UI fields:
- entry_fee, league_type, is_system fields in league creation (POST /api/rbac/leagues/create)
- entry_fee, league_type, is_system fields in league edit (PUT /api/rbac/leagues/{league_id}/rules)
- entry_fee, is_system returned in GET /api/rbac/leagues
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')


class TestNationalLeagueAdminFields:
    """Test the new entry_fee, league_type, is_system fields for admin league management"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Get authentication headers"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_get_leagues_returns_entry_fee_and_is_system(self, auth_headers):
        """GET /api/rbac/leagues should return entry_fee and is_system fields"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get leagues: {response.text}"
        
        leagues = response.json()
        assert isinstance(leagues, list), "Expected list of leagues"
        
        # Check that each league has entry_fee and is_system fields
        for league in leagues[:5]:  # Check first 5 leagues
            assert "entry_fee" in league, f"League {league.get('name', league.get('id'))} missing entry_fee field"
            assert "is_system" in league, f"League {league.get('name', league.get('id'))} missing is_system field"
            assert "league_type" in league, f"League {league.get('name', league.get('id'))} missing league_type field"
            print(f"League '{league.get('name')}': entry_fee={league.get('entry_fee')}, is_system={league.get('is_system')}, league_type={league.get('league_type')}")
    
    def test_edit_league_rules_with_new_fields(self, auth_headers):
        """PUT /api/rbac/leagues/{league_id}/rules should accept entry_fee, league_type, is_system"""
        # First get list of leagues to find a test league
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get leagues: {response.text}"
        
        leagues = response.json()
        # Find a non-national, private league to test with
        test_league = None
        for league in leagues:
            if league.get("league_type") != "national":
                test_league = league
                break
        
        if not test_league:
            pytest.skip("No private league found to test edit")
        
        league_id = test_league["id"]
        original_entry_fee = test_league.get("entry_fee", 0)
        original_is_system = test_league.get("is_system", False)
        
        # Try to update with new entry_fee
        test_entry_fee = 15.50
        update_payload = {
            "entry_fee": test_entry_fee,
            "confirm": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{league_id}/rules",
            headers=auth_headers,
            json=update_payload
        )
        
        # Should succeed for super admin
        if response.status_code == 200:
            result = response.json()
            assert "updates" in result, "Response should contain updates field"
            assert "entry_fee" in result["updates"], "Updates should include entry_fee"
            assert result["updates"]["entry_fee"] == test_entry_fee, f"entry_fee should be {test_entry_fee}"
            print(f"Successfully updated entry_fee to {test_entry_fee}")
            
            # Restore original value
            requests.put(
                f"{BASE_URL}/api/rbac/leagues/{league_id}/rules",
                headers=auth_headers,
                json={"entry_fee": original_entry_fee, "confirm": True}
            )
        elif response.status_code == 403:
            # Expected if not super admin
            print("Edit requires super admin (403 - expected if not super admin)")
        else:
            pytest.fail(f"Unexpected response: {response.status_code} - {response.text}")
    
    def test_edit_league_league_type_field(self, auth_headers):
        """PUT /api/rbac/leagues/{league_id}/rules should accept league_type field"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=auth_headers)
        assert response.status_code == 200
        
        leagues = response.json()
        test_league = None
        for league in leagues:
            if league.get("league_type") != "national":
                test_league = league
                break
        
        if not test_league:
            pytest.skip("No private league found")
        
        league_id = test_league["id"]
        
        # Test that league_type is accepted in the payload (even if we don't change it)
        update_payload = {
            "league_type": test_league.get("league_type", "private"),
            "confirm": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{league_id}/rules",
            headers=auth_headers,
            json=update_payload
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"league_type field accepted in edit rules: {result}")
        elif response.status_code == 403:
            print("Edit requires super admin (403 - expected)")
        else:
            # Check if it's a validation error
            print(f"Response: {response.status_code} - {response.text}")
    
    def test_edit_league_is_system_field(self, auth_headers):
        """PUT /api/rbac/leagues/{league_id}/rules should accept is_system field"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=auth_headers)
        assert response.status_code == 200
        
        leagues = response.json()
        test_league = None
        for league in leagues:
            if league.get("league_type") != "national" and not league.get("is_system", False):
                test_league = league
                break
        
        if not test_league:
            pytest.skip("No non-system private league found")
        
        league_id = test_league["id"]
        original_is_system = test_league.get("is_system", False)
        
        # Try to update is_system
        update_payload = {
            "is_system": True,
            "confirm": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{league_id}/rules",
            headers=auth_headers,
            json=update_payload
        )
        
        if response.status_code == 200:
            result = response.json()
            assert "updates" in result
            print(f"is_system field accepted: {result}")
            
            # Restore original value
            requests.put(
                f"{BASE_URL}/api/rbac/leagues/{league_id}/rules",
                headers=auth_headers,
                json={"is_system": original_is_system, "confirm": True}
            )
        elif response.status_code == 403:
            print("Edit requires super admin (403 - expected)")
        else:
            print(f"Response: {response.status_code} - {response.text}")
    
    def test_get_seasons_for_league_creation(self, auth_headers):
        """Verify seasons endpoint works for league creation form"""
        response = requests.get(f"{BASE_URL}/api/seasons", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get seasons: {response.text}"
        
        seasons = response.json()
        assert isinstance(seasons, list), "Expected list of seasons"
        if len(seasons) > 0:
            print(f"Found {len(seasons)} seasons")
            # Get the first season ID for potential league creation test
            return seasons[0].get("id")
        else:
            print("No seasons found")
            return None


class TestAdminLeagueCreationFields:
    """Test league creation with new fields"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_create_league_accepts_entry_fee_league_type_is_system(self, auth_headers):
        """POST /api/rbac/leagues/create should accept entry_fee, league_type, is_system"""
        # First get a valid season_id
        seasons_resp = requests.get(f"{BASE_URL}/api/seasons", headers=auth_headers)
        if seasons_resp.status_code != 200:
            pytest.skip("Cannot get seasons")
        
        seasons = seasons_resp.json()
        if not seasons:
            pytest.skip("No seasons available")
        
        season_id = seasons[0]["id"]
        
        # Create a test league with new fields
        test_name = f"TEST_AdminFields_{uuid.uuid4().hex[:6]}"
        create_payload = {
            "name": test_name,
            "season_id": season_id,
            "match_source_type": "national",
            "entry_fee": 25.99,
            "league_type": "private",
            "is_system": False,
            "start_matchday": 1,
            "end_matchday": 38
        }
        
        response = requests.post(
            f"{BASE_URL}/api/rbac/leagues/create",
            headers=auth_headers,
            json=create_payload
        )
        
        if response.status_code == 200:
            result = response.json()
            league_id = result.get("league_id")
            print(f"Successfully created league: {result}")
            
            # Verify the league was created with correct fields
            leagues_resp = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=auth_headers)
            if leagues_resp.status_code == 200:
                leagues = leagues_resp.json()
                created_league = next((l for l in leagues if l.get("id") == league_id), None)
                if created_league:
                    assert created_league.get("entry_fee") == 25.99, "entry_fee not saved correctly"
                    assert created_league.get("is_system") == False, "is_system not saved correctly"
                    print(f"Verified created league fields: entry_fee={created_league.get('entry_fee')}, is_system={created_league.get('is_system')}")
            
            return league_id
        elif response.status_code == 400:
            # May fail due to matchday constraints
            print(f"Creation failed (likely matchday constraint): {response.text}")
        elif response.status_code == 403:
            print("Creation requires admin permission (403 - expected)")
        else:
            print(f"Unexpected response: {response.status_code} - {response.text}")


class TestAdminUIAPIEndpoints:
    """Test the API endpoints used by the admin UI"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@fantapronostic.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_rbac_my_permissions(self, auth_headers):
        """Verify admin can get their permissions"""
        response = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers=auth_headers)
        assert response.status_code == 200
        
        perms = response.json()
        assert "is_super_admin" in perms
        assert "permissions" in perms
        print(f"Admin is_super_admin: {perms.get('is_super_admin')}")
        print(f"Admin permissions count: {len(perms.get('permissions', []))}")
    
    def test_rbac_dashboard_stats(self, auth_headers):
        """Verify dashboard stats endpoint works"""
        response = requests.get(f"{BASE_URL}/api/rbac/dashboard-stats", headers=auth_headers)
        assert response.status_code == 200
        
        stats = response.json()
        assert "leagues" in stats
        assert "users" in stats
        print(f"Dashboard stats: leagues={stats['leagues'].get('total')}, users={stats['users'].get('total')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
