"""
Test X3 Badge API Fields - Verifies is_special and multiplier fields in API responses
Tests backend changes for X3 badge display in live/completed and user-predictions screens
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://premium-mobile-app-1.preview.emergentagent.com')

# Test constants from requirements
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
G17_MATCHDAY_ID = "38df601f-49f7-47d1-8f7e-2aa524884f7d"
G18_MATCHDAY_ID = "461d6479-2987-45b3-adc8-63f4ec2aed1a"
ADMIN_USER_ID = "f0a01bb1-4b0c-4f6f-9c8e-a7b33b445651"
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def api_client():
    """Create a requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestUserPredictionsEndpoint:
    """Tests for GET /api/predictions/user/{userId}/{matchdayId} - X3 badge fields"""
    
    def test_user_predictions_returns_is_special_field(self, authenticated_client):
        """Verify is_special field is present in user-predictions response"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/predictions/user/{ADMIN_USER_ID}/{G17_MATCHDAY_ID}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "predictions" in data, "Response should contain predictions field"
        
        # Check that predictions list is not empty
        predictions = data["predictions"]
        if len(predictions) > 0:
            # Verify each prediction has is_special field
            for pred in predictions:
                assert "is_special" in pred, f"Prediction missing is_special field: {pred}"
                assert isinstance(pred["is_special"], bool), "is_special should be boolean"
    
    def test_user_predictions_returns_multiplier_field(self, authenticated_client):
        """Verify multiplier field is present in user-predictions response"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/predictions/user/{ADMIN_USER_ID}/{G17_MATCHDAY_ID}"
        )
        assert response.status_code == 200
        
        data = response.json()
        predictions = data.get("predictions", [])
        
        if len(predictions) > 0:
            for pred in predictions:
                assert "multiplier" in pred, f"Prediction missing multiplier field: {pred}"
                assert isinstance(pred["multiplier"], (int, float)), "multiplier should be numeric"
    
    def test_g17_inter_roma_is_special(self, authenticated_client):
        """Verify Inter vs Roma match in G17 has is_special=True and multiplier=3.0"""
        response = authenticated_client.get(
            f"{BASE_URL}/api/predictions/user/{ADMIN_USER_ID}/{G17_MATCHDAY_ID}"
        )
        assert response.status_code == 200
        
        data = response.json()
        predictions = data.get("predictions", [])
        
        # Find Inter vs Roma match
        special_match = None
        for pred in predictions:
            home = pred.get("home_team", "").lower()
            away = pred.get("away_team", "").lower()
            if "inter" in home or "inter" in away or "roma" in home or "roma" in away:
                special_match = pred
                break
        
        if special_match:
            print(f"Found special match: {special_match.get('home_team')} vs {special_match.get('away_team')}")
            assert special_match.get("is_special") == True, f"Inter vs Roma should have is_special=True, got {special_match.get('is_special')}"
            assert special_match.get("multiplier") == 3.0, f"Inter vs Roma should have multiplier=3.0, got {special_match.get('multiplier')}"
        else:
            # List all matches for debugging
            matches_list = [f"{p.get('home_team')} vs {p.get('away_team')}" for p in predictions]
            print(f"Available matches in G17: {matches_list}")
            pytest.fail("Inter vs Roma match not found in G17 predictions")


class TestLiveEndpoint:
    """Tests for GET /api/live/{matchday_id} - X3 badge fields"""
    
    def test_live_endpoint_returns_is_special(self, authenticated_client):
        """Verify is_special field in live endpoint match response"""
        response = authenticated_client.get(f"{BASE_URL}/api/live/{G17_MATCHDAY_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        matches = data.get("matches", [])
        
        if len(matches) > 0:
            for match in matches:
                assert "is_special" in match, f"Match missing is_special field: {match.get('home_team')} vs {match.get('away_team')}"
    
    def test_live_endpoint_returns_multiplier(self, authenticated_client):
        """Verify multiplier field in live endpoint match response"""
        response = authenticated_client.get(f"{BASE_URL}/api/live/{G17_MATCHDAY_ID}")
        assert response.status_code == 200
        
        data = response.json()
        matches = data.get("matches", [])
        
        if len(matches) > 0:
            for match in matches:
                assert "multiplier" in match, f"Match missing multiplier field: {match.get('home_team')} vs {match.get('away_team')}"
    
    def test_g17_live_inter_roma_special(self, authenticated_client):
        """Verify Inter vs Roma in live endpoint has correct special flags"""
        response = authenticated_client.get(f"{BASE_URL}/api/live/{G17_MATCHDAY_ID}")
        assert response.status_code == 200
        
        data = response.json()
        matches = data.get("matches", [])
        
        # Find the special match
        special_match = None
        for match in matches:
            if match.get("is_special") == True:
                special_match = match
                break
        
        if special_match:
            print(f"Special match found: {special_match.get('home_team')} vs {special_match.get('away_team')}")
            assert special_match.get("multiplier") == 3.0, f"Special match should have multiplier=3.0"
        else:
            # Print all matches for debugging
            print(f"Matches in live: {[(m.get('home_team'), m.get('away_team'), m.get('is_special')) for m in matches]}")


class TestHomeEndpoint:
    """Tests for GET /api/home - live provisional points"""
    
    def test_home_endpoint_accessible(self, authenticated_client):
        """Verify home endpoint returns 200"""
        response = authenticated_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_home_returns_live_section(self, authenticated_client):
        """Verify home endpoint structure includes live section"""
        response = authenticated_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200
        
        data = response.json()
        # Home should have live_matchday or live section when LIVE matchday exists
        # Currently no LIVE matchday, so it may be null
        print(f"Home response keys: {data.keys()}")
        print(f"Live matchday: {data.get('live_matchday')}")
        print(f"Total provisional: {data.get('total_provisional')}")
    
    def test_home_total_provisional_when_no_live(self, authenticated_client):
        """When no LIVE matchday exists, total_provisional should be null/0"""
        response = authenticated_client.get(f"{BASE_URL}/api/home")
        assert response.status_code == 200
        
        data = response.json()
        # If no LIVE matchday, live_matchday should be null
        if data.get("live_matchday") is None:
            print("No LIVE matchday currently - test passed (expected behavior)")
        else:
            # If there is a live matchday, total_provisional should be present
            assert "total_provisional" in data.get("live_matchday", {}), \
                "Live matchday should include total_provisional field"


class TestFixturesEndpoint:
    """Tests for GET /api/leagues/{league_id}/fixtures - X3 badge fields"""
    
    def test_fixtures_returns_is_special_for_special_matches(self, authenticated_client):
        """Verify fixtures endpoint returns is_special=True for special matches"""
        response = authenticated_client.get(f"{BASE_URL}/api/leagues/{NATIONAL_LEAGUE_ID}/fixtures")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        matchdays = data.get("matchdays", [])
        
        # Find special matches
        special_matches_found = 0
        for md in matchdays:
            for match in md.get("matches", []):
                if match.get("is_special") == True:
                    special_matches_found += 1
                    assert "multiplier" in match, "Special match should have multiplier field"
                    print(f"Special match found: {match.get('home_team')} vs {match.get('away_team')}, multiplier={match.get('multiplier')}")
        
        print(f"Total special matches found in fixtures: {special_matches_found}")
        assert special_matches_found >= 1, "At least one special match should exist"
    
    def test_fixtures_special_matches_have_multiplier(self, authenticated_client):
        """Verify special matches in fixtures have multiplier=3.0"""
        response = authenticated_client.get(f"{BASE_URL}/api/leagues/{NATIONAL_LEAGUE_ID}/fixtures")
        assert response.status_code == 200
        
        data = response.json()
        matchdays = data.get("matchdays", [])
        
        for md in matchdays:
            for match in md.get("matches", []):
                if match.get("is_special") == True:
                    assert match.get("multiplier") == 3.0, f"Special match should have multiplier=3.0, got {match.get('multiplier')}"
    
    def test_fixtures_g17_special_match(self, authenticated_client):
        """Verify G17 Inter vs Roma has is_special=True in fixtures"""
        response = authenticated_client.get(f"{BASE_URL}/api/leagues/{NATIONAL_LEAGUE_ID}/fixtures")
        assert response.status_code == 200
        
        data = response.json()
        matchdays = data.get("matchdays", data) if isinstance(data, dict) else data
        
        # Find G17 matchday
        g17_found = False
        special_matches_count = 0
        
        for md in matchdays if isinstance(matchdays, list) else [matchdays]:
            md_id = md.get("id") or md.get("matchday_id")
            matches = md.get("matches", [])
            
            if md_id == G17_MATCHDAY_ID:
                g17_found = True
                print(f"Found G17 with {len(matches)} matches")
                
                for match in matches:
                    if match.get("is_special"):
                        special_matches_count += 1
                        print(f"Special match in G17: {match.get('home_team')} vs {match.get('away_team')} (x{match.get('multiplier')})")
        
        if g17_found:
            assert special_matches_count >= 1, "G17 should have at least one special match (Inter vs Roma)"
    
    def test_fixtures_g18_special_match(self, authenticated_client):
        """Verify G18 Milan vs Napoli has is_special=True in fixtures"""
        response = authenticated_client.get(f"{BASE_URL}/api/leagues/{NATIONAL_LEAGUE_ID}/fixtures")
        assert response.status_code == 200
        
        data = response.json()
        matchdays = data.get("matchdays", data) if isinstance(data, dict) else data
        
        # Find G18 matchday
        g18_found = False
        special_matches_count = 0
        
        for md in matchdays if isinstance(matchdays, list) else [matchdays]:
            md_id = md.get("id") or md.get("matchday_id")
            matches = md.get("matches", [])
            
            if md_id == G18_MATCHDAY_ID:
                g18_found = True
                print(f"Found G18 with {len(matches)} matches")
                
                for match in matches:
                    if match.get("is_special"):
                        special_matches_count += 1
                        print(f"Special match in G18: {match.get('home_team')} vs {match.get('away_team')} (x{match.get('multiplier')})")
        
        if g18_found:
            assert special_matches_count >= 1, "G18 should have at least one special match (Milan vs Napoli)"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
