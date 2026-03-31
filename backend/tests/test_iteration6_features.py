"""
Test iteration 6 features:
- Audit Log API
- Job creation creates audit log
- Job start creates audit log
- 24h session persistence (backend user login)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuditLogAPI:
    """Test audit log endpoint and functionality"""
    
    def test_audit_logs_endpoint_returns_200(self):
        """GET /api/audit-logs should return 200"""
        response = requests.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/audit-logs returns 200")
    
    def test_audit_logs_response_structure(self):
        """Audit logs response should have logs array and total count"""
        response = requests.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 200
        data = response.json()
        
        assert "logs" in data, "Response should have 'logs' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["logs"], list), "'logs' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        print(f"✓ Audit logs structure valid - {data['total']} total logs")
    
    def test_audit_log_entry_structure(self):
        """Each audit log entry should have required fields"""
        response = requests.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            log = data["logs"][0]
            required_fields = ["id", "user", "action", "entity_type", "entity_name", "details", "created_at"]
            for field in required_fields:
                assert field in log, f"Log entry missing '{field}' field"
            print(f"✓ Audit log entry has all required fields: {required_fields}")
        else:
            print("⚠ No audit logs to verify structure")


class TestJobCreationAuditLog:
    """Test that creating a job creates an audit log entry"""
    
    def test_create_job_creates_audit_log(self):
        """POST /api/jobs should create an audit log entry"""
        # Get initial audit log count
        initial_response = requests.get(f"{BASE_URL}/api/audit-logs")
        initial_count = initial_response.json()["total"]
        
        # Get a machine to assign the job to
        machines_response = requests.get(f"{BASE_URL}/api/machines")
        assert machines_response.status_code == 200
        machines = machines_response.json()
        assert len(machines) > 0, "No machines available"
        machine = machines[0]
        
        # Create a test job
        job_data = {
            "name": f"TEST_AuditJob_{int(time.time())}",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "koli_count": 100,
            "colors": "Test Color",
            "notes": "Test job for audit log verification"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_response.status_code == 200, f"Job creation failed: {create_response.text}"
        created_job = create_response.json()
        print(f"✓ Created test job: {created_job['name']}")
        
        # Check audit log was created
        time.sleep(0.5)  # Small delay for DB write
        audit_response = requests.get(f"{BASE_URL}/api/audit-logs")
        new_count = audit_response.json()["total"]
        
        assert new_count > initial_count, f"Audit log count should increase. Was {initial_count}, now {new_count}"
        
        # Verify the audit log entry
        logs = audit_response.json()["logs"]
        job_create_log = next((log for log in logs if log["entity_name"] == created_job["name"] and log["action"] == "create"), None)
        assert job_create_log is not None, f"No audit log found for job creation: {created_job['name']}"
        assert job_create_log["entity_type"] == "job", "Entity type should be 'job'"
        assert job_create_log["user"] == "Plan", "User should be 'Plan' for job creation"
        print(f"✓ Audit log created for job: {job_create_log}")
        
        # Cleanup - delete the test job
        delete_response = requests.delete(f"{BASE_URL}/api/jobs/{created_job['id']}")
        print(f"✓ Cleaned up test job: {created_job['id']}")


class TestJobStartAuditLog:
    """Test that starting a job creates an audit log entry"""
    
    def test_start_job_creates_audit_log(self):
        """POST /api/jobs/{id}/start should create an audit log entry"""
        # Get a machine
        machines_response = requests.get(f"{BASE_URL}/api/machines")
        machines = machines_response.json()
        machine = machines[0]
        
        # Create a test job
        job_data = {
            "name": f"TEST_StartJob_{int(time.time())}",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "koli_count": 50,
            "colors": "Blue",
            "notes": "Test job for start audit"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_response.status_code == 200
        created_job = create_response.json()
        job_id = created_job["id"]
        print(f"✓ Created test job: {created_job['name']}")
        
        # Get initial audit log count
        initial_response = requests.get(f"{BASE_URL}/api/audit-logs")
        initial_count = initial_response.json()["total"]
        
        # Start the job (PUT method)
        start_data = {"operator_name": "TEST_Operator"}
        start_response = requests.put(f"{BASE_URL}/api/jobs/{job_id}/start", json=start_data)
        assert start_response.status_code == 200, f"Job start failed: {start_response.text}"
        print(f"✓ Started job: {job_id}")
        
        # Check audit log was created
        time.sleep(0.5)
        audit_response = requests.get(f"{BASE_URL}/api/audit-logs")
        new_count = audit_response.json()["total"]
        
        assert new_count > initial_count, f"Audit log count should increase after job start"
        
        # Verify the audit log entry
        logs = audit_response.json()["logs"]
        start_log = next((log for log in logs if log["entity_name"] == created_job["name"] and log["action"] == "start"), None)
        assert start_log is not None, f"No audit log found for job start: {created_job['name']}"
        assert start_log["entity_type"] == "job", "Entity type should be 'job'"
        print(f"✓ Audit log created for job start: {start_log}")
        
        # Cleanup - delete the test job
        requests.delete(f"{BASE_URL}/api/jobs/{job_id}")
        print(f"✓ Cleaned up test job: {job_id}")


class TestUserLogin:
    """Test user login endpoints for different roles"""
    
    def test_operator_login(self):
        """Operator login with ali/134679"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": "ali",
            "password": "134679",
            "role": "operator"
        })
        assert response.status_code == 200, f"Operator login failed: {response.text}"
        data = response.json()
        assert "username" in data or "name" in data, "Login response should contain user info"
        print(f"✓ Operator login successful: {data}")
    
    def test_plan_login(self):
        """Plan login with emrecan/testtest12"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": "emrecan",
            "password": "testtest12",
            "role": "plan"
        })
        assert response.status_code == 200, f"Plan login failed: {response.text}"
        data = response.json()
        print(f"✓ Plan login successful: {data}")
    
    def test_warehouse_login(self):
        """Warehouse login with depo1/depo123"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": "depo1",
            "password": "depo123",
            "role": "depo"
        })
        assert response.status_code == 200, f"Warehouse login failed: {response.text}"
        data = response.json()
        print(f"✓ Warehouse login successful: {data}")
    
    def test_invalid_login_returns_error(self):
        """Invalid credentials should return error"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": "invalid_user",
            "password": "wrong_password",
            "role": "operator"
        })
        assert response.status_code in [401, 404], f"Invalid login should fail, got {response.status_code}"
        print(f"✓ Invalid login correctly rejected with status {response.status_code}")


class TestHealthAndBasicEndpoints:
    """Test basic API health and endpoints"""
    
    def test_health_endpoint(self):
        """Health endpoint should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ Health check passed: {data}")
    
    def test_machines_endpoint(self):
        """Machines endpoint should return list of machines"""
        response = requests.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 200
        machines = response.json()
        assert isinstance(machines, list)
        assert len(machines) > 0, "Should have at least one machine"
        print(f"✓ Machines endpoint returned {len(machines)} machines")
    
    def test_jobs_endpoint(self):
        """Jobs endpoint should return list of jobs"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        jobs = response.json()
        assert isinstance(jobs, list)
        print(f"✓ Jobs endpoint returned {len(jobs)} jobs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
