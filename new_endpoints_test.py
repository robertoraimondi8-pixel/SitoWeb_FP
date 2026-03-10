#!/usr/bin/env python3
"""
FantaPronostic Backend API Testing - Standings, Transparency, and Live Endpoints
Testing the new endpoints for classifications, user predictions transparency, and live matchday data
"""

import requests
import json
import sys
from datetime import datetime

# API Configuration
BASE_URL = "https://matchup-arena-4.preview.emergentagent.com/api"
TEST_USER = {
    "email": "marco@test.com", 
    "password": "password123"
}

class FantaPronosticNewEndpointsTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details="", error=""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")
        print()

    def login(self):
        """Test login and get authentication token"""
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json=TEST_USER,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                
                # Set authorization header for future requests
                self.session.headers.update({
                    "Authorization": f"Bearer {self.token}"
                })
                
                self.log_test(
                    "Login Authentication", 
                    True, 
                    f"User ID: {self.user_id}, Token received"
                )
                return True
            else:
                self.log_test(
                    "Login Authentication", 
                    False, 
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Login Authentication", False, "", str(e))
            return False

    def test_standings_total(self):
        """Test GET /api/standings/total"""
        try:
            response = self.session.get(f"{BASE_URL}/standings/total", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["league_id", "league_name", "standings_type", "entries"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "Standings Total - Structure", 
                        False, 
                        f"Missing fields: {missing_fields}",
                        json.dumps(data, indent=2)
                    )
                    return False
                
                # Check entries structure
                entries = data.get("entries", [])
                if entries:
                    entry = entries[0]
                    entry_fields = ["user_id", "username", "rank", "total_points", "matchdays_played", "jolly_used", "current_week_points"]
                    missing_entry_fields = [field for field in entry_fields if field not in entry]
                    
                    if missing_entry_fields:
                        self.log_test(
                            "Standings Total - Entry Structure", 
                            False, 
                            f"Missing entry fields: {missing_entry_fields}",
                            json.dumps(entry, indent=2)
                        )
                        return False
                
                self.log_test(
                    "Standings Total", 
                    True, 
                    f"League: {data.get('league_name')}, Entries: {len(entries)}, Type: {data.get('standings_type')}"
                )
                return True
            else:
                self.log_test(
                    "Standings Total", 
                    False, 
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Standings Total", False, "", str(e))
            return False

    def test_standings_weekly(self):
        """Test GET /api/standings/matchdays and GET /api/standings/weekly/{matchday_id}"""
        try:
            # First get available matchdays
            response = self.session.get(f"{BASE_URL}/standings/matchdays", timeout=30)
            
            if response.status_code != 200:
                self.log_test(
                    "Standings Matchdays List", 
                    False, 
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
            
            matchdays = response.json()
            if not matchdays:
                self.log_test(
                    "Standings Matchdays List", 
                    False, 
                    "No matchdays available"
                )
                return False
            
            self.log_test(
                "Standings Matchdays List", 
                True, 
                f"Found {len(matchdays)} matchdays"
            )
            
            # Test weekly standings for first matchday
            matchday = matchdays[0]
            matchday_id = matchday.get("id")
            
            response = self.session.get(f"{BASE_URL}/standings/weekly/{matchday_id}", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["league_id", "league_name", "standings_type", "entries", "matchday_id", "matchday_number"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "Standings Weekly - Structure", 
                        False, 
                        f"Missing fields: {missing_fields}",
                        json.dumps(data, indent=2)
                    )
                    return False
                
                # Check entries structure
                entries = data.get("entries", [])
                if entries:
                    entry = entries[0]
                    entry_fields = ["user_id", "username", "matchday_points", "exact_correct", "1x2_correct", "jolly_active"]
                    missing_entry_fields = [field for field in entry_fields if field not in entry]
                    
                    if missing_entry_fields:
                        self.log_test(
                            "Standings Weekly - Entry Structure", 
                            False, 
                            f"Missing entry fields: {missing_entry_fields}",
                            json.dumps(entry, indent=2)
                        )
                        return False
                
                self.log_test(
                    "Standings Weekly", 
                    True, 
                    f"Matchday {data.get('matchday_number')}, Entries: {len(entries)}"
                )
                return matchday_id
            else:
                self.log_test(
                    "Standings Weekly", 
                    False, 
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Standings Weekly", False, "", str(e))
            return False

    def test_live_endpoint(self, matchday_id):
        """Test GET /api/live/{matchday_id}"""
        try:
            response = self.session.get(f"{BASE_URL}/live/{matchday_id}", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["matchday_status", "matches", "base_points", "joker_bonus", "total_live_points", "server_time"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "Live Endpoint - Structure", 
                        False, 
                        f"Missing fields: {missing_fields}",
                        json.dumps(data, indent=2)
                    )
                    return False
                
                # Check matches structure
                matches = data.get("matches", [])
                if matches:
                    match = matches[0]
                    match_fields = ["status", "home_score", "away_score", "my_prediction", "outcome", "points"]
                    missing_match_fields = [field for field in match_fields if field not in match]
                    
                    if missing_match_fields:
                        self.log_test(
                            "Live Endpoint - Match Structure", 
                            False, 
                            f"Missing match fields: {missing_match_fields}",
                            json.dumps(match, indent=2)
                        )
                        return False
                
                self.log_test(
                    "Live Endpoint", 
                    True, 
                    f"Status: {data.get('matchday_status')}, Matches: {len(matches)}, Points: {data.get('total_live_points')}"
                )
                return True
            else:
                self.log_test(
                    "Live Endpoint", 
                    False, 
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Live Endpoint", False, "", str(e))
            return False

    def test_transparency_endpoint(self, matchday_id):
        """Test GET /api/predictions/user/{other_user_id}/{matchday_id}"""
        try:
            # First get standings to find another user
            response = self.session.get(f"{BASE_URL}/standings/total", timeout=30)
            
            if response.status_code != 200:
                self.log_test(
                    "Transparency - Get Other User", 
                    False, 
                    "Could not get standings to find other user"
                )
                return False
            
            data = response.json()
            entries = data.get("entries", [])
            other_user_id = None
            
            # Find a user that's not the current user
            for entry in entries:
                if entry.get("user_id") != self.user_id:
                    other_user_id = entry.get("user_id")
                    break
            
            if not other_user_id:
                self.log_test(
                    "Transparency - Get Other User", 
                    False, 
                    "No other users found in standings"
                )
                return False
            
            # Test transparency endpoint
            response = self.session.get(
                f"{BASE_URL}/predictions/user/{other_user_id}/{matchday_id}", 
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["predictions", "jolly_active", "total_points"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "Transparency Endpoint - Structure", 
                        False, 
                        f"Missing fields: {missing_fields}",
                        json.dumps(data, indent=2)
                    )
                    return False
                
                # Check predictions structure
                predictions = data.get("predictions", [])
                if predictions:
                    pred = predictions[0]
                    pred_fields = ["outcome", "points"]
                    missing_pred_fields = [field for field in pred_fields if field not in pred]
                    
                    if missing_pred_fields:
                        self.log_test(
                            "Transparency Endpoint - Prediction Structure", 
                            False, 
                            f"Missing prediction fields: {missing_pred_fields}",
                            json.dumps(pred, indent=2)
                        )
                        return False
                
                self.log_test(
                    "Transparency Endpoint", 
                    True, 
                    f"User: {data.get('username')}, Predictions: {len(predictions)}, Jolly: {data.get('jolly_active')}"
                )
                return other_user_id
            elif response.status_code == 403:
                self.log_test(
                    "Transparency Endpoint", 
                    True, 
                    "Access denied (403) - This is expected for OPEN matchdays"
                )
                return other_user_id
            else:
                self.log_test(
                    "Transparency Endpoint", 
                    False, 
                    f"Status: {response.status_code}",
                    response.text
                )
                return False
                
        except Exception as e:
            self.log_test("Transparency Endpoint", False, "", str(e))
            return False

    def test_transparency_access_control(self, other_user_id, matchday_id):
        """Test transparency access control scenarios"""
        try:
            # Test 1: Try accessing predictions for OPEN matchday (should return 403)
            # First, let's get matchdays to find an OPEN one
            response = self.session.get(f"{BASE_URL}/standings/matchdays", timeout=30)
            
            if response.status_code == 200:
                matchdays = response.json()
                open_matchday = None
                
                for md in matchdays:
                    if md.get("status") == "OPEN":
                        open_matchday = md.get("id")
                        break
                
                if open_matchday:
                    response = self.session.get(
                        f"{BASE_URL}/predictions/user/{other_user_id}/{open_matchday}", 
                        timeout=30
                    )
                    
                    if response.status_code == 403:
                        self.log_test(
                            "Transparency Access Control - OPEN Matchday", 
                            True, 
                            "Correctly denied access to OPEN matchday predictions"
                        )
                    else:
                        self.log_test(
                            "Transparency Access Control - OPEN Matchday", 
                            False, 
                            f"Expected 403, got {response.status_code}",
                            response.text
                        )
                else:
                    self.log_test(
                        "Transparency Access Control - OPEN Matchday", 
                        True, 
                        "No OPEN matchdays found to test (this is acceptable)"
                    )
            
            # Test 2: Try accessing with invalid user (should return 403 or 404)
            fake_user_id = "fake_user_12345"
            response = self.session.get(
                f"{BASE_URL}/predictions/user/{fake_user_id}/{matchday_id}", 
                timeout=30
            )
            
            if response.status_code in [403, 404]:
                self.log_test(
                    "Transparency Access Control - Invalid User", 
                    True, 
                    f"Correctly denied access for invalid user (status: {response.status_code})"
                )
            else:
                self.log_test(
                    "Transparency Access Control - Invalid User", 
                    False, 
                    f"Expected 403/404, got {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_test("Transparency Access Control", False, "", str(e))

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 60)
        print("FantaPronostic Backend API Testing")
        print("Testing: Standings, Transparency, and Live endpoints")
        print("=" * 60)
        print()
        
        # Step 1: Login
        if not self.login():
            print("❌ Login failed - cannot continue with other tests")
            return False
        
        # Step 2: Test Standings Total
        self.test_standings_total()
        
        # Step 3: Test Standings Weekly
        matchday_id = self.test_standings_weekly()
        
        if not matchday_id:
            print("❌ Could not get matchday ID - skipping live and transparency tests")
            return False
        
        # Step 4: Test Live Endpoint
        self.test_live_endpoint(matchday_id)
        
        # Step 5: Test Transparency Endpoint
        other_user_id = self.test_transparency_endpoint(matchday_id)
        
        # Step 6: Test Transparency Access Control
        if other_user_id:
            self.test_transparency_access_control(other_user_id, matchday_id)
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['error']}")
        
        return passed == total

if __name__ == "__main__":
    tester = FantaPronosticNewEndpointsTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)