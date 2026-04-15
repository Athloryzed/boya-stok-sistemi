"""
Security Authentication Tests - Iteration 20
Tests for JWT authentication enforcement on all protected endpoints
and public endpoint accessibility.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OPERATOR_CREDS = {"username": "ali", "password": "134679"}
PLAN_CREDS = {"username": "emrecan", "password": "testtest12"}
MANAGEMENT_PASSWORD = "buse11993"
DASHBOARD_PASSWORD = "buse4"
WAREHOUSE_CREDS = {"username": "depo1", "password": "depo123"}


class TestPublicEndpoints:
    """Test that public endpoints work WITHOUT authentication"""
    
    def test_health_endpoint_public(self):
        """GET /api/health should be public"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health endpoint failed: {response.text}"
        print(f"✓ GET /api/health returns 200 (public)")
    
    def test_root_endpoint_public(self):
        """GET /api/ should be public"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Root endpoint failed: {response.text}"
        print(f"✓ GET /api/ returns 200 (public)")
    
    def test_operator_login_public(self):
        """POST /api/users/login should be public and return token"""
        response = requests.post(f"{BASE_URL}/api/users/login", json=OPERATOR_CREDS)
        assert response.status_code == 200, f"Operator login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ POST /api/users/login (operator ali/134679) returns 200 with token")
    
    def test_management_login_public(self):
        """POST /api/management/login should be public and return token"""
        response = requests.post(f"{BASE_URL}/api/management/login", json={"password": MANAGEMENT_PASSWORD})
        assert response.status_code == 200, f"Management login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✓ POST /api/management/login with buse11993 returns 200 with token")
    
    def test_dashboard_login_public(self):
        """POST /api/dashboard/login should be public and return token"""
        response = requests.post(f"{BASE_URL}/api/dashboard/login", json={"password": DASHBOARD_PASSWORD})
        assert response.status_code == 200, f"Dashboard login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert data.get("success") == True, "Success flag not set"
        print(f"✓ POST /api/dashboard/login with buse4 returns 200 with token")
    
    def test_dashboard_login_wrong_password(self):
        """POST /api/dashboard/login with wrong password should return 401"""
        response = requests.post(f"{BASE_URL}/api/dashboard/login", json={"password": "wrongpassword"})
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/dashboard/login with wrong password returns 401")
    
    def test_tracking_endpoint_public(self):
        """GET /api/takip/nonexistent should return 404 (not 401)"""
        response = requests.get(f"{BASE_URL}/api/takip/nonexistent_token_12345")
        # Should return 404 for invalid tracking token, NOT 401 (auth error)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/takip/nonexistent returns 404 (not 401 - public endpoint)")
    
    def test_visitors_log_public(self):
        """POST /api/visitors/log should be public"""
        response = requests.post(f"{BASE_URL}/api/visitors/log", json={
            "user_agent": "Test Agent",
            "page_visited": "/test"
        })
        assert response.status_code == 200, f"Visitors log failed: {response.status_code}: {response.text}"
        print(f"✓ POST /api/visitors/log returns 200 without token (public)")
    
    def test_drivers_login_wrong_creds(self):
        """POST /api/drivers/login with wrong creds should return 401 (not auth error)"""
        response = requests.post(f"{BASE_URL}/api/drivers/login", json={
            "name": "nonexistent_driver",
            "password": "wrongpassword"
        })
        # Should return 401 for invalid credentials, not a different auth error
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/drivers/login with wrong creds returns 401 (credential error, not auth error)")


class TestProtectedEndpointsWithoutToken:
    """Test that protected endpoints return 401 WITHOUT authentication"""
    
    def test_machines_requires_auth(self):
        """GET /api/machines without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/machines without token returns 401")
    
    def test_jobs_requires_auth(self):
        """GET /api/jobs without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/jobs without token returns 401")
    
    def test_dashboard_live_requires_auth(self):
        """GET /api/dashboard/live without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/dashboard/live without token returns 401")
    
    def test_analytics_weekly_requires_auth(self):
        """GET /api/analytics/weekly without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/analytics/weekly")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/analytics/weekly without token returns 401")
    
    def test_paints_requires_auth(self):
        """GET /api/paints without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/paints")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/paints without token returns 401")
    
    def test_shifts_current_requires_auth(self):
        """GET /api/shifts/current without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/shifts/current")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/shifts/current without token returns 401")
    
    def test_defects_requires_auth(self):
        """GET /api/defects without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/defects")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/defects without token returns 401")
    
    def test_audit_logs_requires_auth(self):
        """GET /api/audit-logs without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/audit-logs without token returns 401")
    
    def test_vehicles_requires_auth(self):
        """GET /api/vehicles without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/vehicles without token returns 401")
    
    def test_drivers_requires_auth(self):
        """GET /api/drivers without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/drivers")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/drivers without token returns 401")
    
    def test_visitors_stats_requires_auth(self):
        """GET /api/visitors/stats without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/visitors/stats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/visitors/stats without token returns 401")
    
    def test_pallets_requires_auth(self):
        """GET /api/pallets without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/pallets")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print(f"✓ SECURITY: GET /api/pallets without token returns 401")


class TestProtectedEndpointsWithToken:
    """Test that protected endpoints work WITH valid JWT token"""
    
    @pytest.fixture(autouse=True)
    def setup_token(self):
        """Get a valid JWT token for authenticated tests"""
        response = requests.post(f"{BASE_URL}/api/management/login", json={"password": MANAGEMENT_PASSWORD})
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not get auth token")
    
    def test_machines_with_token(self):
        """GET /api/machines with valid JWT should return 200"""
        response = requests.get(f"{BASE_URL}/api/machines", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of machines"
        print(f"✓ AUTH: GET /api/machines with valid JWT returns 200 ({len(data)} machines)")
    
    def test_jobs_with_token(self):
        """GET /api/jobs with valid JWT should return 200"""
        response = requests.get(f"{BASE_URL}/api/jobs", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of jobs"
        print(f"✓ AUTH: GET /api/jobs with valid JWT returns 200 ({len(data)} jobs)")
    
    def test_dashboard_live_with_token(self):
        """GET /api/dashboard/live with valid JWT should return 200"""
        # Get dashboard-specific token
        dash_response = requests.post(f"{BASE_URL}/api/dashboard/login", json={"password": DASHBOARD_PASSWORD})
        dash_token = dash_response.json().get("token")
        dash_headers = {"Authorization": f"Bearer {dash_token}"}
        
        response = requests.get(f"{BASE_URL}/api/dashboard/live", headers=dash_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "summary" in data, "Expected summary in dashboard data"
        assert "machines" in data, "Expected machines in dashboard data"
        print(f"✓ AUTH: GET /api/dashboard/live with dashboard token returns 200")
    
    def test_analytics_weekly_with_token(self):
        """GET /api/analytics/weekly with valid JWT should return 200"""
        response = requests.get(f"{BASE_URL}/api/analytics/weekly", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "machine_stats" in data, "Expected machine_stats in analytics"
        print(f"✓ AUTH: GET /api/analytics/weekly with valid JWT returns 200")
    
    def test_paints_with_token(self):
        """GET /api/paints with valid JWT should return 200"""
        response = requests.get(f"{BASE_URL}/api/paints", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of paints"
        print(f"✓ AUTH: GET /api/paints with valid JWT returns 200 ({len(data)} paints)")
    
    def test_shifts_current_with_token(self):
        """GET /api/shifts/current with valid JWT should return 200"""
        response = requests.get(f"{BASE_URL}/api/shifts/current", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ AUTH: GET /api/shifts/current with valid JWT returns 200")
    
    def test_defects_with_token(self):
        """GET /api/defects with valid JWT should return 200"""
        response = requests.get(f"{BASE_URL}/api/defects", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of defects"
        print(f"✓ AUTH: GET /api/defects with valid JWT returns 200")
    
    def test_audit_logs_with_token(self):
        """GET /api/audit-logs with valid JWT should return 200"""
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Audit logs returns {"logs": [...], "total": N}
        assert "logs" in data or isinstance(data, list), "Expected logs in audit response"
        print(f"✓ AUTH: GET /api/audit-logs with valid JWT returns 200")


class TestAllLoginFlows:
    """Test all login flows return valid tokens"""
    
    def test_operator_login_flow(self):
        """Operator login should return valid token"""
        response = requests.post(f"{BASE_URL}/api/users/login", json=OPERATOR_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        
        # Verify token works
        headers = {"Authorization": f"Bearer {data['token']}"}
        verify = requests.get(f"{BASE_URL}/api/machines", headers=headers)
        assert verify.status_code == 200, "Operator token should work for protected endpoints"
        print(f"✓ Operator login flow complete - token works for protected endpoints")
    
    def test_plan_login_flow(self):
        """Plan user login should return valid token"""
        response = requests.post(f"{BASE_URL}/api/users/login", json=PLAN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        
        # Verify token works
        headers = {"Authorization": f"Bearer {data['token']}"}
        verify = requests.get(f"{BASE_URL}/api/jobs", headers=headers)
        assert verify.status_code == 200, "Plan token should work for protected endpoints"
        print(f"✓ Plan login flow complete - token works for protected endpoints")
    
    def test_warehouse_login_flow(self):
        """Warehouse user login should return valid token"""
        response = requests.post(f"{BASE_URL}/api/users/login", json=WAREHOUSE_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        
        # Verify token works
        headers = {"Authorization": f"Bearer {data['token']}"}
        verify = requests.get(f"{BASE_URL}/api/pallets", headers=headers)
        assert verify.status_code == 200, "Warehouse token should work for protected endpoints"
        print(f"✓ Warehouse login flow complete - token works for protected endpoints")
    
    def test_management_login_flow(self):
        """Management login should return valid token"""
        response = requests.post(f"{BASE_URL}/api/management/login", json={"password": MANAGEMENT_PASSWORD})
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        
        # Verify token works
        headers = {"Authorization": f"Bearer {data['token']}"}
        verify = requests.get(f"{BASE_URL}/api/analytics/weekly", headers=headers)
        assert verify.status_code == 200, "Management token should work for protected endpoints"
        print(f"✓ Management login flow complete - token works for protected endpoints")
    
    def test_dashboard_login_flow(self):
        """Dashboard login should return valid token"""
        response = requests.post(f"{BASE_URL}/api/dashboard/login", json={"password": DASHBOARD_PASSWORD})
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data.get("success") == True
        
        # Verify token works for dashboard endpoint
        headers = {"Authorization": f"Bearer {data['token']}"}
        verify = requests.get(f"{BASE_URL}/api/dashboard/live", headers=headers)
        assert verify.status_code == 200, "Dashboard token should work for dashboard/live"
        print(f"✓ Dashboard login flow complete - token works for dashboard/live")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
