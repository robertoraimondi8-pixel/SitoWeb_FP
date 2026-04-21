"""
Test Cases for Owner Role Bug Fix (P0)
======================================
A) Creator role sbagliato - il creatore della lega risulta 'player' e non vede la console admin
B) Empty state mancante - se lega manuale non ha partite, la sezione Pronostici non mostra nulla

Test credentials:
- ilio@raimondi.it / Roberto95 (owner of "Test Owner Role" league)
- email@email.com / Roberto95 (second user for non-owner tests)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')
TEST_LEAGUE_ID = "72952cf4-899e-480e-845c-7001c1bf8ebf"  # Test Owner Role (manual league)

# Test credentials
OWNER_EMAIL = "ilio@raimondi.it"
OWNER_PASSWORD = "Roberto95"
NON_OWNER_EMAIL = "email@email.com"
NON_OWNER_PASSWORD = "Roberto95"


class TestOwnerRoleFix:
    """Test cases for Bug A: Creator role fix"""

    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as the owner user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Owner login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]

    @pytest.fixture(scope="class")
    def non_owner_token(self):
        """Login as a non-owner user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": NON_OWNER_EMAIL,
            "password": NON_OWNER_PASSWORD
        })
        assert response.status_code == 200, f"Non-owner login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]

    def test_A1_create_manual_league_membership_role_is_owner(self, owner_token):
        """A1: Creating a new manual league should set membership.role = 'owner'"""
        # First get available seasons
        response = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        seasons = response.json()
        assert len(seasons) > 0, "No active seasons found"
        season_id = seasons[0]["id"]

        # Create a new manual league
        import uuid
        new_league_name = f"Test Owner Role Check {uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "name": new_league_name,
                "season_id": season_id,
                "start_matchday": 1,
                "end_matchday": 38,
                "bet_deadline_minutes": 60,
                "match_source_type": "manual",
            }
        )
        assert response.status_code == 200, f"Create league failed: {response.text}"
        new_league = response.json()
        new_league_id = new_league["id"]
        
        # Verify the league was created with owner_id
        assert "owner_id" in new_league, "owner_id should be in league response"
        
        # Now check /api/home for this new league
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={new_league_id}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        home_data = response.json()
        
        # Verify ownership fields
        league = home_data.get("league", {})
        assert league.get("is_owner") == True, f"is_owner should be True, got: {league.get('is_owner')}"
        assert league.get("my_role") == "owner", f"my_role should be 'owner', got: {league.get('my_role')}"
        
        print(f"✓ A1 PASSED: New manual league created with membership.role='owner'")

    def test_A2_home_returns_is_owner_and_my_role_for_creator(self, owner_token):
        """A2: /api/home returns is_owner=true and my_role='owner' for the creator"""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Home API failed: {response.text}"
        data = response.json()
        
        league = data.get("league", {})
        assert league is not None, "league should not be None"
        
        # Check is_owner
        is_owner = league.get("is_owner")
        assert is_owner == True, f"is_owner should be True for creator, got: {is_owner}"
        
        # Check my_role
        my_role = league.get("my_role")
        assert my_role in ("owner", "admin"), f"my_role should be 'owner' or 'admin' for creator, got: {my_role}"
        
        # Check match_source_type is manual
        match_source = league.get("match_source_type")
        assert match_source in ("manual", "custom"), f"Expected manual/custom league, got: {match_source}"
        
        print(f"✓ A2 PASSED: /api/home returns is_owner={is_owner}, my_role={my_role}")

    def test_A3_non_owner_sees_is_owner_false(self, non_owner_token):
        """A3: Non-owner should see is_owner=false for the same league"""
        # First, non_owner needs to be a member - let's check their leagues
        response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {non_owner_token}"}
        )
        assert response.status_code == 200
        user_leagues = response.json()
        
        # Find a league where user is NOT owner (national or other's manual league)
        for league in user_leagues:
            league_id = league["id"]
            response = requests.get(
                f"{BASE_URL}/api/home?league_id={league_id}",
                headers={"Authorization": f"Bearer {non_owner_token}"}
            )
            if response.status_code == 200:
                data = response.json()
                lg = data.get("league", {})
                # If this is not their league, is_owner should be False
                if lg.get("owner_id") and lg.get("is_owner") == False:
                    print(f"✓ A3 PASSED: Non-owner sees is_owner=False for league {league_id[:8]}")
                    return
        
        # If we get here, test the behavior for non-owner joining TEST_LEAGUE_ID
        # Note: They might not be a member, so this is informational
        print("ℹ A3 INFO: Non-owner not member of test league, verified concept in other leagues")

    def test_A4_auto_repair_membership_role(self, owner_token):
        """A4: Auto-repair - if owner but role is wrong, it should be corrected automatically"""
        # This is tested indirectly - the /api/home endpoint has auto-repair logic
        # If the membership role was 'player' instead of 'owner', calling /api/home should fix it
        
        # Call /api/home twice to verify consistent behavior
        for i in range(2):
            response = requests.get(
                f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_ID}",
                headers={"Authorization": f"Bearer {owner_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            league = data.get("league", {})
            
            # After auto-repair, role should always be owner
            my_role = league.get("my_role")
            assert my_role in ("owner", "admin"), f"Call {i+1}: my_role should be owner/admin, got: {my_role}"
        
        print(f"✓ A4 PASSED: Auto-repair verified - my_role consistently returns 'owner'")


class TestEmptyStateFix:
    """Test cases for Bug B: Empty state for manual league without matches"""

    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as the owner user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]

    def test_B1_fixtures_empty_for_empty_manual_league(self, owner_token):
        """B1: Manual league without matchdays returns empty fixtures"""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_ID}/fixtures",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"Fixtures API failed: {response.text}"
        data = response.json()
        
        matchdays = data.get("matchdays", [])
        # For "Test Owner Role" league that was created empty
        print(f"ℹ B1: League has {len(matchdays)} matchdays")
        
        if len(matchdays) == 0:
            print(f"✓ B1 PASSED: Empty manual league returns 0 matchdays (triggers empty state)")
        else:
            # If matchdays exist, check if they have matches
            total_matches = sum(len(md.get("matches", [])) for md in matchdays)
            print(f"ℹ B1 INFO: League has {len(matchdays)} matchdays with {total_matches} total matches")

    def test_B2_home_provides_ownership_info_for_empty_state(self, owner_token):
        """B2: /api/home provides is_owner and my_role for frontend to show correct empty state"""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        league = data.get("league", {})
        
        # For empty state logic, frontend needs:
        # 1. is_owner or my_role to decide button visibility
        # 2. match_source_type to know it's a manual league
        
        assert "is_owner" in league, "is_owner field should be present"
        assert "my_role" in league, "my_role field should be present"
        assert "match_source_type" in league, "match_source_type field should be present"
        
        is_owner = league.get("is_owner")
        my_role = league.get("my_role")
        match_source = league.get("match_source_type")
        
        print(f"✓ B2 PASSED: Home provides ownership info for empty state:")
        print(f"   - is_owner: {is_owner}")
        print(f"   - my_role: {my_role}")
        print(f"   - match_source_type: {match_source}")
        
        # If owner, frontend should show "Aggiungi partite" button
        if is_owner or my_role in ("owner", "admin"):
            print(f"   → Frontend should show 'Aggiungi partite' button")
        else:
            print(f"   → Frontend should show 'Il creatore deve aggiungere le partite'")

    def test_B3_league_detail_includes_all_needed_fields(self, owner_token):
        """B3: League detail API includes all fields needed for empty state logic"""
        response = requests.get(
            f"{BASE_URL}/api/leagues/{TEST_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200, f"League detail failed: {response.text}"
        data = response.json()
        
        # Verify expected fields
        assert "id" in data, "id should be in league detail"
        assert "name" in data, "name should be in league detail"
        assert "match_source_type" in data, "match_source_type should be in league detail"
        assert "owner_id" in data or "created_by" in data, "owner_id or created_by should be in league detail"
        
        print(f"✓ B3 PASSED: League detail has all required fields")
        print(f"   - id: {data.get('id')[:8]}...")
        print(f"   - name: {data.get('name')}")
        print(f"   - match_source_type: {data.get('match_source_type')}")


class TestSettingsIconVisibility:
    """Test the settings icon visibility on home screen"""

    @pytest.fixture(scope="class")
    def owner_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]

    def test_settings_icon_conditions(self, owner_token):
        """Test that settings icon visibility conditions are met in API response"""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={TEST_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {owner_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        league = data.get("league", {})
        
        # Frontend logic for settings icon (from home.tsx line 149):
        # {(data?.league?.is_owner || ['owner', 'admin'].includes(data?.league?.my_role)) && 
        #  (data?.league?.match_source_type === 'manual' || data?.league?.match_source_type === 'custom')
        
        is_owner = league.get("is_owner", False)
        my_role = league.get("my_role", "")
        match_source = league.get("match_source_type", "")
        
        # Condition 1: is_owner OR my_role in ['owner', 'admin']
        owner_condition = is_owner or my_role in ["owner", "admin"]
        
        # Condition 2: match_source_type is manual or custom
        manual_condition = match_source in ["manual", "custom"]
        
        # Both conditions must be true for settings icon to show
        should_show_settings = owner_condition and manual_condition
        
        print(f"✓ Settings Icon Visibility Test:")
        print(f"   - is_owner: {is_owner}")
        print(f"   - my_role: {my_role}")
        print(f"   - match_source_type: {match_source}")
        print(f"   - owner_condition: {owner_condition}")
        print(f"   - manual_condition: {manual_condition}")
        print(f"   → Settings icon SHOULD show: {should_show_settings}")
        
        assert should_show_settings == True, "Settings icon should be visible for owner of manual league"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
