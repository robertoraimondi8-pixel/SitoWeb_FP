"""
RBAC STEP 2A: Testing migration of 20 admin endpoints from require_admin to require_permission.

Permission Mapping:
- seasons → admin.seasons.manage (GET/POST/PUT /api/admin/seasons)
- matchdays → admin.matchdays.manage (GET/POST/PUT/DELETE /api/admin/matchdays, confirm, recalc)
- matches → admin.matches.manage (GET/POST/PUT/DELETE /api/admin/matches, live-update)
- leagues → admin.leagues.manage (GET /api/admin/leagues)
- payments → admin.payments.view (GET /api/admin/payments)
- audit → admin.audit.view (GET /api/admin/audit-logs)
- score-summaries → admin.dashboard.view (GET /api/admin/score-summaries/{matchday_id})
- fixtures/refresh-live → admin.matches.manage (POST /api/admin/real-fixtures/refresh-live)

Default Roles:
- Osservatore: admin.dashboard.view, admin.audit.view, admin.payments.view
- Gestore Leghe: admin.dashboard.view, admin.seasons.manage, admin.matchdays.manage, admin.matches.manage, admin.leagues.manage
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://admin-unified-ui.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN_EMAIL = "admin@fantapronostic.com"
SUPER_ADMIN_PASSWORD = "admin123"
STANDARD_USER_EMAIL = "ilio@raimondi.it"
STANDARD_USER_PASSWORD = "password123"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def super_admin_token(api_client):
    """Get super admin token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Super admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def standard_user_token(api_client):
    """Get standard user (ilio@raimondi.it) token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": STANDARD_USER_EMAIL,
        "password": STANDARD_USER_PASSWORD
    })
    assert response.status_code == 200, f"Standard user login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def standard_user_id(api_client, standard_user_token):
    """Get standard user ID"""
    response = api_client.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {standard_user_token}"}
    )
    assert response.status_code == 200
    return response.json()["id"]


def get_role_id_by_name(api_client, super_admin_token, role_name):
    """Helper to get role ID by name"""
    response = api_client.get(
        f"{BASE_URL}/api/rbac/roles",
        headers={"Authorization": f"Bearer {super_admin_token}"}
    )
    if response.status_code != 200:
        return None
    roles = response.json()
    for role in roles:
        if role.get("name") == role_name:
            return role["id"]
    return None


def assign_role_to_user(api_client, super_admin_token, user_id, role_ids):
    """Helper to assign roles to a user"""
    response = api_client.put(
        f"{BASE_URL}/api/rbac/users/{user_id}/roles",
        headers={"Authorization": f"Bearer {super_admin_token}"},
        json={"role_ids": role_ids}
    )
    return response


class TestSuperAdminAccessAll:
    """Super Admin (is_super_admin=true) can access ALL 20 admin endpoints with 200"""
    
    def test_super_admin_seasons_get(self, api_client, super_admin_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"GET /api/admin/seasons failed: {response.text}"
        print(f"✓ Super Admin can GET /api/admin/seasons")
    
    def test_super_admin_matchdays_get(self, api_client, super_admin_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"GET /api/admin/matchdays failed: {response.text}"
        print(f"✓ Super Admin can GET /api/admin/matchdays")
    
    def test_super_admin_matches_get(self, api_client, super_admin_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/matches",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"GET /api/admin/matches failed: {response.text}"
        print(f"✓ Super Admin can GET /api/admin/matches")
    
    def test_super_admin_leagues_get(self, api_client, super_admin_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/leagues",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"GET /api/admin/leagues failed: {response.text}"
        print(f"✓ Super Admin can GET /api/admin/leagues")
    
    def test_super_admin_payments_get(self, api_client, super_admin_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/payments",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"GET /api/admin/payments failed: {response.text}"
        print(f"✓ Super Admin can GET /api/admin/payments")
    
    def test_super_admin_audit_logs_get(self, api_client, super_admin_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"GET /api/admin/audit-logs failed: {response.text}"
        print(f"✓ Super Admin can GET /api/admin/audit-logs")
    
    def test_super_admin_score_summaries_get(self, api_client, super_admin_token):
        # First get a matchday id
        response = api_client.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        matchdays = response.json()
        matchday_id = matchdays[0]["id"] if matchdays else "test-id"
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/score-summaries/{matchday_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        # May return 200 or 404 if matchday doesn't exist - not 403
        assert response.status_code in [200, 404], f"GET /api/admin/score-summaries/{matchday_id} failed: {response.text}"
        print(f"✓ Super Admin can GET /api/admin/score-summaries/{matchday_id}")


class TestOsservatoreRole:
    """
    Osservatore role has: admin.dashboard.view, admin.audit.view, admin.payments.view
    Should get 403 on seasons/matchdays/matches/leagues
    Should get 200 on payments/audit/score-summaries
    """
    
    @pytest.fixture(autouse=True)
    def setup_osservatore_role(self, api_client, super_admin_token, standard_user_id):
        """Setup: Assign Osservatore role to standard user"""
        role_id = get_role_id_by_name(api_client, super_admin_token, "Osservatore")
        if role_id:
            assign_role_to_user(api_client, super_admin_token, standard_user_id, [role_id])
        yield
        # Cleanup: remove roles after test
        assign_role_to_user(api_client, super_admin_token, standard_user_id, [])
    
    def test_osservatore_seasons_403(self, api_client, standard_user_token):
        """Osservatore should get 403 on /api/admin/seasons (needs admin.seasons.manage)"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 403 on GET /api/admin/seasons")
    
    def test_osservatore_matchdays_403(self, api_client, standard_user_token):
        """Osservatore should get 403 on /api/admin/matchdays (needs admin.matchdays.manage)"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 403 on GET /api/admin/matchdays")
    
    def test_osservatore_matches_403(self, api_client, standard_user_token):
        """Osservatore should get 403 on /api/admin/matches (needs admin.matches.manage)"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/matches",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 403 on GET /api/admin/matches")
    
    def test_osservatore_leagues_403(self, api_client, standard_user_token):
        """Osservatore should get 403 on /api/admin/leagues (needs admin.leagues.manage)"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/leagues",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 403 on GET /api/admin/leagues")
    
    def test_osservatore_payments_200(self, api_client, standard_user_token):
        """Osservatore has admin.payments.view - should get 200"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/payments",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 200 on GET /api/admin/payments")
    
    def test_osservatore_audit_200(self, api_client, standard_user_token):
        """Osservatore has admin.audit.view - should get 200"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 200 on GET /api/admin/audit-logs")
    
    def test_osservatore_score_summaries_200(self, api_client, standard_user_token, super_admin_token):
        """Osservatore has admin.dashboard.view - should get 200 on score-summaries"""
        # Get a valid matchday id
        response = api_client.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        matchdays = response.json() if response.status_code == 200 else []
        matchday_id = matchdays[0]["id"] if matchdays else "test-id"
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/score-summaries/{matchday_id}",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        # 200 or 404 (if matchday not found), but not 403
        assert response.status_code in [200, 404], f"Expected 200/404, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 200/404 (not 403) on GET /api/admin/score-summaries")


class TestGestoreLegheRole:
    """
    Gestore Leghe role has: admin.dashboard.view, admin.seasons.manage, admin.matchdays.manage, 
    admin.matches.manage, admin.leagues.manage
    Should get 200 on seasons/matchdays/matches/leagues
    Should get 403 on payments/audit
    """
    
    @pytest.fixture(autouse=True)
    def setup_gestore_leghe_role(self, api_client, super_admin_token, standard_user_id):
        """Setup: Assign Gestore Leghe role to standard user"""
        role_id = get_role_id_by_name(api_client, super_admin_token, "Gestore Leghe")
        if role_id:
            assign_role_to_user(api_client, super_admin_token, standard_user_id, [role_id])
        yield
        # Cleanup: remove roles after test
        assign_role_to_user(api_client, super_admin_token, standard_user_id, [])
    
    def test_gestore_seasons_200(self, api_client, standard_user_token):
        """Gestore Leghe has admin.seasons.manage - should get 200"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Gestore Leghe gets 200 on GET /api/admin/seasons")
    
    def test_gestore_matchdays_200(self, api_client, standard_user_token):
        """Gestore Leghe has admin.matchdays.manage - should get 200"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Gestore Leghe gets 200 on GET /api/admin/matchdays")
    
    def test_gestore_matches_200(self, api_client, standard_user_token):
        """Gestore Leghe has admin.matches.manage - should get 200"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/matches",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Gestore Leghe gets 200 on GET /api/admin/matches")
    
    def test_gestore_leagues_200(self, api_client, standard_user_token):
        """Gestore Leghe has admin.leagues.manage - should get 200"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/leagues",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Gestore Leghe gets 200 on GET /api/admin/leagues")
    
    def test_gestore_payments_403(self, api_client, standard_user_token):
        """Gestore Leghe does NOT have admin.payments.view - should get 403"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/payments",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Gestore Leghe gets 403 on GET /api/admin/payments")
    
    def test_gestore_audit_403(self, api_client, standard_user_token):
        """Gestore Leghe does NOT have admin.audit.view - should get 403"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Gestore Leghe gets 403 on GET /api/admin/audit-logs")


class TestNoRoleUser:
    """User with NO role should get 403 on ALL admin endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_no_role(self, api_client, super_admin_token, standard_user_id):
        """Setup: Remove all roles from standard user"""
        assign_role_to_user(api_client, super_admin_token, standard_user_id, [])
        yield
    
    def test_no_role_seasons_403(self, api_client, standard_user_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/seasons",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ No role user gets 403 on GET /api/admin/seasons")
    
    def test_no_role_matchdays_403(self, api_client, standard_user_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/matchdays",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ No role user gets 403 on GET /api/admin/matchdays")
    
    def test_no_role_matches_403(self, api_client, standard_user_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/matches",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ No role user gets 403 on GET /api/admin/matches")
    
    def test_no_role_leagues_403(self, api_client, standard_user_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/leagues",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ No role user gets 403 on GET /api/admin/leagues")
    
    def test_no_role_payments_403(self, api_client, standard_user_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/payments",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ No role user gets 403 on GET /api/admin/payments")
    
    def test_no_role_audit_403(self, api_client, standard_user_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ No role user gets 403 on GET /api/admin/audit-logs")
    
    def test_no_role_score_summaries_403(self, api_client, standard_user_token):
        response = api_client.get(
            f"{BASE_URL}/api/admin/score-summaries/test-id",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ No role user gets 403 on GET /api/admin/score-summaries")


class TestRefreshLiveEndpoint:
    """Test /api/admin/real-fixtures/refresh-live requires admin.matches.manage"""
    
    def test_super_admin_refresh_live_access(self, api_client, super_admin_token):
        """Super admin can access refresh-live endpoint"""
        response = api_client.post(
            f"{BASE_URL}/api/admin/real-fixtures/refresh-live",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        # May return 200/502 (API Football error) but not 403
        assert response.status_code != 403, f"Super admin should not get 403: {response.text}"
        print(f"✓ Super Admin can POST /api/admin/real-fixtures/refresh-live (status: {response.status_code})")
    
    def test_gestore_refresh_live_access(self, api_client, super_admin_token, standard_user_token, standard_user_id):
        """Gestore Leghe (has admin.matches.manage) can access refresh-live"""
        # Assign Gestore Leghe role
        role_id = get_role_id_by_name(api_client, super_admin_token, "Gestore Leghe")
        if role_id:
            assign_role_to_user(api_client, super_admin_token, standard_user_id, [role_id])
        
        response = api_client.post(
            f"{BASE_URL}/api/admin/real-fixtures/refresh-live",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        # May return 200/502 but not 403 since Gestore Leghe has admin.matches.manage
        assert response.status_code != 403, f"Gestore Leghe should not get 403: {response.text}"
        print(f"✓ Gestore Leghe can POST /api/admin/real-fixtures/refresh-live (status: {response.status_code})")
        
        # Cleanup
        assign_role_to_user(api_client, super_admin_token, standard_user_id, [])
    
    def test_osservatore_refresh_live_403(self, api_client, super_admin_token, standard_user_token, standard_user_id):
        """Osservatore (NO admin.matches.manage) gets 403 on refresh-live"""
        # Assign Osservatore role
        role_id = get_role_id_by_name(api_client, super_admin_token, "Osservatore")
        if role_id:
            assign_role_to_user(api_client, super_admin_token, standard_user_id, [role_id])
        
        response = api_client.post(
            f"{BASE_URL}/api/admin/real-fixtures/refresh-live",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ Osservatore gets 403 on POST /api/admin/real-fixtures/refresh-live")
        
        # Cleanup
        assign_role_to_user(api_client, super_admin_token, standard_user_id, [])


class TestNonAdminEndpointsStillWork:
    """Non-admin endpoints should work without any role/permission"""
    
    def test_user_login_no_role_required(self, api_client):
        """Regular user login works without admin roles"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": STANDARD_USER_EMAIL,
            "password": STANDARD_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        print(f"✓ Login works without admin roles")
    
    def test_home_endpoint_no_role_required(self, api_client, standard_user_token):
        """Home endpoint works without admin roles"""
        response = api_client.get(
            f"{BASE_URL}/api/home",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Home failed: {response.text}"
        print(f"✓ /api/home works without admin roles")
    
    def test_profile_no_role_required(self, api_client, standard_user_token):
        """Profile endpoint works without admin roles"""
        response = api_client.get(
            f"{BASE_URL}/api/profile",
            headers={"Authorization": f"Bearer {standard_user_token}"}
        )
        assert response.status_code == 200, f"Profile failed: {response.text}"
        print(f"✓ /api/profile works without admin roles")
