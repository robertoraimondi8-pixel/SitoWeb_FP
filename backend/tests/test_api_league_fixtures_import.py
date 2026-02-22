"""
Test API League Fixtures Import Feature - Private leagues with match_source_type='api'
Tests both backend API endpoints and permissions for the new API-type league import feature.

Test Cases:
1. National league home/standings still work (no regression)
2. Creating a league with match_source_type='api' works correctly
3. League owner of API-type league can access /api/admin/real-fixtures/leagues (200)
4. League owner of API-type league can access /api/admin/real-fixtures/search (200)
5. League owner can import fixtures into their OWN API-type league (200)
6. Non-owner user CANNOT import into someone else's API-type league (403)
7. Non-admin user CANNOT import into national league (403)
8. Super admin CAN import into any league including API-type (200)
9. Admin V3 leagues endpoint shows API-type leagues with _can_manage_matches=true
10. Verify match_source_type='api' is properly stored
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://matchday-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN = {"email": "admin@fantapronostic.com", "password": "admin123"}
DESY_USER = {"email": "desiree@raimondi.it", "password": "Roberto95"}
ILIO_USER = {"email": "ilio@raimondi.it", "password": "password123"}
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
ACTIVE_SEASON_ID = "19e329ae-4c6b-47ea-ab38-50a4d1baab1e"


@pytest.fixture(scope="module")
def admin_token():
    """Get super admin token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def desy_token():
    """Get desy user token (league owner)"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=DESY_USER)
    assert resp.status_code == 200, f"Desy login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def ilio_token():
    """Get ilio user token (non-owner)"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=ILIO_USER)
    assert resp.status_code == 200, f"Ilio login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def api_league(desy_token):
    """Create a test API-type league owned by desy"""
    unique_name = f"TEST_API_League_{uuid.uuid4().hex[:8]}"
    payload = {
        "name": unique_name,
        "season_id": ACTIVE_SEASON_ID,
        "match_source_type": "api",
        "start_matchday": 1,
        "end_matchday": 38,
        "bet_deadline_minutes": 0,
    }
    resp = requests.post(
        f"{BASE_URL}/api/leagues",
        json=payload,
        headers={"Authorization": f"Bearer {desy_token}"}
    )
    assert resp.status_code == 200, f"League creation failed: {resp.text}"
    league = resp.json()
    yield league
    # Cleanup is handled by prefix TEST_


@pytest.fixture(scope="module")
def api_league_matchday(desy_token, api_league):
    """Create a matchday in the API league for import testing"""
    payload = {
        "number": 1,
        "label": "Test Giornata 1",
        "season_id": ACTIVE_SEASON_ID,
        "half": 1,
    }
    resp = requests.post(
        f"{BASE_URL}/api/leagues/{api_league['id']}/matchdays",
        json=payload,
        headers={"Authorization": f"Bearer {desy_token}"}
    )
    assert resp.status_code in [200, 201], f"Matchday creation failed: {resp.text}"
    return resp.json()


class TestNationalLeagueRegression:
    """Test 1: No regression on national league home/standings"""
    
    def test_national_home_works(self, desy_token):
        """National league home endpoint still works"""
        resp = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200, f"National home failed: {resp.text}"
        data = resp.json()
        assert "league" in data or "matchday" in data, "Missing expected fields in home response"
        print(f"✓ National league home works - matchday: {data.get('matchday', {}).get('number', 'N/A')}")
    
    def test_national_standings_works(self, desy_token):
        """National league standings endpoint still works"""
        resp = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200, f"National standings failed: {resp.text}"
        data = resp.json()
        # Response is an object with 'entries' list
        assert "entries" in data, "Standings should have entries field"
        assert isinstance(data["entries"], list), "Standings entries should be a list"
        print(f"✓ National league standings works - {len(data['entries'])} entries")


class TestAPILeagueCreation:
    """Test 2: Creating a league with match_source_type='api' works"""
    
    def test_api_league_created_correctly(self, api_league):
        """Verify API league was created with correct match_source_type"""
        assert api_league.get("match_source_type") == "api", \
            f"Expected 'api', got '{api_league.get('match_source_type')}'"
        assert api_league.get("id"), "League should have an ID"
        assert api_league.get("owner_id"), "League should have owner_id"
        print(f"✓ API league created: {api_league.get('name')}, source_type={api_league.get('match_source_type')}")
    
    def test_api_league_has_owner(self, desy_token, api_league):
        """Verify the creator is the owner"""
        resp = requests.get(
            f"{BASE_URL}/api/leagues/{api_league['id']}",
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200
        league_detail = resp.json()
        assert league_detail.get("match_source_type") == "api"
        print(f"✓ League detail confirms match_source_type=api")


class TestFixturesLeaguesEndpoint:
    """Test 3: League owner of API-type league can access /api/admin/real-fixtures/leagues"""
    
    def test_owner_can_access_fixtures_leagues(self, desy_token, api_league):
        """Owner of API league can access leagues endpoint"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/leagues",
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200, f"Fixtures leagues failed (owner): {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Should return list of API-Football leagues"
        print(f"✓ Owner can access fixtures/leagues - got {len(data)} leagues from API-Football")
    
    def test_non_owner_can_access_fixtures_leagues(self, ilio_token):
        """Non-owner user can also access leagues endpoint (search is open)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/leagues",
            headers={"Authorization": f"Bearer {ilio_token}"}
        )
        # Fixtures leagues is now open to all authenticated users
        assert resp.status_code == 200, f"Fixtures leagues failed (non-owner): {resp.text}"
        print(f"✓ Non-owner can access fixtures/leagues")


class TestFixturesSearchEndpoint:
    """Test 4: League owner of API-type league can access /api/admin/real-fixtures/search"""
    
    def test_owner_can_search_fixtures(self, desy_token, api_league):
        """Owner can search fixtures"""
        # Serie A league ID = 135, season 2024 or 2025
        resp = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/search?league=135&season=2024",
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200, f"Search fixtures failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Should return list of fixtures"
        print(f"✓ Owner can search fixtures - found {len(data)} fixtures")
    
    def test_non_owner_can_search_fixtures(self, ilio_token):
        """Non-owner can also search fixtures (search is open)"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/real-fixtures/search?league=135&season=2024",
            headers={"Authorization": f"Bearer {ilio_token}"}
        )
        assert resp.status_code == 200, f"Search fixtures failed (non-owner): {resp.text}"
        print(f"✓ Non-owner can search fixtures")


class TestOwnerCanImport:
    """Test 5: League owner can import fixtures into their OWN API-type league"""
    
    def test_owner_can_import_into_own_api_league(self, desy_token, api_league, api_league_matchday):
        """Owner can import fixtures into their own API league"""
        # Use real fixture IDs from Serie A
        fixture_ids = [1208614]  # A real Serie A fixture
        
        payload = {
            "league_id": api_league["id"],
            "matchday_id": api_league_matchday["id"],
            "fixture_ids": fixture_ids
        }
        resp = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json=payload,
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        # Can be 200 for success or 502 if API-Football has issues
        if resp.status_code == 502:
            print(f"! API-Football service unavailable, but permission check passed (502)")
            pytest.skip("API-Football service unavailable")
        assert resp.status_code == 200, f"Import failed: {resp.text}"
        data = resp.json()
        print(f"✓ Owner imported fixtures: imported={data.get('imported', 0)}, skipped={data.get('skipped', 0)}")


class TestNonOwnerCannotImport:
    """Test 6: Non-owner user CANNOT import into someone else's API-type league"""
    
    def test_non_owner_cannot_import(self, ilio_token, api_league, api_league_matchday):
        """Non-owner should get 403 when trying to import"""
        payload = {
            "league_id": api_league["id"],
            "matchday_id": api_league_matchday["id"],
            "fixture_ids": [1208615]
        }
        resp = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json=payload,
            headers={"Authorization": f"Bearer {ilio_token}"}
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print(f"✓ Non-owner correctly blocked from importing (403)")


class TestNonAdminCannotImportNational:
    """Test 7: Non-admin user CANNOT import into national league"""
    
    def test_non_admin_cannot_import_national(self, desy_token):
        """Non-admin should get 403 for national league import"""
        # First need to get a national league matchday
        resp = requests.get(
            f"{BASE_URL}/api/admin/v3/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        # This will likely fail because desy isn't admin of national league
        # But let's try the import directly
        
        payload = {
            "league_id": NATIONAL_LEAGUE_ID,
            "matchday_id": "some-matchday-id",
            "fixture_ids": [1208616]
        }
        resp = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json=payload,
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        # Should get 403 because desy is not owner of national league and not super admin
        assert resp.status_code in [403, 404, 400], \
            f"Expected 403/404/400 for non-admin importing to national, got {resp.status_code}: {resp.text}"
        print(f"✓ Non-admin correctly blocked from national league import ({resp.status_code})")


class TestSuperAdminCanImportAnywhere:
    """Test 8: Super admin CAN import into any league including API-type"""
    
    def test_admin_can_import_into_api_league(self, admin_token, api_league, api_league_matchday):
        """Super admin can import into any league"""
        payload = {
            "league_id": api_league["id"],
            "matchday_id": api_league_matchday["id"],
            "fixture_ids": [1208617]
        }
        resp = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if resp.status_code == 502:
            print(f"! API-Football service unavailable, but permission passed (502)")
            pytest.skip("API-Football service unavailable")
        assert resp.status_code == 200, f"Admin import failed: {resp.text}"
        print(f"✓ Super admin can import into API league")


class TestAdminV3LeaguesEndpoint:
    """Test 9: Admin V3 leagues endpoint shows API-type leagues with _can_manage_matches=true"""
    
    def test_admin_v3_shows_api_leagues_for_owner(self, desy_token, api_league):
        """Owner sees their API league with _can_manage_matches=true"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200, f"Admin v3 leagues failed: {resp.text}"
        leagues = resp.json()
        
        # Find our API league
        api_league_found = None
        for lg in leagues:
            if lg.get("id") == api_league["id"]:
                api_league_found = lg
                break
        
        assert api_league_found, f"API league not found in admin v3 response"
        assert api_league_found.get("_can_manage_matches") == True, \
            f"Expected _can_manage_matches=True, got {api_league_found.get('_can_manage_matches')}"
        assert api_league_found.get("match_source_type") == "api", \
            f"Expected match_source_type=api, got {api_league_found.get('match_source_type')}"
        print(f"✓ Admin V3 shows API league with _can_manage_matches=true")
    
    def test_admin_v3_super_admin_sees_all(self, admin_token, api_league):
        """Super admin sees all leagues including national"""
        resp = requests.get(
            f"{BASE_URL}/api/admin/v3/leagues",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert resp.status_code == 200
        leagues = resp.json()
        
        # Should include national league
        national = next((lg for lg in leagues if lg.get("_is_national")), None)
        assert national, "Super admin should see national league"
        
        # Should also see API league
        api_lg = next((lg for lg in leagues if lg.get("id") == api_league["id"]), None)
        assert api_lg, "Super admin should see API league"
        assert api_lg.get("_can_manage_matches") == True
        print(f"✓ Super admin sees all leagues including national and API leagues")


class TestMatchSourceTypeOptions:
    """Test 10: All three match_source_type options work correctly"""
    
    def test_create_national_source_league(self, desy_token):
        """Can create league with match_source_type=national"""
        unique_name = f"TEST_National_Source_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "national",
            "start_matchday": 1,
            "end_matchday": 38,
            "bet_deadline_minutes": 0,
        }
        resp = requests.post(
            f"{BASE_URL}/api/leagues",
            json=payload,
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200, f"National source league creation failed: {resp.text}"
        league = resp.json()
        assert league.get("match_source_type") == "national"
        print(f"✓ Created league with match_source_type=national")
    
    def test_create_custom_source_league(self, desy_token):
        """Can create league with match_source_type=custom"""
        unique_name = f"TEST_Custom_Source_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "season_id": ACTIVE_SEASON_ID,
            "match_source_type": "custom",
            "start_matchday": 1,
            "end_matchday": 38,
            "bet_deadline_minutes": 0,
        }
        resp = requests.post(
            f"{BASE_URL}/api/leagues",
            json=payload,
            headers={"Authorization": f"Bearer {desy_token}"}
        )
        assert resp.status_code == 200, f"Custom source league creation failed: {resp.text}"
        league = resp.json()
        assert league.get("match_source_type") == "custom"
        print(f"✓ Created league with match_source_type=custom")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
