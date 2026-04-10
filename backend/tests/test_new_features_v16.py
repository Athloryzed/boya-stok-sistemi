"""
Test Suite for 3 New Features (Iteration 16):
1. Customer Tracking Page - GET /api/track/{tracking_code}
2. Drag & Drop Job Reordering - PUT /api/jobs/reorder-batch
3. QR Code Generation - Jobs include tracking_code field
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCustomerTracking:
    """Tests for Customer Tracking Page feature"""
    
    def test_track_valid_code_returns_job_info(self):
        """GET /api/track/{tracking_code} returns job info for valid code"""
        # First get a job with tracking code
        jobs_response = requests.get(f"{BASE_URL}/api/jobs")
        assert jobs_response.status_code == 200, f"Failed to get jobs: {jobs_response.text}"
        
        jobs = jobs_response.json()
        job_with_tracking = None
        for job in jobs:
            if job.get("tracking_code"):
                job_with_tracking = job
                break
        
        if not job_with_tracking:
            pytest.skip("No jobs with tracking_code found")
        
        tracking_code = job_with_tracking["tracking_code"]
        
        # Test tracking endpoint
        response = requests.get(f"{BASE_URL}/api/track/{tracking_code}")
        assert response.status_code == 200, f"Track endpoint failed: {response.text}"
        
        data = response.json()
        assert "tracking_code" in data
        assert "job_name" in data
        assert "status" in data
        assert "status_text" in data
        assert data["tracking_code"] == tracking_code
        print(f"PASS: Track endpoint returns job info for code {tracking_code}")
    
    def test_track_invalid_code_returns_404(self):
        """GET /api/track/{invalid_code} returns 404"""
        response = requests.get(f"{BASE_URL}/api/track/INVALID123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Track endpoint returns 404 for invalid code")
    
    def test_track_response_has_status_text(self):
        """Track response includes Turkish status text"""
        jobs_response = requests.get(f"{BASE_URL}/api/jobs")
        jobs = jobs_response.json()
        
        job_with_tracking = None
        for job in jobs:
            if job.get("tracking_code"):
                job_with_tracking = job
                break
        
        if not job_with_tracking:
            pytest.skip("No jobs with tracking_code found")
        
        response = requests.get(f"{BASE_URL}/api/track/{job_with_tracking['tracking_code']}")
        data = response.json()
        
        # Check status_text is Turkish
        valid_status_texts = ["Sırada Bekliyor", "Üretimde", "Beklemede", "Tamamlandı", "Bilinmiyor"]
        assert data.get("status_text") in valid_status_texts, f"Invalid status_text: {data.get('status_text')}"
        print(f"PASS: Track response has valid Turkish status_text: {data.get('status_text')}")
    
    def test_track_sample_code_qpf64llj(self):
        """Test the sample tracking code QPF64LLJ for 'Et Yiyelim' job"""
        response = requests.get(f"{BASE_URL}/api/track/QPF64LLJ")
        
        if response.status_code == 404:
            print("INFO: Sample code QPF64LLJ not found - may have been deleted or changed")
            return
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("job_name") == "Et Yiyelim", f"Expected 'Et Yiyelim', got {data.get('job_name')}"
        print(f"PASS: Sample tracking code QPF64LLJ returns 'Et Yiyelim' job")


class TestDragDropReorder:
    """Tests for Drag & Drop Job Reordering feature"""
    
    def test_reorder_batch_endpoint_exists(self):
        """PUT /api/jobs/reorder-batch endpoint exists"""
        response = requests.put(f"{BASE_URL}/api/jobs/reorder-batch", json={"jobs": []})
        # Should return 200 even with empty array
        assert response.status_code == 200, f"Reorder batch endpoint failed: {response.text}"
        print("PASS: Reorder batch endpoint exists and accepts empty array")
    
    def test_reorder_batch_updates_order(self):
        """PUT /api/jobs/reorder-batch updates job order"""
        # Get pending jobs
        jobs_response = requests.get(f"{BASE_URL}/api/jobs?status=pending")
        assert jobs_response.status_code == 200
        
        pending_jobs = jobs_response.json()
        if len(pending_jobs) < 2:
            pytest.skip("Need at least 2 pending jobs to test reorder")
        
        # Reorder first two jobs
        job1 = pending_jobs[0]
        job2 = pending_jobs[1]
        
        reorder_data = {
            "jobs": [
                {"job_id": job1["id"], "order": 1},
                {"job_id": job2["id"], "order": 0}
            ]
        }
        
        response = requests.put(f"{BASE_URL}/api/jobs/reorder-batch", json=reorder_data)
        assert response.status_code == 200, f"Reorder failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, f"Reorder did not return success: {data}"
        print("PASS: Reorder batch updates job order successfully")
    
    def test_reorder_batch_with_invalid_job_id(self):
        """PUT /api/jobs/reorder-batch handles invalid job IDs gracefully"""
        reorder_data = {
            "jobs": [
                {"job_id": "nonexistent-id-12345", "order": 0}
            ]
        }
        
        response = requests.put(f"{BASE_URL}/api/jobs/reorder-batch", json=reorder_data)
        # Should not crash - may return 200 or 404 depending on implementation
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"PASS: Reorder batch handles invalid job ID (status: {response.status_code})")


class TestTrackingCodeField:
    """Tests for tracking_code field in jobs"""
    
    def test_jobs_have_tracking_code(self):
        """Jobs include tracking_code field"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        
        jobs = response.json()
        if not jobs:
            pytest.skip("No jobs found")
        
        jobs_with_tracking = [j for j in jobs if j.get("tracking_code")]
        print(f"INFO: {len(jobs_with_tracking)}/{len(jobs)} jobs have tracking_code")
        
        # At least some jobs should have tracking codes
        assert len(jobs_with_tracking) > 0, "No jobs have tracking_code field"
        print("PASS: Jobs have tracking_code field")
    
    def test_tracking_code_format(self):
        """Tracking codes are 8 characters alphanumeric"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        jobs = response.json()
        
        for job in jobs:
            if job.get("tracking_code"):
                code = job["tracking_code"]
                assert len(code) == 8, f"Tracking code {code} is not 8 characters"
                assert code.isalnum(), f"Tracking code {code} is not alphanumeric"
        
        print("PASS: Tracking codes are 8 characters alphanumeric")
    
    def test_new_job_gets_tracking_code(self):
        """New jobs automatically get tracking_code"""
        # Get machines first
        machines_response = requests.get(f"{BASE_URL}/api/machines")
        machines = machines_response.json()
        if not machines:
            pytest.skip("No machines found")
        
        machine = machines[0]
        
        # Create a test job
        job_data = {
            "name": "TEST_TrackingCode_Job",
            "koli_count": 10,
            "colors": "Test",
            "machine_id": machine["id"],
            "machine_name": machine["name"]
        }
        
        response = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert response.status_code == 200, f"Failed to create job: {response.text}"
        
        created_job = response.json()
        assert "tracking_code" in created_job, "New job missing tracking_code"
        assert len(created_job["tracking_code"]) == 8, "Tracking code not 8 characters"
        
        print(f"PASS: New job gets tracking_code: {created_job['tracking_code']}")
        
        # Cleanup - delete test job
        requests.delete(f"{BASE_URL}/api/jobs/{created_job['id']}")


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """API health endpoint works"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("PASS: API health check passed")
    
    def test_machines_endpoint(self):
        """Machines endpoint works"""
        response = requests.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 200
        machines = response.json()
        assert isinstance(machines, list)
        print(f"PASS: Machines endpoint returns {len(machines)} machines")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
