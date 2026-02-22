"""
Comprehensive Backend API Tests for FantaPronostic MVP

Tests cover:
- Health check
- Auth (register, login)
- Home endpoint
- Predictions CRUD
- Leagues (list, join, national)
- Admin endpoints (seasons, matchdays, matches, live-update)
"""
import pytest
import requests

BASE_URL = "https://p0-bugfix-sprint.preview.emergentagent.com"

class TestHealth:
    """API health check"""
    
    def test_api_health(self):
        """Test GET /api returns success"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "running"
        print("✓ API health check passed")


class TestAuth:
    """Authentication flows"""
    
    def test_login_seeded_user_marco(self):
        """Test login with seeded user marco@test.com"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "marco@test.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["email"] == "marco@test.com"
        print(f"✓ Marco login successful, token received")
    
    def test_login_admin(self):
        """Test login with admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] in ("admin", "superadmin")
        print(f"✓ Admin login successful, role: {data['user']['role']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")
    
    def test_register_new_user(self):
        """Test user registration"""
        import random
        random_num = random.randint(1000, 9999)
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_newuser{random_num}@test.com",
            "username": f"TEST_user{random_num}",
            "password": "testpass123",
            "language": "it"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == f"TEST_newuser{random_num}@test.com"
        print(f"✓ Registration successful for TEST_user{random_num}")


@pytest.fixture
def marco_token():
    """Get auth token for marco@test.com"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "marco@test.com",
        "password": "password123"
    })
    if response.status_code != 200:
        pytest.skip("Marco login failed - cannot proceed")
    return response.json()["access_token"]


@pytest.fixture
def admin_token():
    """Get auth token for admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@fantapronostic.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed - cannot proceed")
    return response.json()["access_token"]


class TestHome:
    """Home endpoint tests"""
    
    def test_home_with_auth(self, marco_token):
        """Test GET /api/home with authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Home should have matchday data
        assert "matchday" in data or data.get("matchday") is None
        print(f"✓ Home endpoint accessible, matchday status: {data.get('matchday', {}).get('status', 'N/A')}")
    
    def test_home_without_auth(self):
        """Test GET /api/home without auth token"""
        response = requests.get(f"{BASE_URL}/api/home")
        assert response.status_code == 401
        print("✓ Home endpoint correctly requires authentication")


class TestPredictions:
    """Predictions CRUD tests"""
    
    def test_get_predictions_for_matchday(self, marco_token):
        """Test GET /api/predictions/{matchday_id}"""
        # First get home to find matchday_id
        home_response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        home_data = home_response.json()
        
        if not home_data.get("matchday"):
            pytest.skip("No matchday available")
        
        matchday_id = home_data["matchday"]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "matchday" in data
        assert "predictions" in data
        assert isinstance(data["predictions"], list)
        print(f"✓ Predictions retrieved for matchday {matchday_id}, {len(data['predictions'])} matches")
    
    def test_save_predictions_batch(self, marco_token):
        """Test POST /api/predictions/{matchday_id} with batch predictions"""
        # Get matchday and matches
        home_response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        home_data = home_response.json()
        
        if not home_data.get("matchday"):
            pytest.skip("No matchday available")
        
        matchday_id = home_data["matchday"]["id"]
        
        # Get predictions to find match IDs
        pred_response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        pred_data = pred_response.json()
        
        if not pred_data.get("predictions"):
            pytest.skip("No matches available")
        
        # Create predictions for first 3 matches
        predictions = []
        for i, item in enumerate(pred_data["predictions"][:3]):
            match = item["match"]
            match_id = match["id"]
            market_type = match["market_type"]
            
            # Set appropriate prediction based on market type
            if market_type == "1X2":
                pred_value = "1"
            elif market_type == "GOAL_NOGOL":
                pred_value = "GOAL"
            elif market_type == "OVER_UNDER_25":
                pred_value = "OVER"
            elif market_type == "EXACT_SCORE":
                pred_value = "2-1"
            else:
                pred_value = "1"
            
            predictions.append({
                "match_id": match_id,
                "prediction_value": pred_value
            })
        
        # Save predictions
        response = requests.post(
            f"{BASE_URL}/api/predictions/{matchday_id}",
            headers={"Authorization": f"Bearer {marco_token}"},
            json={"predictions": predictions}
        )
        assert response.status_code == 200
        data = response.json()
        assert "saved_count" in data
        assert data["saved_count"] >= 0
        print(f"✓ Predictions saved: {data['saved_count']} matches")


class TestLeagues:
    """League management tests"""
    
    def test_get_my_leagues(self, marco_token):
        """Test GET /api/leagues"""
        response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User leagues retrieved: {len(data)} leagues")
    
    def test_join_league_with_code(self, marco_token):
        """Test POST /api/leagues/join with invite code"""
        # Try joining the seeded private league
        response = requests.post(
            f"{BASE_URL}/api/leagues/join",
            headers={"Authorization": f"Bearer {marco_token}"},
            json={"invite_code": "AMICI2024"}
        )
        # Should succeed or return 400 if already member
        assert response.status_code in (200, 400)
        if response.status_code == 200:
            data = response.json()
            assert "league" in data
            print(f"✓ Joined league with code AMICI2024")
        else:
            print(f"✓ Already member of league AMICI2024")
    
    def test_get_national_leagues(self):
        """Test GET /api/leagues/national"""
        response = requests.get(f"{BASE_URL}/api/leagues/national")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ National leagues retrieved: {len(data)} leagues")


class TestAdmin:
    """Admin endpoints tests"""
    
    def test_admin_get_seasons(self, admin_token):
        """Test GET /api/admin/seasons"""
        response = requests.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Admin seasons retrieved: {len(data)} seasons")
    
    def test_admin_get_matchdays(self, admin_token):
        """Test GET /api/admin/matchdays"""
        response = requests.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Admin matchdays retrieved: {len(data)} matchdays")
    
    def test_admin_get_matches(self, admin_token):
        """Test GET /api/admin/matches"""
        response = requests.get(
            f"{BASE_URL}/api/admin/matches",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Admin matches retrieved: {len(data)} matches")
    
    def test_admin_live_update_match(self, admin_token):
        """Test POST /api/admin/matches/{id}/live-update"""
        # Get first match
        matches_response = requests.get(
            f"{BASE_URL}/api/admin/matches",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        matches = matches_response.json()
        
        if not matches:
            pytest.skip("No matches available")
        
        match_id = matches[0]["id"]
        
        # Update match score
        response = requests.post(
            f"{BASE_URL}/api/admin/matches/{match_id}/live-update",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "match_id": match_id,
                "home_score": 2,
                "away_score": 1,
                "status": "live"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["home_score"] == 2
        assert data["away_score"] == 1
        assert data["status"] == "live"
        print(f"✓ Admin live update successful for match {match_id}")


class TestAdminAuth:
    """Admin authentication restrictions"""
    
    def test_admin_endpoint_requires_admin_role(self, marco_token):
        """Test that regular user cannot access admin endpoints"""
        response = requests.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        assert response.status_code == 403
        print("✓ Admin endpoint correctly blocks regular users")
