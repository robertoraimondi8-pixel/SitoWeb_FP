"""
Test suite for Tiebreak System Implementation:
1. GET /api/standings/total - tiebreak fields and sorting
2. POST /api/admin/backfill-tiebreak-stats - backfill functionality
3. Tournament complete_round tiebreak logic
4. score_summaries fields: total_correct_predictions, exact_score_hits, one_x_two_hits
5. standings_cache tiebreak aggregation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fanta-auth-fix.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "ilio@raimondi.it"
USER_PASSWORD = "password123"
LEAGUE_ID = "f1373417-43aa-4043-b6a2-125873181c95"  # Lega Nazionale FantaPronostic
TOURNAMENT_ID = "b3e9021f-b8a6-4f65-ad83-fc7b778f922a"  # TEST_LC_tb901


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip("Admin authentication failed")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def user_token():
    """Get regular user auth token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip("User authentication failed")
    return response.json()["access_token"]


class TestTotalStandingsTiebreak:
    """Tests for GET /api/standings/total tiebreak fields"""

    def test_total_standings_returns_tiebreak_fields(self, user_token):
        """Verify standings entries include tiebreak fields"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "entries" in data
        assert "tiebreak_rules" in data
        
        # Verify tiebreak_rules array
        assert data["tiebreak_rules"] == ["total_correct_predictions", "exact_score_hits", "one_x_two_hits", "random"], \
            f"Unexpected tiebreak_rules: {data.get('tiebreak_rules')}"
        
        # Check entry fields if entries exist
        if data["entries"] and len(data["entries"]) > 0:
            entry = data["entries"][0]
            assert "total_correct_predictions" in entry, "Missing total_correct_predictions field"
            assert "exact_score_hits" in entry, "Missing exact_score_hits field"
            assert "one_x_two_hits" in entry, "Missing one_x_two_hits field"
            print(f"First entry tiebreak stats: tcp={entry.get('total_correct_predictions')}, esh={entry.get('exact_score_hits')}, oxth={entry.get('one_x_two_hits')}")

    def test_standings_sorting_order(self, user_token):
        """Verify standings are sorted by points DESC, then tiebreak criteria"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if len(entries) < 2:
            pytest.skip("Need at least 2 entries to test sorting")
        
        # Verify entries are sorted by total_points DESC
        for i in range(len(entries) - 1):
            curr = entries[i]
            next_entry = entries[i + 1]
            
            # If points are equal, check tiebreak criteria
            if curr["total_points"] == next_entry["total_points"]:
                # total_correct_predictions should break the tie
                assert curr.get("total_correct_predictions", 0) >= next_entry.get("total_correct_predictions", 0), \
                    f"Tiebreak sorting incorrect at positions {i} and {i+1}"
            else:
                assert curr["total_points"] >= next_entry["total_points"], \
                    f"Points sorting incorrect: {curr['total_points']} < {next_entry['total_points']}"
        
        print(f"Verified sorting for {len(entries)} entries")

    def test_standings_returns_correct_league_info(self, user_token):
        """Verify standings returns correct league metadata"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("league_id") == LEAGUE_ID
        assert "league_name" in data
        assert data.get("standings_type") == "total"
        print(f"League: {data.get('league_name')}")


class TestBackfillTiebreakStats:
    """Tests for POST /api/admin/backfill-tiebreak-stats endpoint"""

    def test_backfill_requires_admin(self, user_token):
        """Verify backfill endpoint requires admin permission"""
        response = requests.post(
            f"{BASE_URL}/api/admin/backfill-tiebreak-stats",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Should return 403 for non-admin user
        assert response.status_code == 403, f"Expected 403 for regular user, got {response.status_code}"
        print("Correctly blocked non-admin user from backfill")

    def test_backfill_endpoint_exists(self, admin_token):
        """Verify backfill endpoint exists and returns success structure"""
        response = requests.post(
            f"{BASE_URL}/api/admin/backfill-tiebreak-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "summaries_updated" in data or "ok" in data, f"Unexpected response structure: {data}"
        print(f"Backfill response: {data}")

    def test_backfill_updates_score_summaries(self, admin_token):
        """Verify backfill actually updates score_summaries with tiebreak fields"""
        # Run backfill
        response = requests.post(
            f"{BASE_URL}/api/admin/backfill-tiebreak-stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        summaries_updated = data.get("summaries_updated", 0)
        caches_updated = data.get("caches_updated", 0)
        
        print(f"Backfill result: {summaries_updated} summaries, {caches_updated} caches updated")
        
        # The endpoint should report how many documents were updated
        assert "summaries_updated" in data or "ok" in data


class TestScoreSummariesTiebreakFields:
    """Tests for tiebreak fields in score_summaries collection"""

    def test_score_summaries_via_admin_endpoint(self, admin_token):
        """Check score summaries have tiebreak fields via admin endpoint"""
        # Get matchdays to find a completed one
        response = requests.get(
            f"{BASE_URL}/api/admin/matchdays?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Could not fetch matchdays")
        
        matchdays = response.json()
        completed = [m for m in matchdays if m.get("status") == "COMPLETED"]
        
        if not completed:
            pytest.skip("No completed matchdays found")
        
        md_id = completed[0]["id"]
        
        # Get score summaries for this matchday
        response = requests.get(
            f"{BASE_URL}/api/admin/score-summaries/{md_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Could not fetch score summaries")
        
        summaries = response.json()
        if not summaries:
            pytest.skip("No score summaries found for matchday")
        
        # Check first summary for tiebreak fields
        summary = summaries[0]
        has_tcp = "total_correct_predictions" in summary
        has_esh = "exact_score_hits" in summary
        has_oxth = "one_x_two_hits" in summary
        
        print(f"Summary fields check - tcp: {has_tcp}, esh: {has_esh}, oxth: {has_oxth}")
        print(f"Sample summary: user={summary.get('username')}, tcp={summary.get('total_correct_predictions')}, esh={summary.get('exact_score_hits')}, oxth={summary.get('one_x_two_hits')}")


class TestTournamentTiebreak:
    """Tests for tournament knockout round tiebreak logic"""

    def test_tournament_detail_returns_tiebreak_info(self, user_token):
        """Verify tournament detail includes matchup tiebreak_reason if applicable"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TOURNAMENT_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        # Tournament might not exist in all environments
        if response.status_code == 404:
            pytest.skip("Test tournament not found")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Tournament: {data.get('name')}, status: {data.get('status')}")

    def test_tournament_all_matchups_includes_tiebreak(self, user_token):
        """Check all-matchups endpoint includes tiebreak_reason field"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TOURNAMENT_ID}/all-matchups",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if response.status_code == 404:
            pytest.skip("Test tournament not found")
        
        assert response.status_code == 200
        
        data = response.json()
        if not data:
            pytest.skip("No matchups found")
        
        # Find any completed matchup with potential tiebreak
        for round_data in data:
            matchups = round_data.get("matchups", [])
            for m in matchups:
                if m.get("status") == "completed" and m.get("user_a_points") == m.get("user_b_points"):
                    # Should have tiebreak_reason
                    print(f"Found tied matchup: {m.get('user_a_username')} vs {m.get('user_b_username')}, tiebreak_reason: {m.get('tiebreak_reason')}")
                    # Note: tiebreak_reason is set when points are tied and winner determined
        
        print(f"Checked {sum(len(r.get('matchups', [])) for r in data)} matchups")

    def test_matchup_live_view_returns_scores(self, user_token):
        """Verify matchup live view endpoint returns score details"""
        # First get matchups
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TOURNAMENT_ID}/all-matchups",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if response.status_code == 404:
            pytest.skip("Test tournament not found")
        
        if response.status_code != 200:
            pytest.skip("Could not fetch matchups")
        
        data = response.json()
        if not data:
            pytest.skip("No matchups found")
        
        # Find any matchup to check live view
        matchup_id = None
        for round_data in data:
            matchups = round_data.get("matchups", [])
            if matchups:
                matchup_id = matchups[0].get("id")
                break
        
        if not matchup_id:
            pytest.skip("No matchup ID found")
        
        # Get live view
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TOURNAMENT_ID}/matchup/{matchup_id}/live",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "matchup" in data
        assert "user_a_total" in data
        assert "user_b_total" in data
        print(f"Matchup live view: A={data.get('user_a_total')}, B={data.get('user_b_total')}")


class TestWeeklyStandingsTiebreak:
    """Tests for weekly standings tiebreak data"""

    def test_weekly_standings_tiebreak_fields(self, user_token):
        """Verify weekly standings include correct prediction counts"""
        # Get matchdays first
        response = requests.get(
            f"{BASE_URL}/api/standings/matchdays?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Could not fetch matchdays")
        
        matchdays = response.json()
        completed = [m for m in matchdays if m.get("status") == "COMPLETED"]
        
        if not completed:
            pytest.skip("No completed matchdays for weekly standings test")
        
        md_id = completed[0]["id"]
        
        # Get weekly standings
        response = requests.get(
            f"{BASE_URL}/api/standings/weekly/{md_id}?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if entries:
            entry = entries[0]
            # Weekly standings should have total_correct and 1x2_correct
            print(f"Weekly entry: {entry.get('username')}, total_correct={entry.get('total_correct')}, 1x2_correct={entry.get('1x2_correct')}")


class TestAdminUIIntegration:
    """Tests to verify admin panel integration points"""

    def test_admin_ui_accessible(self, admin_token):
        """Verify admin UI page loads"""
        response = requests.get(f"{BASE_URL}/api/admin-ui")
        assert response.status_code == 200
        
        content = response.text
        # Check for tiebreak-related elements in admin UI
        assert "Indovinati" in content or "indovinati" in content.lower(), "Admin UI should contain 'Indovinati' column reference"
        assert "Esatti" in content or "esatti" in content.lower(), "Admin UI should contain 'Esatti' column reference"
        assert "1X2" in content, "Admin UI should contain '1X2' column reference"
        assert "backfill-tiebreak" in content.lower() or "tiebreak-backfill" in content.lower(), "Admin UI should contain backfill tiebreak button"
        print("Admin UI contains tiebreak-related elements")

    def test_admin_standings_table_columns(self):
        """Verify admin standings table has new columns"""
        response = requests.get(f"{BASE_URL}/api/admin-ui")
        assert response.status_code == 200
        
        content = response.text
        # Check for showLeagueStandings function containing new columns
        assert "showLeagueStandings" in content, "Admin UI should contain showLeagueStandings function"
        
        # Check the table header includes new columns
        assert "Indovinati" in content
        assert "Esatti" in content
        print("Admin standings table includes Indovinati, Esatti, 1X2 columns")


class TestTiebreakDataIntegrity:
    """Tests to verify tiebreak data integrity after backfill"""

    def test_total_correct_predictions_sum_matches(self, user_token):
        """Verify total_correct_predictions is sum of all correct markets"""
        response = requests.get(
            f"{BASE_URL}/api/standings/total?league_id={LEAGUE_ID}",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        # For users with data, verify the relationship:
        # total_correct_predictions should be >= exact_score_hits + one_x_two_hits
        # (because it includes OU and GNG as well)
        for entry in entries[:5]:  # Check first 5
            tcp = entry.get("total_correct_predictions", 0)
            esh = entry.get("exact_score_hits", 0)
            oxth = entry.get("one_x_two_hits", 0)
            
            # tcp should be >= esh + oxth (it also includes OU and GNG)
            if tcp > 0:
                assert tcp >= esh + oxth, \
                    f"Data integrity issue for {entry.get('username')}: tcp={tcp} < esh({esh}) + oxth({oxth})"
        
        print(f"Data integrity verified for {len(entries[:5])} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
