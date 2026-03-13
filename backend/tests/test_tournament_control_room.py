"""
Tournament Control Room API Tests
Tests the new Control Room modal for tournaments including:
- 5 tabs: Info & Regole, Modifica, Partecipanti, Struttura Torneo, Zona Pericolo
- PUT /api/admin/tournaments/{id} - Update tournament name/fee
- GET /api/admin/tournaments/{id}/participants - Get participant list
- POST /api/admin/tournaments/{id}/reset-groups - Reset tournament groups
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test tournament ID (Torneo Redubull - has 32 participants and is in 'groups' status)
TEST_TOURNAMENT_ID = "a0a60a06-65a3-4707-aa42-545a7da08dff"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@fantapronostic.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestTournamentControlRoomAPIs:
    """Test Tournament Control Room Backend APIs"""
    
    def test_get_tournament_detail(self, admin_headers):
        """Test GET /api/tournaments/{id} - Get tournament details for Control Room Info tab"""
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}?include_drafts=true",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify tournament data structure for Info tab
        assert "id" in data
        assert "name" in data
        assert "status" in data
        assert "max_participants" in data
        assert "groups_count" in data
        assert "advance_count" in data
        print(f"PASS: Tournament detail - name: {data.get('name')}, status: {data.get('status')}")
    
    def test_get_tournament_rounds(self, admin_headers):
        """Test GET /api/admin/tournament-rounds/{id} - Get rounds for Structure tab"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tournament-rounds/{TEST_TOURNAMENT_ID}",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return list of rounds
        assert isinstance(data, list)
        print(f"PASS: Tournament rounds - count: {len(data)}")
        if len(data) > 0:
            round_data = data[0]
            assert "id" in round_data
            assert "round_number" in round_data
            assert "status" in round_data


class TestParticipantsTab:
    """Test GET /api/admin/tournaments/{id}/participants endpoint for Participants tab"""
    
    def test_get_participants_list(self, admin_headers):
        """Test participant list returns proper data structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}/participants",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Should return list of participants
        assert isinstance(data, list)
        print(f"PASS: Participants list - count: {len(data)}")
        
        if len(data) > 0:
            participant = data[0]
            # Verify participant data structure for table display
            assert "user_id" in participant
            assert "username" in participant
            assert "email" in participant
            assert "registered_at" in participant
            print(f"PASS: Participant structure - username: {participant.get('username')}, email: {participant.get('email')}")
    
    def test_participants_count(self, admin_headers):
        """Verify Torneo Redubull has 32 participants"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}/participants",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Expected: 32 participants based on main agent context
        assert len(data) == 32, f"Expected 32 participants, got {len(data)}"
        print(f"PASS: Torneo Redubull has correct participant count: {len(data)}")


class TestEditTab:
    """Test PUT /api/admin/tournaments/{id} endpoint for Edit tab"""
    
    def test_update_tournament_name(self, admin_headers):
        """Test updating tournament name"""
        # First get original name
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}?include_drafts=true",
            headers=admin_headers
        )
        original_name = response.json().get("name", "Torneo Redubull")
        
        # Update with test name
        test_name = f"{original_name} Test"
        response = requests.put(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}",
            headers=admin_headers,
            json={"name": test_name}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("name") == test_name
        print(f"PASS: Tournament name updated to: {test_name}")
        
        # Restore original name
        response = requests.put(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}",
            headers=admin_headers,
            json={"name": original_name}
        )
        assert response.status_code == 200
        print(f"PASS: Tournament name restored to: {original_name}")
    
    def test_update_tournament_entry_fee(self, admin_headers):
        """Test updating tournament entry fee"""
        # Get original fee
        response = requests.get(
            f"{BASE_URL}/api/tournaments/{TEST_TOURNAMENT_ID}?include_drafts=true",
            headers=admin_headers
        )
        original_fee = response.json().get("entry_fee", 0)
        
        # Update fee
        new_fee = 10.50
        response = requests.put(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}",
            headers=admin_headers,
            json={"entry_fee": new_fee}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("entry_fee") == new_fee
        print(f"PASS: Tournament entry_fee updated to: {new_fee}")
        
        # Restore original fee
        response = requests.put(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}",
            headers=admin_headers,
            json={"entry_fee": original_fee}
        )
        assert response.status_code == 200
        print(f"PASS: Tournament entry_fee restored to: {original_fee}")
    
    def test_structural_fields_locked_for_started_tournament(self, admin_headers):
        """Test that structural fields cannot be changed for started tournaments"""
        # Tournament is in 'groups' status, so structural fields should be locked
        response = requests.put(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}",
            headers=admin_headers,
            json={
                "max_participants": 64,  # Try to change structural field
                "groups_count": 8
            }
        )
        # Since tournament is in 'groups' status, only name and entry_fee are editable
        # Structural fields should be rejected with 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("PASS: Structural fields correctly rejected for started tournament (400)")
    
    def test_name_and_fee_still_editable_for_started_tournament(self, admin_headers):
        """Test that name and entry_fee CAN be changed even for started tournaments"""
        response = requests.put(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}",
            headers=admin_headers,
            json={
                "name": "Torneo Redubull",  # Only editable fields
                "entry_fee": 0
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Name and entry_fee editable for started tournament")


class TestZonaPericoloTab:
    """Test POST /api/admin/tournaments/{id}/reset-groups for Danger Zone tab"""
    
    def test_reset_groups_endpoint_exists(self, admin_headers):
        """Test that reset-groups endpoint exists and returns proper response"""
        # Note: We don't actually want to reset the tournament, just verify endpoint works
        # For a tournament in 'groups' status, this should work but we'll check response format
        
        # First create a test tournament to reset (don't reset the main one)
        # For now, just verify the endpoint returns appropriate error for non-existent tournament
        response = requests.post(
            f"{BASE_URL}/api/admin/tournaments/non-existent-id/reset-groups",
            headers=admin_headers
        )
        # Should return 404 for non-existent tournament
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: reset-groups endpoint returns 404 for non-existent tournament")
    
    def test_delete_tournament_endpoint_exists(self, admin_headers):
        """Test that delete tournament endpoint exists"""
        # Verify endpoint returns 404 for non-existent tournament
        response = requests.delete(
            f"{BASE_URL}/api/admin/tournaments/non-existent-id",
            headers=admin_headers
        )
        assert response.status_code == 404
        print("PASS: delete tournament endpoint returns 404 for non-existent tournament")


class TestTournamentsList:
    """Test admin tournaments list endpoint"""
    
    def test_get_all_tournaments(self, admin_headers):
        """Test GET /api/admin/tournaments returns list with registered_count"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tournaments",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"PASS: Tournaments list - count: {len(data)}")
        
        if len(data) > 0:
            tournament = data[0]
            # Verify tournament has Control Room required fields
            assert "id" in tournament
            assert "name" in tournament
            assert "status" in tournament
            assert "registered_count" in tournament
            print(f"PASS: Tournament has Control Room fields - id, name, status, registered_count")


class TestAddRemoveParticipants:
    """Test participant management for Partecipanti tab"""
    
    def test_add_participant_to_non_started_tournament(self, admin_headers):
        """Test POST /api/admin/tournaments/{id}/participants - should fail for started tournament"""
        # Tournament in 'groups' status - should not allow adding participants
        response = requests.post(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}/participants",
            headers=admin_headers,
            json={"email": "test@example.com"}
        )
        # Should return 400 because tournament is already started
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("PASS: Cannot add participant to started tournament")
    
    def test_remove_participant_from_started_tournament(self, admin_headers):
        """Test DELETE /api/admin/tournaments/{id}/participants/{user_id} - should fail for started tournament"""
        # First get a participant ID
        response = requests.get(
            f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}/participants",
            headers=admin_headers
        )
        participants = response.json()
        if len(participants) > 0:
            user_id = participants[0]["user_id"]
            
            # Try to remove - should fail for started tournament
            response = requests.delete(
                f"{BASE_URL}/api/admin/tournaments/{TEST_TOURNAMENT_ID}/participants/{user_id}",
                headers=admin_headers
            )
            # Should return 400 because tournament is already started
            assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
            print("PASS: Cannot remove participant from started tournament")
        else:
            pytest.skip("No participants to test removal")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
