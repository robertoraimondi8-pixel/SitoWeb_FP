"""
Champion Picks API Tests
Tests the 4 champion pick endpoints:
1. GET /api/champion-picks/teams?league_id=xxx - Returns teams with standings
2. POST /api/champion-picks - Saves/updates user's champion pick
3. GET /api/champion-picks/my?league_id=xxx - Returns user's current pick
4. GET /api/champion-picks/league?league_id=xxx - Returns all league picks with summary
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
STANDARD_USER = {"email": "ilio@raimondi.it", "password": "password123"}
ADMIN_USER = {"email": "admin@fantapronostic.com", "password": "admin123"}

# Test league IDs
LIGA2_LEAGUE_ID = "1762173a-31fe-463b-9668-d757114f440b"  # Custom league
ILIO_LEGA_ID = "883e5161-f3d2-404a-ab67-2c9301295e82"  # National source league


class TestChampionPicksAuth:
    """Authentication tests for champion picks"""
    
    def test_get_teams_requires_auth(self):
        """GET /api/champion-picks/teams requires authentication"""
        response = requests.get(f"{BASE_URL}/api/champion-picks/teams?league_id={LIGA2_LEAGUE_ID}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /champion-picks/teams requires authentication")
    
    def test_get_my_pick_requires_auth(self):
        """GET /api/champion-picks/my requires authentication"""
        response = requests.get(f"{BASE_URL}/api/champion-picks/my?league_id={LIGA2_LEAGUE_ID}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /champion-picks/my requires authentication")
    
    def test_get_league_picks_requires_auth(self):
        """GET /api/champion-picks/league requires authentication"""
        response = requests.get(f"{BASE_URL}/api/champion-picks/league?league_id={LIGA2_LEAGUE_ID}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: /champion-picks/league requires authentication")
    
    def test_post_pick_requires_auth(self):
        """POST /api/champion-picks requires authentication"""
        response = requests.post(f"{BASE_URL}/api/champion-picks", json={
            "league_id": LIGA2_LEAGUE_ID,
            "team_name": "Inter",
            "team_logo": "https://example.com/inter.png"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: POST /champion-picks requires authentication")


class TestChampionPicksTeams:
    """Tests for GET /api/champion-picks/teams endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_teams_for_national_league(self):
        """GET /api/champion-picks/teams returns 20 Serie A teams for national league"""
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/teams?league_id={ILIO_LEGA_ID}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "competition" in data, "Response missing 'competition' field"
        assert "teams" in data, "Response missing 'teams' field"
        assert "season" in data, "Response missing 'season' field"
        
        # Should return Serie A teams (default for national leagues)
        assert data["competition"] == "Serie A", f"Expected Serie A, got {data['competition']}"
        
        # Should have 20 teams
        teams = data["teams"]
        assert len(teams) == 20, f"Expected 20 teams, got {len(teams)}"
        
        # Verify team structure
        for team in teams:
            assert "rank" in team, "Team missing 'rank'"
            assert "team_name" in team, "Team missing 'team_name'"
            assert "team_logo" in team, "Team missing 'team_logo'"
            assert "points" in team, "Team missing 'points'"
            assert "played" in team, "Team missing 'played'"
        
        print(f"PASS: /champion-picks/teams returns {len(teams)} {data['competition']} teams")
        print(f"  Top 3: {teams[0]['team_name']}, {teams[1]['team_name']}, {teams[2]['team_name']}")
    
    def test_get_teams_for_custom_league(self):
        """GET /api/champion-picks/teams returns Serie A teams for custom league (default)"""
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/teams?league_id={LIGA2_LEAGUE_ID}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["competition"] == "Serie A", f"Expected Serie A default, got {data['competition']}"
        assert len(data["teams"]) == 20, f"Expected 20 teams, got {len(data['teams'])}"
        
        print(f"PASS: Custom league also defaults to Serie A with {len(data['teams'])} teams")
    
    def test_get_teams_missing_league_id(self):
        """GET /api/champion-picks/teams requires league_id parameter"""
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/teams",
            headers=self.headers
        )
        assert response.status_code == 422, f"Expected 422 for missing param, got {response.status_code}"
        print("PASS: /champion-picks/teams requires league_id parameter")
    
    def test_get_teams_invalid_league_id(self):
        """GET /api/champion-picks/teams returns 404 for invalid league"""
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/teams?league_id=invalid-id",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: /champion-picks/teams returns 404 for invalid league")


class TestChampionPicksSaveAndRetrieve:
    """Tests for POST/GET champion pick operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_save_champion_pick_creates_new(self):
        """POST /api/champion-picks creates a new pick"""
        # First get current pick to see if we need to clean up
        response = requests.post(
            f"{BASE_URL}/api/champion-picks",
            headers=self.headers,
            json={
                "league_id": ILIO_LEGA_ID,
                "team_name": "Inter",
                "team_logo": "https://media.api-sports.io/football/teams/505.png"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response missing 'status'"
        assert data["status"] in ["created", "updated"], f"Unexpected status: {data['status']}"
        assert data["team_name"] == "Inter", f"Expected 'Inter', got {data['team_name']}"
        
        print(f"PASS: Champion pick {data['status']} for Inter")
    
    def test_update_champion_pick(self):
        """POST /api/champion-picks updates existing pick"""
        # First save Inter
        requests.post(
            f"{BASE_URL}/api/champion-picks",
            headers=self.headers,
            json={
                "league_id": ILIO_LEGA_ID,
                "team_name": "Inter",
                "team_logo": "https://media.api-sports.io/football/teams/505.png"
            }
        )
        
        # Now change to Napoli
        response = requests.post(
            f"{BASE_URL}/api/champion-picks",
            headers=self.headers,
            json={
                "league_id": ILIO_LEGA_ID,
                "team_name": "Napoli",
                "team_logo": "https://media.api-sports.io/football/teams/492.png"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["status"] == "updated", f"Expected 'updated', got {data['status']}"
        assert data["team_name"] == "Napoli", f"Expected 'Napoli', got {data['team_name']}"
        
        print("PASS: Champion pick updated from Inter to Napoli")
    
    def test_get_my_champion_pick(self):
        """GET /api/champion-picks/my returns user's current pick"""
        # First save a pick
        requests.post(
            f"{BASE_URL}/api/champion-picks",
            headers=self.headers,
            json={
                "league_id": ILIO_LEGA_ID,
                "team_name": "Juventus",
                "team_logo": "https://media.api-sports.io/football/teams/496.png"
            }
        )
        
        # Now retrieve it
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/my?league_id={ILIO_LEGA_ID}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "competition" in data, "Response missing 'competition'"
        assert "pick" in data, "Response missing 'pick'"
        
        pick = data["pick"]
        assert pick is not None, "Expected pick to exist"
        assert pick["team_name"] == "Juventus", f"Expected 'Juventus', got {pick['team_name']}"
        assert "team_logo" in pick, "Pick missing 'team_logo'"
        assert "user_id" in pick, "Pick missing 'user_id'"
        assert "league_id" in pick, "Pick missing 'league_id'"
        
        print(f"PASS: Retrieved my champion pick: {pick['team_name']}")
    
    def test_get_my_pick_no_pick_yet(self):
        """GET /api/champion-picks/my returns null pick if none saved"""
        # Use liga2 league which might not have a pick
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/my?league_id={LIGA2_LEAGUE_ID}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "competition" in data, "Response missing 'competition'"
        assert "pick" in data, "Response should have 'pick' field (may be null)"
        
        print(f"PASS: /champion-picks/my handles no-pick case (pick={data['pick']})")


class TestChampionPicksLeague:
    """Tests for GET /api/champion-picks/league endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_league_picks(self):
        """GET /api/champion-picks/league returns all league members' picks"""
        # First save a pick to ensure there's data
        requests.post(
            f"{BASE_URL}/api/champion-picks",
            headers=self.headers,
            json={
                "league_id": ILIO_LEGA_ID,
                "team_name": "AC Milan",
                "team_logo": "https://media.api-sports.io/football/teams/489.png"
            }
        )
        
        # Get league picks
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/league?league_id={ILIO_LEGA_ID}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "competition" in data, "Response missing 'competition'"
        assert "total_members" in data, "Response missing 'total_members'"
        assert "total_picks" in data, "Response missing 'total_picks'"
        assert "picks" in data, "Response missing 'picks'"
        assert "team_summary" in data, "Response missing 'team_summary'"
        
        # Verify picks structure
        assert isinstance(data["picks"], list), "'picks' should be a list"
        if len(data["picks"]) > 0:
            pick = data["picks"][0]
            assert "user_id" in pick, "Pick missing 'user_id'"
            assert "username" in pick, "Pick missing 'username'"
            assert "team_name" in pick, "Pick missing 'team_name'"
            assert "is_current_user" in pick, "Pick missing 'is_current_user'"
        
        # Verify team_summary structure
        assert isinstance(data["team_summary"], list), "'team_summary' should be a list"
        if len(data["team_summary"]) > 0:
            summary = data["team_summary"][0]
            assert "team_name" in summary, "Summary missing 'team_name'"
            assert "count" in summary, "Summary missing 'count'"
            assert "team_logo" in summary, "Summary missing 'team_logo'"
        
        print(f"PASS: League picks - {data['total_picks']}/{data['total_members']} members picked")
        print(f"  Top choice: {data['team_summary'][0]['team_name']} ({data['team_summary'][0]['count']} picks)" if data['team_summary'] else "  No picks yet")
    
    def test_league_picks_marks_current_user(self):
        """GET /api/champion-picks/league marks current user's pick"""
        response = requests.get(
            f"{BASE_URL}/api/champion-picks/league?league_id={ILIO_LEGA_ID}",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Find current user's pick
        current_user_picks = [p for p in data["picks"] if p.get("is_current_user")]
        if current_user_picks:
            print(f"PASS: Current user's pick marked correctly: {current_user_picks[0]['team_name']}")
        else:
            print("INFO: No pick found for current user (may not have picked yet)")


class TestChampionPicksMembership:
    """Tests for membership validation in champion picks"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_cannot_save_pick_without_membership(self):
        """POST /api/champion-picks requires league membership"""
        # Try to save pick for a league user is not a member of
        response = requests.post(
            f"{BASE_URL}/api/champion-picks",
            headers=self.headers,
            json={
                "league_id": "non-existent-league-id",
                "team_name": "Inter",
                "team_logo": "https://example.com/inter.png"
            }
        )
        # Should fail with 404 (league not found) or 403 (not a member)
        assert response.status_code in [403, 404], f"Expected 403/404, got {response.status_code}"
        print(f"PASS: Cannot save pick for non-member league (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
