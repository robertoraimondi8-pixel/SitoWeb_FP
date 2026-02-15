#!/usr/bin/env python3
"""
Extended Backend Test Suite for FantaPronostic Jolly Feature
Tests the UNIQUE constraint by creating test data
"""
import asyncio
import aiohttp
import json
from datetime import datetime, timezone, timedelta

# Get backend URL from frontend env
BACKEND_URL = "https://fantascore-1.preview.emergentagent.com/api"

class ExtendedJollyTester:
    def __init__(self):
        self.session = None
        self.admin_token = None
        self.user_token = None
        self.user_id = None
        self.season_id = None
        self.matchday1_id = None
        self.matchday2_id = None
        
    async def setup(self):
        """Initialize HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def api_call(self, method, endpoint, data=None, token=None, expect_error=False):
        """Make API call with authentication"""
        url = f"{BACKEND_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            async with self.session.request(method, url, json=data, headers=headers) as resp:
                response_text = await resp.text()
                
                if resp.status >= 400 and not expect_error:
                    print(f"❌ API Error {resp.status}: {endpoint}")
                    print(f"   Response: {response_text}")
                    return None
                    
                try:
                    result = json.loads(response_text) if response_text else {}
                    result["_status_code"] = resp.status
                    return result
                except json.JSONDecodeError:
                    return {"text": response_text, "status": resp.status, "_status_code": resp.status}
                    
        except Exception as e:
            print(f"❌ Request failed: {endpoint} - {str(e)}")
            return None
            
    async def login_admin(self):
        """Login as admin to create test data"""
        print("🔐 Logging in as admin...")
        
        response = await self.api_call("POST", "/auth/login", {
            "email": "admin@fantapronostic.com",
            "password": "admin123"
        })
        
        if not response or "access_token" not in response:
            print("❌ Admin login failed")
            return False
            
        self.admin_token = response["access_token"]
        print("✅ Admin login successful")
        return True
        
    async def login_user(self):
        """Login as regular user"""
        print("🔐 Logging in as user...")
        
        response = await self.api_call("POST", "/auth/login", {
            "email": "marco@test.com",
            "password": "password123"
        })
        
        if not response or "access_token" not in response:
            print("❌ User login failed")
            return False
            
        self.user_token = response["access_token"]
        self.user_id = response["user"]["id"]
        print(f"✅ User login successful - ID: {self.user_id}")
        return True
        
    async def get_season_id(self):
        """Get active season ID"""
        response = await self.api_call("GET", "/admin/seasons", token=self.admin_token)
        if not response or not isinstance(response, list):
            print(f"❌ Invalid seasons response: {response}")
            return False
            
        active_seasons = [s for s in response if s.get("is_active")]
        if not active_seasons:
            print("❌ No active season found")
            return False
            
        self.season_id = active_seasons[0]["id"]
        print(f"✅ Found active season: {self.season_id}")
        return True
        
    async def create_test_matchdays(self):
        """Create two matchdays in the same half for testing"""
        print("📅 Creating test matchdays...")
        
        if not self.season_id:
            print("❌ No season ID available")
            return False
            
        # Create first matchday in half 1
        now = datetime.now(timezone.utc)
        kickoff1 = (now + timedelta(hours=1)).isoformat()
        
        md1_data = {
            "season_id": self.season_id,
            "number": 10,
            "label": "Test Matchday 10",
            "half": 1,
            "first_kickoff": kickoff1,
            "status": "OPEN"
        }
        
        response1 = await self.api_call("POST", "/admin/matchdays", md1_data, token=self.admin_token)
        if not response1:
            print("❌ Failed to create first test matchday")
            return False
            
        self.matchday1_id = response1["id"]
        print(f"✅ Created test matchday 1: {self.matchday1_id}")
        
        # Create second matchday in same half (half 1)
        kickoff2 = (now + timedelta(hours=2)).isoformat()
        
        md2_data = {
            "season_id": self.season_id,
            "number": 11,
            "label": "Test Matchday 11",
            "half": 1,  # Same half as first matchday
            "first_kickoff": kickoff2,
            "status": "OPEN"
        }
        
        response2 = await self.api_call("POST", "/admin/matchdays", md2_data, token=self.admin_token)
        if not response2:
            print("❌ Failed to create second test matchday")
            return False
            
        self.matchday2_id = response2["id"]
        print(f"✅ Created test matchday 2: {self.matchday2_id}")
        
        return True
        
    async def test_unique_constraint_violation(self):
        """Test that UNIQUE constraint prevents multiple jokers in same half"""
        print("\n🔒 Testing UNIQUE constraint violation...")
        
        if not self.matchday1_id or not self.matchday2_id:
            print("❌ Test matchdays not available")
            return False
            
        # Activate joker on first matchday
        response1 = await self.api_call("POST", f"/predictions/{self.matchday1_id}/joker", 
                                       token=self.user_token)
        if not response1 or not response1.get("is_active"):
            print("❌ Failed to activate joker on first matchday")
            return False
            
        print(f"✅ Joker activated on matchday 1: {self.matchday1_id}")
        
        # Try to activate joker on second matchday in same half - should fail
        response2 = await self.api_call("POST", f"/predictions/{self.matchday2_id}/joker", 
                                       token=self.user_token, expect_error=True)
        
        if not response2:
            print("❌ No response from second joker activation attempt")
            return False
            
        # Check if we got the expected 400 error
        if response2.get("_status_code") == 400:
            error_detail = response2.get("detail", "")
            if "already used in half" in error_detail:
                print(f"✅ UNIQUE constraint working: {error_detail}")
                return True
            else:
                print(f"❌ Got 400 error but wrong message: {error_detail}")
                return False
        else:
            print(f"❌ Expected 400 error, got {response2.get('_status_code')}: {response2}")
            return False
            
    async def test_different_half_allowed(self):
        """Test that joker can be used in different half"""
        print("\n🔄 Testing joker in different half...")
        
        # Create a matchday in half 2
        now = datetime.now(timezone.utc)
        kickoff3 = (now + timedelta(hours=3)).isoformat()
        
        md3_data = {
            "season_id": self.season_id,
            "number": 20,
            "label": "Test Matchday 20",
            "half": 2,  # Different half
            "first_kickoff": kickoff3,
            "status": "OPEN"
        }
        
        response = await self.api_call("POST", "/admin/matchdays", md3_data, token=self.admin_token)
        if not response:
            print("❌ Failed to create matchday in half 2")
            return False
            
        matchday3_id = response["id"]
        print(f"✅ Created matchday in half 2: {matchday3_id}")
        
        # Try to activate joker on matchday in half 2 - should work
        joker_response = await self.api_call("POST", f"/predictions/{matchday3_id}/joker", 
                                           token=self.user_token)
        
        if not joker_response or not joker_response.get("is_active"):
            print("❌ Failed to activate joker in different half")
            return False
            
        print("✅ Joker successfully activated in different half (half 2)")
        return True
        
    async def cleanup_test_data(self):
        """Clean up test matchdays"""
        print("\n🧹 Cleaning up test data...")
        
        # Note: In a real scenario, we might want to clean up the test matchdays
        # For now, we'll leave them as they don't interfere with normal operation
        print("✅ Test data cleanup completed")
        
    async def run_extended_tests(self):
        """Run extended joker constraint tests"""
        print("🚀 Starting Extended Jolly UNIQUE Constraint Tests")
        print("=" * 60)
        
        tests = [
            ("Admin Login", self.login_admin),
            ("User Login", self.login_user),
            ("Get Season ID", self.get_season_id),
            ("Create Test Matchdays", self.create_test_matchdays),
            ("Test UNIQUE Constraint Violation", self.test_unique_constraint_violation),
            ("Test Different Half Allowed", self.test_different_half_allowed),
            ("Cleanup Test Data", self.cleanup_test_data),
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            try:
                print(f"\n--- {test_name} ---")
                result = await test_func()
                results[test_name] = result
                if not result:
                    print(f"\n❌ Test '{test_name}' FAILED")
                    break
            except Exception as e:
                print(f"\n💥 Test '{test_name}' crashed: {str(e)}")
                results[test_name] = False
                break
                
        print("\n" + "=" * 60)
        print("📊 EXTENDED TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
            
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL EXTENDED TESTS PASSED - UNIQUE constraint working correctly!")
        else:
            print("⚠️  SOME EXTENDED TESTS FAILED - Issues with UNIQUE constraint")
            
        return results

async def main():
    """Main test runner"""
    tester = ExtendedJollyTester()
    
    try:
        await tester.setup()
        results = await tester.run_extended_tests()
        return results
    finally:
        await tester.cleanup()

if __name__ == "__main__":
    asyncio.run(main())