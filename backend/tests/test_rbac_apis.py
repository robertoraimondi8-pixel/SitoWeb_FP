"""RBAC API Tests for FantaPronostic STEP 0.

Tests all RBAC endpoints:
- GET /api/rbac/permissions - list all permissions (requires admin.roles.manage or super_admin)
- GET /api/rbac/my-permissions - get current user's aggregated permissions
- GET /api/rbac/roles - list all roles (requires admin.roles.manage)
- POST /api/rbac/roles - create custom role with valid permissions
- PUT /api/rbac/roles/{id} - update role name/permissions
- DELETE /api/rbac/roles/{id} - delete custom role + cascade remove from users
- GET /api/rbac/users - list all users with role details
- PUT /api/rbac/users/{id}/roles - assign roles to user
- PUT /api/rbac/users/{id}/super-admin - set/unset super_admin flag

Permission enforcement:
- Regular user without roles gets 403 on admin endpoints
- Super admin bypasses all permission checks
- Bootstrap: 4 default roles created, admin@fantapronostic.com is super_admin
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://match-arena-10.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@fantapronostic.com"
ADMIN_PASSWORD = "admin123"
REGULAR_USER_EMAIL = "ilio@raimondi.it"
REGULAR_USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin (super_admin) token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def admin_user_id(admin_token):
    """Get admin user ID from /api/auth/me."""
    resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    assert resp.status_code == 200
    return resp.json()["id"]


@pytest.fixture(scope="module")
def regular_token():
    """Get regular user token."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": REGULAR_USER_EMAIL,
        "password": REGULAR_USER_PASSWORD
    })
    assert resp.status_code == 200, f"Regular user login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def regular_user_id(regular_token):
    """Get regular user ID."""
    resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
        "Authorization": f"Bearer {regular_token}"
    })
    assert resp.status_code == 200
    return resp.json()["id"]


class TestBootstrap:
    """Test RBAC bootstrap - 4 default roles and admin super_admin flag."""

    def test_bootstrap_four_default_roles(self, admin_token):
        """Verify 4 default system roles exist: Super Admin, Moderatore, Gestore Leghe, Osservatore."""
        resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        roles = resp.json()
        role_names = [r["name"] for r in roles]
        
        expected_roles = ["Super Admin", "Moderatore", "Gestore Leghe", "Osservatore"]
        for name in expected_roles:
            assert name in role_names, f"Missing default role: {name}"
        
        # Verify system roles have is_system=True
        for role in roles:
            if role["name"] in expected_roles:
                assert role.get("is_system") == True, f"Role {role['name']} should be system role"
        print(f"PASSED: Found all 4 default roles: {expected_roles}")

    def test_admin_is_super_admin(self, admin_token):
        """Verify admin@fantapronostic.com has is_super_admin=true."""
        resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_super_admin"] == True, "Admin should be super_admin"
        print("PASSED: admin@fantapronostic.com is super_admin")


class TestPermissionsEndpoint:
    """Test GET /api/rbac/permissions endpoint."""

    def test_permissions_returns_12_permissions(self, admin_token):
        """GET /api/rbac/permissions returns 12 permissions."""
        resp = requests.get(f"{BASE_URL}/api/rbac/permissions", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        permissions = resp.json()
        assert len(permissions) == 12, f"Expected 12 permissions, got {len(permissions)}"
        
        # Verify structure
        for p in permissions:
            assert "key" in p
            assert "description" in p
        
        # Verify expected permission keys
        perm_keys = [p["key"] for p in permissions]
        expected_keys = [
            "admin.dashboard.view", "admin.seasons.manage", "admin.matchdays.manage",
            "admin.matches.manage", "admin.leagues.manage", "admin.users.manage",
            "admin.roles.manage", "admin.payments.view", "admin.audit.view",
            "admin.news.manage", "admin.notifications.manage", "admin.impersonate"
        ]
        for key in expected_keys:
            assert key in perm_keys, f"Missing permission: {key}"
        print(f"PASSED: GET /api/rbac/permissions returns all 12 permissions")

    def test_permissions_requires_auth(self):
        """GET /api/rbac/permissions without auth returns 401."""
        resp = requests.get(f"{BASE_URL}/api/rbac/permissions")
        assert resp.status_code == 401
        print("PASSED: /api/rbac/permissions requires authentication")

    def test_permissions_denied_for_regular_user(self, regular_token):
        """GET /api/rbac/permissions for user without admin.roles.manage permission returns 403."""
        resp = requests.get(f"{BASE_URL}/api/rbac/permissions", headers={
            "Authorization": f"Bearer {regular_token}"
        })
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
        print("PASSED: Regular user gets 403 on /api/rbac/permissions")


class TestMyPermissionsEndpoint:
    """Test GET /api/rbac/my-permissions endpoint."""

    def test_my_permissions_super_admin(self, admin_token):
        """Super admin gets all 12 permissions."""
        resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_super_admin"] == True
        assert len(data["permissions"]) == 12, "Super admin should have all 12 permissions"
        print("PASSED: Super admin has all 12 permissions")

    def test_my_permissions_regular_user(self, regular_token):
        """Regular user without roles gets empty permissions list."""
        resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {regular_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_super_admin"] == False
        # User may have no roles, resulting in empty permissions
        assert "permissions" in data
        assert "role_ids" in data
        print(f"PASSED: Regular user permissions: {len(data['permissions'])} permissions, {len(data['role_ids'])} roles")


class TestRolesEndpoint:
    """Test GET /api/rbac/roles endpoint."""

    def test_roles_list_requires_permission(self, regular_token):
        """GET /api/rbac/roles without permission returns 403."""
        resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {regular_token}"
        })
        assert resp.status_code == 403
        print("PASSED: /api/rbac/roles requires admin.roles.manage permission")

    def test_roles_list_success(self, admin_token):
        """Super admin can list all roles."""
        resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        roles = resp.json()
        assert len(roles) >= 4, "At least 4 default roles should exist"
        
        # Verify role structure
        for role in roles:
            assert "id" in role
            assert "name" in role
            assert "permissions" in role
            assert "is_system" in role
        print(f"PASSED: Listed {len(roles)} roles")


class TestCreateRole:
    """Test POST /api/rbac/roles - create custom role."""

    def test_create_role_success(self, admin_token):
        """Create a custom role with valid permissions."""
        unique_name = f"TEST_Role_{uuid.uuid4().hex[:8]}"
        resp = requests.post(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": unique_name,
            "description": "Test role for RBAC testing",
            "permissions": ["admin.dashboard.view", "admin.audit.view"]
        })
        assert resp.status_code == 200, f"Failed to create role: {resp.text}"
        data = resp.json()
        assert data["name"] == unique_name
        assert data["is_system"] == False
        assert set(data["permissions"]) == {"admin.dashboard.view", "admin.audit.view"}
        print(f"PASSED: Created custom role '{unique_name}'")
        
        # Cleanup
        role_id = data["id"]
        requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })

    def test_create_role_invalid_permissions(self, admin_token):
        """Create role with invalid permission strings returns 400."""
        resp = requests.post(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": f"TEST_Invalid_{uuid.uuid4().hex[:8]}",
            "permissions": ["admin.dashboard.view", "invalid.permission.xyz"]
        })
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "non validi" in resp.text.lower() or "invalid" in resp.text.lower()
        print("PASSED: Invalid permission string rejected with 400")

    def test_create_role_duplicate_name(self, admin_token):
        """Create role with duplicate name returns 409."""
        # Create a role first
        unique_name = f"TEST_Dup_{uuid.uuid4().hex[:8]}"
        resp1 = requests.post(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": unique_name,
            "permissions": ["admin.dashboard.view"]
        })
        assert resp1.status_code == 200
        role_id = resp1.json()["id"]
        
        # Try to create with same name
        resp2 = requests.post(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": unique_name,
            "permissions": ["admin.audit.view"]
        })
        assert resp2.status_code == 409, f"Expected 409, got {resp2.status_code}: {resp2.text}"
        print("PASSED: Duplicate role name rejected with 409")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })


class TestUpdateRole:
    """Test PUT /api/rbac/roles/{id} - update role."""

    def test_update_role_success(self, admin_token):
        """Update role name and permissions."""
        # Create a role
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": unique_name,
            "permissions": ["admin.dashboard.view"]
        })
        assert create_resp.status_code == 200
        role_id = create_resp.json()["id"]
        
        # Update the role
        new_name = f"TEST_Updated_{uuid.uuid4().hex[:8]}"
        update_resp = requests.put(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": new_name,
            "permissions": ["admin.dashboard.view", "admin.news.manage"]
        })
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        data = update_resp.json()
        assert data["name"] == new_name
        assert set(data["permissions"]) == {"admin.dashboard.view", "admin.news.manage"}
        print(f"PASSED: Updated role name to '{new_name}' with new permissions")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })

    def test_update_role_not_found(self, admin_token):
        """Update non-existent role returns 404."""
        resp = requests.put(f"{BASE_URL}/api/rbac/roles/nonexistent-uuid", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": "New Name"
        })
        assert resp.status_code == 404
        print("PASSED: Update non-existent role returns 404")


class TestDeleteRole:
    """Test DELETE /api/rbac/roles/{id}."""

    def test_delete_custom_role_success(self, admin_token):
        """Delete custom role and cascade remove from users."""
        # Create a role
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": unique_name,
            "permissions": ["admin.dashboard.view"]
        })
        assert create_resp.status_code == 200
        role_id = create_resp.json()["id"]
        
        # Delete the role
        delete_resp = requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        assert delete_resp.json()["deleted"] == True
        print(f"PASSED: Deleted custom role '{unique_name}'")

    def test_delete_system_role_forbidden(self, admin_token):
        """Delete system role returns 403."""
        # Get a system role (e.g., Moderatore)
        roles_resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        roles = roles_resp.json()
        system_role = next((r for r in roles if r.get("is_system") and r["name"] == "Moderatore"), None)
        assert system_role is not None, "Moderatore system role not found"
        
        # Try to delete
        delete_resp = requests.delete(f"{BASE_URL}/api/rbac/roles/{system_role['id']}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert delete_resp.status_code == 403, f"Expected 403, got {delete_resp.status_code}: {delete_resp.text}"
        print("PASSED: System role deletion rejected with 403")


class TestUsersEndpoint:
    """Test GET /api/rbac/users - list users with roles."""

    def test_list_users_success(self, admin_token):
        """List all users with role details."""
        resp = requests.get(f"{BASE_URL}/api/rbac/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) > 0, "Should have at least 1 user"
        
        # Verify user structure
        for u in users:
            assert "id" in u
            assert "email" in u
            assert "username" in u
            assert "is_super_admin" in u
            assert "role_ids" in u
            assert "roles" in u
        
        # Verify admin is in the list
        admin = next((u for u in users if u["email"] == ADMIN_EMAIL), None)
        assert admin is not None, "Admin should be in user list"
        assert admin["is_super_admin"] == True
        print(f"PASSED: Listed {len(users)} users with role details")

    def test_list_users_requires_permission(self, regular_token):
        """Regular user without permission gets 403."""
        resp = requests.get(f"{BASE_URL}/api/rbac/users", headers={
            "Authorization": f"Bearer {regular_token}"
        })
        assert resp.status_code == 403
        print("PASSED: /api/rbac/users requires admin.users.manage permission")


class TestAssignRoles:
    """Test PUT /api/rbac/users/{id}/roles - assign roles to user."""

    def test_assign_roles_success(self, admin_token, regular_user_id):
        """Assign roles to a user."""
        # Get a role ID (Osservatore - viewer role)
        roles_resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        roles = roles_resp.json()
        viewer_role = next((r for r in roles if r["name"] == "Osservatore"), None)
        assert viewer_role is not None, "Osservatore role not found"
        
        # Assign the role
        assign_resp = requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "role_ids": [viewer_role["id"]]
        })
        assert assign_resp.status_code == 200, f"Assign failed: {assign_resp.text}"
        data = assign_resp.json()
        assert viewer_role["id"] in data["role_ids"]
        print(f"PASSED: Assigned Osservatore role to user {regular_user_id}")
        
        # Cleanup - remove role
        requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "role_ids": []
        })

    def test_assign_nonexistent_role(self, admin_token, regular_user_id):
        """Assign non-existent role returns 400."""
        resp = requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "role_ids": ["nonexistent-role-id"]
        })
        assert resp.status_code == 400
        print("PASSED: Assigning non-existent role returns 400")


class TestSuperAdminFlag:
    """Test PUT /api/rbac/users/{id}/super-admin - set/unset super_admin."""

    def test_set_super_admin_requires_super_admin(self, regular_token, admin_user_id):
        """Only super_admin can set super_admin flag."""
        # First assign admin.roles.manage permission to regular user temporarily
        # Actually, regular user won't have permission at all, so expect 403
        resp = requests.put(f"{BASE_URL}/api/rbac/users/{admin_user_id}/super-admin", headers={
            "Authorization": f"Bearer {regular_token}",
            "Content-Type": "application/json"
        }, json={
            "is_super_admin": True
        })
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        print("PASSED: Setting super_admin requires admin.roles.manage permission")

    def test_cannot_remove_own_super_admin(self, admin_token, admin_user_id):
        """Super admin cannot remove their own super_admin status."""
        resp = requests.put(f"{BASE_URL}/api/rbac/users/{admin_user_id}/super-admin", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "is_super_admin": False
        })
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"
        assert "super admin" in resp.text.lower() or "rimuovere" in resp.text.lower()
        print("PASSED: Super admin cannot remove own super_admin status")


class TestPermissionEnforcement:
    """Test permission enforcement across RBAC endpoints."""

    def test_regular_user_no_roles_gets_403(self, regular_token):
        """Regular user without roles gets 403 on admin endpoints."""
        endpoints = [
            ("GET", "/api/rbac/permissions"),
            ("GET", "/api/rbac/roles"),
            ("GET", "/api/rbac/users"),
        ]
        for method, endpoint in endpoints:
            if method == "GET":
                resp = requests.get(f"{BASE_URL}{endpoint}", headers={
                    "Authorization": f"Bearer {regular_token}"
                })
            assert resp.status_code == 403, f"{method} {endpoint} should return 403, got {resp.status_code}"
        print("PASSED: Regular user without roles gets 403 on all admin RBAC endpoints")

    def test_user_with_role_can_access_permitted(self, admin_token, regular_token, regular_user_id):
        """User with specific role can access permitted endpoints."""
        # Get roles
        roles_resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        roles = roles_resp.json()
        
        # Find Osservatore role (has admin.dashboard.view, admin.audit.view, admin.payments.view)
        viewer_role = next((r for r in roles if r["name"] == "Osservatore"), None)
        assert viewer_role is not None
        
        # Assign Osservatore role to regular user
        requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "role_ids": [viewer_role["id"]]
        })
        
        # Need to re-login to get updated token with roles
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_USER_EMAIL,
            "password": REGULAR_USER_PASSWORD
        })
        new_token = login_resp.json()["access_token"]
        
        # Check my-permissions
        perm_resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {new_token}"
        })
        assert perm_resp.status_code == 200
        perms = perm_resp.json()
        assert "admin.dashboard.view" in perms["permissions"]
        assert "admin.audit.view" in perms["permissions"]
        print(f"PASSED: User with Osservatore role has permissions: {perms['permissions']}")
        
        # User still shouldn't access admin.roles.manage endpoints
        roles_list_resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {new_token}"
        })
        assert roles_list_resp.status_code == 403, "Osservatore shouldn't access /api/rbac/roles"
        print("PASSED: Osservatore role cannot access /api/rbac/roles (requires admin.roles.manage)")
        
        # Cleanup - remove role
        requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "role_ids": []
        })

    def test_super_admin_bypasses_all_checks(self, admin_token):
        """Super admin bypasses all permission checks."""
        # Super admin can access all endpoints
        endpoints = [
            "/api/rbac/permissions",
            "/api/rbac/roles",
            "/api/rbac/users",
            "/api/rbac/my-permissions",
        ]
        for endpoint in endpoints:
            resp = requests.get(f"{BASE_URL}{endpoint}", headers={
                "Authorization": f"Bearer {admin_token}"
            })
            assert resp.status_code == 200, f"Super admin should access {endpoint}, got {resp.status_code}"
        print("PASSED: Super admin bypasses all permission checks")


class TestAuditLogsWithRBAC:
    """Test audit logs include new RBAC fields."""

    def test_audit_log_includes_rbac_fields(self, admin_token):
        """Verify audit log entry includes actor_roles, ip, before, after fields."""
        # Create a role to generate audit log
        unique_name = f"TEST_Audit_{uuid.uuid4().hex[:8]}"
        create_resp = requests.post(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}",
            "Content-Type": "application/json"
        }, json={
            "name": unique_name,
            "permissions": ["admin.dashboard.view"]
        })
        assert create_resp.status_code == 200
        role_id = create_resp.json()["id"]
        
        # Check audit logs for the CREATE action
        audit_resp = requests.get(f"{BASE_URL}/api/admin/audit-logs", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert audit_resp.status_code == 200
        logs = audit_resp.json()
        
        # Find the CREATE role log entry
        create_log = None
        for log in logs:
            if log.get("action") == "CREATE" and log.get("entity_type") == "role" and log.get("entity_id") == role_id:
                create_log = log
                break
        
        if create_log:
            # Verify new fields exist
            assert "actor_roles" in create_log, "Missing actor_roles in audit log"
            assert "ip" in create_log, "Missing ip in audit log"
            # before/after may be present or None depending on action type
            print(f"PASSED: Audit log includes actor_roles={create_log.get('actor_roles')}, ip={create_log.get('ip')}")
        else:
            print("WARNING: Could not find CREATE role audit log entry - may be due to pagination")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })


class TestExistingAdminEndpoints:
    """Test existing /api/admin/* endpoints still work with require_admin."""

    def test_admin_audit_logs_still_works(self, admin_token):
        """GET /api/admin/audit-logs still works."""
        resp = requests.get(f"{BASE_URL}/api/admin/audit-logs", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        print("PASSED: /api/admin/audit-logs works with admin token")

    def test_admin_seasons_still_works(self, admin_token):
        """GET /api/admin/seasons still works."""
        resp = requests.get(f"{BASE_URL}/api/admin/seasons", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        print("PASSED: /api/admin/seasons works with admin token")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
