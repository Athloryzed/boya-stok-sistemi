"""
Test suite to validate backend refactoring from monolithic server.py to modular structure.
Tests all endpoints to ensure functionality is preserved after splitting into:
- database.py, auth.py, models.py, websocket_manager.py
- routes/: health, jobs, users, shifts, analytics, paints, logistics, misc, etc.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from /app/memory/test_credentials.md
MANAGEMENT_PASSWORD = "buse11993"
OPERATOR_CREDS = {"username": "ali", "password": "134679"}
PLAN_CREDS = {"username": "emrecan", "password": "testtest12"}
DEPO_CREDS = {"username": "depo1", "password": "depo123"}


class TestHealthEndpoints:
    """Health and root endpoint tests"""
    
    def test_api_root(self):
        """GET /api/ returns Buse Kagit API message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Buse" in data["message"]
        print(f"Root endpoint: {data}")
    
    def test_api_health(self):
        """GET /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "database" in data
        print(f"Health check: {data}")


class TestAuthenticationEndpoints:
    """Authentication endpoint tests for all user roles"""
    
    def test_management_login_success(self):
        """POST /api/management/login with correct password returns JWT"""
        response = requests.post(
            f"{BASE_URL}/api/management/login",
            json={"password": MANAGEMENT_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "token" in data
        assert data["role"] == "management"
        # Verify JWT format (3 parts separated by dots)
        assert len(data["token"].split(".")) == 3
        print(f"Management login successful, role: {data['role']}")
    
    def test_management_login_wrong_password(self):
        """POST /api/management/login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/management/login",
            json={"password": "wrongpassword"}
        )
        assert response.status_code == 401
        print("Management login correctly rejected wrong password")
    
    def test_operator_login_success(self):
        """POST /api/users/login with operator credentials returns JWT"""
        response = requests.post(
            f"{BASE_URL}/api/users/login",
            json=OPERATOR_CREDS
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "operator"
        assert data["username"] == "ali"
        assert "password" not in data  # Password should be excluded
        print(f"Operator login successful: {data['display_name']}")
    
    def test_plan_login_success(self):
        """POST /api/users/login with plan credentials returns JWT"""
        response = requests.post(
            f"{BASE_URL}/api/users/login",
            json=PLAN_CREDS
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "plan"
        assert data["username"] == "emrecan"
        assert "password" not in data
        print(f"Plan login successful: {data['display_name']}")
    
    def test_depo_login_success(self):
        """POST /api/users/login with depo credentials returns JWT"""
        response = requests.post(
            f"{BASE_URL}/api/users/login",
            json=DEPO_CREDS
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["role"] == "depo"
        assert data["username"] == "depo1"
        assert "password" not in data
        print(f"Depo login successful: {data['display_name']}")
    
    def test_user_login_wrong_credentials(self):
        """POST /api/users/login with wrong credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/users/login",
            json={"username": "ali", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print("User login correctly rejected wrong password")


class TestMachinesEndpoints:
    """Machine management endpoint tests"""
    
    def test_get_machines(self):
        """GET /api/machines returns list of machines"""
        response = requests.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify machine structure
        machine = data[0]
        assert "id" in machine
        assert "name" in machine
        assert "status" in machine
        print(f"Found {len(data)} machines")


class TestJobsEndpoints:
    """Job management endpoint tests"""
    
    def test_get_jobs(self):
        """GET /api/jobs returns list of jobs"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify job structure if jobs exist
        if len(data) > 0:
            job = data[0]
            assert "id" in job
            assert "name" in job
            assert "status" in job
            assert "tracking_code" in job
        print(f"Found {len(data)} jobs")


class TestDashboardEndpoints:
    """Dashboard endpoint tests"""
    
    def test_dashboard_live(self):
        """GET /api/dashboard/live returns machine data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200
        data = response.json()
        assert "timestamp" in data
        assert "summary" in data
        assert "machines" in data
        # Verify summary structure
        summary = data["summary"]
        assert "total_machines" in summary
        assert "working" in summary
        assert "idle" in summary
        print(f"Dashboard live: {summary['total_machines']} machines, {summary['working']} working")


class TestAnalyticsEndpoints:
    """Analytics endpoint tests"""
    
    def test_analytics_weekly(self):
        """GET /api/analytics/weekly returns machine_stats"""
        response = requests.get(f"{BASE_URL}/api/analytics/weekly")
        assert response.status_code == 200
        data = response.json()
        assert "machine_stats" in data
        print(f"Weekly analytics: {data}")


class TestAuditLogsEndpoints:
    """Audit logs endpoint tests"""
    
    def test_get_audit_logs(self):
        """GET /api/audit-logs returns logs"""
        response = requests.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 200
        data = response.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)
        if len(data["logs"]) > 0:
            log = data["logs"][0]
            assert "id" in log
            assert "user" in log
            assert "action" in log
        print(f"Found {len(data['logs'])} audit logs")


class TestPaintsEndpoints:
    """Paint management endpoint tests"""
    
    def test_get_paints(self):
        """GET /api/paints returns paint list"""
        response = requests.get(f"{BASE_URL}/api/paints")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            paint = data[0]
            assert "id" in paint
            assert "name" in paint
            assert "stock_kg" in paint
        print(f"Found {len(data)} paints")


class TestDefectsEndpoints:
    """Defect management endpoint tests"""
    
    def test_get_defects(self):
        """GET /api/defects returns defect list"""
        response = requests.get(f"{BASE_URL}/api/defects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            defect = data[0]
            assert "id" in defect
            assert "machine_id" in defect
            assert "defect_kg" in defect
        print(f"Found {len(data)} defects")


class TestShiftsEndpoints:
    """Shift management endpoint tests"""
    
    def test_get_current_shift(self):
        """GET /api/shifts/current returns current shift"""
        response = requests.get(f"{BASE_URL}/api/shifts/current")
        assert response.status_code == 200
        data = response.json()
        # May return null if no active shift, or shift object
        if data:
            assert "id" in data
            assert "status" in data
        print(f"Current shift: {data}")


class TestLogisticsEndpoints:
    """Logistics (vehicles, drivers, shipments) endpoint tests"""
    
    def test_get_vehicles(self):
        """GET /api/vehicles returns vehicles list"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            vehicle = data[0]
            assert "id" in vehicle
            assert "plate" in vehicle
        print(f"Found {len(data)} vehicles")
    
    def test_get_drivers(self):
        """GET /api/drivers returns drivers list"""
        response = requests.get(f"{BASE_URL}/api/drivers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            driver = data[0]
            assert "id" in driver
            assert "name" in driver
        print(f"Found {len(data)} drivers")
    
    def test_get_shipments(self):
        """GET /api/shipments returns shipments list"""
        response = requests.get(f"{BASE_URL}/api/shipments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            shipment = data[0]
            assert "id" in shipment
            assert "status" in shipment
        print(f"Found {len(data)} shipments")


class TestPalletsEndpoints:
    """Pallet management endpoint tests"""
    
    def test_get_pallets(self):
        """GET /api/pallets returns pallets list"""
        response = requests.get(f"{BASE_URL}/api/pallets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} pallets")


class TestProtectedEndpoints:
    """Test that protected endpoints require authentication"""
    
    def test_get_users_requires_auth(self):
        """GET /api/users without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/users")
        assert response.status_code == 401
        print("GET /api/users correctly requires authentication")
    
    def test_get_users_with_auth(self):
        """GET /api/users with valid token returns user list"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/management/login",
            json={"password": MANAGEMENT_PASSWORD}
        )
        token = login_response.json()["token"]
        
        # Then access protected endpoint
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify no passwords in response
        for user in data:
            assert "password" not in user
        print(f"GET /api/users with auth: found {len(data)} users")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
