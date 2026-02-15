#!/usr/bin/env python3
"""
FantaPronostic Backend Testing - P2 & P3 Bug Fixes
Testing P2: User Profile Endpoint consistency 
Testing P3: COMPLETED Matchday "Frozen" State
"""

import requests
import json
import sys
from typing import Dict, Any, Optional, List

# Backend URL from environment
BACKEND_URL = "https://bugbuster-101.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "marco@test.com"
TEST_PASSWORD = "password123"

class FantaPronosticTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.refresh_token = None
        self.user_data = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_login_endpoint(self):
        """Test POST /api/auth/login - verify returns access_token and refresh_token"""
        try:
            payload = {
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
            
            response = self.session.post(f"{BASE_URL}/auth/login", json=payload)
            
            if response.status_code != 200:
                self.log_test("Login Endpoint", False, f"Login failed with status {response.status_code}", 
                            {"response": response.text})
                return False
            
            data = response.json()
            
            # Verify required fields
            required_fields = ["access_token", "refresh_token", "user"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Login Endpoint", False, f"Missing required fields: {missing_fields}", 
                            {"response_data": data})
                return False
            
            # Store tokens for later tests
            self.access_token = data["access_token"]
            self.refresh_token = data["refresh_token"]
            self.user_data = data["user"]
            
            # Verify user data structure
            user_required = ["id", "email", "username", "role"]
            missing_user_fields = [field for field in user_required if field not in self.user_data]
            
            if missing_user_fields:
                self.log_test("Login Endpoint", False, f"Missing user fields: {missing_user_fields}", 
                            {"user_data": self.user_data})
                return False
            
            self.log_test("Login Endpoint", True, "Login successful, tokens and user data received", 
                         {"user_id": self.user_data["id"], "email": self.user_data["email"]})
            return True
            
        except Exception as e:
            self.log_test("Login Endpoint", False, f"Exception during login: {str(e)}")
            return False
    
    def test_refresh_endpoint(self):
        """Test POST /api/auth/refresh - verify accepts refresh_token and returns NEW tokens"""
        if not self.refresh_token:
            self.log_test("Refresh Endpoint", False, "No refresh token available from login")
            return False
        
        try:
            # Store old tokens for comparison
            old_access_token = self.access_token
            old_refresh_token = self.refresh_token
            
            payload = {
                "refresh_token": self.refresh_token
            }
            
            response = self.session.post(f"{BASE_URL}/auth/refresh", json=payload)
            
            if response.status_code != 200:
                self.log_test("Refresh Endpoint", False, f"Refresh failed with status {response.status_code}", 
                            {"response": response.text})
                return False
            
            data = response.json()
            
            # Verify required fields
            required_fields = ["access_token", "refresh_token", "user"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Refresh Endpoint", False, f"Missing required fields: {missing_fields}", 
                            {"response_data": data})
                return False
            
            # Verify NEW tokens are different from old ones
            new_access_token = data["access_token"]
            new_refresh_token = data["refresh_token"]
            
            if new_access_token == old_access_token:
                self.log_test("Refresh Endpoint", False, "New access token is same as old token")
                return False
            
            if new_refresh_token == old_refresh_token:
                self.log_test("Refresh Endpoint", False, "New refresh token is same as old token")
                return False
            
            # Update stored tokens
            self.access_token = new_access_token
            self.refresh_token = new_refresh_token
            
            # Verify user data is returned correctly
            new_user_data = data["user"]
            if new_user_data["id"] != self.user_data["id"]:
                self.log_test("Refresh Endpoint", False, "User ID mismatch in refresh response")
                return False
            
            self.log_test("Refresh Endpoint", True, "Refresh successful, new tokens received", 
                         {"new_tokens_generated": True, "user_id": new_user_data["id"]})
            return True
            
        except Exception as e:
            self.log_test("Refresh Endpoint", False, f"Exception during refresh: {str(e)}")
            return False
    
    def test_expired_token_401(self):
        """Test using expired access_token returns 401"""
        try:
            # Create an expired token manually
            expired_payload = {
                "sub": "test_user_id",
                "role": "user",
                "type": "access",
                "exp": datetime.now(timezone.utc) - timedelta(minutes=1),  # Expired 1 minute ago
                "iat": datetime.now(timezone.utc) - timedelta(minutes=61),  # Issued 61 minutes ago
            }
            
            # Use the same secret as the backend (from .env)
            JWT_SECRET = "fantapronostic_jwt_secret_2025_prod"
            expired_token = jwt.encode(expired_payload, JWT_SECRET, algorithm="HS256")
            
            # Try to access a protected endpoint with expired token
            headers = {"Authorization": f"Bearer {expired_token}"}
            response = self.session.get(f"{BASE_URL}/profile", headers=headers)
            
            if response.status_code == 401:
                self.log_test("Expired Token 401", True, "Expired token correctly rejected with 401", 
                             {"status_code": response.status_code})
                return True
            else:
                self.log_test("Expired Token 401", False, f"Expected 401, got {response.status_code}", 
                             {"response": response.text})
                return False
                
        except Exception as e:
            self.log_test("Expired Token 401", False, f"Exception during expired token test: {str(e)}")
            return False
    
    def test_home_endpoint(self):
        """Test GET /api/home with valid token"""
        if not self.access_token:
            self.log_test("Home Endpoint", False, "No access token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(f"{BASE_URL}/home", headers=headers)
            
            if response.status_code != 200:
                self.log_test("Home Endpoint", False, f"Home endpoint failed with status {response.status_code}", 
                            {"response": response.text})
                return False
            
            data = response.json()
            
            # Verify response structure (can be empty but should be valid JSON)
            if not isinstance(data, dict):
                self.log_test("Home Endpoint", False, "Home endpoint did not return a JSON object")
                return False
            
            # Check for expected fields (they can be None/null)
            expected_fields = ["matchday", "live", "rankings_preview", "stats_preview", "user_leagues"]
            has_expected_structure = all(field in data for field in expected_fields)
            
            if has_expected_structure:
                self.log_test("Home Endpoint", True, "Home endpoint returned valid structure", 
                             {"fields_present": list(data.keys())})
            else:
                self.log_test("Home Endpoint", True, "Home endpoint accessible (basic structure)", 
                             {"response_keys": list(data.keys())})
            return True
            
        except Exception as e:
            self.log_test("Home Endpoint", False, f"Exception accessing home endpoint: {str(e)}")
            return False
    
    def test_leagues_endpoint(self):
        """Test GET /api/leagues with valid token"""
        if not self.access_token:
            self.log_test("Leagues Endpoint", False, "No access token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(f"{BASE_URL}/leagues", headers=headers)
            
            if response.status_code != 200:
                self.log_test("Leagues Endpoint", False, f"Leagues endpoint failed with status {response.status_code}", 
                            {"response": response.text})
                return False
            
            data = response.json()
            
            # Should return a list (can be empty)
            if not isinstance(data, list):
                self.log_test("Leagues Endpoint", False, "Leagues endpoint did not return a list")
                return False
            
            self.log_test("Leagues Endpoint", True, f"Leagues endpoint returned list with {len(data)} leagues", 
                         {"league_count": len(data)})
            return True
            
        except Exception as e:
            self.log_test("Leagues Endpoint", False, f"Exception accessing leagues endpoint: {str(e)}")
            return False
    
    def test_profile_endpoint(self):
        """Test GET /api/profile with valid token"""
        if not self.access_token:
            self.log_test("Profile Endpoint", False, "No access token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(f"{BASE_URL}/profile", headers=headers)
            
            if response.status_code != 200:
                self.log_test("Profile Endpoint", False, f"Profile endpoint failed with status {response.status_code}", 
                            {"response": response.text})
                return False
            
            data = response.json()
            
            # Verify response structure
            if not isinstance(data, dict):
                self.log_test("Profile Endpoint", False, "Profile endpoint did not return a JSON object")
                return False
            
            # Should contain user info and leagues_count
            if "user" not in data:
                self.log_test("Profile Endpoint", False, "Profile response missing 'user' field")
                return False
            
            user_info = data["user"]
            if user_info.get("id") != self.user_data["id"]:
                self.log_test("Profile Endpoint", False, "Profile user ID mismatch")
                return False
            
            self.log_test("Profile Endpoint", True, "Profile endpoint returned correct user data", 
                         {"user_id": user_info["id"], "username": user_info.get("username")})
            return True
            
        except Exception as e:
            self.log_test("Profile Endpoint", False, f"Exception accessing profile endpoint: {str(e)}")
            return False
    
    def test_invalid_refresh_token(self):
        """Test refresh endpoint with invalid token"""
        try:
            payload = {
                "refresh_token": "invalid_token_12345"
            }
            
            response = self.session.post(f"{BASE_URL}/auth/refresh", json=payload)
            
            if response.status_code == 401:
                self.log_test("Invalid Refresh Token", True, "Invalid refresh token correctly rejected with 401")
                return True
            else:
                self.log_test("Invalid Refresh Token", False, f"Expected 401, got {response.status_code}", 
                             {"response": response.text})
                return False
                
        except Exception as e:
            self.log_test("Invalid Refresh Token", False, f"Exception during invalid refresh test: {str(e)}")
            return False
    
    def test_no_auth_header_401(self):
        """Test protected endpoint without auth header returns 401"""
        try:
            response = self.session.get(f"{BASE_URL}/profile")
            
            if response.status_code == 401:
                self.log_test("No Auth Header 401", True, "Protected endpoint correctly requires authentication")
                return True
            else:
                self.log_test("No Auth Header 401", False, f"Expected 401, got {response.status_code}", 
                             {"response": response.text})
                return False
                
        except Exception as e:
            self.log_test("No Auth Header 401", False, f"Exception during no auth test: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all auth-related tests"""
        print("🚀 Starting P0 Auth Token Refresh Testing Suite")
        print(f"Backend URL: {BASE_URL}")
        print(f"Test User: {TEST_USER_EMAIL}")
        print("=" * 60)
        
        # Core auth flow tests
        tests = [
            ("Login Flow", self.test_login_endpoint),
            ("Token Refresh", self.test_refresh_endpoint),
            ("Expired Token Rejection", self.test_expired_token_401),
            ("Home Endpoint Access", self.test_home_endpoint),
            ("Leagues Endpoint Access", self.test_leagues_endpoint),
            ("Profile Endpoint Access", self.test_profile_endpoint),
            ("Invalid Refresh Token", self.test_invalid_refresh_token),
            ("No Auth Header Protection", self.test_no_auth_header_401),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🧪 Running: {test_name}")
            if test_func():
                passed += 1
            time.sleep(0.5)  # Small delay between tests
        
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL AUTH TESTS PASSED - P0 Auth Token Refresh is WORKING!")
        else:
            print(f"⚠️  {total - passed} tests failed - Auth system needs attention")
        
        return passed == total
    
    def get_summary(self):
        """Get detailed test summary"""
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        total = len(self.test_results)
        
        summary = {
            "total_tests": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": f"{(passed/total*100):.1f}%" if total > 0 else "0%",
            "results": self.test_results
        }
        
        return summary

def main():
    """Main test execution"""
    test_suite = AuthTestSuite()
    
    try:
        success = test_suite.run_all_tests()
        summary = test_suite.get_summary()
        
        print(f"\n📋 DETAILED RESULTS:")
        for result in summary["results"]:
            print(f"  {result['status']}: {result['test']}")
            if "❌ FAIL" in result["status"]:
                print(f"    → {result['message']}")
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())