"""
Test Classifica LIVE Feature - Backend API Tests

Tests cover:
1. Home API returns live_rank, live_points, total_members when matchday is LIVE
2. Weekly standings API returns ALL league members for LIVE matchdays
3. Weekly standings API returns matchday_status field
4. Available matchdays API includes LIVE matchdays
5. User predictions API shows "empty" response for users without predictions
6. Total standings API still works correctly (regression)
7. COMPLETED matchday weekly standings only show users who played (not all members)
8. Multi-league isolation - different leagues show different data
"""
import pytest
import requests
import os

# Use the public URL from frontend environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://palmares-historic.preview.emergentagent.com')

# Test credentials
TEST_USERS = {
    'desiree': {'email': 'desiree@raimondi.it', 'password': 'Roberto95'},
    'admin': {'email': 'admin@fantapronostic.com', 'password': 'admin123'},
    'ilio': {'email': 'ilio@raimondi.it', 'password': 'password123'}
}

# Known IDs
NATIONAL_LEAGUE_ID = 'f1373417-43aa-4043-b6a2-125873181c95'
LIVE_MATCHDAY_ID = '23c88f47-475f-4aa5-8fe8-f13d61d43cbe'
DESYLEGA_ID = '788c822f-325d-4934-87a6-cf989ff68c3e'


@pytest.fixture
def admin_token():
    """Login as admin and return token"""
    res = requests.post(f'{BASE_URL}/api/auth/login', json=TEST_USERS['admin'])
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return res.json()['access_token']


@pytest.fixture
def desiree_token():
    """Login as desiree and return token"""
    res = requests.post(f'{BASE_URL}/api/auth/login', json=TEST_USERS['desiree'])
    assert res.status_code == 200, f"Desiree login failed: {res.text}"
    return res.json()['access_token']


class TestHomeLiveClassifica:
    """Tests for 'Classifica LIVE' box on Home page"""
    
    def test_home_returns_live_rank_and_points(self, admin_token):
        """Home API should return live_rank, live_points, total_members when LIVE"""
        res = requests.get(
            f'{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert res.status_code == 200
        data = res.json()
        
        md = data.get('matchday')
        live = data.get('live')
        
        # Check matchday is LIVE
        if md and md.get('status') == 'LIVE':
            assert live is not None, "live data should be present for LIVE matchday"
            assert 'live_rank' in live, "live_rank should be in response"
            assert 'live_points' in live, "live_points should be in response"
            assert 'total_members' in live, "total_members should be in response"
            
            # Validate values
            assert isinstance(live['live_rank'], int), "live_rank should be integer"
            assert isinstance(live['live_points'], (int, float)), "live_points should be numeric"
            assert live['total_members'] == 10, "National league should have 10 members"
    
    def test_home_multi_league_isolation(self, desiree_token):
        """Home API should return different data for different leagues"""
        # Get home for National League
        res_nat = requests.get(
            f'{BASE_URL}/api/home?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {desiree_token}'}
        )
        assert res_nat.status_code == 200
        nat_data = res_nat.json()
        
        # Get home for Desylega
        res_desy = requests.get(
            f'{BASE_URL}/api/home?league_id={DESYLEGA_ID}',
            headers={'Authorization': f'Bearer {desiree_token}'}
        )
        assert res_desy.status_code == 200
        desy_data = res_desy.json()
        
        # Verify isolation
        assert nat_data['league']['id'] == NATIONAL_LEAGUE_ID
        assert desy_data['league']['id'] == DESYLEGA_ID
        
        # Live data should differ
        if nat_data.get('live') and desy_data.get('live'):
            assert nat_data['live']['total_members'] != desy_data['live']['total_members'], \
                "Different leagues should have different member counts"


class TestWeeklyStandingsLive:
    """Tests for Weekly Standings with LIVE matchdays"""
    
    def test_live_matchday_shows_all_members(self, admin_token):
        """Weekly standings for LIVE matchday should show ALL league members including 0 pts"""
        res = requests.get(
            f'{BASE_URL}/api/standings/weekly/{LIVE_MATCHDAY_ID}?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert res.status_code == 200
        data = res.json()
        
        # Verify matchday is LIVE
        assert data.get('matchday_status') == 'LIVE', "Matchday should be LIVE"
        
        # Verify all 10 members are shown
        entries = data.get('entries', [])
        assert len(entries) == 10, f"LIVE matchday should show all 10 members, got {len(entries)}"
        
        # Verify some have 0 points
        zero_points_users = [e for e in entries if e['matchday_points'] == 0]
        assert len(zero_points_users) > 0, "Should include users with 0 points"
    
    def test_matchday_status_in_response(self, admin_token):
        """Weekly standings should include matchday_status field"""
        res = requests.get(
            f'{BASE_URL}/api/standings/weekly/{LIVE_MATCHDAY_ID}?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert res.status_code == 200
        data = res.json()
        
        assert 'matchday_status' in data, "Response should include matchday_status"
        assert data['matchday_status'] in ['LIVE', 'OPEN', 'COMPLETED', 'DRAFT'], \
            f"matchday_status should be valid, got {data.get('matchday_status')}"


class TestAvailableMatchdays:
    """Tests for available matchdays endpoint"""
    
    def test_includes_live_matchdays(self, admin_token):
        """Available matchdays should include LIVE matchdays"""
        res = requests.get(
            f'{BASE_URL}/api/standings/matchdays?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert res.status_code == 200
        matchdays = res.json()
        
        # Find LIVE matchday
        live_mds = [md for md in matchdays if md.get('status') == 'LIVE']
        assert len(live_mds) >= 1, "Should include at least one LIVE matchday"


class TestUserPredictionsEmptyState:
    """Tests for user predictions empty state"""
    
    def test_user_without_predictions(self, admin_token):
        """User predictions API should handle users without predictions"""
        # First get weekly standings to find user with 0 points
        res = requests.get(
            f'{BASE_URL}/api/standings/weekly/{LIVE_MATCHDAY_ID}?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert res.status_code == 200
        entries = res.json().get('entries', [])
        
        # Find a user with 0 points
        zero_user = None
        for e in entries:
            if e['matchday_points'] == 0:
                zero_user = e
                break
        
        if zero_user:
            # Get their predictions
            pred_res = requests.get(
                f'{BASE_URL}/api/predictions/user/{zero_user["user_id"]}/{LIVE_MATCHDAY_ID}?league_id={NATIONAL_LEAGUE_ID}',
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            assert pred_res.status_code == 200
            pred_data = pred_res.json()
            
            # Verify response structure
            assert 'username' in pred_data
            assert 'predictions' in pred_data
            assert pred_data['total_points'] == 0
            
            # Check if predictions are empty or have no actual values
            preds = pred_data.get('predictions', [])
            has_actual_predictions = any(p.get('prediction_value') for p in preds)
            assert not has_actual_predictions, "User with 0 pts should have no actual predictions"


class TestRegressionTotalStandings:
    """Regression tests for total standings"""
    
    def test_total_standings_still_works(self, admin_token):
        """Total standings should still return correct data"""
        res = requests.get(
            f'{BASE_URL}/api/standings/total?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert res.status_code == 200
        data = res.json()
        
        assert 'entries' in data
        assert len(data['entries']) > 0, "Total standings should have entries"
        
        # Verify structure
        first = data['entries'][0]
        assert 'rank' in first
        assert 'username' in first
        assert 'total_points' in first


class TestCompletedMatchdayRegression:
    """Regression tests for COMPLETED matchday behavior"""
    
    def test_completed_matchday_shows_only_players(self, admin_token):
        """COMPLETED matchday weekly standings should only show users who played"""
        # Get available matchdays to find a COMPLETED one
        mds_res = requests.get(
            f'{BASE_URL}/api/standings/matchdays?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert mds_res.status_code == 200
        matchdays = mds_res.json()
        
        # Find a COMPLETED matchday
        completed_md = None
        for md in matchdays:
            if md.get('status') == 'COMPLETED':
                completed_md = md
                break
        
        if completed_md:
            # Get weekly standings
            weekly_res = requests.get(
                f'{BASE_URL}/api/standings/weekly/{completed_md["id"]}?league_id={NATIONAL_LEAGUE_ID}',
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            assert weekly_res.status_code == 200
            weekly = weekly_res.json()
            
            # COMPLETED matchdays should NOT show all 10 members
            # They should only show users who actually played
            entries_count = len(weekly.get('entries', []))
            assert entries_count < 10, \
                f"COMPLETED matchday should only show players, got {entries_count} (expected < 10)"


class TestMultiLeagueIsolation:
    """Tests for multi-league data isolation"""
    
    def test_weekly_standings_isolated_by_league(self, desiree_token):
        """Weekly standings should show different data for different leagues"""
        # National league
        res_nat = requests.get(
            f'{BASE_URL}/api/standings/weekly/{LIVE_MATCHDAY_ID}?league_id={NATIONAL_LEAGUE_ID}',
            headers={'Authorization': f'Bearer {desiree_token}'}
        )
        assert res_nat.status_code == 200
        nat_data = res_nat.json()
        
        # Desylega
        res_desy = requests.get(
            f'{BASE_URL}/api/standings/weekly/{LIVE_MATCHDAY_ID}?league_id={DESYLEGA_ID}',
            headers={'Authorization': f'Bearer {desiree_token}'}
        )
        assert res_desy.status_code == 200
        desy_data = res_desy.json()
        
        # Verify isolation
        assert nat_data['league_id'] == NATIONAL_LEAGUE_ID
        assert desy_data['league_id'] == DESYLEGA_ID
        
        # Different member counts
        assert len(nat_data['entries']) != len(desy_data['entries']), \
            "Different leagues should have different entry counts"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
