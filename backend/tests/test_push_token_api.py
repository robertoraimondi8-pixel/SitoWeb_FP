"""
Push Token & Notification API Tests (Iteration 44)
Tests the push notification token management including:
- POST /api/push-token - Register valid Expo push token
- POST /api/push-token - Reject invalid tokens (not starting with ExponentPushToken[)
- DELETE /api/push-token - Remove push token
- Existing notification APIs (GET /api/notifications, unread-count, read-all)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://unified-competitions.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"


class TestPushTokenAPIs:
    """Test push token management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_register_valid_push_token(self):
        """Test POST /api/push-token with valid ExponentPushToken format"""
        response = requests.post(
            f"{BASE_URL}/api/push-token",
            headers=self.headers,
            json={
                "token": "ExponentPushToken[TEST_valid_token_abc123]",
                "device_type": "ios"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "registrato" in data["message"].lower() or "push token" in data["message"].lower(), \
            f"Unexpected message: {data['message']}"
        print("POST /api/push-token with valid token: PASSED")
        
        # Cleanup: remove the test token
        requests.delete(
            f"{BASE_URL}/api/push-token",
            headers=self.headers,
            json={"token": "ExponentPushToken[TEST_valid_token_abc123]"}
        )
    
    def test_reject_invalid_push_token_no_prefix(self):
        """Test POST /api/push-token rejects tokens without ExponentPushToken[ prefix"""
        response = requests.post(
            f"{BASE_URL}/api/push-token",
            headers=self.headers,
            json={
                "token": "invalid_token_without_prefix",
                "device_type": "android"
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should have detail"
        print(f"POST /api/push-token rejects invalid token: PASSED - {data['detail']}")
    
    def test_reject_push_token_wrong_format(self):
        """Test POST /api/push-token rejects tokens with wrong format"""
        invalid_tokens = [
            "",  # Empty token
            "RandomToken123",  # No prefix
            "ExponentPush[incomplete]",  # Missing 'Token'
            "exponentpushtoken[lowercase]",  # Wrong case
        ]
        
        for invalid_token in invalid_tokens:
            response = requests.post(
                f"{BASE_URL}/api/push-token",
                headers=self.headers,
                json={"token": invalid_token}
            )
            assert response.status_code == 400, f"Token '{invalid_token}' should be rejected but got {response.status_code}"
        
        print("POST /api/push-token rejects all invalid token formats: PASSED")
    
    def test_delete_push_token(self):
        """Test DELETE /api/push-token removes a push token"""
        test_token = "ExponentPushToken[TEST_delete_token_xyz789]"
        
        # First register the token
        register_response = requests.post(
            f"{BASE_URL}/api/push-token",
            headers=self.headers,
            json={"token": test_token, "device_type": "ios"}
        )
        assert register_response.status_code == 200, "Token registration should succeed"
        
        # Then delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/push-token",
            headers=self.headers,
            json={"token": test_token}
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        data = delete_response.json()
        assert "message" in data, "Response should have message"
        assert "rimosso" in data["message"].lower() or "removed" in data["message"].lower(), \
            f"Unexpected message: {data['message']}"
        print("DELETE /api/push-token: PASSED")
    
    def test_push_token_requires_auth(self):
        """Test push token endpoints require authentication"""
        no_auth_headers = {"Content-Type": "application/json"}
        
        # POST without auth
        response = requests.post(
            f"{BASE_URL}/api/push-token",
            headers=no_auth_headers,
            json={"token": "ExponentPushToken[test]"}
        )
        assert response.status_code == 401, "POST /api/push-token should require auth"
        
        # DELETE without auth
        response = requests.delete(
            f"{BASE_URL}/api/push-token",
            headers=no_auth_headers,
            json={"token": "ExponentPushToken[test]"}
        )
        assert response.status_code == 401, "DELETE /api/push-token should require auth"
        
        print("Push token endpoints correctly require authentication: PASSED")


class TestExistingNotificationAPIs:
    """Regression tests for existing notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_notifications(self):
        """Test GET /api/notifications returns list"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"GET /api/notifications: PASSED - returned {len(data)} notifications")
    
    def test_get_unread_count(self):
        """Test GET /api/notifications/unread-count returns count object"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "count" in data, "Response should have 'count' field"
        assert isinstance(data["count"], int), "Count should be integer"
        print(f"GET /api/notifications/unread-count: PASSED - count={data['count']}")
    
    def test_mark_all_read(self):
        """Test PATCH /api/notifications/read-all"""
        response = requests.patch(
            f"{BASE_URL}/api/notifications/read-all",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message" in data, "Response should have message"
        print("PATCH /api/notifications/read-all: PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
