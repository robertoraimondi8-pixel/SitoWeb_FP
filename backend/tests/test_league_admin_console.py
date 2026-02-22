"""
Test suite for League Admin Console feature.

Tests:
1. Profile endpoint returns owned leagues (owner_id or created_by)
2. GET /api/leagues/{id}/matchdays returns matchdays for a league
3. POST /api/leagues/{id}/matchdays creates matchday (owner only)
4. GET /api/leagues/{id}/matchdays/{md_id}/matches returns matches
5. POST /api/leagues/{id}/matchdays/{md_id}/matches creates match (owner only)
6. PUT /api/leagues/{id}/matchdays/{md_id} updates matchday status (owner only)
7. PUT /api/leagues/{id}/matches/{match_id} updates match result (owner only)
8. Non-owner gets 403 on management endpoints
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://matchday-fix.preview.emergentagent.com"

# Test credentials
OWNER_EMAIL = "ilio@raimondi.it"
OWNER_PASSWORD = "Roberto95"
NON_OWNER_EMAIL = "marco@test.com"
NON_OWNER_PASSWORD = "password123"


class TestLeagueAdminConsole:
    """Test League Admin Console backend endpoints"""

    @pytest.fixture(scope="class")
    def owner_token(self):
        """Login as owner user and return token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip(f"Owner login failed: {resp.status_code} - {resp.text}")
        data = resp.json()
        return data.get("access_token"), data.get("user", {}).get("id")

    @pytest.fixture(scope="class")
    def non_owner_setup(self):
        """Try to create or login as non-owner user"""
        # First try login
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": NON_OWNER_EMAIL,
            "password": NON_OWNER_PASSWORD
        })
        if resp.status_code == 200:
            data = resp.json()
            return data.get("access_token"), data.get("user", {}).get("id")
        
        # If login fails, try to register
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": NON_OWNER_EMAIL,
            "password": NON_OWNER_PASSWORD,
            "username": "marco_test_user",
            "first_name": "Marco",
            "last_name": "Test",
            "date_of_birth": "1990-01-15",
            "address": "Via Test 123",
            "city": "Roma",
            "country": "Italia",
            "postal_code": "00100",
            "language": "it",
            "accepted_privacy": True,
            "accepted_terms": True
        })
        if resp.status_code in [200, 201]:
            data = resp.json()
            return data.get("access_token"), data.get("user", {}).get("id")
        
        pytest.skip(f"Non-owner user setup failed: {resp.status_code}")

    @pytest.fixture(scope="class")
    def manual_league_id(self, owner_token):
        """Find or create a manual league owned by the owner user"""
        token, user_id = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get user's leagues
        resp = requests.get(f"{BASE_URL}/api/leagues", headers=headers)
        if resp.status_code != 200:
            pytest.skip("Could not fetch leagues")
        
        leagues = resp.json()
        
        # Find a manual league where user is owner
        for league in leagues:
            is_manual = league.get("match_source_type") in ("manual", "custom")
            is_owner = league.get("owner_id") == user_id or league.get("created_by") == user_id
            if is_manual and is_owner:
                print(f"Found existing manual league: {league.get('name')} ({league.get('id')})")
                return league.get("id")
        
        # Create a new manual league if none found
        season_resp = requests.get(f"{BASE_URL}/api/leagues/seasons", headers=headers)
        if season_resp.status_code != 200 or not season_resp.json():
            pytest.skip("No seasons available")
        
        season_id = season_resp.json()[0].get("id")
        
        create_resp = requests.post(f"{BASE_URL}/api/leagues", headers=headers, json={
            "name": f"TEST_LeagueAdmin_{datetime.now().strftime('%H%M%S')}",
            "season_id": season_id,
            "match_source_type": "manual",
            "start_matchday": 1,
            "end_matchday": 38,
            "bet_deadline_minutes": 60,
            "include_championship_predictions": False
        })
        if create_resp.status_code not in [200, 201]:
            pytest.skip(f"Could not create manual league: {create_resp.text}")
        
        league_id = create_resp.json().get("id")
        print(f"Created new manual league: {league_id}")
        return league_id

    # ====== TEST 1: Profile shows owned leagues ======
    def test_01_home_returns_owned_leagues(self, owner_token):
        """User's owned leagues are included in home response"""
        token, user_id = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.get(f"{BASE_URL}/api/home", headers=headers)
        assert resp.status_code == 200, f"Home failed: {resp.text}"
        
        data = resp.json()
        user_leagues = data.get("user_leagues", [])
        
        # Check that we have at least one league
        assert len(user_leagues) > 0, "No leagues found for user"
        
        # Check that leagues have the necessary fields for admin console
        for league in user_leagues:
            assert "id" in league, "League missing id"
            assert "name" in league, "League missing name"
            # owner_id or created_by should be present for ownership check
            has_ownership_field = "owner_id" in league or "created_by" in league
            assert has_ownership_field, f"League {league.get('name')} missing ownership field"
        
        print(f"Found {len(user_leagues)} leagues for owner")

    # ====== TEST 2: Owner can access league details ======
    def test_02_owner_can_get_league_details(self, owner_token, manual_league_id):
        """Owner can get full league details including match_source_type"""
        token, _ = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}", headers=headers)
        assert resp.status_code == 200, f"Failed to get league: {resp.text}"
        
        league = resp.json()
        assert league.get("match_source_type") in ("manual", "custom"), \
            f"Expected manual league but got {league.get('match_source_type')}"
        assert league.get("id") == manual_league_id
        
        print(f"League details: {league.get('name')}, type: {league.get('match_source_type')}")

    # ====== TEST 3: Owner can get matchdays for league ======
    def test_03_owner_can_get_league_matchdays(self, owner_token, manual_league_id):
        """Owner can fetch matchdays for their manual league"""
        token, _ = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", headers=headers)
        assert resp.status_code == 200, f"Failed to get matchdays: {resp.text}"
        
        matchdays = resp.json()
        assert isinstance(matchdays, list), "Expected list of matchdays"
        print(f"Found {len(matchdays)} matchdays for league")

    # ====== TEST 4: Owner can create matchday ======
    def test_04_owner_can_create_matchday(self, owner_token, manual_league_id):
        """Owner can create a new matchday for their manual league"""
        token, _ = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get league to find season_id
        league_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}", headers=headers)
        assert league_resp.status_code == 200
        season_id = league_resp.json().get("season_id")
        
        # Find an unused matchday number
        md_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", headers=headers)
        existing_numbers = [md.get("number") for md in md_resp.json()] if md_resp.status_code == 200 else []
        
        new_number = 1
        for i in range(1, 40):
            if i not in existing_numbers:
                new_number = i
                break
        
        # Create matchday
        kickoff = (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
        create_resp = requests.post(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", 
            headers=headers, 
            json={
                "season_id": season_id,
                "number": new_number,
                "label": f"Test Giornata {new_number}",
                "half": 1 if new_number <= 19 else 2,
                "first_kickoff": kickoff
            }
        )
        
        assert create_resp.status_code == 200, f"Failed to create matchday: {create_resp.text}"
        matchday = create_resp.json()
        assert matchday.get("number") == new_number
        assert matchday.get("league_id") == manual_league_id
        
        print(f"Created matchday {new_number} with id {matchday.get('id')}")
        return matchday.get("id")

    # ====== TEST 5: Owner can create match ======
    def test_05_owner_can_create_match(self, owner_token, manual_league_id):
        """Owner can create a match for a matchday in their manual league"""
        token, _ = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get or create a matchday
        md_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", headers=headers)
        matchdays = md_resp.json() if md_resp.status_code == 200 else []
        
        if not matchdays:
            # Create a matchday first
            league_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}", headers=headers)
            season_id = league_resp.json().get("season_id")
            kickoff = (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
            md_create = requests.post(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays",
                headers=headers,
                json={
                    "season_id": season_id,
                    "number": 1,
                    "label": "Test Giornata 1",
                    "half": 1,
                    "first_kickoff": kickoff
                }
            )
            assert md_create.status_code == 200, f"Failed to create matchday: {md_create.text}"
            matchday_id = md_create.json().get("id")
        else:
            matchday_id = matchdays[0].get("id")
        
        # Create a match
        match_time = (datetime.utcnow() + timedelta(days=7, hours=3)).isoformat() + "Z"
        match_resp = requests.post(
            f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays/{matchday_id}/matches",
            headers=headers,
            json={
                "home_team": "TEST_Home FC",
                "away_team": "TEST_Away United",
                "market_type": "1X2",
                "competition": "Test League",
                "start_time": match_time,
                "status": "scheduled"
            }
        )
        
        assert match_resp.status_code == 200, f"Failed to create match: {match_resp.text}"
        match = match_resp.json()
        assert match.get("home_team") == "TEST_Home FC"
        assert match.get("away_team") == "TEST_Away United"
        assert match.get("league_id") == manual_league_id
        
        print(f"Created match: {match.get('home_team')} vs {match.get('away_team')}")
        return match.get("id"), matchday_id

    # ====== TEST 6: Owner can update matchday status ======
    def test_06_owner_can_update_matchday_status(self, owner_token, manual_league_id):
        """Owner can change matchday status (DRAFT -> OPEN etc)"""
        token, _ = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get matchdays
        md_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", headers=headers)
        matchdays = md_resp.json() if md_resp.status_code == 200 else []
        
        if not matchdays:
            pytest.skip("No matchdays to update")
        
        matchday_id = matchdays[0].get("id")
        current_status = matchdays[0].get("status", "DRAFT")
        
        # Toggle status
        new_status = "OPEN" if current_status == "DRAFT" else "DRAFT"
        
        update_resp = requests.put(
            f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays/{matchday_id}",
            headers=headers,
            json={"status": new_status}
        )
        
        assert update_resp.status_code == 200, f"Failed to update matchday: {update_resp.text}"
        updated = update_resp.json()
        assert updated.get("status") == new_status, f"Status not updated: {updated.get('status')}"
        
        print(f"Updated matchday status from {current_status} to {new_status}")

    # ====== TEST 7: Owner can update match result ======
    def test_07_owner_can_update_match_result(self, owner_token, manual_league_id):
        """Owner can update match score and status"""
        token, _ = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get matchdays with matches
        md_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", headers=headers)
        matchdays = md_resp.json() if md_resp.status_code == 200 else []
        
        match_id = None
        for md in matchdays:
            matches_resp = requests.get(
                f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays/{md.get('id')}/matches",
                headers=headers
            )
            matches = matches_resp.json() if matches_resp.status_code == 200 else []
            if matches:
                match_id = matches[0].get("id")
                break
        
        if not match_id:
            pytest.skip("No matches to update")
        
        # Update match result
        update_resp = requests.put(
            f"{BASE_URL}/api/leagues/{manual_league_id}/matches/{match_id}",
            headers=headers,
            json={
                "home_score": 2,
                "away_score": 1,
                "status": "finished"
            }
        )
        
        assert update_resp.status_code == 200, f"Failed to update match: {update_resp.text}"
        updated = update_resp.json()
        assert updated.get("home_score") == 2
        assert updated.get("away_score") == 1
        assert updated.get("status") == "finished"
        
        print(f"Updated match result: 2-1 (finished)")

    # ====== TEST 8: Non-owner cannot create matchday ======
    def test_08_non_owner_cannot_create_matchday(self, non_owner_setup, manual_league_id, owner_token):
        """Non-owner should get 403 when trying to create matchday"""
        non_owner_token, _ = non_owner_setup
        owner_tk, _ = owner_token
        
        headers = {"Authorization": f"Bearer {non_owner_token}"}
        owner_headers = {"Authorization": f"Bearer {owner_tk}"}
        
        # Get league info to get season_id
        league_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}", headers=owner_headers)
        if league_resp.status_code != 200:
            pytest.skip("Could not get league info")
        season_id = league_resp.json().get("season_id")
        
        kickoff = (datetime.utcnow() + timedelta(days=14)).isoformat() + "Z"
        create_resp = requests.post(
            f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays",
            headers=headers,
            json={
                "season_id": season_id,
                "number": 99,  # unlikely to exist
                "label": "Unauthorized Test",
                "half": 2,
                "first_kickoff": kickoff
            }
        )
        
        # Should be 403 Forbidden OR 401 if not a member
        assert create_resp.status_code in [401, 403], \
            f"Non-owner should get 401/403 but got {create_resp.status_code}: {create_resp.text}"
        
        print(f"Non-owner correctly blocked with {create_resp.status_code}")

    # ====== TEST 9: Non-owner cannot create match ======
    def test_09_non_owner_cannot_create_match(self, non_owner_setup, manual_league_id, owner_token):
        """Non-owner should get 403 when trying to create match"""
        non_owner_token, _ = non_owner_setup
        owner_tk, _ = owner_token
        
        headers = {"Authorization": f"Bearer {non_owner_token}"}
        owner_headers = {"Authorization": f"Bearer {owner_tk}"}
        
        # Get a matchday ID
        md_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", headers=owner_headers)
        matchdays = md_resp.json() if md_resp.status_code == 200 else []
        
        if not matchdays:
            pytest.skip("No matchdays to test with")
        
        matchday_id = matchdays[0].get("id")
        match_time = (datetime.utcnow() + timedelta(days=14)).isoformat() + "Z"
        
        create_resp = requests.post(
            f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays/{matchday_id}/matches",
            headers=headers,
            json={
                "home_team": "Unauthorized Home",
                "away_team": "Unauthorized Away",
                "market_type": "1X2",
                "competition": "Test",
                "start_time": match_time,
                "status": "scheduled"
            }
        )
        
        assert create_resp.status_code in [401, 403], \
            f"Non-owner should get 401/403 but got {create_resp.status_code}: {create_resp.text}"
        
        print(f"Non-owner correctly blocked from creating match with {create_resp.status_code}")

    # ====== TEST 10: Non-owner cannot update match ======
    def test_10_non_owner_cannot_update_match(self, non_owner_setup, manual_league_id, owner_token):
        """Non-owner should get 403 when trying to update match result"""
        non_owner_token, _ = non_owner_setup
        owner_tk, _ = owner_token
        
        headers = {"Authorization": f"Bearer {non_owner_token}"}
        owner_headers = {"Authorization": f"Bearer {owner_tk}"}
        
        # Find a match
        md_resp = requests.get(f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays", headers=owner_headers)
        matchdays = md_resp.json() if md_resp.status_code == 200 else []
        
        match_id = None
        for md in matchdays:
            matches_resp = requests.get(
                f"{BASE_URL}/api/leagues/{manual_league_id}/matchdays/{md.get('id')}/matches",
                headers=owner_headers
            )
            matches = matches_resp.json() if matches_resp.status_code == 200 else []
            if matches:
                match_id = matches[0].get("id")
                break
        
        if not match_id:
            pytest.skip("No matches to test with")
        
        update_resp = requests.put(
            f"{BASE_URL}/api/leagues/{manual_league_id}/matches/{match_id}",
            headers=headers,
            json={"home_score": 5, "away_score": 0, "status": "finished"}
        )
        
        assert update_resp.status_code in [401, 403], \
            f"Non-owner should get 401/403 but got {update_resp.status_code}: {update_resp.text}"
        
        print(f"Non-owner correctly blocked from updating match with {update_resp.status_code}")

    # ====== TEST 11: National league blocks management ======
    def test_11_national_league_blocks_management(self, owner_token):
        """Owner of national league cannot manage matches (uses external data)"""
        token, _ = owner_token
        headers = {"Authorization": f"Bearer {token}"}
        
        # Find a national league
        leagues_resp = requests.get(f"{BASE_URL}/api/leagues", headers=headers)
        leagues = leagues_resp.json() if leagues_resp.status_code == 200 else []
        
        national_league = None
        for league in leagues:
            if league.get("match_source_type") == "national":
                national_league = league
                break
        
        if not national_league:
            # Try to find via national endpoint
            nat_resp = requests.get(f"{BASE_URL}/api/leagues/national", headers=headers)
            nat_leagues = nat_resp.json() if nat_resp.status_code == 200 else []
            if nat_leagues:
                national_league = nat_leagues[0]
        
        if not national_league:
            pytest.skip("No national league found to test")
        
        national_id = national_league.get("id")
        
        # Try to create matchday - should fail
        kickoff = (datetime.utcnow() + timedelta(days=14)).isoformat() + "Z"
        create_resp = requests.post(
            f"{BASE_URL}/api/leagues/{national_id}/matchdays",
            headers=headers,
            json={
                "season_id": national_league.get("season_id", ""),
                "number": 99,
                "label": "Test",
                "half": 2,
                "first_kickoff": kickoff
            }
        )
        
        # Should be 400 (bad request - uses national data) or 403
        assert create_resp.status_code in [400, 403], \
            f"National league should block management but got {create_resp.status_code}: {create_resp.text}"
        
        print(f"National league correctly blocked management with {create_resp.status_code}")


# ====== Additional verification tests ======
class TestProfileOwnedLeagues:
    """Test that profile correctly shows owned leagues"""

    @pytest.fixture
    def owner_session(self):
        """Login as owner"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        if resp.status_code != 200:
            pytest.skip("Login failed")
        data = resp.json()
        return data.get("access_token"), data.get("user", {}).get("id")

    def test_profile_contains_league_count(self, owner_session):
        """Profile endpoint returns leagues_count"""
        token, _ = owner_session
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.get(f"{BASE_URL}/api/profile", headers=headers)
        assert resp.status_code == 200, f"Profile failed: {resp.text}"
        
        data = resp.json()
        assert "leagues_count" in data, "Profile missing leagues_count"
        assert "user" in data, "Profile missing user data"
        
        print(f"User has {data.get('leagues_count')} leagues")

    def test_home_user_leagues_have_ownership_info(self, owner_session):
        """Home response includes ownership info for league admin logic"""
        token, user_id = owner_session
        headers = {"Authorization": f"Bearer {token}"}
        
        resp = requests.get(f"{BASE_URL}/api/home", headers=headers)
        assert resp.status_code == 200, f"Home failed: {resp.text}"
        
        data = resp.json()
        user_leagues = data.get("user_leagues", [])
        
        # Check at least one league has ownership fields
        has_ownership_fields = any(
            league.get("owner_id") or league.get("created_by")
            for league in user_leagues
        )
        
        assert has_ownership_fields or len(user_leagues) == 0, \
            "Leagues should have owner_id or created_by for frontend ownership check"
        
        # Count owned leagues
        owned_count = sum(
            1 for league in user_leagues
            if league.get("owner_id") == user_id or league.get("created_by") == user_id
        )
        
        print(f"User owns {owned_count} out of {len(user_leagues)} leagues")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
