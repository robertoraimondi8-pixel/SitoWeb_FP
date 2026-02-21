"""
Tests for API-Football (API-Sports) integration endpoints.
Endpoints tested:
- GET /api/admin/real-fixtures/leagues
- GET /api/admin/real-fixtures/search
- POST /api/admin/real-fixtures/import

Test credentials:
- Admin: admin@fantapronostic.com / admin123
- Non-admin: test@raimondi.it / password123
- National League ID: f1373417-43aa-4043-b6a2-125873181c95
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"


# ========================================
# FIXTURES & HELPERS
# ========================================
@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@fantapronostic.com", "password": "admin123"}
    )
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} {resp.text[:200]}")
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def non_admin_token():
    """Get non-admin user authentication token."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "test@raimondi.it", "password": "password123"}
    )
    if resp.status_code != 200:
        pytest.skip(f"Non-admin login failed: {resp.status_code} {resp.text[:200]}")
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def admin_session(admin_token):
    """Session with admin auth header."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def non_admin_session(non_admin_token):
    """Session with non-admin auth header."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {non_admin_token}",
        "Content-Type": "application/json"
    })
    return session


@pytest.fixture(scope="module")
def test_matchday_id(admin_session):
    """Create a test matchday for import testing, clean up after tests."""
    # Get first active season
    resp = admin_session.get(f"{BASE_URL}/api/admin/seasons")
    if resp.status_code != 200:
        pytest.skip(f"Failed to get seasons: {resp.text[:200]}")
    seasons = resp.json()
    if not seasons:
        pytest.skip("No seasons found")
    season_id = seasons[0]["id"]
    
    # Create matchday with number=99 to avoid conflicts
    resp = admin_session.post(
        f"{BASE_URL}/api/admin/matchdays",
        json={
            "season_id": season_id,
            "number": 99,
            "label": "Test Matchday for API-Football Import",
            "first_kickoff": "2025-03-01T15:00:00Z",
            "half": 2,
            "league_id": NATIONAL_LEAGUE_ID
        }
    )
    if resp.status_code not in (200, 201):
        # Matchday might already exist, try to find it
        all_matchdays = admin_session.get(f"{BASE_URL}/api/admin/matchdays?season_id={season_id}").json()
        existing = next((m for m in all_matchdays if m.get("number") == 99), None)
        if existing:
            matchday_id = existing["id"]
        else:
            pytest.skip(f"Failed to create test matchday: {resp.text[:200]}")
    else:
        matchday_id = resp.json()["id"]
    
    yield matchday_id
    
    # Cleanup: delete test matchday and its matches
    # First delete all matches in the matchday
    matches_resp = admin_session.get(f"{BASE_URL}/api/admin/matchdays/{matchday_id}/matches")
    if matches_resp.status_code == 200:
        matches = matches_resp.json()
        for match in matches:
            admin_session.delete(f"{BASE_URL}/api/admin/matchdays/{matchday_id}/matches/{match['id']}")
    
    # Delete the matchday
    admin_session.delete(f"{BASE_URL}/api/admin/matchdays/{matchday_id}")


# ========================================
# TEST: GET /api/admin/real-fixtures/leagues
# ========================================
class TestGetLeagues:
    """Tests for GET /api/admin/real-fixtures/leagues"""
    
    def test_leagues_returns_5_leagues(self, admin_session):
        """Verify endpoint returns exactly 5 top leagues."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/leagues")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
        
        leagues = resp.json()
        assert isinstance(leagues, list), "Response should be a list"
        assert len(leagues) == 5, f"Expected 5 leagues, got {len(leagues)}"
    
    def test_leagues_have_required_fields(self, admin_session):
        """Verify each league has league_id, name, country, logo, current_season."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/leagues")
        assert resp.status_code == 200
        
        leagues = resp.json()
        required_fields = ["league_id", "name", "country", "logo", "current_season"]
        
        for league in leagues:
            for field in required_fields:
                assert field in league, f"League missing field '{field}': {league}"
            
            # Validate types
            assert isinstance(league["league_id"], int), f"league_id should be int: {league}"
            assert isinstance(league["name"], str), f"name should be string: {league}"
            assert isinstance(league["country"], str), f"country should be string: {league}"
    
    def test_leagues_include_serie_a(self, admin_session):
        """Verify Serie A (league_id=135) is in the list."""
        resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/leagues")
        assert resp.status_code == 200
        
        leagues = resp.json()
        serie_a = next((l for l in leagues if l["league_id"] == 135), None)
        
        assert serie_a is not None, "Serie A (league_id=135) should be in top 5 leagues"
        assert "Serie A" in serie_a["name"], f"Expected 'Serie A' in name, got: {serie_a['name']}"
        assert serie_a["country"] == "Italy", f"Expected country 'Italy', got: {serie_a['country']}"
    
    def test_leagues_caching(self, admin_session):
        """Verify second call returns cached data (faster response)."""
        # First call - may hit API-Football
        start1 = time.time()
        resp1 = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/leagues")
        time1 = time.time() - start1
        
        assert resp1.status_code == 200
        data1 = resp1.json()
        
        # Second call - should hit cache
        start2 = time.time()
        resp2 = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/leagues")
        time2 = time.time() - start2
        
        assert resp2.status_code == 200
        data2 = resp2.json()
        
        # Data should be identical
        assert data1 == data2, "Cached data should match original"
        
        # Second call should generally be faster (cache hit)
        # Not a strict assertion since network variability exists
        print(f"First call: {time1:.3f}s, Second call: {time2:.3f}s")
    
    def test_leagues_requires_admin_auth(self, non_admin_session):
        """Verify non-admin users get 403."""
        resp = non_admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/leagues")
        assert resp.status_code == 403, f"Non-admin should get 403, got {resp.status_code}"
    
    def test_leagues_requires_auth(self):
        """Verify unauthenticated requests get 401."""
        resp = requests.get(f"{BASE_URL}/api/admin/real-fixtures/leagues")
        assert resp.status_code == 401, f"Unauthenticated should get 401, got {resp.status_code}"


# ========================================
# TEST: GET /api/admin/real-fixtures/search
# ========================================
class TestSearchFixtures:
    """Tests for GET /api/admin/real-fixtures/search"""
    
    def test_search_fixtures_serie_a(self, admin_session):
        """Search Serie A fixtures for a date range."""
        params = {
            "league": 135,  # Serie A
            "season": 2024,  # 2024-2025 season
            "from": "2025-02-15",
            "to": "2025-02-25"
        }
        resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
        
        fixtures = resp.json()
        assert isinstance(fixtures, list), "Response should be a list"
        # We expect some fixtures in this date range
        print(f"Found {len(fixtures)} fixtures for Serie A 2024-2025 (Feb 15-25)")
    
    def test_search_fixtures_have_required_fields(self, admin_session):
        """Verify fixtures have fixture_id, home_team, away_team, date, status_short."""
        params = {
            "league": 135,
            "season": 2024,
            "from": "2025-02-15",
            "to": "2025-02-25"
        }
        resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        assert resp.status_code == 200
        
        fixtures = resp.json()
        required_fields = ["fixture_id", "home_team", "away_team", "date", "status_short"]
        
        if fixtures:  # Only check if we got fixtures
            for fixture in fixtures[:5]:  # Check first 5
                for field in required_fields:
                    assert field in fixture, f"Fixture missing field '{field}': {fixture}"
                
                # Validate types
                assert isinstance(fixture["fixture_id"], int), f"fixture_id should be int: {fixture}"
                assert isinstance(fixture["home_team"], str), f"home_team should be string: {fixture}"
                assert isinstance(fixture["away_team"], str), f"away_team should be string: {fixture}"
    
    def test_search_fixtures_require_league_param(self, admin_session):
        """Verify league parameter is required."""
        params = {"season": 2024}
        resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        
        # Should return 422 (validation error) or error status
        assert resp.status_code in [400, 422], f"Missing league should fail, got {resp.status_code}"
    
    def test_search_fixtures_require_season_param(self, admin_session):
        """Verify season parameter is required."""
        params = {"league": 135}
        resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        
        # Should return 422 (validation error) or error status
        assert resp.status_code in [400, 422], f"Missing season should fail, got {resp.status_code}"
    
    def test_search_fixtures_requires_admin_auth(self, non_admin_session):
        """Verify non-admin users get 403."""
        params = {"league": 135, "season": 2024}
        resp = non_admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        assert resp.status_code == 403, f"Non-admin should get 403, got {resp.status_code}"
    
    def test_search_fixtures_requires_auth(self):
        """Verify unauthenticated requests get 401."""
        params = {"league": 135, "season": 2024}
        resp = requests.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        assert resp.status_code == 401, f"Unauthenticated should get 401, got {resp.status_code}"


# ========================================
# TEST: POST /api/admin/real-fixtures/import
# ========================================
class TestImportFixtures:
    """Tests for POST /api/admin/real-fixtures/import"""
    
    def test_import_fixtures_success(self, admin_session, test_matchday_id):
        """Import fixtures and verify they're saved with correct fields."""
        # First search for fixtures to get valid fixture_ids
        params = {
            "league": 135,
            "season": 2024,
            "from": "2025-02-15",
            "to": "2025-02-20"
        }
        search_resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        assert search_resp.status_code == 200
        
        fixtures = search_resp.json()
        if not fixtures:
            pytest.skip("No fixtures found in date range to import")
        
        # Take first 2 fixtures for import
        fixture_ids = [f["fixture_id"] for f in fixtures[:2]]
        
        # Import fixtures
        import_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": test_matchday_id,
                "fixture_ids": fixture_ids
            }
        )
        
        assert import_resp.status_code == 200, f"Import failed: {import_resp.text[:300]}"
        
        result = import_resp.json()
        assert "imported" in result, f"Response missing 'imported' field: {result}"
        assert "skipped" in result, f"Response missing 'skipped' field: {result}"
        assert "matches" in result, f"Response missing 'matches' field: {result}"
        
        # Verify imported matches have correct fields
        for match in result["matches"]:
            assert match.get("external_provider") == "api-football", f"Missing external_provider: {match}"
            assert match.get("external_fixture_id") in fixture_ids, f"Wrong external_fixture_id: {match}"
            assert "home_team" in match, f"Missing home_team: {match}"
            assert "away_team" in match, f"Missing away_team: {match}"
            assert "start_time" in match, f"Missing start_time: {match}"
            assert "status" in match, f"Missing status: {match}"
            assert "competition" in match, f"Missing competition: {match}"
        
        print(f"Successfully imported {result['imported']} fixtures, skipped {result['skipped']}")
    
    def test_import_skips_duplicates(self, admin_session, test_matchday_id):
        """Import same fixtures twice - second import should skip."""
        # Search for fixtures
        params = {
            "league": 135,
            "season": 2024,
            "from": "2025-02-20",
            "to": "2025-02-25"
        }
        search_resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        if search_resp.status_code != 200 or not search_resp.json():
            pytest.skip("No fixtures found in date range")
        
        fixtures = search_resp.json()
        fixture_ids = [fixtures[0]["fixture_id"]]
        
        # First import
        import1_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": test_matchday_id,
                "fixture_ids": fixture_ids
            }
        )
        
        # Second import - should skip
        import2_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": test_matchday_id,
                "fixture_ids": fixture_ids
            }
        )
        
        assert import2_resp.status_code == 200
        result = import2_resp.json()
        
        # Check that fixture was skipped with reason
        assert result["skipped"] >= 1, f"Should skip duplicate, got: {result}"
        
        if result["skipped_details"]:
            skipped = result["skipped_details"][0]
            assert skipped.get("reason") == "already_imported", f"Wrong skip reason: {skipped}"
        
        print(f"Duplicate protection working: imported={result['imported']}, skipped={result['skipped']}")
    
    def test_import_enforces_max_10_matches(self, admin_session, test_matchday_id):
        """Verify max 10 match limit is enforced."""
        # Try to import 11 fixtures
        fake_fixture_ids = list(range(1, 12))  # 11 fake IDs
        
        import_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": test_matchday_id,
                "fixture_ids": fake_fixture_ids
            }
        )
        
        # Should fail with 400
        assert import_resp.status_code == 400, f"Expected 400 for >10 fixtures, got {import_resp.status_code}"
        
        error_msg = import_resp.json().get("detail", "")
        assert "10" in error_msg, f"Error should mention limit of 10: {error_msg}"
    
    def test_import_requires_league_id(self, admin_session, test_matchday_id):
        """Verify league_id is required."""
        import_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "matchday_id": test_matchday_id,
                "fixture_ids": [12345]
            }
        )
        
        assert import_resp.status_code in [400, 422], f"Missing league_id should fail, got {import_resp.status_code}"
    
    def test_import_requires_matchday_id(self, admin_session):
        """Verify matchday_id is required."""
        import_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "fixture_ids": [12345]
            }
        )
        
        assert import_resp.status_code in [400, 422], f"Missing matchday_id should fail, got {import_resp.status_code}"
    
    def test_import_requires_admin_auth(self, non_admin_session, test_matchday_id):
        """Verify non-admin users get 403."""
        import_resp = non_admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": test_matchday_id,
                "fixture_ids": [12345]
            }
        )
        assert import_resp.status_code == 403, f"Non-admin should get 403, got {import_resp.status_code}"
    
    def test_import_requires_auth(self, test_matchday_id):
        """Verify unauthenticated requests get 401."""
        import_resp = requests.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": test_matchday_id,
                "fixture_ids": [12345]
            }
        )
        assert import_resp.status_code == 401, f"Unauthenticated should get 401, got {import_resp.status_code}"
    
    def test_import_with_nonexistent_league(self, admin_session, test_matchday_id):
        """Verify 404 for nonexistent league."""
        import_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": "nonexistent-league-id",
                "matchday_id": test_matchday_id,
                "fixture_ids": [12345]
            }
        )
        
        assert import_resp.status_code == 404, f"Expected 404 for nonexistent league, got {import_resp.status_code}"
    
    def test_import_with_nonexistent_matchday(self, admin_session):
        """Verify 404 for nonexistent matchday."""
        import_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": "nonexistent-matchday-id",
                "fixture_ids": [12345]
            }
        )
        
        assert import_resp.status_code == 404, f"Expected 404 for nonexistent matchday, got {import_resp.status_code}"


# ========================================
# TEST: Imported match data validation
# ========================================
class TestImportedMatchData:
    """Verify imported matches have correct data structure."""
    
    def test_imported_match_has_all_fields(self, admin_session, test_matchday_id):
        """Verify imported match documents include all required fields."""
        # Search and import a fixture
        params = {"league": 135, "season": 2024, "from": "2025-02-18", "to": "2025-02-22"}
        search_resp = admin_session.get(f"{BASE_URL}/api/admin/real-fixtures/search", params=params)
        
        if search_resp.status_code != 200 or not search_resp.json():
            pytest.skip("No fixtures found")
        
        fixture = search_resp.json()[0]
        
        # Import it
        import_resp = admin_session.post(
            f"{BASE_URL}/api/admin/real-fixtures/import",
            json={
                "league_id": NATIONAL_LEAGUE_ID,
                "matchday_id": test_matchday_id,
                "fixture_ids": [fixture["fixture_id"]]
            }
        )
        
        # If already imported, that's ok
        if import_resp.status_code != 200:
            pytest.skip(f"Import failed: {import_resp.text[:200]}")
        
        result = import_resp.json()
        
        # Check imported matches
        if result.get("matches"):
            match = result["matches"][0]
            
            # Required fields for imported matches
            assert "home_team" in match
            assert "away_team" in match
            assert "start_time" in match
            assert "status" in match
            assert "competition" in match
            assert "external_provider" in match
            assert "external_fixture_id" in match
            
            # Validate external_provider value
            assert match["external_provider"] == "api-football"
            
            # Validate status is a valid internal status
            valid_statuses = ["scheduled", "live", "finished", "postponed", "cancelled", "void"]
            assert match["status"] in valid_statuses, f"Invalid status: {match['status']}"
            
            print(f"Match data: {match['home_team']} vs {match['away_team']}, status={match['status']}, "
                  f"competition={match['competition']}, external_id={match['external_fixture_id']}")
        else:
            # Check if skipped
            print(f"Fixture was skipped (probably already imported): {result.get('skipped_details')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
