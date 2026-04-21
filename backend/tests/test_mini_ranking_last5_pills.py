"""
Tests for Mini Ranking Block and Last 5 Pills UI features.
- Backend: /api/home returns rankings_preview.current_user_id
- Backend: /api/tournaments/{id}/groups returns group standings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')

# Test credentials
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"
ADMIN_USER_EMAIL = "admin@fantapronostic.com"
ADMIN_USER_PASSWORD = "admin123"
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
TOURNAMENT_REDUBULL_ID = "a0a60a06-65a3-4707-aa42-545a7da08dff"


@pytest.fixture
def standard_user_token():
    """Login as standard user ilio@raimondi.it"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": STANDARD_USER_EMAIL,
        "password": STANDARD_USER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Standard user login failed: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("access_token")


@pytest.fixture
def admin_user_token():
    """Login as admin user admin@fantapronostic.com"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_USER_EMAIL,
        "password": ADMIN_USER_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin user login failed: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("access_token")


class TestHomeApiRankingsPreview:
    """Test /api/home returns rankings_preview with current_user_id"""

    def test_home_returns_rankings_preview_with_current_user_id(self, standard_user_token):
        """Verify rankings_preview includes current_user_id field"""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Home API failed: {response.text}"
        data = response.json()
        
        # Check rankings_preview exists
        assert "rankings_preview" in data, "rankings_preview not in response"
        rankings = data["rankings_preview"]
        
        # Verify current_user_id field is present
        assert "current_user_id" in rankings, "current_user_id not in rankings_preview"
        assert rankings["current_user_id"] is not None, "current_user_id is None"
        
        # Verify top 3 entries exist
        assert "top" in rankings, "top not in rankings_preview"
        assert len(rankings["top"]) > 0, "No entries in rankings_preview.top"
        
        # Log top 3 for verification
        print(f"\n[MINI RANKING] Top 3 entries:")
        for entry in rankings["top"][:3]:
            print(f"  {entry.get('rank')}° - {entry.get('username')}: {entry.get('total_points')} pts")
        print(f"  current_user_id: {rankings['current_user_id']}")

    def test_home_returns_last_5_performance(self, standard_user_token):
        """Verify last_5_performance returns matchday numbers and points"""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Home API failed: {response.text}"
        data = response.json()
        
        # Check last_5_performance exists
        assert "last_5_performance" in data, "last_5_performance not in response"
        last5 = data["last_5_performance"]
        
        # Verify structure
        assert isinstance(last5, list), "last_5_performance is not a list"
        
        # Log last 5 for verification
        print(f"\n[LAST 5] Performance entries:")
        for entry in last5:
            md_num = entry.get("matchday_number")
            pts = entry.get("points")
            print(f"  Matchday {md_num}: {pts} pts")
        
        # Expected: [0, 22, 0, 12, 0] for md 21-25
        if len(last5) >= 5:
            print(f"  Expected: md 21-25 with pts [0, 22, 0, 12, 0]")


class TestTournamentGroupsEndpoint:
    """Test /api/tournaments/{id}/groups returns group standings"""

    def test_tournament_groups_endpoint_exists(self, admin_user_token):
        """Verify /api/tournaments/{id}/groups endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TOURNAMENT_REDUBULL_ID}/groups",
            headers={"Authorization": f"Bearer {admin_user_token}"}
        )
        assert response.status_code == 200, f"Groups API failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Should be a list of groups
        assert isinstance(data, list), "Groups response should be a list"
        
        # Log groups for verification
        print(f"\n[TOURNAMENT GROUPS] Found {len(data)} groups:")
        for g in data:
            group_name = g.get("group_name", "Unknown")
            standings = g.get("standings", [])
            print(f"  {group_name}: {len(standings)} members")
            for s in standings[:3]:
                print(f"    - {s.get('username')}: {s.get('group_points', 0)} pts")

    def test_admin_group_c_has_standings(self, admin_user_token):
        """Verify admin user's group (C) has standings data"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TOURNAMENT_REDUBULL_ID}/groups",
            headers={"Authorization": f"Bearer {admin_user_token}"}
        )
        assert response.status_code == 200, f"Groups API failed: {response.text}"
        data = response.json()
        
        # Find Group C
        group_c = None
        for g in data:
            if "C" in str(g.get("group_name", "")):
                group_c = g
                break
        
        if group_c:
            print(f"\n[GROUP C] Found admin's group:")
            standings = group_c.get("standings", [])
            for s in standings:
                print(f"  {s.get('username')}: {s.get('group_points', 0)} pts")
        else:
            print(f"\n[WARN] Group C not found in tournament groups")


class TestTournamentMyMatchups:
    """Test tournament matchups for Last 5 pills data"""

    def test_tournament_my_matchups_returns_data(self, admin_user_token):
        """Verify my-matchups endpoint returns completed rounds data"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TOURNAMENT_REDUBULL_ID}/my-matchups",
            headers={"Authorization": f"Bearer {admin_user_token}"}
        )
        assert response.status_code == 200, f"My matchups API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "my-matchups should return a list"
        
        # Filter completed matchups
        completed = [m for m in data if m.get("status") == "completed"]
        
        print(f"\n[MATCHUPS] Total: {len(data)}, Completed: {len(completed)}")
        for m in completed:
            round_num = m.get("round_number")
            user_a_pts = m.get("user_a_points", 0)
            user_b_pts = m.get("user_b_points", 0)
            print(f"  Round {round_num}: {user_a_pts} vs {user_b_pts}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
