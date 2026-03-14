"""
Test Stripe Payment Integration for Custom Leagues
- POST /api/payments/custom-league-checkout: Create Stripe checkout session for custom leagues (89.99 EUR)
- GET /api/payments/status/{session_id}: Poll payment status
- POST /api/leagues: Create national league without payment (free)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestStripePayments:
    """Stripe payment integration tests for custom-matches leagues"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ilio@raimondi.it",
            "password": "password123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        assert self.token, "No access_token in login response"
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        # Get season ID for tests
        seasons_resp = self.session.get(f"{BASE_URL}/api/leagues/seasons")
        assert seasons_resp.status_code == 200, f"Failed to get seasons: {seasons_resp.text}"
        seasons = seasons_resp.json()
        assert len(seasons) > 0, "No seasons available"
        self.season_id = seasons[0]["id"]
        
        # Get valid matchday range
        range_resp = self.session.get(f"{BASE_URL}/api/leagues/matchday-range")
        assert range_resp.status_code == 200, f"Failed to get matchday range: {range_resp.text}"
        md_range = range_resp.json()
        self.first_matchday = md_range.get("first_selectable", 1)
        self.last_matchday = md_range.get("last_matchday", 38)
        print(f"Using season_id: {self.season_id}, matchday range: {self.first_matchday}-{self.last_matchday}")
    
    # --- Custom League Checkout Tests ---
    
    def test_custom_league_checkout_creates_stripe_session(self):
        """POST /api/payments/custom-league-checkout should return a Stripe checkout URL"""
        payload = {
            "origin_url": BASE_URL,
            "name": "TEST_CustomLeague_Stripe",
            "season_id": self.season_id,
            "start_matchday": self.first_matchday,
            "end_matchday": self.last_matchday,
            "bet_deadline_minutes": 5
        }
        
        resp = self.session.post(f"{BASE_URL}/api/payments/custom-league-checkout", json=payload)
        
        assert resp.status_code == 200, f"Checkout failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "url" in data, "Response should contain 'url' field"
        assert "session_id" in data, "Response should contain 'session_id' field"
        
        # Verify Stripe URL format
        checkout_url = data["url"]
        assert checkout_url.startswith("https://checkout.stripe.com/"), f"URL should be Stripe checkout URL, got: {checkout_url}"
        
        # Store session_id for subsequent tests
        self.checkout_session_id = data["session_id"]
        print(f"Created Stripe checkout session: {self.checkout_session_id}")
        print(f"Stripe URL: {checkout_url[:60]}...")
    
    def test_custom_league_checkout_without_auth_fails(self):
        """POST /api/payments/custom-league-checkout without auth should fail"""
        payload = {
            "origin_url": BASE_URL,
            "name": "TEST_NoAuth",
            "season_id": self.season_id,
            "start_matchday": 1,
            "end_matchday": 38,
            "bet_deadline_minutes": 5
        }
        
        # Create new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        resp = unauth_session.post(f"{BASE_URL}/api/payments/custom-league-checkout", json=payload)
        
        assert resp.status_code in [401, 403], f"Expected 401/403, got: {resp.status_code}"
    
    def test_custom_league_checkout_validates_matchdays(self):
        """POST /api/payments/custom-league-checkout should validate end_matchday >= start_matchday"""
        payload = {
            "origin_url": BASE_URL,
            "name": "TEST_InvalidMatchdays",
            "season_id": self.season_id,
            "start_matchday": self.last_matchday,
            "end_matchday": self.first_matchday,  # Invalid: end < start
            "bet_deadline_minutes": 5
        }
        
        resp = self.session.post(f"{BASE_URL}/api/payments/custom-league-checkout", json=payload)
        
        assert resp.status_code == 400, f"Expected 400 for invalid matchdays, got: {resp.status_code}"
    
    # --- Payment Status Tests ---
    
    def test_payment_status_returns_expected_fields(self):
        """GET /api/payments/status/{session_id} should return payment_status, status, amount, currency, type"""
        # First create a checkout session
        payload = {
            "origin_url": BASE_URL,
            "name": "TEST_StatusCheck",
            "season_id": self.season_id,
            "start_matchday": self.first_matchday,
            "end_matchday": self.last_matchday,
            "bet_deadline_minutes": 5
        }
        
        checkout_resp = self.session.post(f"{BASE_URL}/api/payments/custom-league-checkout", json=payload)
        assert checkout_resp.status_code == 200
        session_id = checkout_resp.json()["session_id"]
        
        # Now check status
        status_resp = self.session.get(f"{BASE_URL}/api/payments/status/{session_id}")
        
        assert status_resp.status_code == 200, f"Status check failed: {status_resp.status_code} - {status_resp.text}"
        data = status_resp.json()
        
        # Verify all required fields
        assert "payment_status" in data, "Missing 'payment_status' field"
        assert "status" in data, "Missing 'status' field"
        assert "amount" in data, "Missing 'amount' field"
        assert "currency" in data, "Missing 'currency' field"
        assert "type" in data, "Missing 'type' field"
        
        # Verify values
        assert data["amount"] == 89.99, f"Expected amount 89.99, got: {data['amount']}"
        assert data["currency"] == "eur", f"Expected currency 'eur', got: {data['currency']}"
        assert data["type"] == "custom_league_creation", f"Expected type 'custom_league_creation', got: {data['type']}"
        
        print(f"Payment status: {data['payment_status']}, session status: {data['status']}")
    
    def test_payment_status_invalid_session_returns_404(self):
        """GET /api/payments/status/{invalid_session_id} should return 404"""
        resp = self.session.get(f"{BASE_URL}/api/payments/status/invalid_session_12345")
        
        assert resp.status_code == 404, f"Expected 404 for invalid session, got: {resp.status_code}"
    
    def test_payment_status_without_auth_fails(self):
        """GET /api/payments/status/{session_id} without auth should fail"""
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        resp = unauth_session.get(f"{BASE_URL}/api/payments/status/some_session_id")
        
        assert resp.status_code in [401, 403], f"Expected 401/403, got: {resp.status_code}"
    
    # --- National League (Free) Creation Tests ---
    
    def test_national_league_creation_is_free(self):
        """POST /api/leagues with national source should create league without payment"""
        import uuid
        unique_name = f"TEST_NationalFree_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": unique_name,
            "season_id": self.season_id,
            "start_matchday": self.first_matchday,
            "end_matchday": self.last_matchday,
            "bet_deadline_minutes": 5,
            "match_source_type": "national",
            "include_championship_predictions": False
        }
        
        resp = self.session.post(f"{BASE_URL}/api/leagues", json=payload)
        
        assert resp.status_code in [200, 201], f"National league creation failed: {resp.status_code} - {resp.text}"
        data = resp.json()
        
        # Verify league was created
        assert "id" in data, "Response should contain league 'id'"
        assert data["name"] == unique_name, f"Expected name '{unique_name}', got: {data['name']}"
        assert "invite_code" in data, "Response should contain 'invite_code'"
        
        print(f"Created national league: {data['id']} with invite_code: {data.get('invite_code')}")


class TestSeasonEndpoints:
    """Season endpoint tests"""
    
    def test_get_seasons_endpoint(self):
        """GET /api/leagues/seasons should return available seasons"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Login first
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ilio@raimondi.it",
            "password": "password123"
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get seasons
        resp = session.get(f"{BASE_URL}/api/leagues/seasons")
        
        assert resp.status_code == 200, f"Seasons endpoint failed: {resp.status_code} - {resp.text}"
        seasons = resp.json()
        
        assert isinstance(seasons, list), "Response should be a list"
        assert len(seasons) > 0, "Should have at least one season"
        
        # Check season has required fields
        season = seasons[0]
        assert "id" in season, "Season should have 'id' field"
        print(f"Found {len(seasons)} season(s), first: {season.get('id')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
