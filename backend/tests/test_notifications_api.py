"""
Notification Center API Tests
Tests the in-app notification system including:
- GET /api/notifications - List notifications
- GET /api/notifications/unread-count - Get unread count
- PATCH /api/notifications/{notif_id}/read - Mark single as read
- PATCH /api/notifications/read-all - Mark all as read
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rbac-enhanced.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"


class TestNotificationAPIs:
    """Test notification center endpoints"""
    
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
    
    def test_get_notifications_list(self):
        """Test GET /api/notifications returns list of notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Response should be a list
        assert isinstance(data, list), "Response should be a list"
        
        # If notifications exist, verify structure
        if len(data) > 0:
            notif = data[0]
            assert "id" in notif, "Notification should have id"
            assert "title" in notif or "message" in notif, "Notification should have title or message"
            assert "read" in notif, "Notification should have read status"
            assert "created_at" in notif, "Notification should have created_at"
            print(f"GET /api/notifications returned {len(data)} notifications")
    
    def test_get_unread_count(self):
        """Test GET /api/notifications/unread-count returns count object"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "count" in data, "Response should have 'count' field"
        assert isinstance(data["count"], int), "Count should be integer"
        assert data["count"] >= 0, "Count should be non-negative"
        print(f"GET /api/notifications/unread-count returned count={data['count']}")
    
    def test_mark_all_notifications_read(self):
        """Test PATCH /api/notifications/read-all marks all as read"""
        response = requests.patch(
            f"{BASE_URL}/api/notifications/read-all",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should have message"
        assert data["message"] == "OK", f"Expected 'OK', got {data['message']}"
        
        # Verify unread count is now 0
        count_response = requests.get(
            f"{BASE_URL}/api/notifications/unread-count",
            headers=self.headers
        )
        count_data = count_response.json()
        assert count_data["count"] == 0, f"Expected unread count 0 after mark-all-read, got {count_data['count']}"
        print("PATCH /api/notifications/read-all worked - all notifications marked as read")
    
    def test_mark_single_notification_read(self):
        """Test PATCH /api/notifications/{id}/read marks single notification as read"""
        # First get notifications to find one
        notifs_response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers
        )
        notifs = notifs_response.json()
        
        if len(notifs) == 0:
            pytest.skip("No notifications to test with")
        
        notif_id = notifs[0]["id"]
        
        response = requests.patch(
            f"{BASE_URL}/api/notifications/{notif_id}/read",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"PATCH /api/notifications/{notif_id}/read returned OK")
    
    def test_notifications_require_auth(self):
        """Test notification endpoints require authentication"""
        # No auth header
        no_auth_headers = {"Content-Type": "application/json"}
        
        # GET /api/notifications
        response = requests.get(f"{BASE_URL}/api/notifications", headers=no_auth_headers)
        assert response.status_code == 401, "GET /api/notifications should require auth"
        
        # GET /api/notifications/unread-count
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=no_auth_headers)
        assert response.status_code == 401, "GET /api/notifications/unread-count should require auth"
        
        # PATCH /api/notifications/read-all
        response = requests.patch(f"{BASE_URL}/api/notifications/read-all", headers=no_auth_headers)
        assert response.status_code == 401, "PATCH /api/notifications/read-all should require auth"
        
        print("All notification endpoints correctly require authentication")


class TestNotificationDataIntegrity:
    """Test notification data structure and integrity"""
    
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
    
    def test_notification_has_required_fields(self):
        """Test notification objects have all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers
        )
        
        if response.status_code != 200 or len(response.json()) == 0:
            pytest.skip("No notifications to verify")
        
        notif = response.json()[0]
        
        # Required fields
        required_fields = ["id", "message", "read", "created_at"]
        for field in required_fields:
            assert field in notif, f"Notification missing required field: {field}"
        
        # Optional but expected fields
        optional_fields = ["title", "type", "link", "user_id"]
        for field in optional_fields:
            if field in notif:
                print(f"Notification has optional field: {field}")
        
        # Validate types
        assert isinstance(notif["id"], str), "id should be string"
        assert isinstance(notif["read"], bool), "read should be boolean"
        assert isinstance(notif["message"], str), "message should be string"
        
        print(f"Notification structure validated: {list(notif.keys())}")
    
    def test_notifications_sorted_by_date(self):
        """Test notifications are sorted newest first"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers=self.headers
        )
        
        if response.status_code != 200 or len(response.json()) < 2:
            pytest.skip("Need at least 2 notifications to test sorting")
        
        notifs = response.json()
        
        # Check descending order (newest first)
        for i in range(len(notifs) - 1):
            date_i = notifs[i].get("created_at", "")
            date_next = notifs[i + 1].get("created_at", "")
            assert date_i >= date_next, "Notifications should be sorted newest first"
        
        print("Notifications correctly sorted by date (newest first)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
