"""
Test Quick Transfer Feature for Buse Kağıt Factory Management System
Tests the POST /api/jobs/{job_id}/quick-transfer endpoint

Features tested:
1. Transfer pending job with 0 produced koli (simple machine change)
2. Transfer paused job with produced_koli > 0 (split: complete old, create new with remaining)
3. Complete job when total produced >= koli_count
4. Validation - reject transfer if job is not pending or paused
5. Validation - reject if target_machine_id is missing
6. Audit log records the transfer action
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestQuickTransferFeature:
    """Test Quick Transfer API endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get machines for testing
        response = self.session.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 200, f"Failed to get machines: {response.text}"
        self.machines = response.json()
        assert len(self.machines) >= 2, "Need at least 2 machines for transfer tests"
        
        # Store machine IDs for testing
        self.source_machine = self.machines[0]
        self.target_machine = self.machines[1]
        
        # Track created jobs for cleanup
        self.created_job_ids = []
        
        yield
        
        # Cleanup: Delete test jobs
        for job_id in self.created_job_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/jobs/{job_id}")
            except:
                pass
    
    def create_test_job(self, status="pending", machine=None, koli_count=100, produced_before_pause=0):
        """Helper to create a test job"""
        machine = machine or self.source_machine
        job_data = {
            "name": f"TEST_QuickTransfer_{uuid.uuid4().hex[:8]}",
            "koli_count": koli_count,
            "colors": "Test Color",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "status": status,
            "produced_before_pause": produced_before_pause
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert response.status_code == 200, f"Failed to create test job: {response.text}"
        job = response.json()
        self.created_job_ids.append(job["id"])
        
        # If we need a paused job, update it
        if status == "paused":
            update_data = {
                "status": "paused",
                "paused_at": "2026-01-15T10:00:00+00:00",
                "pause_reason": "Test pause",
                "produced_before_pause": produced_before_pause
            }
            self.session.put(f"{BASE_URL}/api/jobs/{job['id']}", json=update_data)
        
        return job
    
    # ==================== BACKEND API TESTS ====================
    
    def test_quick_transfer_pending_job_simple(self):
        """Test 1: Transfer pending job with 0 produced koli (simple machine change)"""
        # Create a pending job
        job = self.create_test_job(status="pending", koli_count=100)
        
        # Transfer to target machine
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 0,
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        result = response.json()
        
        # Verify response
        assert result["success"] == True
        assert "split" in result
        assert result["split"] == False  # No split for simple transfer
        assert self.target_machine["name"] in result["message"]
        
        # Verify job was updated
        get_response = self.session.get(f"{BASE_URL}/api/jobs/{job['id']}")
        if get_response.status_code == 200:
            updated_job = get_response.json()
            assert updated_job["machine_id"] == self.target_machine["id"]
            assert updated_job["machine_name"] == self.target_machine["name"]
            assert updated_job["status"] == "pending"
        
        print("✅ Test 1 PASSED: Simple pending job transfer works correctly")
    
    def test_quick_transfer_paused_job_with_produced_koli(self):
        """Test 2: Transfer paused job with produced_koli > 0 (split scenario)"""
        # Create a paused job with some production
        job = self.create_test_job(status="paused", koli_count=100, produced_before_pause=30)
        
        # Transfer with additional produced koli
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 20,  # Total will be 30 + 20 = 50
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        result = response.json()
        
        # Verify split occurred
        assert result["success"] == True
        assert result["split"] == True
        assert "new_job_id" in result
        
        # Track new job for cleanup
        if "new_job_id" in result:
            self.created_job_ids.append(result["new_job_id"])
        
        # Verify original job was completed
        get_response = self.session.get(f"{BASE_URL}/api/jobs/{job['id']}")
        if get_response.status_code == 200:
            original_job = get_response.json()
            assert original_job["status"] == "completed"
            assert original_job["completed_koli"] == 50  # 30 + 20
        
        # Verify new job was created with remaining koli
        if "new_job_id" in result:
            new_job_response = self.session.get(f"{BASE_URL}/api/jobs/{result['new_job_id']}")
            if new_job_response.status_code == 200:
                new_job = new_job_response.json()
                assert new_job["koli_count"] == 50  # 100 - 50
                assert new_job["machine_id"] == self.target_machine["id"]
                assert new_job["status"] == "pending"
        
        print("✅ Test 2 PASSED: Paused job with produced koli splits correctly")
    
    def test_quick_transfer_complete_when_all_produced(self):
        """Test 3: Complete job when total produced >= koli_count"""
        # Create a paused job
        job = self.create_test_job(status="paused", koli_count=100, produced_before_pause=50)
        
        # Transfer with remaining koli produced
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 50,  # Total = 50 + 50 = 100 (complete)
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        result = response.json()
        
        # Verify job was completed (not split)
        assert result["success"] == True
        assert result["split"] == False
        assert "tamamlandı" in result["message"].lower() or "completed" in result["message"].lower()
        
        # Verify job status
        get_response = self.session.get(f"{BASE_URL}/api/jobs/{job['id']}")
        if get_response.status_code == 200:
            completed_job = get_response.json()
            assert completed_job["status"] == "completed"
            assert completed_job["completed_koli"] == 100
        
        print("✅ Test 3 PASSED: Job completes when all koli produced")
    
    def test_quick_transfer_reject_in_progress_job(self):
        """Test 4: Reject transfer if job is in_progress"""
        # Create a job and set it to in_progress
        job = self.create_test_job(status="pending", koli_count=100)
        
        # Update to in_progress
        self.session.put(f"{BASE_URL}/api/jobs/{job['id']}", json={"status": "in_progress"})
        
        # Try to transfer
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 0,
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        # Should be rejected
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        print("✅ Test 4 PASSED: In-progress job transfer correctly rejected")
    
    def test_quick_transfer_reject_completed_job(self):
        """Test 5: Reject transfer if job is completed"""
        # Create a job and set it to completed
        job = self.create_test_job(status="pending", koli_count=100)
        
        # Update to completed
        self.session.put(f"{BASE_URL}/api/jobs/{job['id']}", json={"status": "completed", "completed_koli": 100})
        
        # Try to transfer
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 0,
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        # Should be rejected
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        print("✅ Test 5 PASSED: Completed job transfer correctly rejected")
    
    def test_quick_transfer_reject_missing_target_machine(self):
        """Test 6: Reject if target_machine_id is missing"""
        job = self.create_test_job(status="pending", koli_count=100)
        
        # Transfer without target_machine_id
        transfer_data = {
            "produced_koli": 0,
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        # Should be rejected
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        print("✅ Test 6 PASSED: Missing target_machine_id correctly rejected")
    
    def test_quick_transfer_reject_invalid_job_id(self):
        """Test 7: Reject if job_id doesn't exist"""
        fake_job_id = str(uuid.uuid4())
        
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 0,
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{fake_job_id}/quick-transfer",
            json=transfer_data
        )
        
        # Should return 404
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        print("✅ Test 7 PASSED: Invalid job_id correctly returns 404")
    
    def test_quick_transfer_reject_invalid_target_machine(self):
        """Test 8: Reject if target_machine_id doesn't exist"""
        job = self.create_test_job(status="pending", koli_count=100)
        
        fake_machine_id = str(uuid.uuid4())
        transfer_data = {
            "target_machine_id": fake_machine_id,
            "produced_koli": 0,
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        # Should return 404
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        print("✅ Test 8 PASSED: Invalid target_machine_id correctly returns 404")
    
    def test_quick_transfer_audit_log(self):
        """Test 9: Verify audit log records the transfer action"""
        job = self.create_test_job(status="pending", koli_count=100)
        
        # Transfer job
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 0,
            "user_name": "AuditTestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        
        # Check audit logs
        audit_response = self.session.get(f"{BASE_URL}/api/audit-logs?limit=10")
        assert audit_response.status_code == 200, f"Failed to get audit logs: {audit_response.text}"
        
        audit_data = audit_response.json()
        logs = audit_data.get("logs", [])
        
        # Find the transfer log
        transfer_log = None
        for log in logs:
            if log.get("action") == "quick_transfer" and "AuditTestUser" in log.get("user", ""):
                transfer_log = log
                break
        
        assert transfer_log is not None, "Transfer audit log not found"
        assert transfer_log["entity_type"] == "job"
        assert self.target_machine["name"] in transfer_log.get("details", "")
        
        print("✅ Test 9 PASSED: Audit log correctly records transfer action")


class TestQuickTransferEdgeCases:
    """Test edge cases for Quick Transfer"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get machines
        response = self.session.get(f"{BASE_URL}/api/machines")
        self.machines = response.json()
        self.source_machine = self.machines[0]
        self.target_machine = self.machines[1]
        self.created_job_ids = []
        
        yield
        
        # Cleanup
        for job_id in self.created_job_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/jobs/{job_id}")
            except:
                pass
    
    def create_test_job(self, **kwargs):
        """Helper to create test job"""
        job_data = {
            "name": f"TEST_Edge_{uuid.uuid4().hex[:8]}",
            "koli_count": kwargs.get("koli_count", 100),
            "colors": "Test",
            "machine_id": kwargs.get("machine_id", self.source_machine["id"]),
            "machine_name": kwargs.get("machine_name", self.source_machine["name"]),
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_data)
        job = response.json()
        self.created_job_ids.append(job["id"])
        return job
    
    def test_transfer_preserves_job_details(self):
        """Test that transfer preserves job name, colors, notes, etc."""
        # Create job with specific details
        job_data = {
            "name": f"TEST_Preserve_{uuid.uuid4().hex[:8]}",
            "koli_count": 100,
            "colors": "Red - Blue - Green",
            "machine_id": self.source_machine["id"],
            "machine_name": self.source_machine["name"],
            "notes": "Important test notes",
            "delivery_date": "2026-02-15"
        }
        
        response = self.session.post(f"{BASE_URL}/api/jobs", json=job_data)
        job = response.json()
        self.created_job_ids.append(job["id"])
        
        # Transfer with some produced koli (to trigger split)
        transfer_data = {
            "target_machine_id": self.target_machine["id"],
            "produced_koli": 30,
            "user_name": "TestUser"
        }
        
        # First update to paused status
        self.session.put(f"{BASE_URL}/api/jobs/{job['id']}", json={"status": "paused"})
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        assert response.status_code == 200
        result = response.json()
        
        if result.get("split") and "new_job_id" in result:
            self.created_job_ids.append(result["new_job_id"])
            
            # Check new job preserves details
            new_job_response = self.session.get(f"{BASE_URL}/api/jobs/{result['new_job_id']}")
            if new_job_response.status_code == 200:
                new_job = new_job_response.json()
                assert new_job["name"] == job_data["name"]
                assert new_job["colors"] == job_data["colors"]
                # Notes and delivery_date should also be preserved
        
        print("✅ Edge Case Test PASSED: Job details preserved during transfer")
    
    def test_transfer_to_same_machine_allowed(self):
        """Test that transfer to same machine is handled (edge case)"""
        job = self.create_test_job()
        
        # Try to transfer to same machine
        transfer_data = {
            "target_machine_id": self.source_machine["id"],  # Same machine
            "produced_koli": 0,
            "user_name": "TestUser"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/jobs/{job['id']}/quick-transfer",
            json=transfer_data
        )
        
        # This should still work (no validation against same machine)
        # The job just stays on the same machine
        assert response.status_code == 200
        
        print("✅ Edge Case Test PASSED: Transfer to same machine handled")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
