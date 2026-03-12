"""RBAC STEP 1 Tests - Admin UI features, disable/enable users, last super admin protection."""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://palmares-historic.preview.emergentagent.com").rstrip("/")

# Test credentials
SUPER_ADMIN_EMAIL = "admin@fantapronostic.com"
SUPER_ADMIN_PASS = "admin123"
REGULAR_USER_EMAIL = "ilio@raimondi.it"
REGULAR_USER_PASS = "password123"


class TestLogin:
    """Test login functionality."""

    def test_super_admin_login(self):
        """Super admin can login and get token."""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL

    def test_regular_user_login(self):
        """Regular user can login."""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_USER_EMAIL,
            "password": REGULAR_USER_PASS
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data


class TestMyPermissions:
    """Test /api/rbac/my-permissions endpoint."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    @pytest.fixture
    def regular_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_USER_EMAIL,
            "password": REGULAR_USER_PASS
        })
        return resp.json()["access_token"]

    def test_super_admin_has_all_permissions(self, admin_token):
        """Super admin gets all permissions."""
        resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_super_admin"] is True
        # Should have admin.dashboard.view permission
        assert "admin.dashboard.view" in data["permissions"]

    def test_regular_user_permissions(self, regular_token):
        """Regular user gets only their assigned permissions."""
        resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {regular_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_super_admin"] is False
        # Regular user may or may not have admin.dashboard.view
        assert isinstance(data["permissions"], list)


class TestRolesEndpoints:
    """Test roles CRUD operations."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    def test_list_roles_returns_4_system_roles(self, admin_token):
        """Should return 4 system roles."""
        resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        roles = resp.json()
        system_roles = [r for r in roles if r.get("is_system")]
        assert len(system_roles) == 4
        
        role_names = [r["name"] for r in system_roles]
        assert "Super Admin" in role_names
        assert "Moderatore" in role_names
        assert "Gestore Leghe" in role_names
        assert "Osservatore" in role_names

    def test_create_custom_role(self, admin_token):
        """Create a custom role with specific permissions."""
        # First clean up if exists
        resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        roles = resp.json()
        existing = next((r for r in roles if r["name"] == "TEST_Custom_Role"), None)
        if existing:
            requests.delete(f"{BASE_URL}/api/rbac/roles/{existing['id']}", headers={
                "Authorization": f"Bearer {admin_token}"
            })

        # Create new role
        resp = requests.post(f"{BASE_URL}/api/rbac/roles", json={
            "name": "TEST_Custom_Role",
            "description": "Test custom role for RBAC STEP 1",
            "permissions": ["admin.dashboard.view", "admin.audit.view"]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert resp.status_code in [200, 201]
        data = resp.json()
        assert data["name"] == "TEST_Custom_Role"
        assert data["is_system"] is False
        assert "admin.dashboard.view" in data["permissions"]
        assert "admin.audit.view" in data["permissions"]
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/rbac/roles/{data['id']}", headers={
            "Authorization": f"Bearer {admin_token}"
        })

    def test_edit_role_updates_permissions(self, admin_token):
        """Edit a role and verify permissions are updated."""
        import time
        unique_name = f"TEST_Edit_Role_{int(time.time())}"
        
        # Create a role first
        create_resp = requests.post(f"{BASE_URL}/api/rbac/roles", json={
            "name": unique_name,
            "description": "Role for edit test",
            "permissions": ["admin.dashboard.view"]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert create_resp.status_code in [200, 201], f"Create failed: {create_resp.text}"
        role_id = create_resp.json()["id"]
        
        # Edit the role
        edit_resp = requests.put(f"{BASE_URL}/api/rbac/roles/{role_id}", json={
            "name": f"{unique_name}_Updated",
            "description": "Updated description",
            "permissions": ["admin.dashboard.view", "admin.payments.view"]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert edit_resp.status_code == 200
        data = edit_resp.json()
        assert data["name"] == f"{unique_name}_Updated"
        assert "admin.payments.view" in data["permissions"]
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })

    def test_delete_custom_role(self, admin_token):
        """Delete a custom role."""
        import time
        unique_name = f"TEST_Delete_Role_{int(time.time())}"
        
        # Create a role first
        create_resp = requests.post(f"{BASE_URL}/api/rbac/roles", json={
            "name": unique_name,
            "description": "Role to be deleted",
            "permissions": ["admin.dashboard.view"]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert create_resp.status_code in [200, 201], f"Create failed: {create_resp.text}"
        role_id = create_resp.json()["id"]
        
        # Delete the role
        del_resp = requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        
        assert del_resp.status_code in [200, 204]

    def test_cannot_delete_system_role(self, admin_token):
        """System roles cannot be deleted."""
        # Get Super Admin role
        resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        roles = resp.json()
        super_admin_role = next((r for r in roles if r["name"] == "Super Admin"), None)
        assert super_admin_role is not None
        
        # Try to delete
        del_resp = requests.delete(f"{BASE_URL}/api/rbac/roles/{super_admin_role['id']}", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        
        assert del_resp.status_code == 403


class TestUsersEndpoints:
    """Test users list and role assignment."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    def test_list_users_with_roles(self, admin_token):
        """List users shows roles and is_disabled."""
        resp = requests.get(f"{BASE_URL}/api/rbac/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        users = resp.json()
        assert isinstance(users, list)
        assert len(users) > 0
        
        # Check user structure
        user = users[0]
        assert "id" in user
        assert "email" in user
        assert "username" in user
        assert "is_super_admin" in user
        assert "is_disabled" in user
        assert "roles" in user
        assert "role_ids" in user

    def test_assign_roles_to_user(self, admin_token):
        """Assign roles to a user."""
        # Get a regular user
        users_resp = requests.get(f"{BASE_URL}/api/rbac/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        users = users_resp.json()
        regular_user = next((u for u in users if u["email"] == REGULAR_USER_EMAIL), None)
        assert regular_user is not None
        
        # Get a role to assign
        roles_resp = requests.get(f"{BASE_URL}/api/rbac/roles", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        roles = roles_resp.json()
        observer_role = next((r for r in roles if r["name"] == "Osservatore"), None)
        assert observer_role is not None
        
        # Store original role_ids
        original_role_ids = regular_user.get("role_ids", [])
        
        # Assign role
        assign_resp = requests.put(f"{BASE_URL}/api/rbac/users/{regular_user['id']}/roles", json={
            "role_ids": [observer_role["id"]]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert assign_resp.status_code == 200
        data = assign_resp.json()
        assert observer_role["id"] in data["role_ids"]
        
        # Verify user has permissions now
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_USER_EMAIL,
            "password": REGULAR_USER_PASS
        })
        user_token = login_resp.json()["access_token"]
        
        perms_resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {user_token}"
        })
        assert perms_resp.status_code == 200
        perms_data = perms_resp.json()
        assert "admin.dashboard.view" in perms_data["permissions"]
        
        # Restore original state
        requests.put(f"{BASE_URL}/api/rbac/users/{regular_user['id']}/roles", json={
            "role_ids": original_role_ids
        }, headers={"Authorization": f"Bearer {admin_token}"})


class TestDisableEnableUser:
    """Test PUT /api/rbac/users/{id}/status endpoint."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    @pytest.fixture
    def regular_user_id(self, admin_token):
        resp = requests.get(f"{BASE_URL}/api/rbac/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        users = resp.json()
        user = next((u for u in users if u["email"] == REGULAR_USER_EMAIL), None)
        return user["id"] if user else None

    def test_toggle_user_status_disable(self, admin_token, regular_user_id):
        """Admin can disable a user."""
        # First ensure user is enabled
        status_resp = requests.get(f"{BASE_URL}/api/rbac/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        users = status_resp.json()
        user = next((u for u in users if u["id"] == regular_user_id), None)
        was_disabled = user.get("is_disabled", False)
        
        # Toggle status
        resp = requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/status", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_disabled"] == (not was_disabled)
        
        # Toggle back
        requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/status", headers={
            "Authorization": f"Bearer {admin_token}"
        })

    def test_disabled_user_gets_403(self, admin_token, regular_user_id):
        """Disabled user gets 403 on any API call."""
        # First ensure user is enabled and get a valid token
        users_resp = requests.get(f"{BASE_URL}/api/rbac/users", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        users = users_resp.json()
        user = next((u for u in users if u["id"] == regular_user_id), None)
        
        # If disabled, enable first
        if user.get("is_disabled"):
            requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/status", headers={
                "Authorization": f"Bearer {admin_token}"
            })
        
        # Get user's token while enabled
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_USER_EMAIL,
            "password": REGULAR_USER_PASS
        })
        assert login_resp.status_code == 200
        user_token = login_resp.json()["access_token"]
        
        # Now disable the user
        disable_resp = requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/status", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert disable_resp.status_code == 200
        assert disable_resp.json()["is_disabled"] is True
        
        # User's existing token should now return 403
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {user_token}"
        })
        assert me_resp.status_code == 403
        assert "disabilitato" in me_resp.json().get("detail", "").lower()
        
        # Re-enable user
        requests.put(f"{BASE_URL}/api/rbac/users/{regular_user_id}/status", headers={
            "Authorization": f"Bearer {admin_token}"
        })

    def test_cannot_disable_yourself(self, admin_token):
        """Cannot disable own account."""
        # Get admin user id
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        admin_id = me_resp.json()["id"]
        
        # Try to disable self
        resp = requests.put(f"{BASE_URL}/api/rbac/users/{admin_id}/status", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 400


class TestLastSuperAdminProtection:
    """Test that last super admin cannot be removed."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    def test_cannot_remove_last_super_admin(self, admin_token):
        """Cannot remove super admin status from the last super admin."""
        # Get admin user id
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        admin_id = me_resp.json()["id"]
        
        # Try to remove own super admin status
        resp = requests.put(f"{BASE_URL}/api/rbac/users/{admin_id}/super-admin", json={
            "is_super_admin": False
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        # Should be 400 (cannot remove own) or 403 (last super admin protection)
        assert resp.status_code in [400, 403]


class TestAuditLogging:
    """Test that RBAC actions are logged in audit."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    def test_role_actions_logged(self, admin_token):
        """RBAC actions are logged with before/after."""
        import time
        unique_name = f"TEST_Audit_Role_{int(time.time())}"
        
        # Create a role
        create_resp = requests.post(f"{BASE_URL}/api/rbac/roles", json={
            "name": unique_name,
            "description": "Role for audit test",
            "permissions": ["admin.dashboard.view"]
        }, headers={"Authorization": f"Bearer {admin_token}"})
        
        assert create_resp.status_code in [200, 201], f"Create failed: {create_resp.text}"
        role_id = create_resp.json()["id"]
        
        # Check audit logs
        audit_resp = requests.get(f"{BASE_URL}/api/admin/audit-logs?limit=10", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert audit_resp.status_code == 200
        logs = audit_resp.json()
        
        # Find the CREATE log for the role
        create_log = next((l for l in logs if l.get("action") == "CREATE" and l.get("entity_id") == role_id), None)
        assert create_log is not None, f"No CREATE log found for role {role_id}. Available logs: {[l.get('action') for l in logs]}"
        assert "details" in create_log
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/rbac/roles/{role_id}", headers={
            "Authorization": f"Bearer {admin_token}"
        })


class TestExistingAdminEndpoints:
    """Verify existing admin endpoints still work."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    def test_admin_seasons_works(self, admin_token):
        """/api/admin/seasons still works."""
        resp = requests.get(f"{BASE_URL}/api/admin/seasons", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_admin_matchdays_works(self, admin_token):
        """/api/admin/matchdays still works."""
        resp = requests.get(f"{BASE_URL}/api/admin/matchdays", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestPermissionsEndpoint:
    """Test GET /api/rbac/permissions endpoint."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    def test_permissions_list(self, admin_token):
        """Get all available permissions."""
        resp = requests.get(f"{BASE_URL}/api/rbac/permissions", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        perms = resp.json()
        assert isinstance(perms, list)
        assert len(perms) >= 10  # At least 10 permissions
        
        # Check structure
        perm = perms[0]
        assert "key" in perm
        assert "description" in perm


class TestSuperAdminEnvVar:
    """Test SUPER_ADMIN_EMAIL env var usage."""

    @pytest.fixture
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASS
        })
        return resp.json()["access_token"]

    def test_admin_is_super_admin(self, admin_token):
        """admin@fantapronostic.com is super admin via SUPER_ADMIN_EMAIL env."""
        resp = requests.get(f"{BASE_URL}/api/rbac/my-permissions", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_super_admin"] is True
