"""
Onboarding & League Management Tests - Milestone 1-3

Tests cover:
- New user registration → empty leagues array
- Create private league → returns invite_code
- Join private league with code AMICI2024
- GET /api/leagues returns leagues with member_count
- GET /api/leagues/national returns national leagues
- GET /api/leagues/seasons returns active seasons
- Admin endpoints for matchdays and matches (verify 11 seeded matches)
"""
import pytest
import requests
import random

BASE_URL = "https://fixture-hub-5.preview.emergentagent.com"


@pytest.fixture
def new_user_credentials():
    """Generate unique credentials for new user"""
    random_num = random.randint(10000, 99999)
    return {
        "email": f"TEST_onboarding_{random_num}@test.com",
        "username": f"TEST_ob_{random_num}",
        "password": "testpass123",
        "language": "it"
    }


@pytest.fixture
def new_user_token(new_user_credentials):
    """Register new user and return auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/register", json=new_user_credentials)
    if response.status_code != 200:
        pytest.skip(f"User registration failed: {response.status_code}")
    data = response.json()
    return data["access_token"]


@pytest.fixture
def marco_token():
    """Get auth token for existing user marco@test.com"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "marco@test.com",
        "password": "password123"
    })
    if response.status_code != 200:
        pytest.skip("Marco login failed")
    return response.json()["access_token"]


@pytest.fixture
def admin_token():
    """Get auth token for admin"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@fantapronostic.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed")
    return response.json()["access_token"]


class TestNewUserOnboarding:
    """Test new user registration and onboarding flow"""
    
    def test_register_new_user_returns_tokens(self, new_user_credentials):
        """Test POST /api/auth/register creates user and returns tokens"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json=new_user_credentials)
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["email"] == new_user_credentials["email"]
        assert data["user"]["username"] == new_user_credentials["username"]
        assert data["user"]["language"] == "it"
        print(f"✓ New user registered: {new_user_credentials['username']}")
    
    def test_new_user_has_empty_leagues(self, new_user_token):
        """Test GET /api/leagues returns empty array for new user"""
        response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {new_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        print("✓ New user has empty leagues array (onboarding required)")


class TestLeagueCreation:
    """Test private league creation"""
    
    def test_create_private_league(self, new_user_token):
        """Test POST /api/leagues creates private league with invite_code"""
        # First get active season
        seasons_response = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {new_user_token}"}
        )
        assert seasons_response.status_code == 200
        seasons = seasons_response.json()
        assert len(seasons) > 0
        season_id = seasons[0]["id"]
        
        # Create league
        random_num = random.randint(1000, 9999)
        league_name = f"TEST_Lega_{random_num}"
        response = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {new_user_token}"},
            json={
                "name": league_name,
                "season_id": season_id
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert "name" in data
        assert data["name"] == league_name
        assert "invite_code" in data
        assert data["invite_code"] is not None
        assert len(data["invite_code"]) == 8
        assert "league_type" in data
        assert data["league_type"] == "private"
        assert "member_count" in data
        assert data["member_count"] == 1
        
        print(f"✓ Private league created: {league_name}, invite_code: {data['invite_code']}")
        
        # Verify league appears in user's leagues
        leagues_response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {new_user_token}"}
        )
        leagues = leagues_response.json()
        assert len(leagues) == 1
        assert leagues[0]["id"] == data["id"]
        assert leagues[0]["invite_code"] == data["invite_code"]
        print(f"✓ League verified in user's league list")


class TestLeagueJoin:
    """Test joining private league with invite code"""
    
    def test_join_private_league_with_code(self, new_user_token):
        """Test POST /api/leagues/join with code AMICI2024"""
        response = requests.post(
            f"{BASE_URL}/api/leagues/join",
            headers={"Authorization": f"Bearer {new_user_token}"},
            json={"invite_code": "AMICI2024"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "league" in data
        assert data["league"]["invite_code"] == "AMICI2024"
        
        print(f"✓ Successfully joined league with code AMICI2024: {data['league']['name']}")
        
        # Verify league appears in user's leagues
        leagues_response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {new_user_token}"}
        )
        leagues = leagues_response.json()
        assert any(l.get("invite_code") == "AMICI2024" for l in leagues)
        print(f"✓ League AMICI2024 verified in user's league list")
    
    def test_join_invalid_code_returns_404(self, new_user_token):
        """Test joining with invalid code returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/leagues/join",
            headers={"Authorization": f"Bearer {new_user_token}"},
            json={"invite_code": "INVALID999"}
        )
        assert response.status_code == 404
        print("✓ Invalid invite code correctly returns 404")


class TestLeaguesList:
    """Test league listing endpoints"""
    
    def test_get_user_leagues_with_member_count(self, marco_token):
        """Test GET /api/leagues returns leagues with member_count"""
        response = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {marco_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            # Verify each league has member_count
            for league in data:
                assert "id" in league
                assert "name" in league
                assert "league_type" in league
                assert "member_count" in league
                assert isinstance(league["member_count"], int)
                assert league["member_count"] > 0
                
                # Private leagues should have invite_code
                if league["league_type"] == "private":
                    assert "invite_code" in league
            
            print(f"✓ User leagues retrieved: {len(data)} leagues, all have member_count")
        else:
            print("✓ User has no leagues (empty array)")
    
    def test_get_national_leagues(self):
        """Test GET /api/leagues/national returns national leagues"""
        response = requests.get(f"{BASE_URL}/api/leagues/national")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            for league in data:
                assert "id" in league
                assert "name" in league
                assert "league_type" in league
                assert league["league_type"] == "national"
                assert "member_count" in league
            
            print(f"✓ National leagues retrieved: {len(data)} leagues")
        else:
            print("✓ No national leagues available")
    
    def test_get_active_seasons(self):
        """Test GET /api/leagues/seasons returns active seasons"""
        response = requests.get(f"{BASE_URL}/api/leagues/seasons")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        for season in data:
            assert "id" in season
            assert "name" in season
            assert "year" in season
            assert "is_active" in season
            assert season["is_active"] is True
        
        print(f"✓ Active seasons retrieved: {len(data)} seasons")


class TestAdminMatchdaysMatches:
    """Test admin endpoints for matchdays and matches"""
    
    def test_admin_get_matchdays(self, admin_token):
        """Test GET /api/admin/matchdays returns matchdays"""
        response = requests.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        for matchday in data:
            assert "id" in matchday
            assert "season_id" in matchday
            assert "number" in matchday
            assert "status" in matchday
            assert "first_kickoff" in matchday
        
        print(f"✓ Admin matchdays retrieved: {len(data)} matchdays")
    
    def test_admin_get_matches_for_seeded_matchday(self, admin_token):
        """Test GET /api/admin/matches returns 11 seeded matches"""
        # First get matchdays
        matchdays_response = requests.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        matchdays = matchdays_response.json()
        assert len(matchdays) > 0
        
        matchday_id = matchdays[0]["id"]
        
        # Get matches for this matchday
        response = requests.get(
            f"{BASE_URL}/api/admin/matches?matchday_id={matchday_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 11  # Verify 11 seeded matches
        
        # Verify match structure
        for match in data:
            assert "id" in match
            assert "matchday_id" in match
            assert match["matchday_id"] == matchday_id
            assert "home_team" in match
            assert "away_team" in match
            assert "competition" in match
            assert "market_type" in match
            assert "start_time" in match
            assert "status" in match
        
        print(f"✓ Admin matches retrieved: {len(data)} matches for matchday {matchdays[0]['number']}")
        print(f"✓ Verified 11 seeded matches present")


class TestLeagueIntegrationFlow:
    """Test complete league flow: create → verify → join another user"""
    
    def test_complete_league_flow(self):
        """Test creating league, getting code, and another user joining"""
        # User 1: Create league
        random_num1 = random.randint(10000, 99999)
        user1_creds = {
            "email": f"TEST_creator_{random_num1}@test.com",
            "username": f"TEST_creator_{random_num1}",
            "password": "testpass123",
            "language": "it"
        }
        
        user1_response = requests.post(f"{BASE_URL}/api/auth/register", json=user1_creds)
        assert user1_response.status_code == 200
        user1_token = user1_response.json()["access_token"]
        
        # Get season
        seasons = requests.get(f"{BASE_URL}/api/leagues/seasons").json()
        season_id = seasons[0]["id"]
        
        # Create league
        league_name = f"TEST_Integration_League_{random_num1}"
        create_response = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"name": league_name, "season_id": season_id}
        )
        assert create_response.status_code == 200
        league_data = create_response.json()
        invite_code = league_data["invite_code"]
        league_id = league_data["id"]
        
        print(f"✓ User 1 created league: {league_name}, code: {invite_code}")
        
        # User 2: Register and join
        random_num2 = random.randint(10000, 99999)
        user2_creds = {
            "email": f"TEST_joiner_{random_num2}@test.com",
            "username": f"TEST_joiner_{random_num2}",
            "password": "testpass123",
            "language": "it"
        }
        
        user2_response = requests.post(f"{BASE_URL}/api/auth/register", json=user2_creds)
        assert user2_response.status_code == 200
        user2_token = user2_response.json()["access_token"]
        
        # User 2 joins league
        join_response = requests.post(
            f"{BASE_URL}/api/leagues/join",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={"invite_code": invite_code}
        )
        assert join_response.status_code == 200
        print(f"✓ User 2 successfully joined league with code: {invite_code}")
        
        # Verify member_count increased
        user1_leagues = requests.get(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user1_token}"}
        ).json()
        
        created_league = next((l for l in user1_leagues if l["id"] == league_id), None)
        assert created_league is not None
        assert created_league["member_count"] == 2
        print(f"✓ League member_count correctly shows 2 members")
