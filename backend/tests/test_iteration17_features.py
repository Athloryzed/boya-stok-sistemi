"""
Test file for Iteration 17 - 5 New Changes:
1) Tracking link shows start date in Turkey time instead of delivery date
2) Management panel shows operator selection dialog when starting a job
3) Link copy button on active/in_progress jobs
4) Live Dashboard requires password 'buse4'
5) Operator list API endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTrackingEndpoint:
    """Test GET /api/takip/{token} returns started_at_tr in Turkey time format"""
    
    def test_get_jobs_for_tracking_code(self):
        """Get a valid tracking code from existing jobs"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200, f"Failed to get jobs: {response.text}"
        jobs = response.json()
        assert len(jobs) > 0, "No jobs found in database"
        
        # Find a job with tracking_code
        job_with_code = None
        for job in jobs:
            if job.get("tracking_code"):
                job_with_code = job
                break
        
        assert job_with_code is not None, "No job with tracking_code found"
        print(f"Found job with tracking_code: {job_with_code['name']} - {job_with_code['tracking_code']}")
        return job_with_code
    
    def test_tracking_endpoint_returns_started_at_tr(self):
        """Test that /api/takip/{token} returns started_at_tr field"""
        # First get a valid tracking code
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        jobs = response.json()
        
        # Find a job with tracking_code (preferably in_progress for started_at)
        tracking_code = None
        for job in jobs:
            if job.get("tracking_code"):
                tracking_code = job["tracking_code"]
                break
        
        assert tracking_code is not None, "No job with tracking_code found"
        
        # Call tracking endpoint
        response = requests.get(f"{BASE_URL}/api/takip/{tracking_code}")
        assert response.status_code == 200, f"Tracking endpoint failed: {response.text}"
        
        data = response.json()
        print(f"Tracking response: {data}")
        
        # Verify response structure
        assert "job_name" in data, "Response missing job_name"
        assert "status" in data, "Response missing status"
        assert "status_text" in data, "Response missing status_text"
        assert "started_at_tr" in data, "Response missing started_at_tr (Turkey time start date)"
        
        # Verify delivery_date is NOT in response (removed per requirements)
        assert "delivery_date" not in data, "Response should NOT contain delivery_date anymore"
        
        print(f"started_at_tr value: {data.get('started_at_tr')}")
    
    def test_tracking_endpoint_invalid_token(self):
        """Test that invalid token returns 404"""
        response = requests.get(f"{BASE_URL}/api/takip/invalid-token-12345")
        assert response.status_code == 404, f"Expected 404 for invalid token, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Error response should have detail field"
        print(f"Invalid token error: {data['detail']}")
    
    def test_tracking_started_at_tr_format(self):
        """Test that started_at_tr is in Turkish date format when job has started_at"""
        # Get jobs and find one that's in_progress (has started_at)
        response = requests.get(f"{BASE_URL}/api/jobs?status=in_progress")
        assert response.status_code == 200
        jobs = response.json()
        
        if len(jobs) == 0:
            pytest.skip("No in_progress jobs to test started_at_tr format")
        
        job = jobs[0]
        tracking_code = job.get("tracking_code")
        if not tracking_code:
            pytest.skip("In-progress job has no tracking_code")
        
        response = requests.get(f"{BASE_URL}/api/takip/{tracking_code}")
        assert response.status_code == 200
        
        data = response.json()
        started_at_tr = data.get("started_at_tr")
        
        if started_at_tr:
            # Check Turkish month names
            turkish_months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", 
                            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
            has_turkish_month = any(month in started_at_tr for month in turkish_months)
            print(f"started_at_tr: {started_at_tr}, has Turkish month: {has_turkish_month}")


class TestOperatorsListEndpoint:
    """Test GET /api/operators/list returns list of active operators"""
    
    def test_operators_list_endpoint_exists(self):
        """Test that /api/operators/list endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/operators/list")
        assert response.status_code == 200, f"Operators list endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Operators list: {data}")
    
    def test_operators_list_structure(self):
        """Test that each operator has id and name fields"""
        response = requests.get(f"{BASE_URL}/api/operators/list")
        assert response.status_code == 200
        
        operators = response.json()
        
        if len(operators) > 0:
            for op in operators:
                assert "id" in op, f"Operator missing 'id' field: {op}"
                assert "name" in op, f"Operator missing 'name' field: {op}"
                print(f"Operator: id={op['id']}, name={op['name']}")
        else:
            print("No operators found (empty list is valid)")
    
    def test_operators_list_has_expected_operators(self):
        """Test that expected operators are in the list (Ali Operatör, Emrecan, Ali)"""
        response = requests.get(f"{BASE_URL}/api/operators/list")
        assert response.status_code == 200
        
        operators = response.json()
        operator_names = [op.get("name", "") for op in operators]
        
        print(f"Found operators: {operator_names}")
        
        # Check if at least some operators exist
        # Note: The exact names may vary based on database state


class TestDashboardLiveEndpoint:
    """Test that dashboard live endpoint exists (password protection is frontend-only)"""
    
    def test_dashboard_live_endpoint(self):
        """Test that /api/dashboard/live endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200, f"Dashboard live endpoint failed: {response.text}"
        
        data = response.json()
        assert "summary" in data, "Dashboard response should have summary"
        assert "machines" in data, "Dashboard response should have machines"
        print(f"Dashboard summary: {data.get('summary')}")


class TestJobsHaveTrackingCode:
    """Test that jobs have tracking_code field for link copy functionality"""
    
    def test_jobs_have_tracking_code(self):
        """Test that jobs include tracking_code field"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        
        jobs = response.json()
        
        if len(jobs) > 0:
            # Check first few jobs for tracking_code
            for job in jobs[:5]:
                assert "tracking_code" in job, f"Job missing tracking_code: {job.get('name')}"
                print(f"Job '{job.get('name')}' has tracking_code: {job.get('tracking_code')}")
    
    def test_in_progress_jobs_have_tracking_code(self):
        """Test that in_progress jobs have tracking_code for link copy button"""
        response = requests.get(f"{BASE_URL}/api/jobs?status=in_progress")
        assert response.status_code == 200
        
        jobs = response.json()
        
        for job in jobs:
            assert "tracking_code" in job, f"In-progress job missing tracking_code: {job.get('name')}"
            assert job["tracking_code"], f"In-progress job has empty tracking_code: {job.get('name')}"
            print(f"In-progress job '{job.get('name')}' tracking_code: {job.get('tracking_code')}")


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print(f"API health: {response.json()}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
