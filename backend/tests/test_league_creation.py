"""
Test suite for Private League Creation feature.
Tests:
1. GET /api/leagues/seasons - Returns active seasons
2. POST /api/leagues - Create league with all fields (scoring_config, start_matchday, end_matchday, etc.)
3. GET /api/leagues/{id} - Returns league details with scoring_config
4. PATCH /api/leagues/{id} - Update if rules_locked=false, 403 if locked
5. POST /api/leagues/join - Join with invite_code + auto-lock rules when members > 1
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://dead-code-sweep.preview.emergentagent.com')

# Test credentials
USER1_EMAIL = "email@email.com"
USER1_PASSWORD = "Roberto95"
USER2_EMAIL = "marco@test.com"
USER2_PASSWORD = "password123"


class TestLeagueCreation:
    """Tests for Private League Creation feature."""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Get auth token for user 1 (creator)."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        assert response.status_code == 200, f"User 1 login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def user2_token(self):
        """Get auth token for user 2 (joiner)."""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER2_EMAIL,
            "password": USER2_PASSWORD
        })
        assert response.status_code == 200, f"User 2 login failed: {response.text}"
        return response.json()["access_token"]
    
    # ============================================
    # 1. GET /api/leagues/seasons - Active seasons
    # ============================================
    def test_get_active_seasons(self, user1_token):
        """Test GET /api/leagues/seasons returns active seasons."""
        response = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        print(f"GET /api/leagues/seasons status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        assert len(data) > 0, "Should have at least one active season"
        
        # Verify season has required fields
        season = data[0]
        assert "id" in season, "Season should have id"
        assert "name" in season, "Season should have name"
        assert season.get("is_active") == True, "Season should be active"
        print(f"✅ Found active season: {season['name']} (ID: {season['id']})")
    
    # ============================================
    # 2. POST /api/leagues - Create league with full config
    # ============================================
    def test_create_league_with_full_config(self, user1_token):
        """Test POST /api/leagues creates league with all fields."""
        # First get season id
        seasons_resp = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        season_id = seasons_resp.json()[0]["id"]
        
        # Create league with full configuration
        unique_name = f"TEST_Liga_Privata_{uuid.uuid4().hex[:8]}"
        scoring_config = {
            "1x2": {"enabled": True, "points": 1.0},
            "over_under": {"enabled": True, "points": 0.5},
            "goal_no_goal": {"enabled": False, "points": 0.5},
            "exact_score": {"enabled": True, "points": 4.0}
        }
        
        payload = {
            "name": unique_name,
            "season_id": season_id,
            "start_matchday": 5,
            "end_matchday": 25,
            "bet_deadline_minutes": 15,
            "match_source_type": "national",
            "scoring_config": scoring_config,
            "include_championship_predictions": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user1_token}"},
            json=payload
        )
        print(f"POST /api/leagues status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all fields
        assert data["name"] == unique_name, "Name should match"
        assert "id" in data, "Should have league id"
        assert "invite_code" in data, "Should have invite_code generated"
        assert len(data["invite_code"]) >= 6, "Invite code should be at least 6 chars"
        assert data["rules_locked"] == False, "rules_locked should be False initially"
        assert data["start_matchday"] == 5, "start_matchday should be 5"
        assert data["end_matchday"] == 25, "end_matchday should be 25"
        assert data["bet_deadline_minutes"] == 15, "bet_deadline_minutes should be 15"
        assert data["match_source_type"] == "national", "match_source_type should be national"
        assert "scoring_config" in data, "Should have scoring_config"
        assert data["member_count"] == 1, "Creator should be auto-joined"
        
        print(f"✅ League created: {data['name']} with invite_code: {data['invite_code']}")
        return data
    
    # ============================================
    # 3. GET /api/leagues/{id} - League detail with scoring_config
    # ============================================
    def test_get_league_detail(self, user1_token):
        """Test GET /api/leagues/{id} returns details with scoring_config."""
        # First create a league
        seasons_resp = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        season_id = seasons_resp.json()[0]["id"]
        
        unique_name = f"TEST_Detail_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={
                "name": unique_name,
                "season_id": season_id,
                "start_matchday": 1,
                "end_matchday": 38,
                "bet_deadline_minutes": 30,
                "match_source_type": "custom",
                "scoring_config": {
                    "1x2": {"enabled": True, "points": 2.0},
                    "over_under": {"enabled": False, "points": 0.5},
                    "goal_no_goal": {"enabled": True, "points": 1.0},
                    "exact_score": {"enabled": True, "points": 5.0}
                }
            }
        )
        league_id = create_resp.json()["id"]
        
        # Get league detail
        response = requests.get(
            f"{BASE_URL}/api/leagues/{league_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        print(f"GET /api/leagues/{league_id} status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify scoring_config is returned
        assert "scoring_config" in data, "Should have scoring_config in detail"
        assert data["scoring_config"]["1x2"]["points"] == 2.0, "Custom scoring should be returned"
        assert data["match_source_type"] == "custom", "match_source_type should be custom"
        assert data["bet_deadline_minutes"] == 30, "bet_deadline_minutes should be 30"
        
        print(f"✅ League detail retrieved with scoring_config: {data['scoring_config']}")
    
    # ============================================
    # 4. PATCH /api/leagues/{id} - Update rules (if unlocked)
    # ============================================
    def test_update_league_when_rules_unlocked(self, user1_token):
        """Test PATCH /api/leagues/{id} works when rules_locked=false."""
        # Create a league
        seasons_resp = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        season_id = seasons_resp.json()[0]["id"]
        
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={
                "name": unique_name,
                "season_id": season_id,
                "start_matchday": 1,
                "end_matchday": 20,
                "bet_deadline_minutes": 0
            }
        )
        league_id = create_resp.json()["id"]
        
        # Update the league
        update_payload = {
            "start_matchday": 3,
            "end_matchday": 30,
            "bet_deadline_minutes": 45,
            "scoring_config": {
                "1x2": {"enabled": True, "points": 3.0},
                "exact_score": {"enabled": True, "points": 10.0}
            }
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/leagues/{league_id}",
            headers={"Authorization": f"Bearer {user1_token}"},
            json=update_payload
        )
        print(f"PATCH /api/leagues/{league_id} status: {response.status_code}")
        print(f"Response: {response.json()}")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify updates
        assert data["start_matchday"] == 3, "start_matchday should be updated to 3"
        assert data["end_matchday"] == 30, "end_matchday should be updated to 30"
        assert data["bet_deadline_minutes"] == 45, "bet_deadline_minutes should be updated to 45"
        
        print(f"✅ League updated successfully when rules_locked=false")
    
    # ============================================
    # 5. POST /api/leagues/join + auto-lock rules
    # ============================================
    def test_join_league_and_rules_lock(self, user1_token, user2_token):
        """Test POST /api/leagues/join and automatic rules_locked when member>1."""
        # Create a league
        seasons_resp = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        season_id = seasons_resp.json()[0]["id"]
        
        unique_name = f"TEST_Join_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={
                "name": unique_name,
                "season_id": season_id,
                "start_matchday": 10,
                "end_matchday": 35
            }
        )
        create_data = create_resp.json()
        league_id = create_data["id"]
        invite_code = create_data["invite_code"]
        
        # Verify rules_locked is false before join
        detail_before = requests.get(
            f"{BASE_URL}/api/leagues/{league_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert detail_before.json()["rules_locked"] == False, "rules_locked should be False before join"
        print(f"Before join: rules_locked={detail_before.json()['rules_locked']}, member_count={detail_before.json()['member_count']}")
        
        # User 2 joins with invite code
        join_resp = requests.post(
            f"{BASE_URL}/api/leagues/join",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={"invite_code": invite_code}
        )
        print(f"POST /api/leagues/join status: {join_resp.status_code}")
        print(f"Response: {join_resp.json()}")
        
        assert join_resp.status_code == 200, f"Join failed: {join_resp.text}"
        assert "league" in join_resp.json(), "Should return league in response"
        
        # Verify rules are now locked
        detail_after = requests.get(
            f"{BASE_URL}/api/leagues/{league_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        print(f"After join: rules_locked={detail_after.json()['rules_locked']}, member_count={detail_after.json()['member_count']}")
        
        assert detail_after.json()["rules_locked"] == True, "rules_locked should be True after 2nd member joins"
        assert detail_after.json()["member_count"] == 2, "member_count should be 2"
        
        print(f"✅ Join successful and rules auto-locked when member_count > 1")
    
    # ============================================
    # 6. PATCH fails when rules_locked=true
    # ============================================
    def test_update_fails_when_rules_locked(self, user1_token, user2_token):
        """Test PATCH /api/leagues/{id} returns 403 when rules_locked=true."""
        # Create a league and have user2 join to lock it
        seasons_resp = requests.get(
            f"{BASE_URL}/api/leagues/seasons",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        season_id = seasons_resp.json()[0]["id"]
        
        unique_name = f"TEST_Locked_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(
            f"{BASE_URL}/api/leagues",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={
                "name": unique_name,
                "season_id": season_id,
                "start_matchday": 5,
                "end_matchday": 25
            }
        )
        create_data = create_resp.json()
        league_id = create_data["id"]
        invite_code = create_data["invite_code"]
        
        # User 2 joins to lock rules
        requests.post(
            f"{BASE_URL}/api/leagues/join",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={"invite_code": invite_code}
        )
        
        # Now try to update locked fields
        update_resp = requests.patch(
            f"{BASE_URL}/api/leagues/{league_id}",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"start_matchday": 1}  # This should be blocked
        )
        print(f"PATCH locked league status: {update_resp.status_code}")
        print(f"Response: {update_resp.text}")
        
        assert update_resp.status_code == 403, f"Should return 403 when rules locked, got {update_resp.status_code}"
        
        print(f"✅ PATCH correctly returns 403 when rules_locked=true")
    
    # ============================================
    # 7. Join with invalid invite code
    # ============================================
    def test_join_with_invalid_code(self, user1_token):
        """Test POST /api/leagues/join with invalid code returns 404."""
        response = requests.post(
            f"{BASE_URL}/api/leagues/join",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"invite_code": "INVALID123"}
        )
        print(f"Join with invalid code status: {response.status_code}")
        
        assert response.status_code == 404, f"Should return 404 for invalid invite code, got {response.status_code}"
        print(f"✅ Invalid invite code correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
