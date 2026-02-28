#!/usr/bin/env python3
"""
FantaPronostic Backend Testing - A, B, C Fixes
Tests the specific fixes requested:
A) Admin Current Matchday
B) Points Consistency 
C) 11 Predictions Rule
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from frontend .env
BACKEND_URL = "https://admin-unified-ui.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_CREDS = {"email": "admin@fantapronostic.com", "password": "admin123"}
USER_CREDS = {"email": "marco@test.com", "password": "password123"}

class TestSession:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.user_token = None
        self.admin_user_id = None
        self.user_user_id = None
        
    def login_admin(self) -> bool:
        """Login as admin and store token"""
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=ADMIN_CREDS)
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data["access_token"]
                self.admin_user_id = data["user"]["id"]
                print(f"✅ Admin login successful: {data['user']['username']}")
                return True
            else:
                print(f"❌ Admin login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Admin login error: {e}")
            return False
    
    def login_user(self) -> bool:
        """Login as regular user and store token"""
        try:
            response = self.session.post(f"{API_BASE}/auth/login", json=USER_CREDS)
            if response.status_code == 200:
                data = response.json()
                self.user_token = data["access_token"]
                self.user_user_id = data["user"]["id"]
                print(f"✅ User login successful: {data['user']['username']}")
                return True
            else:
                print(f"❌ User login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ User login error: {e}")
            return False
    
    def get_headers(self, is_admin: bool = False) -> Dict[str, str]:
        """Get authorization headers"""
        token = self.admin_token if is_admin else self.user_token
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def api_call(self, method: str, endpoint: str, is_admin: bool = False, **kwargs) -> requests.Response:
        """Make authenticated API call"""
        headers = self.get_headers(is_admin)
        url = f"{API_BASE}{endpoint}"
        return self.session.request(method, url, headers=headers, **kwargs)

def test_a_admin_current_matchday(session: TestSession) -> bool:
    """
    A) Admin Current Matchday:
    - Test PUT /api/admin/seasons/{season_id}/current-matchday?matchday_id=...
    - Verify it sets current_matchday_id on the season
    - Then test GET /api/home returns that matchday
    """
    print("\n🔍 Testing A) Admin Current Matchday...")
    
    try:
        # 1. Get active season
        print("1. Getting active season...")
        response = session.api_call("GET", "/leagues/seasons", is_admin=True)
        if response.status_code != 200:
            print(f"❌ Failed to get seasons: {response.status_code}")
            return False
        
        seasons = response.json()
        if not seasons:
            print("❌ No active seasons found")
            return False
        
        season = seasons[0]
        season_id = season["id"]
        print(f"✅ Found active season: {season_id}")
        
        # 2. Get matchdays for the season
        print("2. Getting matchdays for season...")
        response = session.api_call("GET", "/standings/matchdays", is_admin=True)
        if response.status_code != 200:
            print(f"❌ Failed to get matchdays: {response.status_code}")
            return False
        
        matchdays = response.json()
        if not matchdays:
            print("❌ No matchdays found")
            return False
        
        # Pick a matchday to test with
        test_matchday = matchdays[0]
        matchday_id = test_matchday["id"]
        print(f"✅ Using test matchday: {matchday_id} (Number: {test_matchday['number']})")
        
        # 3. Test set-current-matchday endpoint
        print("3. Testing PUT /api/admin/seasons/{season_id}/current-matchday...")
        endpoint = f"/admin/seasons/{season_id}/current-matchday"
        params = {"matchday_id": matchday_id}
        response = session.api_call("PUT", endpoint, is_admin=True, params=params)
        
        if response.status_code != 200:
            print(f"❌ Set current matchday failed: {response.status_code} - {response.text}")
            return False
        
        result = response.json()
        print(f"✅ Set current matchday successful: {result}")
        
        # 4. Verify GET /api/home returns the expected matchday
        print("4. Verifying GET /api/home returns the set matchday...")
        response = session.api_call("GET", "/home", is_admin=False)  # Test as regular user
        if response.status_code != 200:
            print(f"❌ Home endpoint failed: {response.status_code}")
            return False
        
        home_data = response.json()
        if not home_data.get("matchday"):
            print("❌ Home endpoint returned no matchday data")
            return False
        
        returned_matchday_id = home_data["matchday"]["id"]
        if returned_matchday_id == matchday_id:
            print(f"✅ Home endpoint correctly returns set matchday: {returned_matchday_id}")
            return True
        else:
            print(f"❌ Home endpoint returned wrong matchday. Expected: {matchday_id}, Got: {returned_matchday_id}")
            return False
            
    except Exception as e:
        print(f"❌ Test A failed with exception: {e}")
        return False

def test_b_points_consistency(session: TestSession) -> bool:
    """
    B) Points Consistency:
    - Test GET /api/standings/weekly/{matchday_id}?league_id=...
    - Test GET /api/predictions/user/{user_id}/{matchday_id}?league_id=...
    - Verify: matchday_points in weekly standings EQUALS total_points in user predictions
    """
    print("\n🔍 Testing B) Points Consistency...")
    
    try:
        # 1. Get user's leagues to find a league_id
        print("1. Getting user leagues...")
        response = session.api_call("GET", "/leagues", is_admin=False)
        if response.status_code != 200:
            print(f"❌ Failed to get leagues: {response.status_code}")
            return False
        
        leagues = response.json()
        if not leagues:
            print("❌ User has no leagues")
            return False
        
        league_id = leagues[0]["id"]
        print(f"✅ Using league: {league_id}")
        
        # 2. Get available matchdays
        print("2. Getting available matchdays...")
        response = session.api_call("GET", "/standings/matchdays", is_admin=False)
        if response.status_code != 200:
            print(f"❌ Failed to get matchdays: {response.status_code}")
            return False
        
        matchdays = response.json()
        if not matchdays:
            print("❌ No matchdays available")
            return False
        
        # Find a matchday that's not OPEN (so we can see predictions)
        test_matchday = None
        for md in matchdays:
            if md["status"] in ["LOCKED", "LIVE", "COMPLETED"]:
                test_matchday = md
                break
        
        if not test_matchday:
            # Use first matchday if no locked ones found
            test_matchday = matchdays[0]
        
        matchday_id = test_matchday["id"]
        print(f"✅ Using matchday: {matchday_id} (Status: {test_matchday['status']})")
        
        # 3. Test GET /api/standings/weekly/{matchday_id}
        print("3. Testing GET /api/standings/weekly/{matchday_id}...")
        endpoint = f"/standings/weekly/{matchday_id}"
        params = {"league_id": league_id}
        response = session.api_call("GET", endpoint, is_admin=False, params=params)
        
        if response.status_code != 200:
            print(f"❌ Weekly standings failed: {response.status_code} - {response.text}")
            return False
        
        weekly_standings = response.json()
        print(f"✅ Weekly standings retrieved: {len(weekly_standings.get('entries', []))} entries")
        
        # Find current user in standings
        user_standing = None
        for entry in weekly_standings.get("entries", []):
            if entry["user_id"] == session.user_user_id:
                user_standing = entry
                break
        
        if not user_standing:
            print(f"❌ Current user not found in weekly standings")
            return False
        
        weekly_points = user_standing["matchday_points"]
        print(f"✅ User's weekly standings points: {weekly_points}")
        
        # 4. Test GET /api/predictions/user/{user_id}/{matchday_id}
        print("4. Testing GET /api/predictions/user/{user_id}/{matchday_id}...")
        endpoint = f"/predictions/user/{session.user_user_id}/{matchday_id}"
        params = {"league_id": league_id}
        response = session.api_call("GET", endpoint, is_admin=False, params=params)
        
        if response.status_code != 200:
            print(f"❌ User predictions failed: {response.status_code} - {response.text}")
            return False
        
        predictions_data = response.json()
        predictions_points = predictions_data.get("total_points", 0)
        print(f"✅ User's predictions total_points: {predictions_points}")
        
        # 5. Verify consistency
        if weekly_points == predictions_points:
            print(f"✅ Points consistency verified: {weekly_points} == {predictions_points}")
            return True
        else:
            print(f"❌ Points inconsistency found: weekly={weekly_points} != predictions={predictions_points}")
            return False
            
    except Exception as e:
        print(f"❌ Test B failed with exception: {e}")
        return False

def test_c_eleven_predictions_rule(session: TestSession) -> bool:
    """
    C) 11 Predictions Rule:
    - Test POST /api/predictions/{matchday_id}/confirm
    - If user has < 11 predictions, should return 400 with NEED_11_PREDICTIONS
    - Test GET /api/home returns total_matches >= 11 (never 0)
    """
    print("\n🔍 Testing C) 11 Predictions Rule...")
    
    try:
        # 1. Get current matchday from home
        print("1. Getting current matchday from home...")
        response = session.api_call("GET", "/home", is_admin=False)
        if response.status_code != 200:
            print(f"❌ Home endpoint failed: {response.status_code}")
            return False
        
        home_data = response.json()
        if not home_data.get("matchday"):
            print("❌ No matchday data in home response")
            return False
        
        matchday = home_data["matchday"]
        matchday_id = matchday["id"]
        total_matches = matchday.get("total_matches", 0)
        
        print(f"✅ Current matchday: {matchday_id}")
        print(f"✅ Total matches: {total_matches}")
        
        # Verify total_matches >= 11 (never 0)
        if total_matches >= 11:
            print(f"✅ Total matches rule verified: {total_matches} >= 11")
        else:
            print(f"❌ Total matches rule failed: {total_matches} < 11")
            return False
        
        # 2. Check current predictions count
        print("2. Checking current predictions count...")
        response = session.api_call("GET", f"/predictions/{matchday_id}", is_admin=False)
        if response.status_code != 200:
            print(f"❌ Failed to get predictions: {response.status_code}")
            return False
        
        predictions_data = response.json()
        predictions_list = predictions_data.get("predictions", [])
        current_predictions = sum(1 for p in predictions_list if p.get("prediction"))
        
        print(f"✅ Current predictions count: {current_predictions}")
        
        # 3. Test confirm endpoint
        print("3. Testing POST /api/predictions/{matchday_id}/confirm...")
        endpoint = f"/predictions/{matchday_id}/confirm"
        response = session.api_call("POST", endpoint, is_admin=False)
        
        if current_predictions < 11:
            # Should return 400 with NEED_11_PREDICTIONS
            if response.status_code == 400:
                error_data = response.json()
                # Check if error is in detail field or directly
                error_detail = error_data.get("detail", error_data)
                if isinstance(error_detail, dict) and error_detail.get("code") == "NEED_11_PREDICTIONS":
                    print(f"✅ Confirm correctly rejected incomplete predictions: {error_detail}")
                    return True
                else:
                    print(f"❌ Confirm returned 400 but wrong error format: {error_data}")
                    return False
            else:
                print(f"❌ Confirm should have returned 400 for incomplete predictions, got: {response.status_code}")
                return False
        else:
            # Should succeed
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Confirm successful with complete predictions: {result}")
                return True
            else:
                print(f"❌ Confirm failed with complete predictions: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        print(f"❌ Test C failed with exception: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting FantaPronostic Backend Testing - A, B, C Fixes")
    print(f"Backend URL: {BACKEND_URL}")
    
    session = TestSession()
    
    # Login both users
    if not session.login_admin():
        print("❌ Admin login failed, cannot continue")
        return False
    
    if not session.login_user():
        print("❌ User login failed, cannot continue")
        return False
    
    # Run tests
    results = []
    
    print("\n" + "="*60)
    results.append(("A) Admin Current Matchday", test_a_admin_current_matchday(session)))
    
    print("\n" + "="*60)
    results.append(("B) Points Consistency", test_b_points_consistency(session)))
    
    print("\n" + "="*60)
    results.append(("C) 11 Predictions Rule", test_c_eleven_predictions_rule(session)))
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST RESULTS SUMMARY:")
    print("="*60)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️  Some tests failed - see details above")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)