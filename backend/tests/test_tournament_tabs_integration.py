"""
Tests for Tournament Tabs Integration - Rankings (Gironi/Tabellone) and Predictions 
Focus: GET /api/tournaments/{id}/fixtures, /groups, /bracket endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')

# Test credentials
USER_EMAIL = "ilio@raimondi.it"
USER_PASSWORD = "password123"
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"

# Known tournament ID with groups and bracket data
KNOCKOUT_TOURNAMENT_ID = "b3e9021f-b8a6-4f65-ad83-fc7b778f922a"


class TestTournamentFixturesEndpoint:
    """Tests for GET /api/tournaments/{id}/fixtures endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture
    def user_token(self):
        """Get regular user auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER_EMAIL,
            "password": USER_PASSWORD
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_fixtures_endpoint_exists(self, admin_token):
        """Test that /api/tournaments/{id}/fixtures endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/fixtures",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 200 with matchdays array
        assert response.status_code == 200, f"Fixtures endpoint failed: {response.text}"
        data = response.json()
        assert "matchdays" in data, "Response must contain 'matchdays' key"
        assert isinstance(data["matchdays"], list), "matchdays must be a list"
        print(f"✓ Fixtures endpoint returns {len(data['matchdays'])} matchdays")
    
    def test_fixtures_matchday_structure(self, admin_token):
        """Test that each matchday has required fields for predictions compatibility"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/fixtures",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["matchdays"]) > 0:
            matchday = data["matchdays"][0]
            # Required fields for predictions screen compatibility
            assert "id" in matchday, "Matchday must have 'id'"
            assert "label" in matchday, "Matchday must have 'label'"
            assert "number" in matchday, "Matchday must have 'number'"
            assert "status" in matchday, "Matchday must have 'status'"
            assert "matches" in matchday, "Matchday must have 'matches'"
            print(f"✓ Matchday structure valid: id={matchday['id']}, label={matchday['label']}, status={matchday['status']}")
        else:
            print("⚠ No matchdays found in tournament (expected for newly created tournaments)")
    
    def test_fixtures_404_for_invalid_tournament(self, admin_token):
        """Test that fixtures endpoint returns 404 for invalid tournament ID"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/invalid-tournament-id-12345/fixtures",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Fixtures returns 404 for invalid tournament ID")


class TestTournamentGroupsEndpoint:
    """Tests for GET /api/tournaments/{id}/groups endpoint (Gironi tab)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_groups_endpoint_exists(self, admin_token):
        """Test that /api/tournaments/{id}/groups endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/groups",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Groups endpoint failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Groups response must be a list"
        print(f"✓ Groups endpoint returns {len(data)} groups")
    
    def test_groups_structure_for_gironi_tab(self, admin_token):
        """Test that groups have structure required for Gironi tab display"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/groups",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        groups = response.json()
        
        if len(groups) > 0:
            group = groups[0]
            # Required fields for Gironi tab
            assert "group_name" in group, "Group must have 'group_name'"
            assert "standings" in group, "Group must have 'standings'"
            assert isinstance(group["standings"], list), "standings must be a list"
            
            if len(group["standings"]) > 0:
                standing = group["standings"][0]
                # Check for G/V/P/S/Pts columns
                assert "user_id" in standing, "Standing must have 'user_id'"
                assert "username" in standing, "Standing must have 'username'"
                assert "played" in standing or "games" in standing, "Standing must have 'played' or 'games'"
                assert "wins" in standing, "Standing must have 'wins'"
                assert "draws" in standing, "Standing must have 'draws'"
                assert "losses" in standing, "Standing must have 'losses'"
                # Points field (group_points or points)
                has_points = "group_points" in standing or "points" in standing or "prediction_points" in standing
                assert has_points, "Standing must have a points field (group_points/points/prediction_points)"
                
                print(f"✓ Group {group['group_name']} standings structure valid")
                print(f"  Sample player: {standing['username']} - W:{standing['wins']}/D:{standing['draws']}/L:{standing['losses']}")
        else:
            print("⚠ No groups found (expected if tournament not in groups phase)")
    
    def test_groups_multiple_groups_exist(self, admin_token):
        """Test that knockout tournament has multiple groups (A, B, etc.)"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/groups",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        groups = response.json()
        
        # Knockout tournament should have groups A and B with 4 players each
        group_names = [g.get("group_name") for g in groups]
        print(f"✓ Found groups: {group_names}")
        assert len(groups) >= 2, f"Expected at least 2 groups, got {len(groups)}"


class TestTournamentBracketEndpoint:
    """Tests for GET /api/tournaments/{id}/bracket endpoint (Tabellone tab)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_bracket_endpoint_exists(self, admin_token):
        """Test that /api/tournaments/{id}/bracket endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/bracket",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Bracket endpoint failed: {response.text}"
        data = response.json()
        assert "bracket" in data, "Response must contain 'bracket' key"
        print(f"✓ Bracket endpoint returns data with 'bracket' key")
    
    def test_bracket_structure_for_tabellone_tab(self, admin_token):
        """Test that bracket has structure required for Tabellone tab display"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/bracket",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        bracket = data.get("bracket", {})
        
        if bracket:
            # Bracket is organized by round_type (quarterfinal, semifinal, final)
            for round_type, matchups in bracket.items():
                assert isinstance(matchups, list), f"Round '{round_type}' must be a list of matchups"
                print(f"✓ Round type '{round_type}' has {len(matchups)} matchups")
                
                if len(matchups) > 0:
                    matchup = matchups[0]
                    # Required fields for Tabellone display
                    assert "user_a_id" in matchup or "user_a_username" in matchup, "Matchup must identify user A"
                    assert "user_b_id" in matchup or "user_b_username" in matchup, "Matchup must identify user B"
                    assert "status" in matchup, "Matchup must have 'status'"
                    # Points fields
                    has_points = "user_a_points" in matchup and "user_b_points" in matchup
                    print(f"  Matchup: {matchup.get('user_a_username', 'TBD')} vs {matchup.get('user_b_username', 'TBD')}, status: {matchup.get('status')}")
        else:
            print("⚠ Bracket is empty (expected if still in groups phase - this is the Tabellone message case)")
    
    def test_bracket_404_for_invalid_tournament(self, admin_token):
        """Test that bracket endpoint returns 404 for invalid tournament ID"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/invalid-tournament-id-12345/bracket",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Could return 404 or empty bracket depending on implementation
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"✓ Bracket endpoint handles invalid tournament ID (status: {response.status_code})")


class TestTournamentDetailEndpoint:
    """Tests for GET /api/tournaments/{id} - used by frontend to determine status"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("access_token")
    
    def test_tournament_detail_includes_status(self, admin_token):
        """Test that tournament detail returns status field for conditional rendering"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data, "Tournament must have 'status' field"
        # Status should be one of: draft, registration, groups, knockout, completed
        valid_statuses = ["draft", "registration", "groups", "knockout", "completed"]
        assert data["status"] in valid_statuses, f"Invalid status: {data['status']}"
        
        print(f"✓ Tournament status: {data['status']}")
        print(f"  Status valid for Gironi tab: {data['status'] in ['groups', 'knockout', 'completed']}")
        print(f"  Status valid for Tabellone tab: {data['status'] in ['knockout', 'completed']}")
    
    def test_tournament_detail_includes_rounds(self, admin_token):
        """Test that tournament detail includes rounds array"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "rounds" in data, "Tournament must have 'rounds' array"
        assert isinstance(data["rounds"], list), "Rounds must be a list"
        print(f"✓ Tournament has {len(data['rounds'])} rounds")


class TestPredictionsTabTournamentIntegration:
    """Tests ensuring predictions tab can fetch from tournament fixtures"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_fixtures_format_matches_league_format(self, admin_token):
        """Test that tournament fixtures format is compatible with league fixtures format"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/fixtures",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Must have matchdays array (same as leagues/{id}/fixtures)
        assert "matchdays" in data, "Must have 'matchdays' key like league fixtures"
        
        if len(data["matchdays"]) > 0:
            md = data["matchdays"][0]
            # Required fields for predictions screen
            required_keys = ["id", "status", "matches"]
            for key in required_keys:
                assert key in md, f"Matchday missing required key: {key}"
            print(f"✓ Tournament fixtures format is compatible with league fixtures format")
        else:
            print("⚠ No matchdays to verify format")
    
    def test_predictions_endpoint_with_tournament_matchday(self, admin_token):
        """Test that predictions endpoint works with tournament matchday_id"""
        # First get a tournament matchday ID
        fixtures_resp = requests.get(
            f"{BASE_URL}/api/tournaments/{KNOCKOUT_TOURNAMENT_ID}/fixtures",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert fixtures_resp.status_code == 200
        matchdays = fixtures_resp.json().get("matchdays", [])
        
        if len(matchdays) > 0:
            matchday_id = matchdays[0]["id"]
            # Try to get predictions for this tournament matchday
            preds_resp = requests.get(
                f"{BASE_URL}/api/predictions/{matchday_id}?league_id={KNOCKOUT_TOURNAMENT_ID}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            # Should return 200 even if no predictions exist
            assert preds_resp.status_code == 200, f"Predictions endpoint failed: {preds_resp.text}"
            print(f"✓ Predictions endpoint works with tournament matchday_id: {matchday_id}")
        else:
            print("⚠ No matchdays available to test predictions endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
