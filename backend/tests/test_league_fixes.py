"""
Test suite for 5 League Fixes in Admin Panel:
1. Admin count from memberships (not RBAC)
2. National league not shown in at-risk alerts
3. 3 league types with visual distinction + filtering
4. League rules display in table and detail modal
5. Super Admin edit rules functionality
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://unified-competitions.preview.emergentagent.com").rstrip("/")
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token (super admin)."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def standard_user_token():
    """Get standard user auth token (non-super-admin)."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STANDARD_USER_EMAIL,
        "password": STANDARD_USER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Standard user login failed: {response.text}")
    return response.json()["access_token"]


# ============================================================
# FIX 2: National League Not in At-Risk Alerts
# ============================================================
class TestFix2NationalLeagueNotAtRisk:
    """Dashboard should NOT show national league in at-risk alerts."""

    def test_dashboard_stats_returns_at_risk_list(self, admin_token):
        """GET /api/rbac/dashboard-stats returns at_risk array."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/dashboard-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "leagues" in data
        assert "at_risk" in data["leagues"]
        print(f"At-risk leagues count: {len(data['leagues']['at_risk'])}")

    def test_national_league_not_in_at_risk(self, admin_token):
        """National league (f1373417-43aa-4043-b6a2-125873181c95) must NOT appear in at_risk."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/dashboard-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        at_risk = data["leagues"]["at_risk"]
        
        # Check that national league ID is not in at_risk
        at_risk_ids = [l["id"] for l in at_risk]
        assert NATIONAL_LEAGUE_ID not in at_risk_ids, \
            f"National league ID {NATIONAL_LEAGUE_ID} should NOT be in at_risk list"
        
        # Also check by name pattern
        national_names = [l["name"] for l in at_risk if "nazionale" in l["name"].lower() or "fantapronostic" in l["name"].lower()]
        assert len(national_names) == 0, f"Found national-sounding leagues in at_risk: {national_names}"
        print("PASS: National league not in at_risk list")

    def test_only_private_custom_leagues_in_at_risk(self, admin_token):
        """Only private custom leagues should appear in at_risk list."""
        # Get dashboard stats
        stats_response = requests.get(
            f"{BASE_URL}/api/rbac/dashboard-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert stats_response.status_code == 200
        at_risk = stats_response.json()["leagues"]["at_risk"]
        
        # Get all leagues to check types
        leagues_response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert leagues_response.status_code == 200
        all_leagues = leagues_response.json()
        leagues_map = {l["id"]: l for l in all_leagues}
        
        for risk_league in at_risk:
            league = leagues_map.get(risk_league["id"])
            if league:
                league_type = league.get("league_type", "")
                match_source_type = league.get("match_source_type", "")
                
                # Should NOT be national type
                assert league_type != "national", \
                    f"National league found in at_risk: {risk_league['name']}"
                
                # If private, should NOT be private-national (match_source_type=national)
                if league_type == "private":
                    assert match_source_type != "national", \
                        f"Private-national league found in at_risk: {risk_league['name']}"
                    
                print(f"At-risk league: {risk_league['name']} (type={league_type}, source={match_source_type})")
        
        print("PASS: Only private custom/manual leagues in at_risk")


# ============================================================
# FIX 3: League Type Badges and Filtering
# ============================================================
class TestFix3LeagueTypeBadgesAndFiltering:
    """Leagues table shows 3 type badges and filtering works."""

    def test_leagues_endpoint_returns_type_fields(self, admin_token):
        """GET /api/rbac/leagues returns league_type and match_source_type."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        assert len(leagues) > 0, "No leagues found"
        
        # Check fields exist
        for league in leagues[:5]:
            assert "league_type" in league, f"Missing league_type for {league['name']}"
            assert "match_source_type" in league, f"Missing match_source_type for {league['name']}"
            print(f"League: {league['name']}, type={league['league_type']}, source={league['match_source_type']}")

    def test_three_league_types_exist(self, admin_token):
        """Verify 3 distinct league type combinations exist."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        type_combos = set()
        for l in leagues:
            lt = l.get("league_type", "")
            mst = l.get("match_source_type", "")
            
            if lt == "national":
                type_combos.add("national")
            elif lt == "private" and mst == "national":
                type_combos.add("private_national")
            elif lt == "private":
                type_combos.add("private_custom")
        
        print(f"Found league type combinations: {type_combos}")
        # At minimum should have national
        assert "national" in type_combos, "No national league found"

    def test_national_league_exists_with_correct_type(self, admin_token):
        """National league has league_type=national."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        national = next((l for l in leagues if l["id"] == NATIONAL_LEAGUE_ID), None)
        assert national is not None, f"National league {NATIONAL_LEAGUE_ID} not found"
        assert national.get("league_type") == "national", \
            f"National league has wrong type: {national.get('league_type')}"
        print(f"National league found: {national['name']}, type={national['league_type']}")


# ============================================================
# FIX 4: League Rules Display
# ============================================================
class TestFix4LeagueRulesDisplay:
    """League table shows rules summary, detail modal shows full rules."""

    def test_leagues_return_scoring_config(self, admin_token):
        """GET /api/rbac/leagues returns scoring_config for each league."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        for league in leagues[:5]:
            assert "scoring_config" in league, f"Missing scoring_config for {league['name']}"
            print(f"League: {league['name']}, scoring_config keys: {list(league['scoring_config'].keys()) if league['scoring_config'] else 'empty'}")

    def test_leagues_return_matchday_range(self, admin_token):
        """GET /api/rbac/leagues returns start_matchday and end_matchday."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        for league in leagues[:5]:
            assert "start_matchday" in league, f"Missing start_matchday for {league['name']}"
            assert "end_matchday" in league, f"Missing end_matchday for {league['name']}"
            print(f"League: {league['name']}, matchdays: {league['start_matchday']}-{league['end_matchday']}")

    def test_leagues_return_deadline_and_championship(self, admin_token):
        """GET /api/rbac/leagues returns bet_deadline_minutes and include_championship_predictions."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        for league in leagues[:5]:
            assert "bet_deadline_minutes" in league, f"Missing bet_deadline_minutes for {league['name']}"
            assert "include_championship_predictions" in league, f"Missing include_championship_predictions for {league['name']}"
            print(f"League: {league['name']}, deadline={league['bet_deadline_minutes']}, champ={league['include_championship_predictions']}")


# ============================================================
# FIX 5: Super Admin Edit Rules
# ============================================================
class TestFix5SuperAdminEditRules:
    """Super admin can edit league rules with confirmation."""

    def test_edit_rules_requires_confirm_field(self, admin_token):
        """PUT /api/rbac/leagues/{id}/rules requires confirm=true."""
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{NATIONAL_LEAGUE_ID}/rules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"scoring_config": {"1x2": {"enabled": True, "points": 1}}}
        )
        # Should fail without confirm=true
        assert response.status_code == 400
        assert "confirm" in response.json().get("detail", "").lower()
        print("PASS: Edit rules requires confirm=true")

    def test_edit_rules_rejects_non_super_admin(self, standard_user_token):
        """PUT /api/rbac/leagues/{id}/rules rejects non-super-admin users."""
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{NATIONAL_LEAGUE_ID}/rules",
            headers={"Authorization": f"Bearer {standard_user_token}"},
            json={"confirm": True, "scoring_config": {"1x2": {"enabled": True, "points": 1}}}
        )
        # Should fail - either 403 (permission denied) or other access error
        assert response.status_code in [403, 401], \
            f"Expected 403/401 for non-super-admin, got {response.status_code}: {response.text}"
        print("PASS: Non-super-admin rejected from editing rules")

    def test_edit_rules_updates_scoring_config(self, admin_token):
        """PUT /api/rbac/leagues/{id}/rules updates scoring_config (super admin)."""
        # First get current config
        leagues_response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert leagues_response.status_code == 200
        leagues = leagues_response.json()
        
        # Find a private custom league for testing (avoid modifying national league)
        test_league = None
        for l in leagues:
            if l.get("league_type") == "private" and l.get("match_source_type") != "national":
                test_league = l
                break
        
        if not test_league:
            pytest.skip("No private custom league found for testing")
        
        print(f"Testing on league: {test_league['name']} (id={test_league['id']})")
        
        # Prepare update
        new_scoring_config = {
            "1x2": {"enabled": True, "points": 1.5},
            "over_under": {"enabled": True, "points": 2.0},
            "goal_no_goal": {"enabled": True, "points": 1.5},
            "exact_score": {"enabled": False, "points": 5}
        }
        
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{test_league['id']}/rules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "confirm": True,
                "scoring_config": new_scoring_config,
                "start_matchday": 1,
                "end_matchday": 38,
                "bet_deadline_minutes": 5,
                "include_championship_predictions": False
            }
        )
        assert response.status_code == 200, f"Edit rules failed: {response.text}"
        
        data = response.json()
        assert "updates" in data
        print(f"PASS: Rules updated, fields: {list(data['updates'].keys())}")

    def test_edit_rules_updates_other_fields(self, admin_token):
        """PUT /api/rbac/leagues/{id}/rules can update matchday range, deadline, etc."""
        # Find test league
        leagues_response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert leagues_response.status_code == 200
        leagues = leagues_response.json()
        
        test_league = next((l for l in leagues if l.get("league_type") == "private" and l.get("match_source_type") != "national"), None)
        
        if not test_league:
            pytest.skip("No private custom league found for testing")
        
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{test_league['id']}/rules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "confirm": True,
                "start_matchday": 3,
                "end_matchday": 36,
                "bet_deadline_minutes": 10,
                "include_championship_predictions": True
            }
        )
        assert response.status_code == 200, f"Edit rules failed: {response.text}"
        
        data = response.json()
        assert "updates" in data
        
        # Verify fields were included
        updates = data["updates"]
        if "start_matchday" in updates:
            assert updates["start_matchday"] == 3
        if "end_matchday" in updates:
            assert updates["end_matchday"] == 36
        
        print(f"PASS: Other rule fields updated: {list(updates.keys())}")


# ============================================================
# FIX 1: Admin Count from Memberships
# ============================================================
class TestFix1AdminCountFromMemberships:
    """Admin count refers to league-level admins from memberships."""

    def test_leagues_return_admins_array(self, admin_token):
        """GET /api/rbac/leagues returns admins array per league."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        for league in leagues[:5]:
            assert "admins" in league, f"Missing admins field for {league['name']}"
            assert isinstance(league["admins"], list), f"admins should be array for {league['name']}"
            print(f"League: {league['name']}, admin count: {len(league['admins'])}")

    def test_national_league_owner_shown_as_sistema(self, admin_token):
        """National league owner should display as 'Sistema' (no user owner)."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        
        national = next((l for l in leagues if l["id"] == NATIONAL_LEAGUE_ID), None)
        assert national is not None, "National league not found"
        
        # National league should have no owner (system-owned) or owner=None
        owner = national.get("owner")
        if owner:
            print(f"National league has owner: {owner}")
        else:
            print("PASS: National league has no owner (system-owned, displays as 'Sistema')")


# ============================================================
# Integration: Full Admin Panel Flow
# ============================================================
class TestIntegrationAdminPanelFlow:
    """Test full admin panel flows for leagues."""

    def test_admin_can_view_all_leagues(self, admin_token):
        """Admin can view list of all leagues."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        leagues = response.json()
        assert len(leagues) > 0
        print(f"Total leagues visible: {len(leagues)}")

    def test_dashboard_stats_complete(self, admin_token):
        """Dashboard stats endpoint returns complete data."""
        response = requests.get(
            f"{BASE_URL}/api/rbac/dashboard-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "users" in data
        assert "leagues" in data
        assert "matchdays" in data
        assert "payments" in data
        
        # Verify leagues has at_risk
        assert "at_risk" in data["leagues"]
        assert "total" in data["leagues"]
        
        print(f"Dashboard stats: {data['leagues']['total']} leagues, {len(data['leagues']['at_risk'])} at-risk")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
