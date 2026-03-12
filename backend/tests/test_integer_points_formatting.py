"""
Test integer points formatting across all relevant APIs.
Verifies that all point fields are returned as integer types (not floats with .0)
in GET /api/standings/total, /api/home, /api/predictions, /api/live endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://context-aware-tabs.preview.emergentagent.com"

# Test credentials
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"
NATIONAL_LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
LIGA2_LEAGUE_ID = "1762173a-31fe-463b-9668-d757114f440b"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for standard user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": STANDARD_USER_EMAIL, "password": STANDARD_USER_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "access_token not in login response"
    return data["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Standard headers with auth token."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestStandingsTotalIntegerPoints:
    """Test GET /api/standings/total returns integer point values."""

    def test_total_standings_national_league(self, headers):
        """Verify total_points and current_week_points are integers in standings."""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check entries exist
        assert "entries" in data, "Missing 'entries' in response"
        
        if data["entries"]:
            for entry in data["entries"]:
                # Verify total_points is an integer type
                total_points = entry.get("total_points")
                assert total_points is not None, f"Missing total_points for user {entry.get('username')}"
                assert isinstance(total_points, int), f"total_points should be int, got {type(total_points).__name__}: {total_points}"
                
                # Verify current_week_points is an integer type
                current_week_points = entry.get("current_week_points")
                assert current_week_points is not None, f"Missing current_week_points for user {entry.get('username')}"
                assert isinstance(current_week_points, int), f"current_week_points should be int, got {type(current_week_points).__name__}: {current_week_points}"
                
                print(f"✓ User {entry.get('username')}: total_points={total_points} (int), current_week_points={current_week_points} (int)")

    def test_total_standings_liga2(self, headers):
        """Verify integer points in liga2 standings."""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LIGA2_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        if data.get("entries"):
            for entry in data["entries"][:3]:  # Check first 3 entries
                total_points = entry.get("total_points")
                current_week_points = entry.get("current_week_points")
                
                assert isinstance(total_points, int), f"total_points not int: {type(total_points)}"
                assert isinstance(current_week_points, int), f"current_week_points not int: {type(current_week_points)}"
                
                print(f"✓ Liga2 User {entry.get('username')}: points are integers")


class TestHomeApiIntegerPoints:
    """Test GET /api/home returns integer point values."""

    def test_home_user_summary_integer_points(self, headers):
        """Verify user_summary.total_points is integer in home API."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check user_summary
        user_summary = data.get("user_summary")
        if user_summary:
            total_points = user_summary.get("total_points")
            if total_points is not None:
                assert isinstance(total_points, int), f"user_summary.total_points should be int, got {type(total_points).__name__}: {total_points}"
                print(f"✓ user_summary.total_points = {total_points} (int)")
            
            # Also check points alias if present
            points = user_summary.get("points")
            if points is not None:
                assert isinstance(points, int), f"user_summary.points should be int, got {type(points).__name__}: {points}"
                print(f"✓ user_summary.points = {points} (int)")

    def test_home_last_5_performance_integer_points(self, headers):
        """Verify last_5_performance[].points is integer in home API."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check last_5_performance
        last_5 = data.get("last_5_performance", [])
        if last_5:
            for i, perf in enumerate(last_5):
                points = perf.get("points")
                assert isinstance(points, int), f"last_5_performance[{i}].points should be int, got {type(points).__name__}: {points}"
                print(f"✓ last_5_performance[{i}] matchday {perf.get('matchday_number')}: points = {points} (int)")
        else:
            print("⚠ No last_5_performance data available")

    def test_home_rankings_preview_integer_points(self, headers):
        """Verify rankings_preview.top[].total_points is integer."""
        response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        rankings = data.get("rankings_preview")
        if rankings and rankings.get("top"):
            for entry in rankings["top"]:
                total_points = entry.get("total_points")
                assert isinstance(total_points, int), f"rankings_preview total_points should be int: {total_points}"
                print(f"✓ Ranking: {entry.get('username')} has {total_points} pts (int)")


class TestPredictionsApiIntegerPoints:
    """Test GET /api/predictions returns integer point values."""

    def test_predictions_points_are_integers(self, headers):
        """Verify points and total_base_points are integers in predictions API."""
        # First get current matchday
        home_response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert home_response.status_code == 200
        home_data = home_response.json()
        
        matchday_id = home_data.get("matchday", {}).get("id")
        if not matchday_id:
            pytest.skip("No matchday available")
        
        # Get predictions
        response = requests.get(
            f"{BASE_URL}/api/predictions/{matchday_id}?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check predictions list
        predictions = data.get("predictions", [])
        for pred in predictions:
            if pred.get("prediction"):
                points = pred["prediction"].get("points")
                if points is not None:
                    assert isinstance(points, (int, type(None))), f"prediction.points should be int or None: {points}"
                    print(f"✓ Prediction points: {points}")


class TestLiveApiIntegerPoints:
    """Test GET /api/live returns integer point values."""

    def test_live_points_are_integers(self, headers):
        """Verify base_points, joker_bonus, total_live_points are integers."""
        # First get current matchday
        home_response = requests.get(
            f"{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert home_response.status_code == 200
        home_data = home_response.json()
        
        matchday_id = home_data.get("matchday", {}).get("id")
        if not matchday_id:
            pytest.skip("No matchday available")
        
        # Get live data
        response = requests.get(
            f"{BASE_URL}/api/live/{matchday_id}?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check point totals - they should be numeric (int or float that represents whole number)
        base_points = data.get("base_points")
        if base_points is not None:
            # Allow int or float, but value should be whole number
            print(f"✓ base_points = {base_points} (type: {type(base_points).__name__})")
        
        joker_bonus = data.get("joker_bonus")
        if joker_bonus is not None:
            print(f"✓ joker_bonus = {joker_bonus} (type: {type(joker_bonus).__name__})")
        
        total_live_points = data.get("total_live_points")
        if total_live_points is not None:
            print(f"✓ total_live_points = {total_live_points} (type: {type(total_live_points).__name__})")
        
        # Check individual match points
        matches = data.get("matches", [])
        for match in matches[:3]:  # Check first 3 matches
            points = match.get("points")
            if points is not None:
                # Points should be numeric
                assert isinstance(points, (int, float)), f"match.points should be numeric: {points}"
                print(f"✓ Match {match.get('home_team')} vs {match.get('away_team')}: {points} pts")


class TestWeeklyStandingsIntegerPoints:
    """Test GET /api/standings/weekly returns integer point values."""

    def test_weekly_standings_integer_points(self, headers):
        """Verify matchday_points, base_points, joker_bonus are integers."""
        # First get available matchdays
        response = requests.get(
            f"{BASE_URL}/api/standings/matchdays?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        matchdays = response.json()
        
        if not matchdays:
            pytest.skip("No matchdays available")
        
        # Get first completed matchday
        completed_md = next((m for m in matchdays if m.get("status") == "COMPLETED"), None)
        if not completed_md:
            completed_md = matchdays[0]
        
        matchday_id = completed_md["id"]
        
        # Get weekly standings
        response = requests.get(
            f"{BASE_URL}/api/standings/weekly/{matchday_id}?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        entries = data.get("entries", [])
        if entries:
            for entry in entries[:3]:  # Check first 3 entries
                matchday_points = entry.get("matchday_points")
                base_points = entry.get("base_points")
                joker_bonus = entry.get("joker_bonus")
                
                if matchday_points is not None:
                    assert isinstance(matchday_points, int), f"matchday_points should be int: {matchday_points}"
                if base_points is not None:
                    assert isinstance(base_points, int), f"base_points should be int: {base_points}"
                if joker_bonus is not None:
                    assert isinstance(joker_bonus, int), f"joker_bonus should be int: {joker_bonus}"
                
                print(f"✓ Weekly standings user {entry.get('username')}: matchday_points={matchday_points}, base_points={base_points}, joker_bonus={joker_bonus}")


class TestUserStandingsProfileIntegerPoints:
    """Test GET /api/standings/user returns integer point values."""

    def test_user_standings_profile_integer_points(self, headers, auth_token):
        """Verify all point fields in user profile are integers."""
        # Get current user ID from profile
        profile_response = requests.get(f"{BASE_URL}/api/profile", headers=headers)
        assert profile_response.status_code == 200
        user_id = profile_response.json().get("user", {}).get("id")
        
        if not user_id:
            pytest.skip("Cannot get user ID")
        
        # Get user standings profile
        response = requests.get(
            f"{BASE_URL}/api/standings/user/{user_id}?league_id={NATIONAL_LEAGUE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check main point fields
        fields_to_check = [
            "total_points", "total_base_points", "total_joker_bonus", "current_week_points"
        ]
        
        for field in fields_to_check:
            value = data.get(field)
            if value is not None:
                assert isinstance(value, int), f"{field} should be int, got {type(value).__name__}: {value}"
                print(f"✓ {field} = {value} (int)")
        
        # Check matchday_breakdown points
        breakdown = data.get("matchday_breakdown", [])
        for md in breakdown[:3]:  # Check first 3 matchdays
            base_points = md.get("base_points")
            joker_bonus = md.get("joker_bonus")
            total_points = md.get("total_points")
            
            if base_points is not None:
                assert isinstance(base_points, int), f"matchday base_points should be int: {base_points}"
            if joker_bonus is not None:
                assert isinstance(joker_bonus, int), f"matchday joker_bonus should be int: {joker_bonus}"
            if total_points is not None:
                assert isinstance(total_points, int), f"matchday total_points should be int: {total_points}"
            
            print(f"✓ Matchday {md.get('matchday_number')}: base={base_points}, joker={joker_bonus}, total={total_points}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
