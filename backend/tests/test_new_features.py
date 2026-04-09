"""
Test suite for 3 new features in Buse Kağıt Factory Management System:
1. Job Transfer Timeline - shows which machines a job passed through
2. Shift End Koli Tracking - remaining koli properly tracked across shifts
3. Auto-resume on Shift Start - partially done jobs automatically resume
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTransferHistory:
    """Test transfer_history field in jobs"""
    
    def test_quick_transfer_records_history(self):
        """POST /api/jobs/{job_id}/quick-transfer should record transfer_history"""
        # First create a test job
        machines_res = requests.get(f"{BASE_URL}/api/machines")
        assert machines_res.status_code == 200
        machines = machines_res.json()
        assert len(machines) >= 2, "Need at least 2 machines for transfer test"
        
        source_machine = machines[0]
        target_machine = machines[1]
        
        # Create a test job
        job_data = {
            "name": "TEST_TransferHistory_Job",
            "koli_count": 50,
            "colors": "Test Color",
            "machine_id": source_machine["id"],
            "machine_name": source_machine["name"],
            "status": "pending"
        }
        create_res = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_res.status_code == 200
        job = create_res.json()
        job_id = job["id"]
        
        try:
            # Transfer the job
            transfer_res = requests.post(f"{BASE_URL}/api/jobs/{job_id}/quick-transfer", json={
                "target_machine_id": target_machine["id"],
                "produced_koli": 0,
                "user_name": "TestUser"
            })
            assert transfer_res.status_code == 200
            transfer_data = transfer_res.json()
            assert transfer_data["success"] == True
            
            # Verify transfer_history was recorded
            job_res = requests.get(f"{BASE_URL}/api/jobs")
            jobs = job_res.json()
            transferred_job = next((j for j in jobs if j["name"] == "TEST_TransferHistory_Job" and j["status"] == "pending"), None)
            
            assert transferred_job is not None, "Transferred job not found"
            assert "transfer_history" in transferred_job
            assert len(transferred_job["transfer_history"]) == 1
            
            history_entry = transferred_job["transfer_history"][0]
            assert history_entry["from_machine"] == source_machine["name"]
            assert history_entry["to_machine"] == target_machine["name"]
            assert history_entry["produced_koli"] == 0
            assert history_entry["transferred_by"] == "TestUser"
            assert "transferred_at" in history_entry
            
            print(f"✓ Transfer history recorded correctly: {history_entry}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/jobs/{job_id}")
    
    def test_split_transfer_preserves_history(self):
        """When job is split, new job should inherit transfer_history"""
        machines_res = requests.get(f"{BASE_URL}/api/machines")
        machines = machines_res.json()
        source_machine = machines[0]
        target_machine = machines[1]
        
        # Create a test job
        job_data = {
            "name": "TEST_SplitHistory_Job",
            "koli_count": 100,
            "colors": "Test Color",
            "machine_id": source_machine["id"],
            "machine_name": source_machine["name"],
            "status": "pending"
        }
        create_res = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_res.status_code == 200
        job = create_res.json()
        job_id = job["id"]
        
        try:
            # Transfer with produced_koli > 0 (split scenario)
            transfer_res = requests.post(f"{BASE_URL}/api/jobs/{job_id}/quick-transfer", json={
                "target_machine_id": target_machine["id"],
                "produced_koli": 30,
                "user_name": "TestUser"
            })
            assert transfer_res.status_code == 200
            transfer_data = transfer_res.json()
            assert transfer_data["split"] == True
            assert "new_job_id" in transfer_data
            
            new_job_id = transfer_data["new_job_id"]
            
            # Verify new job has transfer_history
            job_res = requests.get(f"{BASE_URL}/api/jobs")
            jobs = job_res.json()
            new_job = next((j for j in jobs if j["id"] == new_job_id), None)
            
            assert new_job is not None, "New split job not found"
            assert "transfer_history" in new_job
            assert len(new_job["transfer_history"]) == 1
            
            history_entry = new_job["transfer_history"][0]
            assert history_entry["produced_koli"] == 30
            assert new_job["koli_count"] == 70  # 100 - 30
            
            print(f"✓ Split transfer preserves history: new job has {len(new_job['transfer_history'])} history entries")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/jobs/{job_id}")
            if 'new_job_id' in locals():
                requests.delete(f"{BASE_URL}/api/jobs/{new_job_id}")


class TestRemainingKoliTracking:
    """Test remaining_koli tracking across shifts"""
    
    def test_approve_report_accumulates_completed_koli(self):
        """approve_operator_report should accumulate completed_koli, not replace"""
        # Get current shift
        shift_res = requests.get(f"{BASE_URL}/api/shifts/current")
        if shift_res.status_code != 200 or not shift_res.json():
            # Start a shift if none active
            requests.post(f"{BASE_URL}/api/shifts/start")
            shift_res = requests.get(f"{BASE_URL}/api/shifts/current")
        
        shift = shift_res.json()
        shift_id = shift["id"]
        
        # Get machines
        machines_res = requests.get(f"{BASE_URL}/api/machines")
        machines = machines_res.json()
        machine = machines[0]
        
        # Create a test job with some completed_koli already
        job_data = {
            "name": "TEST_AccumulateKoli_Job",
            "koli_count": 100,
            "colors": "Test Color",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "status": "in_progress",
            "completed_koli": 20,  # Already has 20 completed
            "remaining_koli": 80
        }
        create_res = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_res.status_code == 200
        job = create_res.json()
        job_id = job["id"]
        
        try:
            # Submit operator report with additional produced koli
            report_data = {
                "shift_id": shift_id,
                "operator_id": "test_op",
                "operator_name": "Test Operator",
                "machine_id": machine["id"],
                "machine_name": machine["name"],
                "job_id": job_id,
                "job_name": "TEST_AccumulateKoli_Job",
                "target_koli": 80,  # remaining_koli
                "produced_koli": 30,  # Produced 30 more
                "defect_kg": 0,
                "is_completed": False
            }
            report_res = requests.post(f"{BASE_URL}/api/shifts/operator-report", json=report_data)
            assert report_res.status_code == 200
            report = report_res.json()
            report_id = report["report_id"]
            
            # Approve the report
            approve_res = requests.post(f"{BASE_URL}/api/shifts/approve-report/{report_id}", json={"approved_by": "Test"})
            assert approve_res.status_code == 200
            
            # Verify completed_koli was accumulated
            job_res = requests.get(f"{BASE_URL}/api/jobs")
            jobs = job_res.json()
            updated_job = next((j for j in jobs if j["id"] == job_id), None)
            
            if updated_job:
                # Should be 20 (previous) + 30 (new) = 50
                assert updated_job["completed_koli"] == 50, f"Expected 50, got {updated_job['completed_koli']}"
                assert updated_job["remaining_koli"] == 50, f"Expected 50 remaining, got {updated_job['remaining_koli']}"
                print(f"✓ completed_koli accumulated correctly: 20 + 30 = {updated_job['completed_koli']}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/jobs/{job_id}")
    
    def test_request_shift_end_uses_remaining_koli(self):
        """request_shift_end should use remaining_koli as target when available"""
        # Get current shift
        shift_res = requests.get(f"{BASE_URL}/api/shifts/current")
        if shift_res.status_code != 200 or not shift_res.json():
            requests.post(f"{BASE_URL}/api/shifts/start")
        
        # Get machines
        machines_res = requests.get(f"{BASE_URL}/api/machines")
        machines = machines_res.json()
        machine = machines[0]
        
        # Create a job with remaining_koli
        job_data = {
            "name": "TEST_RemainingKoli_Job",
            "koli_count": 100,
            "colors": "Test Color",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "status": "in_progress",
            "completed_koli": 40,
            "remaining_koli": 60
        }
        create_res = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_res.status_code == 200
        job = create_res.json()
        job_id = job["id"]
        
        try:
            # Request shift end
            end_res = requests.post(f"{BASE_URL}/api/shifts/request-end")
            assert end_res.status_code == 200
            end_data = end_res.json()
            
            # Check if active_jobs contains our job with correct target
            active_jobs = end_data.get("active_jobs", [])
            our_job = next((j for j in active_jobs if j.get("job_id") == job_id), None)
            
            if our_job:
                # target_koli should be remaining_koli (60), not koli_count (100)
                assert our_job["target_koli"] == 60, f"Expected target_koli=60, got {our_job['target_koli']}"
                assert our_job["original_koli"] == 100, f"Expected original_koli=100, got {our_job['original_koli']}"
                print(f"✓ request_shift_end uses remaining_koli as target: {our_job['target_koli']}")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/jobs/{job_id}")


class TestAutoResumeOnShiftStart:
    """Test auto-resume of partially done jobs on shift start"""
    
    def test_shift_start_auto_resumes_partial_jobs(self):
        """POST /api/shifts/start should auto-resume jobs with completed_koli > 0 and remaining_koli > 0"""
        # First, end any active shift
        shift_res = requests.get(f"{BASE_URL}/api/shifts/current")
        if shift_res.status_code == 200 and shift_res.json():
            requests.post(f"{BASE_URL}/api/shifts/end")
            time.sleep(0.5)
        
        # Get machines
        machines_res = requests.get(f"{BASE_URL}/api/machines")
        machines = machines_res.json()
        machine = machines[0]
        
        # Create a partially completed job (pending status with completed_koli > 0)
        job_data = {
            "name": "TEST_AutoResume_Job",
            "koli_count": 100,
            "colors": "Test Color",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "status": "pending",
            "completed_koli": 25,
            "remaining_koli": 75
        }
        create_res = requests.post(f"{BASE_URL}/api/jobs", json=job_data)
        assert create_res.status_code == 200
        job = create_res.json()
        job_id = job["id"]
        
        try:
            # Start a new shift
            start_res = requests.post(f"{BASE_URL}/api/shifts/start")
            assert start_res.status_code == 200
            start_data = start_res.json()
            
            # Check resumed_jobs count
            resumed_count = start_data.get("resumed_jobs", 0)
            print(f"Shift start response: resumed_jobs = {resumed_count}")
            
            # Verify the job was auto-resumed
            job_res = requests.get(f"{BASE_URL}/api/jobs")
            jobs = job_res.json()
            our_job = next((j for j in jobs if j["id"] == job_id), None)
            
            assert our_job is not None, "Test job not found"
            assert our_job["status"] == "in_progress", f"Expected status=in_progress, got {our_job['status']}"
            
            # Verify machine status is working
            machines_res = requests.get(f"{BASE_URL}/api/machines")
            machines = machines_res.json()
            our_machine = next((m for m in machines if m["id"] == machine["id"]), None)
            
            assert our_machine["status"] == "working", f"Expected machine status=working, got {our_machine['status']}"
            assert our_machine["current_job_id"] == job_id, "Machine should have current_job_id set"
            
            print(f"✓ Auto-resume working: job status={our_job['status']}, machine status={our_machine['status']}")
            
        finally:
            # Cleanup - complete the job first
            requests.put(f"{BASE_URL}/api/jobs/{job_id}/complete", json={})
            requests.delete(f"{BASE_URL}/api/jobs/{job_id}")
    
    def test_shift_start_response_includes_resumed_count(self):
        """Shift start response should include resumed_jobs count"""
        # End any active shift
        shift_res = requests.get(f"{BASE_URL}/api/shifts/current")
        if shift_res.status_code == 200 and shift_res.json():
            requests.post(f"{BASE_URL}/api/shifts/end")
            time.sleep(0.5)
        
        # Start a new shift
        start_res = requests.post(f"{BASE_URL}/api/shifts/start")
        assert start_res.status_code == 200
        start_data = start_res.json()
        
        # Verify response structure
        assert "id" in start_data
        assert "started_at" in start_data
        assert "status" in start_data
        assert "resumed_jobs" in start_data
        
        print(f"✓ Shift start response includes resumed_jobs: {start_data['resumed_jobs']}")


class TestExistingData:
    """Test with existing data in the system"""
    
    def test_et_yiyelim_has_transfer_history(self):
        """Verify 'Et Yiyelim' job has transfer_history from previous test"""
        jobs_res = requests.get(f"{BASE_URL}/api/jobs")
        assert jobs_res.status_code == 200
        jobs = jobs_res.json()
        
        et_yiyelim = next((j for j in jobs if j["name"] == "Et Yiyelim"), None)
        
        if et_yiyelim:
            assert "transfer_history" in et_yiyelim
            assert len(et_yiyelim["transfer_history"]) >= 1
            print(f"✓ 'Et Yiyelim' has {len(et_yiyelim['transfer_history'])} transfer history entries")
            for entry in et_yiyelim["transfer_history"]:
                print(f"  - {entry['from_machine']} → {entry['to_machine']} ({entry['produced_koli']} koli)")
        else:
            pytest.skip("'Et Yiyelim' job not found in system")
    
    def test_laluna_has_partial_completion(self):
        """Verify 'Laluna' job has partial completion (completed_koli=18, remaining_koli=12)"""
        jobs_res = requests.get(f"{BASE_URL}/api/jobs")
        assert jobs_res.status_code == 200
        jobs = jobs_res.json()
        
        laluna = next((j for j in jobs if j["name"] == "Laluna"), None)
        
        if laluna:
            assert laluna["completed_koli"] == 18, f"Expected completed_koli=18, got {laluna['completed_koli']}"
            assert laluna["remaining_koli"] == 12, f"Expected remaining_koli=12, got {laluna['remaining_koli']}"
            assert laluna["status"] == "in_progress", f"Expected status=in_progress, got {laluna['status']}"
            print(f"✓ 'Laluna' has partial completion: {laluna['completed_koli']}/{laluna['koli_count']} (remaining: {laluna['remaining_koli']})")
        else:
            pytest.skip("'Laluna' job not found in system")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
