"""
Tests for Multi-League Fixtures Feature:
1. GET /api/leagues/{id}/fixtures - national leagues inherit from Nazionale
2. GET /api/leagues/{id}/fixtures - manual leagues return own matchdays
3. POST /api/leagues/{id}/matchdays + POST matches - creator can add matchday/match
4. PATCH /api/profile/current-league - persists current league
5. GET /api/home?league_id=X - returns league + user_leagues
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://predict-hub-10.preview.emergentagent.com').rstrip('/')

# Test credentials
USER1 = {"email": "email@email.com", "password": "Roberto95"}
USER2 = {"email": "marco@test.com", "password": "password123"}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get auth token for user1"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=USER1)
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_token_user2(api_client):
    """Get auth token for user2 (marco)"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=USER2)
    assert response.status_code == 200, f"Login failed for user2: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def active_season(api_client, auth_token):
    """Get active season"""
    response = api_client.get(
        f"{BASE_URL}/api/leagues/seasons",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    seasons = response.json()
    assert len(seasons) > 0, "No active seasons found"
    return seasons[0]


@pytest.fixture(scope="module")
def national_league(api_client, auth_token):
    """Get national league"""
    response = api_client.get(
        f"{BASE_URL}/api/leagues/national",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    leagues = response.json()
    if leagues:
        return leagues[0]
    return None


class TestNationalLeagueFixtures:
    """Test 1: GET /api/leagues/{id}/fixtures for national leagues - should inherit matchdays from Nazionale"""
    
    def test_national_league_exists(self, national_league):
        """Verify national league exists"""
        assert national_league is not None, "National league must exist for inheritance tests"
        print(f"National league: {national_league.get('name')} (id: {national_league.get('id')[:8]})")
    
    def test_national_league_fixtures_returns_matchdays(self, api_client, auth_token, national_league):
        """GET /api/leagues/{national_id}/fixtures should return matchdays with matches"""
        if not national_league:
            pytest.skip("National league not found")
        
        response = api_client.get(
            f"{BASE_URL}/api/leagues/{national_league['id']}/fixtures",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get fixtures: {response.text}"
        
        data = response.json()
        assert "matchdays" in data, "Response must have 'matchdays' field"
        print(f"National league fixtures: {len(data['matchdays'])} matchdays")
        
        # Verify matchdays have structure
        if data['matchdays']:
            md = data['matchdays'][0]
            assert "id" in md, "Matchday must have id"
            assert "number" in md, "Matchday must have number"
            assert "matches" in md, "Matchday must have matches array"
    
    def test_create_private_national_source_league(self, api_client, auth_token, active_season, national_league):
        """Create a private league with match_source_type=national, verify fixtures inherit from Nazionale"""
        if not national_league:
            pytest.skip("National league not found")
        
        # Create league with national source
        create_payload = {
            "name": f"TEST_NationalSource_{datetime.now().strftime('%H%M%S')}",
            "season_id": active_season["id"],
            "start_matchday": 1,
            "end_matchday": 38,
            "match_source_type": "national",  # Inherit from national
            "bet_deadline_minutes": 15,
            "scoring_config": {
                "1x2": {"enabled": True, "points": 1.0},
                "over_under": {"enabled": True, "points": 0.5}
            }
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/leagues",
            json=create_payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200, f"Failed to create league: {create_response.text}"
        
        league = create_response.json()
        league_id = league["id"]
        print(f"Created national-source league: {league['name']} (id: {league_id[:8]})")
        
        # Verify match_source_type
        assert league["match_source_type"] == "national", "League should have national source type"
        
        # Get fixtures - should inherit from national league
        fixtures_response = api_client.get(
            f"{BASE_URL}/api/leagues/{league_id}/fixtures",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert fixtures_response.status_code == 200, f"Failed to get fixtures: {fixtures_response.text}"
        
        data = fixtures_response.json()
        assert "matchdays" in data, "Response must have matchdays"
        
        # Should have matchdays inherited from national
        matchdays = data.get("matchdays", [])
        print(f"Private national-source league has {len(matchdays)} matchdays (inherited)")
        
        # Verify source_league_id points to national
        assert data.get("source_league_id") == national_league["id"], \
            f"source_league_id should be {national_league['id'][:8]}, got {data.get('source_league_id', '')[:8] if data.get('source_league_id') else 'None'}"


class TestManualLeagueFixtures:
    """Test 2-3: Manual leagues have their own matchdays, creator can add matchdays/matches"""
    
    def test_create_manual_league_and_add_fixtures(self, api_client, auth_token, active_season):
        """Create manual league, add matchday, add match - verify fixtures return own data"""
        
        # Create league with manual source
        create_payload = {
            "name": f"TEST_Manual_{datetime.now().strftime('%H%M%S')}",
            "season_id": active_season["id"],
            "start_matchday": 1,
            "end_matchday": 10,
            "match_source_type": "manual",  # Own matches
            "bet_deadline_minutes": 10,
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/leagues",
            json=create_payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200, f"Failed to create manual league: {create_response.text}"
        
        league = create_response.json()
        league_id = league["id"]
        print(f"Created manual league: {league['name']} (id: {league_id[:8]})")
        
        assert league["match_source_type"] == "manual", "League should have manual source type"
        
        # Initially should have 0 matchdays
        fixtures_response = api_client.get(
            f"{BASE_URL}/api/leagues/{league_id}/fixtures",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert fixtures_response.status_code == 200
        initial_matchdays = fixtures_response.json().get("matchdays", [])
        print(f"Initial matchdays: {len(initial_matchdays)}")
        
        # Add matchday via POST /api/leagues/{id}/matchdays
        kickoff_time = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT15:00:00")
        matchday_payload = {
            "number": 1,
            "label": "Giornata 1 Test",
            "half": 1,
            "first_kickoff": kickoff_time,
            "season_id": active_season["id"]
        }
        
        md_response = api_client.post(
            f"{BASE_URL}/api/leagues/{league_id}/matchdays",
            json=matchday_payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert md_response.status_code == 200, f"Failed to create matchday: {md_response.text}"
        
        matchday = md_response.json()
        matchday_id = matchday["id"]
        print(f"Created matchday {matchday['number']}: {matchday['label']} (id: {matchday_id[:8]})")
        
        assert matchday["number"] == 1, "Matchday number should be 1"
        assert matchday["league_id"] == league_id, "Matchday should belong to league"
        
        # Add match via POST /api/leagues/{id}/matchdays/{md_id}/matches
        match_kickoff = (datetime.now() + timedelta(days=7, hours=1)).strftime("%Y-%m-%dT16:00:00")
        match_payload = {
            "home_team": "Milan",
            "away_team": "Inter",
            "competition": "Serie A Test",
            "start_time": match_kickoff,
            "market_type": "1X2",
            "status": "scheduled"
        }
        
        match_response = api_client.post(
            f"{BASE_URL}/api/leagues/{league_id}/matchdays/{matchday_id}/matches",
            json=match_payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert match_response.status_code == 200, f"Failed to create match: {match_response.text}"
        
        match_data = match_response.json()
        print(f"Created match: {match_data['home_team']} vs {match_data['away_team']}")
        
        assert match_data["home_team"] == "Milan", "Home team should be Milan"
        assert match_data["away_team"] == "Inter", "Away team should be Inter"
        assert match_data["matchday_id"] == matchday_id, "Match should belong to matchday"
        assert match_data["league_id"] == league_id, "Match should belong to league"
        
        # Verify fixtures now has 1 matchday with 1 match
        final_fixtures = api_client.get(
            f"{BASE_URL}/api/leagues/{league_id}/fixtures",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert final_fixtures.status_code == 200
        
        final_data = final_fixtures.json()
        final_matchdays = final_data.get("matchdays", [])
        
        assert len(final_matchdays) == 1, f"Should have 1 matchday, got {len(final_matchdays)}"
        assert len(final_matchdays[0].get("matches", [])) == 1, \
            f"Should have 1 match in matchday, got {len(final_matchdays[0].get('matches', []))}"
        
        print(f"VERIFIED: Manual league has {len(final_matchdays)} matchday(s) with {len(final_matchdays[0].get('matches', []))} match(es)")


class TestCurrentLeaguePersistence:
    """Test 4: PATCH /api/profile/current-league persists the current league"""
    
    def test_set_current_league(self, api_client, auth_token, active_season):
        """Set current league and verify persistence"""
        
        # Create a test league first
        create_payload = {
            "name": f"TEST_CurrentLeague_{datetime.now().strftime('%H%M%S')}",
            "season_id": active_season["id"],
            "start_matchday": 1,
            "end_matchday": 38,
            "match_source_type": "national",
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/leagues",
            json=create_payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        league = create_response.json()
        league_id = league["id"]
        print(f"Created test league for current-league test: {league_id[:8]}")
        
        # Set current league
        set_response = api_client.patch(
            f"{BASE_URL}/api/profile/current-league?league_id={league_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert set_response.status_code == 200, f"Failed to set current league: {set_response.text}"
        
        result = set_response.json()
        assert result.get("current_league_id") == league_id, \
            f"current_league_id should be {league_id[:8]}, got {result.get('current_league_id', '')[:8] if result.get('current_league_id') else 'None'}"
        
        print(f"VERIFIED: current_league_id set to {league_id[:8]}")
        
        # Verify via /home endpoint
        home_response = api_client.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert home_response.status_code == 200
        
        home_data = home_response.json()
        active_league = home_data.get("league")
        
        # Home should return the league we just set as current
        assert active_league is not None, "Home should return active league"
        assert active_league.get("id") == league_id, \
            f"Active league should be {league_id[:8]}, got {active_league.get('id', '')[:8] if active_league.get('id') else 'None'}"
        
        print(f"VERIFIED: Home endpoint returns current league: {active_league.get('name')}")


class TestHomeLeagueSwitch:
    """Test 5: GET /api/home?league_id=X returns league + user_leagues"""
    
    def test_home_returns_user_leagues(self, api_client, auth_token):
        """Home endpoint should return user_leagues array"""
        response = api_client.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Home failed: {response.text}"
        
        data = response.json()
        
        # user_leagues must be present
        assert "user_leagues" in data, "Response must have 'user_leagues' field"
        user_leagues = data.get("user_leagues", [])
        print(f"User has {len(user_leagues)} leagues")
        
        # Verify user_leagues structure
        if user_leagues:
            league = user_leagues[0]
            assert "id" in league, "League must have id"
            assert "name" in league, "League must have name"
            print(f"First league: {league['name']} (type: {league.get('league_type', 'private')})")
    
    def test_home_with_league_id_param(self, api_client, auth_token, active_season):
        """GET /api/home?league_id=X should return that specific league"""
        
        # Create 2 leagues so user has multiple
        leagues_created = []
        for i in range(2):
            create_payload = {
                "name": f"TEST_HomeSwitch_{i}_{datetime.now().strftime('%H%M%S')}",
                "season_id": active_season["id"],
                "start_matchday": 1,
                "end_matchday": 38,
                "match_source_type": "national",
            }
            resp = api_client.post(
                f"{BASE_URL}/api/leagues",
                json=create_payload,
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            if resp.status_code == 200:
                leagues_created.append(resp.json())
        
        print(f"Created {len(leagues_created)} test leagues for switch test")
        
        if len(leagues_created) < 2:
            pytest.skip("Could not create test leagues")
        
        # Request home with second league as param
        target_league = leagues_created[1]
        response = api_client.get(
            f"{BASE_URL}/api/home?league_id={target_league['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify 'league' field returns requested league
        active_league = data.get("league")
        assert active_league is not None, "Response must have 'league' field"
        assert active_league.get("id") == target_league["id"], \
            f"Active league should be {target_league['id'][:8]}, got {active_league.get('id', '')[:8] if active_league.get('id') else 'None'}"
        
        print(f"VERIFIED: Home with league_id param returns correct league: {active_league.get('name')}")
        
        # Verify user_leagues contains both leagues
        user_leagues = data.get("user_leagues", [])
        league_ids = [l.get("id") for l in user_leagues]
        
        assert leagues_created[0]["id"] in league_ids, "user_leagues should contain first created league"
        assert leagues_created[1]["id"] in league_ids, "user_leagues should contain second created league"
        
        print(f"VERIFIED: user_leagues contains {len(user_leagues)} leagues (including test leagues)")


class TestNonOwnerCannotAddFixtures:
    """Verify non-owner cannot add matchdays/matches to manual league"""
    
    def test_non_owner_cannot_create_matchday(self, api_client, auth_token, auth_token_user2, active_season):
        """Non-owner should get 403 when trying to add matchday"""
        
        # User1 creates manual league
        create_payload = {
            "name": f"TEST_OwnerOnly_{datetime.now().strftime('%H%M%S')}",
            "season_id": active_season["id"],
            "start_matchday": 1,
            "end_matchday": 10,
            "match_source_type": "manual",
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/leagues",
            json=create_payload,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert create_response.status_code == 200
        league = create_response.json()
        league_id = league["id"]
        invite_code = league["invite_code"]
        print(f"Created manual league for owner test: {league_id[:8]}")
        
        # User2 joins the league
        join_response = api_client.post(
            f"{BASE_URL}/api/leagues/join",
            json={"invite_code": invite_code},
            headers={"Authorization": f"Bearer {auth_token_user2}"}
        )
        assert join_response.status_code == 200, f"Join failed: {join_response.text}"
        print("User2 joined the league")
        
        # User2 (non-owner) tries to add matchday - should fail with 403
        matchday_payload = {
            "number": 1,
            "label": "Giornata Hacker",
            "half": 1,
            "first_kickoff": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%dT15:00:00"),
            "season_id": active_season["id"]
        }
        
        fail_response = api_client.post(
            f"{BASE_URL}/api/leagues/{league_id}/matchdays",
            json=matchday_payload,
            headers={"Authorization": f"Bearer {auth_token_user2}"}
        )
        
        assert fail_response.status_code == 403, \
            f"Non-owner should get 403, got {fail_response.status_code}: {fail_response.text}"
        
        print("VERIFIED: Non-owner correctly blocked from adding matchday (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
