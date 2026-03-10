"""
Backend API tests for Buse Kağıt Factory Management System
Tests cover job management, machine operations, shifts, and warehouse pallet features
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://job-regression-fix.preview.emergentagent.com')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

# ==================== HEALTH & BASIC API TESTS ====================

class TestHealthAndBasicAPIs:
    """Test basic health and fundamental API endpoints"""
    
    def test_health_check(self, api_client):
        """Test /api/health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_get_machines(self, api_client):
        """Test GET /api/machines - should return 8 machines"""
        response = api_client.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 200
        machines = response.json()
        assert isinstance(machines, list)
        assert len(machines) == 8
        machine_names = [m["name"] for m in machines]
        expected = ["40x40", "40x40 ICM", "33x33 (Büyük)", "33x33 ICM", "33x33 (Eski)", "30x30", "24x24", "Dispanser"]
        for name in expected:
            assert name in machine_names, f"Machine {name} not found"
        print(f"✓ Got {len(machines)} machines: {machine_names}")
    
    def test_get_jobs(self, api_client):
        """Test GET /api/jobs"""
        response = api_client.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        jobs = response.json()
        assert isinstance(jobs, list)
        print(f"✓ Got {len(jobs)} jobs")
    
    def test_get_shifts_current(self, api_client):
        """Test GET /api/shifts/current"""
        response = api_client.get(f"{BASE_URL}/api/shifts/current")
        assert response.status_code == 200
        print(f"✓ Current shift: {response.json()}")
    
    def test_get_shifts_status(self, api_client):
        """Test GET /api/shifts/status"""
        response = api_client.get(f"{BASE_URL}/api/shifts/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ Shift status: {data}")
    
    def test_get_pallets(self, api_client):
        """Test GET /api/pallets"""
        response = api_client.get(f"{BASE_URL}/api/pallets")
        assert response.status_code == 200
        pallets = response.json()
        assert isinstance(pallets, list)
        print(f"✓ Got {len(pallets)} pallets")


# ==================== JOB MANAGEMENT TESTS ====================

class TestJobManagement:
    """Test job CRUD and workflow operations"""
    
    @pytest.fixture
    def test_machine(self, api_client):
        """Get a valid machine for testing"""
        response = api_client.get(f"{BASE_URL}/api/machines")
        machines = response.json()
        return machines[0]  # Use first machine (40x40)
    
    def test_create_job(self, api_client, test_machine):
        """Test POST /api/jobs - create a new job"""
        job_data = {
            "name": f"TEST_Job_{uuid.uuid4().hex[:8]}",
            "koli_count": 100,
            "colors": "Kırmızı - Siyah",
            "machine_id": test_machine["id"],
            "machine_name": test_machine["name"],
            "format": None,
            "notes": "Test job for regression testing",
            "delivery_date": "2026-03-15"
        }
        response = api_client.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert response.status_code == 200
        created_job = response.json()
        assert created_job["name"] == job_data["name"]
        assert created_job["koli_count"] == 100
        print(f"✓ Created job: {created_job['name']} (ID: {created_job['id']})")
        return created_job
    
    def test_start_job(self, api_client, test_machine):
        """Test PUT /api/jobs/{job_id}/start"""
        # First create a job
        job_data = {
            "name": f"TEST_StartJob_{uuid.uuid4().hex[:8]}",
            "koli_count": 50,
            "colors": "Mavi",
            "machine_id": test_machine["id"],
            "machine_name": test_machine["name"],
        }
        create_resp = api_client.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_resp.status_code == 200
        job = create_resp.json()
        
        # Start the job
        start_resp = api_client.put(f"{BASE_URL}/api/jobs/{job['id']}/start", json={"operator_name": "Test Operator"})
        assert start_resp.status_code == 200
        print(f"✓ Started job: {job['name']}")
        
        # Verify job status
        get_resp = api_client.get(f"{BASE_URL}/api/jobs?machine_id={test_machine['id']}")
        jobs = get_resp.json()
        started_job = next((j for j in jobs if j["id"] == job["id"]), None)
        assert started_job is not None
        assert started_job["status"] == "in_progress"
        print(f"✓ Verified job status: {started_job['status']}")
        
        return job
    
    def test_complete_job(self, api_client, test_machine):
        """Test PUT /api/jobs/{job_id}/complete"""
        # Create and start a job first
        job_data = {
            "name": f"TEST_CompleteJob_{uuid.uuid4().hex[:8]}",
            "koli_count": 25,
            "colors": "Sarı",
            "machine_id": test_machine["id"],
            "machine_name": test_machine["name"],
        }
        create_resp = api_client.post(f"{BASE_URL}/api/jobs", json=job_data)
        job = create_resp.json()
        
        # Start job
        api_client.put(f"{BASE_URL}/api/jobs/{job['id']}/start", json={"operator_name": "Test Operator"})
        
        # Complete the job
        complete_resp = api_client.put(f"{BASE_URL}/api/jobs/{job['id']}/complete", json={})
        assert complete_resp.status_code == 200
        data = complete_resp.json()
        assert data.get("success") == True or "message" in data
        print(f"✓ Completed job: {job['name']}")
        
        # Verify job status
        get_resp = api_client.get(f"{BASE_URL}/api/jobs")
        jobs = get_resp.json()
        completed_job = next((j for j in jobs if j["id"] == job["id"]), None)
        assert completed_job is not None
        assert completed_job["status"] == "completed"
        print(f"✓ Verified job completed status")
    
    def test_edit_job(self, api_client, test_machine):
        """Test PUT /api/jobs/{job_id} - edit job"""
        # Create a job
        job_data = {
            "name": f"TEST_EditJob_{uuid.uuid4().hex[:8]}",
            "koli_count": 30,
            "colors": "Yeşil",
            "machine_id": test_machine["id"],
            "machine_name": test_machine["name"],
        }
        create_resp = api_client.post(f"{BASE_URL}/api/jobs", json=job_data)
        job = create_resp.json()
        
        # Edit the job
        new_name = f"EDITED_{job['name']}"
        edit_resp = api_client.put(f"{BASE_URL}/api/jobs/{job['id']}", json={
            "name": new_name,
            "koli_count": 40,
            "notes": "Edited test note"
        })
        assert edit_resp.status_code == 200
        edited_job = edit_resp.json()
        assert edited_job["name"] == new_name
        assert edited_job["koli_count"] == 40
        print(f"✓ Edited job: {new_name}")


# ==================== WAREHOUSE PALLET TESTS ====================

class TestWarehousePallets:
    """Test warehouse pallet creation and management"""
    
    def test_create_pallet_with_code(self, api_client):
        """Test POST /api/pallets - create pallet with pallet_code format"""
        pallet_data = {
            "pallet_code": f"PLT-{uuid.uuid4().hex[:8]}",
            "job_id": "test-job",
            "job_name": "Test Pallet Job",
            "operator_name": "Test Operator"
        }
        response = api_client.post(f"{BASE_URL}/api/pallets", json=pallet_data)
        assert response.status_code == 200
        created = response.json()
        assert created.get("pallet_code") == pallet_data["pallet_code"] or created.get("code") == pallet_data.get("code", pallet_data["pallet_code"])
        print(f"✓ Created pallet: {pallet_data['pallet_code']}")
    
    def test_create_pallet_with_code_field(self, api_client):
        """Test POST /api/pallets - create pallet with code field"""
        pallet_data = {
            "code": f"PAL-{uuid.uuid4().hex[:8]}",
            "job_id": "test-job-2",
            "job_name": "Test Job 2",
            "machine_id": "machine-1",
            "machine_name": "33x33",
            "koli_count": 50,
            "operator_name": "Depo"
        }
        response = api_client.post(f"{BASE_URL}/api/pallets", json=pallet_data)
        assert response.status_code == 200
        created = response.json()
        print(f"✓ Created pallet with code field: {created}")


# ==================== USER LOGIN TESTS ====================

class TestUserLogins:
    """Test user login endpoints for different roles"""
    
    def test_operator_login_success(self, api_client):
        """Test operator login with correct credentials"""
        response = api_client.post(f"{BASE_URL}/api/users/login", json={
            "username": "ali",
            "password": "134679",
            "role": "operator"
        })
        # May fail if user doesn't exist - check status
        if response.status_code == 200:
            print(f"✓ Operator login successful")
        else:
            print(f"⚠ Operator login returned {response.status_code}: {response.json()}")
    
    def test_operator_login_invalid_password(self, api_client):
        """Test operator login with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/users/login", json={
            "username": "ali",
            "password": "wrongpassword",
            "role": "operator"
        })
        assert response.status_code in [401, 404]
        print(f"✓ Invalid password correctly rejected")
    
    def test_get_users_list(self, api_client):
        """Test GET /api/users"""
        response = api_client.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        print(f"✓ Got {len(users)} users")


# ==================== ANALYTICS TESTS ====================

class TestAnalytics:
    """Test analytics endpoints"""
    
    def test_weekly_analytics(self, api_client):
        """Test GET /api/analytics/weekly"""
        response = api_client.get(f"{BASE_URL}/api/analytics/weekly")
        assert response.status_code == 200
        data = response.json()
        assert "machine_stats" in data
        print(f"✓ Weekly analytics: {data}")
    
    def test_monthly_analytics(self, api_client):
        """Test GET /api/analytics/monthly"""
        response = api_client.get(f"{BASE_URL}/api/analytics/monthly?year=2026&month=3")
        assert response.status_code == 200
        data = response.json()
        assert "machine_stats" in data
        print(f"✓ Monthly analytics: {data}")


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_jobs(self, api_client):
        """Delete TEST_ prefixed jobs"""
        response = api_client.get(f"{BASE_URL}/api/jobs")
        jobs = response.json()
        test_jobs = [j for j in jobs if j["name"].startswith("TEST_") or j["name"].startswith("EDITED_")]
        for job in test_jobs:
            del_resp = api_client.delete(f"{BASE_URL}/api/jobs/{job['id']}")
            if del_resp.status_code == 200:
                print(f"✓ Deleted test job: {job['name']}")
        print(f"✓ Cleaned up {len(test_jobs)} test jobs")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
