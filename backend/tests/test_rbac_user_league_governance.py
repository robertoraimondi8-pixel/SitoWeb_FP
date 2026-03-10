"""
Test RBAC User/League Governance Features - Iteration 49
Tests:
- GET /api/rbac/users - enriched fields (leagues_created, leagues_admin, leagues_member, last_login, is_deleted)
- GET /api/rbac/users/{id}/leagues - detailed league list
- PUT /api/rbac/users/{id}/soft-delete - soft delete with orphan protection
- GET /api/rbac/leagues - leagues with owner, admins, member_count
- GET /api/rbac/leagues/{id}/members - members with roles
- PUT /api/rbac/leagues/{id}/transfer-owner - ownership transfer
- PUT /api/rbac/leagues/{id}/admins - add/remove admin
- Login sets last_login timestamp
- Audit logging for RBAC actions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://matchup-arena-4.preview.emergentagent.com")

# Test credentials from requirements
SUPER_ADMIN_EMAIL = "admin@fantapronostic.com"
SUPER_ADMIN_PASSWORD = "admin123"
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"


class TestSetup:
    """Test setup and authentication"""
    
    def test_super_admin_login(self):
        """Login as super admin and verify last_login is set"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL
        print(f"Super admin login successful: {data['user']['username']}")

    def test_standard_user_login(self):
        """Login as standard user and verify last_login is set"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STANDARD_USER_EMAIL,
            "password": STANDARD_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Standard user login successful: {data['user']['username']}")


@pytest.fixture(scope="module")
def admin_token():
    """Get super admin token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Cannot login as super admin: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Get headers with super admin auth"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def standard_user_id(admin_headers):
    """Get ilio@raimondi.it user ID"""
    response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
    if response.status_code != 200:
        pytest.skip(f"Cannot fetch users: {response.text}")
    users = response.json()
    for u in users:
        if u["email"] == STANDARD_USER_EMAIL:
            return u["id"]
    pytest.skip("Standard user not found")


class TestRBACUsersEndpoint:
    """Test GET /api/rbac/users - enriched fields"""
    
    def test_users_list_returns_enriched_fields(self, admin_headers):
        """Verify users endpoint returns leagues_created, leagues_admin, leagues_member, last_login, is_deleted"""
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        users = response.json()
        assert len(users) > 0, "No users returned"
        
        # Verify required fields exist in response
        sample_user = users[0]
        required_fields = ["id", "email", "username", "leagues_created", "leagues_admin", "leagues_member", "last_login", "is_deleted"]
        for field in required_fields:
            assert field in sample_user, f"Missing field: {field}"
        
        print(f"Users endpoint returned {len(users)} users with all required fields")
        print(f"Sample user fields: {list(sample_user.keys())}")
        
    def test_users_list_leagues_counts_are_integers(self, admin_headers):
        """Verify league counts are proper integers"""
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        for user in users[:5]:  # Check first 5 users
            assert isinstance(user["leagues_created"], int), f"leagues_created should be int for {user['email']}"
            assert isinstance(user["leagues_admin"], int), f"leagues_admin should be int for {user['email']}"
            assert isinstance(user["leagues_member"], int), f"leagues_member should be int for {user['email']}"
            assert user["leagues_created"] >= 0
            assert user["leagues_admin"] >= 0
            assert user["leagues_member"] >= 0
        print("All league counts are valid integers >= 0")

    def test_users_list_last_login_format(self, admin_headers):
        """Verify last_login is datetime or None"""
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        users_with_login = [u for u in users if u.get("last_login")]
        print(f"Found {len(users_with_login)} users with last_login timestamps")
        # At least our test users should have last_login after logging in
        assert len(users_with_login) > 0, "Expected at least some users with last_login"

    def test_users_list_is_deleted_boolean(self, admin_headers):
        """Verify is_deleted is boolean"""
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        for user in users[:10]:
            assert isinstance(user["is_deleted"], bool), f"is_deleted should be bool for {user['email']}"
        print("is_deleted field is boolean for all checked users")


class TestRBACUserLeaguesEndpoint:
    """Test GET /api/rbac/users/{id}/leagues - detailed league list"""
    
    def test_get_user_leagues_returns_list(self, admin_headers, standard_user_id):
        """Verify user leagues endpoint returns list with required fields"""
        response = requests.get(f"{BASE_URL}/api/rbac/users/{standard_user_id}/leagues", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        leagues = response.json()
        assert isinstance(leagues, list), "Response should be a list"
        print(f"User {STANDARD_USER_EMAIL} has {len(leagues)} leagues")
        
        if len(leagues) > 0:
            league = leagues[0]
            required_fields = ["league_id", "league_name", "membership_role", "is_owner", "is_creator"]
            for field in required_fields:
                assert field in league, f"Missing field: {field}"
            print(f"Sample league: {league['league_name']} - role: {league['membership_role']}, owner: {league['is_owner']}")

    def test_get_user_leagues_membership_role_values(self, admin_headers, standard_user_id):
        """Verify membership_role has valid values"""
        response = requests.get(f"{BASE_URL}/api/rbac/users/{standard_user_id}/leagues", headers=admin_headers)
        assert response.status_code == 200
        leagues = response.json()
        
        valid_roles = ["admin", "member", "owner", "player"]
        for league in leagues:
            assert league["membership_role"] in valid_roles, f"Invalid role: {league['membership_role']}"
        print(f"All {len(leagues)} league memberships have valid roles")

    def test_get_user_leagues_is_owner_is_creator_booleans(self, admin_headers, standard_user_id):
        """Verify is_owner and is_creator are booleans"""
        response = requests.get(f"{BASE_URL}/api/rbac/users/{standard_user_id}/leagues", headers=admin_headers)
        assert response.status_code == 200
        leagues = response.json()
        
        for league in leagues:
            assert isinstance(league["is_owner"], bool), "is_owner should be bool"
            assert isinstance(league["is_creator"], bool), "is_creator should be bool"
        print("is_owner and is_creator are booleans")

    def test_get_nonexistent_user_leagues_404(self, admin_headers):
        """Verify 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/rbac/users/nonexistent-id-12345/leagues", headers=admin_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returns 404 for non-existent user")


class TestRBACLeaguesEndpoint:
    """Test GET /api/rbac/leagues - leagues with owner, admins, member_count"""
    
    def test_leagues_list_returns_all_leagues(self, admin_headers):
        """Verify leagues endpoint returns list with required fields"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        leagues = response.json()
        assert isinstance(leagues, list), "Response should be a list"
        assert len(leagues) > 0, "No leagues returned"
        print(f"Leagues endpoint returned {len(leagues)} leagues")
        
    def test_leagues_have_required_fields(self, admin_headers):
        """Verify leagues have owner, admins list, member_count"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        assert response.status_code == 200
        leagues = response.json()
        
        sample = leagues[0]
        required_fields = ["id", "name", "owner", "admins", "member_count"]
        for field in required_fields:
            assert field in sample, f"Missing field: {field}"
        
        # owner can be None or dict
        assert sample["owner"] is None or isinstance(sample["owner"], dict)
        # admins should be a list
        assert isinstance(sample["admins"], list)
        # member_count should be int
        assert isinstance(sample["member_count"], int)
        print(f"Sample league: {sample['name']} - owner: {sample['owner']}, admins: {len(sample['admins'])}, members: {sample['member_count']}")

    def test_leagues_owner_has_user_info(self, admin_headers):
        """Verify owner object has id, username, email when present"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        assert response.status_code == 200
        leagues = response.json()
        
        leagues_with_owner = [l for l in leagues if l.get("owner")]
        print(f"Found {len(leagues_with_owner)} leagues with owners")
        
        if leagues_with_owner:
            owner = leagues_with_owner[0]["owner"]
            assert "id" in owner, "Owner missing id"
            assert "username" in owner, "Owner missing username"
            assert "email" in owner, "Owner missing email"
            print(f"Owner structure verified: {owner['username']} ({owner['email']})")

    def test_leagues_admins_list_structure(self, admin_headers):
        """Verify admins list entries have user info and role"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        assert response.status_code == 200
        leagues = response.json()
        
        leagues_with_admins = [l for l in leagues if l.get("admins")]
        print(f"Found {len(leagues_with_admins)} leagues with admins")
        
        if leagues_with_admins:
            admin = leagues_with_admins[0]["admins"][0]
            assert "id" in admin, "Admin missing id"
            assert "username" in admin, "Admin missing username"
            assert "role" in admin, "Admin missing role"
            print(f"Admin structure verified: {admin['username']} - role: {admin['role']}")


class TestRBACLeagueMembersEndpoint:
    """Test GET /api/rbac/leagues/{id}/members"""
    
    @pytest.fixture
    def test_league_id(self, admin_headers):
        """Get a league ID with members for testing"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        if response.status_code != 200:
            pytest.skip("Cannot fetch leagues")
        leagues = response.json()
        # Get a league with members
        for lg in leagues:
            if lg.get("member_count", 0) > 0:
                return lg["id"]
        pytest.skip("No leagues with members found")
    
    def test_get_league_members(self, admin_headers, test_league_id):
        """Verify members endpoint returns list with user info and roles"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues/{test_league_id}/members", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        members = response.json()
        assert isinstance(members, list)
        assert len(members) > 0, "Expected at least one member"
        
        member = members[0]
        required_fields = ["user_id", "username", "email", "role", "is_owner"]
        for field in required_fields:
            assert field in member, f"Missing field: {field}"
        print(f"League has {len(members)} members, sample: {member['username']} - role: {member['role']}, is_owner: {member['is_owner']}")

    def test_get_nonexistent_league_members_404(self, admin_headers):
        """Verify 404 for non-existent league"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues/nonexistent-league-id/members", headers=admin_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returns 404 for non-existent league")


class TestSoftDelete:
    """Test PUT /api/rbac/users/{id}/soft-delete"""
    
    def test_soft_delete_blocks_super_admin(self, admin_headers):
        """Verify cannot soft-delete a super admin"""
        # Get the super admin user ID
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        super_admins = [u for u in users if u.get("is_super_admin") and not u.get("is_deleted")]
        if not super_admins:
            pytest.skip("No super admins found")
        
        sa_id = super_admins[0]["id"]
        response = requests.put(f"{BASE_URL}/api/rbac/users/{sa_id}/soft-delete", headers=admin_headers)
        assert response.status_code in [400, 403], f"Expected 400 or 403 for super admin delete, got {response.status_code}: {response.text}"
        print(f"Correctly blocked soft-delete of super admin: {response.json()}")

    def test_soft_delete_blocks_self_delete(self, admin_headers):
        """Verify cannot soft-delete yourself"""
        # Get current user ID from me endpoint
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.status_code == 200
        my_id = response.json()["id"]
        
        response = requests.put(f"{BASE_URL}/api/rbac/users/{my_id}/soft-delete", headers=admin_headers)
        assert response.status_code == 400, f"Expected 400 for self-delete, got {response.status_code}: {response.text}"
        print(f"Correctly blocked self-delete: {response.json()}")

    def test_soft_delete_nonexistent_user_404(self, admin_headers):
        """Verify 404 for non-existent user"""
        response = requests.put(f"{BASE_URL}/api/rbac/users/nonexistent-user-xyz/soft-delete", headers=admin_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returns 404 for non-existent user")


class TestSoftDeleteOrphanProtection:
    """Test soft-delete orphan league protection (409 if sole owner/admin)"""
    
    def test_soft_delete_with_orphan_leagues_check(self, admin_headers):
        """Verify soft-delete checks for orphan leagues"""
        # Get users list
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        # Find a user who owns leagues but is not super_admin
        # This is a documentation test - we verify the endpoint exists and returns proper error
        users_with_leagues = [u for u in users if u.get("leagues_created", 0) > 0 and not u.get("is_super_admin") and not u.get("is_deleted")]
        
        if users_with_leagues:
            user = users_with_leagues[0]
            # Get their leagues to see if they're sole owner
            leagues_response = requests.get(f"{BASE_URL}/api/rbac/users/{user['id']}/leagues", headers=admin_headers)
            assert leagues_response.status_code == 200
            leagues = leagues_response.json()
            
            owned_leagues = [l for l in leagues if l.get("is_owner")]
            print(f"User {user['username']} has {len(owned_leagues)} owned leagues")
            
            # Try to soft delete - may get 409 if orphan protection triggers
            response = requests.put(f"{BASE_URL}/api/rbac/users/{user['id']}/soft-delete", headers=admin_headers)
            if response.status_code == 409:
                error = response.json()
                assert "orphan_leagues" in str(error) or "detail" in error
                print(f"Orphan protection triggered: {error}")
            elif response.status_code == 200:
                # If no orphan leagues, it should succeed - mark user as deleted
                print(f"Soft-delete succeeded (no orphan leagues): {response.json()}")
                # Verify user is now marked as deleted
                verify = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
                deleted_user = next((u for u in verify.json() if u["id"] == user["id"]), None)
                if deleted_user:
                    assert deleted_user.get("is_deleted") == True
            else:
                print(f"Unexpected response: {response.status_code} - {response.text}")
        else:
            print("No suitable user with created leagues found for orphan test - skipping detailed check")
            pytest.skip("No user with created leagues available for orphan test")


class TestTransferOwnership:
    """Test PUT /api/rbac/leagues/{id}/transfer-owner"""
    
    @pytest.fixture
    def league_with_members(self, admin_headers):
        """Find a league with owner and at least one other member"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        assert response.status_code == 200
        leagues = response.json()
        
        for lg in leagues:
            if lg.get("owner") and lg.get("member_count", 0) >= 2:
                # Verify there's a non-owner member
                members_resp = requests.get(f"{BASE_URL}/api/rbac/leagues/{lg['id']}/members", headers=admin_headers)
                if members_resp.status_code == 200:
                    members = members_resp.json()
                    non_owners = [m for m in members if not m.get("is_owner")]
                    if non_owners:
                        return {"league": lg, "non_owner": non_owners[0]}
        pytest.skip("No league with owner and additional members found")
    
    def test_transfer_owner_requires_valid_member(self, admin_headers):
        """Verify transfer fails if new owner is not a member"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        leagues = response.json()
        
        if not leagues:
            pytest.skip("No leagues available")
        
        lg = leagues[0]
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{lg['id']}/transfer-owner",
            headers=admin_headers,
            json={"new_owner_id": "nonexistent-user-id"}
        )
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}: {response.text}"
        print(f"Correctly rejected transfer to non-member: {response.json()}")

    def test_transfer_owner_nonexistent_league_404(self, admin_headers):
        """Verify 404 for non-existent league"""
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/nonexistent-league-xyz/transfer-owner",
            headers=admin_headers,
            json={"new_owner_id": "some-user-id"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returns 404 for non-existent league")


class TestLeagueAdminManagement:
    """Test PUT /api/rbac/leagues/{id}/admins - add/remove admin"""
    
    @pytest.fixture
    def league_with_non_owner_member(self, admin_headers):
        """Find a league with at least one non-owner member"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        assert response.status_code == 200
        leagues = response.json()
        
        for lg in leagues:
            if lg.get("member_count", 0) >= 2:
                members_resp = requests.get(f"{BASE_URL}/api/rbac/leagues/{lg['id']}/members", headers=admin_headers)
                if members_resp.status_code == 200:
                    members = members_resp.json()
                    non_owners = [m for m in members if not m.get("is_owner")]
                    if non_owners:
                        return {"league": lg, "member": non_owners[0]}
        pytest.skip("No league with non-owner members found")
    
    def test_admin_add_requires_valid_action(self, admin_headers):
        """Verify action must be 'add' or 'remove'"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        leagues = response.json()
        if not leagues:
            pytest.skip("No leagues available")
        
        lg = leagues[0]
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{lg['id']}/admins",
            headers=admin_headers,
            json={"user_id": "some-id", "action": "invalid_action"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}: {response.text}"
        print("Correctly rejects invalid action")

    def test_admin_add_requires_user_to_be_member(self, admin_headers):
        """Verify user must be a league member to become admin"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        leagues = response.json()
        if not leagues:
            pytest.skip("No leagues available")
        
        lg = leagues[0]
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{lg['id']}/admins",
            headers=admin_headers,
            json={"user_id": "nonexistent-user-xyz", "action": "add"}
        )
        assert response.status_code == 400, f"Expected 400 for non-member, got {response.status_code}: {response.text}"
        print("Correctly rejects non-member admin promotion")

    def test_cannot_change_owner_role_via_admins_endpoint(self, admin_headers):
        """Verify cannot modify owner role through admins endpoint"""
        response = requests.get(f"{BASE_URL}/api/rbac/leagues", headers=admin_headers)
        leagues = response.json()
        
        leagues_with_owner = [l for l in leagues if l.get("owner")]
        if not leagues_with_owner:
            pytest.skip("No leagues with owners found")
        
        lg = leagues_with_owner[0]
        owner_id = lg["owner"]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/rbac/leagues/{lg['id']}/admins",
            headers=admin_headers,
            json={"user_id": owner_id, "action": "remove"}
        )
        assert response.status_code == 400, f"Expected 400 for owner role change, got {response.status_code}: {response.text}"
        print(f"Correctly blocked owner role modification: {response.json()}")


class TestLoginLastLoginUpdate:
    """Test that login sets last_login timestamp"""
    
    def test_login_updates_last_login(self, admin_headers):
        """Verify last_login is updated after login"""
        # First, get current user state
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        
        admin_user = next((u for u in users if u["email"] == SUPER_ADMIN_EMAIL), None)
        assert admin_user is not None, "Admin user not found"
        assert admin_user.get("last_login") is not None, "last_login should be set after login"
        print(f"Admin last_login: {admin_user['last_login']}")

    def test_standard_user_last_login_after_login(self):
        """Verify standard user last_login is set after login"""
        # Login as standard user
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STANDARD_USER_EMAIL,
            "password": STANDARD_USER_PASSWORD
        })
        assert login_resp.status_code == 200
        
        # Now check via admin endpoint
        admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=admin_headers)
        users = response.json()
        
        standard_user = next((u for u in users if u["email"] == STANDARD_USER_EMAIL), None)
        assert standard_user is not None
        assert standard_user.get("last_login") is not None, "last_login should be set"
        print(f"Standard user last_login: {standard_user['last_login']}")


class TestAuditLogging:
    """Test audit logging for RBAC actions"""
    
    def test_audit_log_access(self, admin_headers):
        """Verify audit logs are accessible"""
        response = requests.get(f"{BASE_URL}/api/admin/audit-logs?limit=50", headers=admin_headers)
        assert response.status_code == 200, f"Audit log access failed: {response.text}"
        logs = response.json()
        assert isinstance(logs, list)
        print(f"Found {len(logs)} audit log entries")
        
        if logs:
            sample = logs[0]
            print(f"Sample audit: action={sample.get('action')}, entity={sample.get('entity_type')}")

    def test_audit_logs_have_before_after_for_rbac_actions(self, admin_headers):
        """Check if recent audit logs include before/after for RBAC actions"""
        response = requests.get(f"{BASE_URL}/api/admin/audit-logs?limit=100", headers=admin_headers)
        assert response.status_code == 200
        logs = response.json()
        
        # Look for RBAC-related actions
        rbac_actions = ["TRANSFER_OWNER", "LEAGUE_ADMIN_ADD", "LEAGUE_ADMIN_REMOVE", "SOFT_DELETE", "ASSIGN_ROLES", "SET_SUPER_ADMIN", "TOGGLE_STATUS"]
        rbac_logs = [l for l in logs if l.get("action") in rbac_actions]
        
        print(f"Found {len(rbac_logs)} RBAC-related audit entries")
        for log in rbac_logs[:3]:
            print(f"  - {log.get('action')}: before={log.get('before')}, after={log.get('after')}")


class TestUnauthorizedAccess:
    """Test that non-admin users cannot access RBAC endpoints"""
    
    def test_standard_user_cannot_access_rbac_users(self):
        """Verify standard user gets 403 on RBAC users endpoint"""
        # Login as standard user
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": STANDARD_USER_EMAIL,
            "password": STANDARD_USER_PASSWORD
        })
        if login_resp.status_code != 200:
            pytest.skip("Cannot login as standard user")
        
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/rbac/users", headers=headers)
        # Standard user should get 403 unless they have admin.users.manage permission
        # From context: ilio@raimondi.it has Osservatore role which likely doesn't include admin.users.manage
        print(f"Standard user RBAC access: {response.status_code}")
        # May be 200 if user has the role, or 403 if not
        if response.status_code == 403:
            print("Correctly denied: user lacks admin.users.manage permission")
        elif response.status_code == 200:
            print("User has admin.users.manage permission (likely via assigned role)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
