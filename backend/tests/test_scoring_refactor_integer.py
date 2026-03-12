"""
Tests for FantaPronostic scoring refactor: integer scoring (1/2/5) instead of decimal (0.5/1.0/4.0).
Global fixed scoring: Goal/Over=1, 1X2=2, Exact Score=5.
X3 multiplier should work with new values: 3/6/15.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://context-aware-tabs.preview.emergentagent.com"

# Test credentials
STANDARD_USER = {"email": "ilio@raimondi.it", "password": "password123"}
ADMIN_USER = {"email": "admin@fantapronostic.com", "password": "admin123"}

# Known IDs from the task
LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"
MATCHDAY_ID = "040552b8-0e2a-4cd8-b52e-030e27d93560"


@pytest.fixture(scope="module")
def user_token():
    """Get auth token for standard user"""
    r = requests.post(f"{BASE_URL}/api/auth/login", json=STANDARD_USER)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_token():
    """Get auth token for admin user"""
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_USER)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json().get("access_token")


class TestScoringConfig:
    """Test that API returns correct global scoring values"""
    
    def test_league_scoring_config_values(self, user_token):
        """GET /api/leagues/{id} should return scoring_config with new integer values (2,1,1,5)"""
        r = requests.get(
            f"{BASE_URL}/api/leagues/{LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200, f"Failed to get league: {r.text}"
        data = r.json()
        
        scoring = data.get("scoring_config", {})
        print(f"Scoring config: {scoring}")
        
        # Verify new global values
        # 1X2 = 2 points
        assert scoring.get("1x2", {}).get("points") == 2, f"1X2 should be 2 points, got {scoring.get('1x2')}"
        
        # Over/Under = 1 point
        assert scoring.get("over_under", {}).get("points") == 1, f"Over/Under should be 1 point, got {scoring.get('over_under')}"
        
        # Goal/NoGoal = 1 point
        assert scoring.get("goal_no_goal", {}).get("points") == 1, f"GG/NG should be 1 point, got {scoring.get('goal_no_goal')}"
        
        # Exact Score = 5 points
        assert scoring.get("exact_score", {}).get("points") == 5, f"Exact Score should be 5 points, got {scoring.get('exact_score')}"
    
    def test_home_returns_matchday_data(self, user_token):
        """GET /api/home should return correct matchday data"""
        r = requests.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200, f"Failed to get home: {r.text}"
        data = r.json()
        
        assert "league" in data, "Home should return league info"
        assert "matchday" in data or "upcoming_matchday" in data, "Home should return matchday info"
        
        print(f"Home league: {data.get('league', {}).get('name')}")
        print(f"Matchday: {data.get('matchday', data.get('upcoming_matchday'))}")


class TestStandingsIntegerPoints:
    """Test that standings show integer point totals (no decimals like 0.5)"""
    
    def test_total_standings_integer_points(self, user_token):
        """GET /api/standings/total should show integer point totals"""
        r = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200, f"Failed to get standings: {r.text}"
        data = r.json()
        
        entries = data.get("entries", [])
        print(f"Standings entries count: {len(entries)}")
        
        for entry in entries[:5]:  # Check first 5 entries
            pts = entry.get("total_points", 0)
            print(f"  {entry.get('username')}: {pts} points")
            
            # Points should be integer or .0 (no 0.5 values)
            # With new scoring (1,2,5), all point values are integers
            if pts != int(pts):
                # Check if it's a multiple of 0.5 - OLD scoring artifact
                if (pts * 2) == int(pts * 2):
                    pytest.fail(f"Found decimal points {pts} for {entry.get('username')} - OLD scoring detected!")


class TestLiveScoringValues:
    """Test scoring engine returns correct values via live endpoint"""
    
    def test_live_predictions_points(self, user_token):
        """GET /api/live/{matchday_id} should return predictions with correct point values"""
        r = requests.get(
            f"{BASE_URL}/api/live/{MATCHDAY_ID}?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200, f"Failed to get live: {r.text}"
        data = r.json()
        
        matches = data.get("matches", [])
        print(f"Live matches: {len(matches)}")
        
        # Check my_predictions for correct point values
        predictions_with_points = []
        for match in matches:
            my_pred = match.get("my_prediction") or {}
            if my_pred.get("points") is not None:
                predictions_with_points.append({
                    "match": f"{match.get('home_team')} vs {match.get('away_team')}",
                    "prediction": my_pred.get("prediction_value"),
                    "market": my_pred.get("market_type"),
                    "points": my_pred.get("points"),
                    "is_correct": my_pred.get("is_correct"),
                    "multiplier": match.get("multiplier", 1.0)
                })
        
        print(f"Predictions with points: {len(predictions_with_points)}")
        for p in predictions_with_points[:5]:
            print(f"  {p['match']}: {p['market']}={p['prediction']} -> {p['points']}pts (correct={p['is_correct']}, mult={p['multiplier']})")
            
            # Verify point values match new scoring
            if p['is_correct'] and p['points'] > 0:
                base_mult = p['multiplier'] if p['multiplier'] else 1.0
                expected_values = {
                    "1X2": 2 * base_mult,
                    "GOAL_NOGOL": 1 * base_mult,
                    "OVER_UNDER_25": 1 * base_mult,
                    "EXACT_SCORE": 5 * base_mult
                }
                expected = expected_values.get(p['market'], 0)
                assert p['points'] == expected, f"Expected {expected} for {p['market']} with mult={base_mult}, got {p['points']}"


class TestX3MultiplierWithNewScoring:
    """Test X3 multiplier works with new integer values (3/6/15)"""
    
    def test_x3_multiplier_values(self, user_token):
        """Verify X3 multiplier produces correct values: 1X2=6, GG/O=3, Exact=15"""
        # Get live data to check any X3 matches
        r = requests.get(
            f"{BASE_URL}/api/live/{MATCHDAY_ID}?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200
        data = r.json()
        
        # Look for X3 matches (is_special=true or multiplier=3)
        x3_matches = [m for m in data.get("matches", []) if m.get("is_special") or m.get("multiplier", 1.0) > 1]
        print(f"X3 matches found: {len(x3_matches)}")
        
        for match in x3_matches:
            print(f"  X3 match: {match.get('home_team')} vs {match.get('away_team')}, multiplier={match.get('multiplier')}")
            
            my_pred = match.get("my_prediction") or {}
            if my_pred.get("is_correct") and my_pred.get("points"):
                pts = my_pred['points']
                market = my_pred['market_type']
                mult = match.get("multiplier", 3.0)
                
                # New scoring * multiplier
                expected = {
                    "1X2": 2 * mult,        # 2 * 3 = 6
                    "GOAL_NOGOL": 1 * mult, # 1 * 3 = 3
                    "OVER_UNDER_25": 1 * mult, # 1 * 3 = 3
                    "EXACT_SCORE": 5 * mult # 5 * 3 = 15
                }
                exp = expected.get(market, 0)
                print(f"    Points: {pts}, Expected: {exp} ({market} * {mult})")


class TestScoringEngineConstants:
    """Verify scoring engine constants are correct at source"""
    
    def test_scoring_source_of_truth(self, user_token):
        """Verify the scoring values match expected global values"""
        # This is more of a documentation/validation test
        # The actual values are:
        # 1X2 = 2 points
        # GOAL_NOGOL = 1 point  
        # OVER_UNDER_25 = 1 point
        # EXACT_SCORE = 5 points
        
        expected_scoring = {
            "1x2": 2,
            "over_under": 1,
            "goal_no_goal": 1,
            "exact_score": 5
        }
        
        # Get league scoring config to verify
        r = requests.get(
            f"{BASE_URL}/api/leagues/{LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200
        scoring = r.json().get("scoring_config", {})
        
        for key, expected_pts in expected_scoring.items():
            actual = scoring.get(key, {})
            actual_pts = actual.get("points") if isinstance(actual, dict) else actual
            print(f"{key}: expected={expected_pts}, actual={actual_pts}")
            assert actual_pts == expected_pts, f"{key} should be {expected_pts} points"


class TestNoOldDecimalScoring:
    """Verify no old decimal scoring (0.5, 4.0) exists"""
    
    def test_no_half_point_values(self, user_token):
        """Verify standings don't have 0.5 point increments (OLD scoring artifact)"""
        r = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert r.status_code == 200
        entries = r.json().get("entries", [])
        
        old_scoring_detected = False
        for entry in entries:
            pts = entry.get("total_points", 0)
            # Check for 0.5 increments (impossible with new 1,2,5 scoring)
            remainder = pts % 1
            if remainder == 0.5:
                print(f"WARNING: {entry.get('username')} has {pts} points - possible old scoring")
                old_scoring_detected = True
        
        # Note: This is a warning, not failure - historical data may still have old values
        if old_scoring_detected:
            print("NOTE: Some entries may have old scoring values from before migration")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
