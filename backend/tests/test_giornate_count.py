"""
Test: GIORNATE count fix - matchdays_played coherence with ULTIMI 5

This test verifies the bug fix where:
- matchdays_played should equal total COMPLETED matchdays in season (6)
- ULTIMI 5 shows last 5 COMPLETED matchdays
- GIORNATE (matchdays_played) must >= count of ULTIMI 5 entries

DB has 7 total matchdays, 6 with status COMPLETED: Giornata 1,2,6,8,9,10
ULTIMI 5 shows last 5 = Giornata 2,6,8,9,10
So GIORNATE should be 6.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
MARCO_EMAIL = "marco@test.com"
MARCO_PASSWORD = "password123"


def get_auth_token(email: str, password: str) -> str:
    """Login and return access token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": email,
        "password": password
    })
    assert response.status_code == 200, f"Login failed for {email}: {response.text}"
    return response.json()["access_token"]


class TestGiornateCountFix:
    """Tests for the matchdays_played fix in /api/home endpoint"""

    def test_admin_matchdays_played_equals_completed_matchdays(self):
        """
        Admin user: matchdays_played should be 6 (6 COMPLETED matchdays in season)
        """
        token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Home API failed: {response.text}"
        
        data = response.json()
        user_summary = data.get("user_summary", {})
        last_5 = data.get("last_5_performance", [])
        
        # Log the values for debugging
        print(f"\n=== ADMIN USER TEST ===")
        print(f"user_summary.matchdays_played: {user_summary.get('matchdays_played')}")
        print(f"last_5_performance count: {len(last_5)}")
        print(f"last_5_performance matchday numbers: {[m.get('matchday_number') for m in last_5]}")
        print(f"user_summary.points: {user_summary.get('points')}")
        
        # CRITICAL ASSERTIONS
        # 1. matchdays_played should be >= len(last_5_performance)
        matchdays_played = user_summary.get("matchdays_played", 0)
        last_5_count = len(last_5)
        
        assert matchdays_played >= last_5_count, (
            f"INCOHERENT: matchdays_played ({matchdays_played}) < last_5_performance count ({last_5_count})"
        )
        
        # 2. matchdays_played should be 6 (based on DB having 6 COMPLETED matchdays)
        assert matchdays_played == 6, (
            f"Expected matchdays_played=6, got {matchdays_played}"
        )
        
        # 3. last_5_performance should have 5 entries (if 6 completed matchdays exist)
        assert last_5_count == 5, f"Expected 5 entries in last_5_performance, got {last_5_count}"
        
        print(f"\n✓ COHERENT: GIORNATE={matchdays_played}, ULTIMI 5 count={last_5_count}")

    def test_marco_matchdays_played_equals_completed_matchdays(self):
        """
        Marco user: matchdays_played should be 6 (6 COMPLETED matchdays in season)
        """
        token = get_auth_token(MARCO_EMAIL, MARCO_PASSWORD)
        
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Home API failed: {response.text}"
        
        data = response.json()
        user_summary = data.get("user_summary", {})
        last_5 = data.get("last_5_performance", [])
        
        # Log the values for debugging
        print(f"\n=== MARCO USER TEST ===")
        print(f"user_summary.matchdays_played: {user_summary.get('matchdays_played')}")
        print(f"last_5_performance count: {len(last_5)}")
        print(f"last_5_performance matchday numbers: {[m.get('matchday_number') for m in last_5]}")
        print(f"user_summary.points: {user_summary.get('points')}")
        
        # CRITICAL ASSERTIONS
        matchdays_played = user_summary.get("matchdays_played", 0)
        last_5_count = len(last_5)
        
        # 1. matchdays_played should be >= len(last_5_performance) - COHERENCE CHECK
        assert matchdays_played >= last_5_count, (
            f"INCOHERENT: matchdays_played ({matchdays_played}) < last_5_performance count ({last_5_count})"
        )
        
        # 2. matchdays_played should be 6 (same for all users in same season)
        assert matchdays_played == 6, (
            f"Expected matchdays_played=6, got {matchdays_played}"
        )
        
        # 3. last_5_performance should have 5 entries
        assert last_5_count == 5, f"Expected 5 entries in last_5_performance, got {last_5_count}"
        
        print(f"\n✓ COHERENT: GIORNATE={matchdays_played}, ULTIMI 5 count={last_5_count}")

    def test_coherence_check_matchdays_played_vs_last5(self):
        """
        General coherence check: matchdays_played must always be >= last_5_performance length
        This test checks both admin and marco users
        """
        users = [
            (ADMIN_EMAIL, ADMIN_PASSWORD, "admin"),
            (MARCO_EMAIL, MARCO_PASSWORD, "marco")
        ]
        
        for email, password, username in users:
            token = get_auth_token(email, password)
            
            response = requests.get(
                f"{BASE_URL}/api/home",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            
            data = response.json()
            user_summary = data.get("user_summary", {})
            last_5 = data.get("last_5_performance", [])
            
            matchdays_played = user_summary.get("matchdays_played", 0)
            last_5_count = len(last_5)
            
            print(f"\n{username}: matchdays_played={matchdays_played}, last5_count={last_5_count}")
            
            # COHERENCE: GIORNATE >= ULTIMI 5 count
            assert matchdays_played >= last_5_count, (
                f"INCOHERENT for {username}: GIORNATE={matchdays_played} < ULTIMI 5 count={last_5_count}"
            )

    def test_api_response_structure(self):
        """
        Verify /api/home response contains expected fields for this feature
        """
        token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        
        response = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # user_summary should exist
        assert "user_summary" in data, "Missing user_summary in response"
        user_summary = data["user_summary"]
        
        # user_summary should have matchdays_played
        assert "matchdays_played" in user_summary, "Missing matchdays_played in user_summary"
        
        # last_5_performance should exist and be a list
        assert "last_5_performance" in data, "Missing last_5_performance in response"
        assert isinstance(data["last_5_performance"], list), "last_5_performance should be a list"
        
        # Each last_5 entry should have matchday_number and points
        for entry in data["last_5_performance"]:
            assert "matchday_number" in entry, "Missing matchday_number in last_5 entry"
            assert "points" in entry, "Missing points in last_5 entry"
        
        print(f"\n✓ API response structure is correct")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
