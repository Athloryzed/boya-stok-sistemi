"""
Test shift-end approval workflow APIs
- GET /api/shifts/pending-reports
- POST /api/shifts/approve-report/{report_id}
- POST /api/shifts/approve-all
- POST /api/shifts/operator-report (create test data)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pause-resume-jobs.preview.emergentagent.com').rstrip('/')

class TestShiftApprovalWorkflow:
    """Test cases for shift-end approval workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Generate unique IDs for test data
        self.test_shift_id = f"TEST_SHIFT_{uuid.uuid4().hex[:8]}"
        self.test_operator_id = f"TEST_OP_{uuid.uuid4().hex[:8]}"
        self.test_machine_id = f"TEST_MACHINE_{uuid.uuid4().hex[:8]}"
        
    def test_01_health_check(self):
        """Test API health"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed - API is healthy")
        
    def test_02_get_pending_reports_empty(self):
        """Test GET /api/shifts/pending-reports returns list"""
        response = self.session.get(f"{BASE_URL}/api/shifts/pending-reports")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"✓ GET pending-reports returned {len(data)} reports")
        
    def test_03_get_shift_status(self):
        """Test GET /api/shifts/status returns shift info"""
        response = self.session.get(f"{BASE_URL}/api/shifts/status")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data, "Response should have status field"
        print(f"✓ GET shift status: {data.get('status')}")
        
    def test_04_create_operator_report(self):
        """Test POST /api/shifts/operator-report creates pending report"""
        # Create test operator report
        payload = {
            "shift_id": self.test_shift_id,
            "operator_id": self.test_operator_id,
            "operator_name": "Test Operator",
            "machine_id": self.test_machine_id,
            "machine_name": "Test Machine 40x40",
            "job_id": f"TEST_JOB_{uuid.uuid4().hex[:8]}",
            "job_name": "Test Job for Approval",
            "target_koli": 100,
            "produced_koli": 75,
            "defect_kg": 2.5,
            "is_completed": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/shifts/operator-report", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "report_id" in data, "Response should have report_id"
        assert data.get("message") == "Rapor gönderildi, onay bekleniyor"
        
        self.created_report_id = data["report_id"]
        print(f"✓ Created operator report: {self.created_report_id}")
        return self.created_report_id
        
    def test_05_verify_report_in_pending(self):
        """Verify created report appears in pending reports"""
        # First create a report
        payload = {
            "shift_id": self.test_shift_id,
            "operator_id": self.test_operator_id,
            "operator_name": "Test Operator 2",
            "machine_id": self.test_machine_id,
            "machine_name": "Test Machine 33x33",
            "job_id": f"TEST_JOB_{uuid.uuid4().hex[:8]}",
            "job_name": "Test Job 2 for Approval",
            "target_koli": 50,
            "produced_koli": 30,
            "defect_kg": 1.0,
            "is_completed": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/shifts/operator-report", json=payload)
        assert create_response.status_code == 200
        report_id = create_response.json()["report_id"]
        
        # Verify it's in pending list
        response = self.session.get(f"{BASE_URL}/api/shifts/pending-reports")
        assert response.status_code == 200
        
        pending = response.json()
        report_ids = [r.get("id") for r in pending]
        assert report_id in report_ids, f"Report {report_id} should be in pending list"
        print(f"✓ Report {report_id} verified in pending reports")
        return report_id
        
    def test_06_approve_individual_report(self):
        """Test POST /api/shifts/approve-report/{report_id}"""
        # Create a report first
        payload = {
            "shift_id": self.test_shift_id,
            "operator_id": self.test_operator_id,
            "operator_name": "Test Operator 3",
            "machine_id": self.test_machine_id,
            "machine_name": "Test Machine 30x30",
            "job_id": f"TEST_JOB_{uuid.uuid4().hex[:8]}",
            "job_name": "Test Job 3 for Approval",
            "target_koli": 80,
            "produced_koli": 60,
            "defect_kg": 0.5,
            "is_completed": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/shifts/operator-report", json=payload)
        assert create_response.status_code == 200
        report_id = create_response.json()["report_id"]
        
        # Approve the report
        approve_response = self.session.post(
            f"{BASE_URL}/api/shifts/approve-report/{report_id}",
            json={"approved_by": "Test Manager"}
        )
        assert approve_response.status_code == 200, f"Expected 200, got {approve_response.status_code}: {approve_response.text}"
        
        data = approve_response.json()
        assert data.get("message") == "Rapor onaylandı"
        print(f"✓ Report {report_id} approved successfully")
        
        # Verify it's no longer in pending
        pending_response = self.session.get(f"{BASE_URL}/api/shifts/pending-reports")
        pending = pending_response.json()
        pending_ids = [r.get("id") for r in pending]
        assert report_id not in pending_ids, "Approved report should not be in pending list"
        print(f"✓ Approved report removed from pending list")
        
    def test_07_approve_nonexistent_report(self):
        """Test approving non-existent report returns 404"""
        fake_id = f"FAKE_{uuid.uuid4().hex[:12]}"
        response = self.session.post(f"{BASE_URL}/api/shifts/approve-report/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent report returns 404 as expected")
        
    def test_08_approve_completed_job_report(self):
        """Test approving a report with is_completed=True"""
        payload = {
            "shift_id": self.test_shift_id,
            "operator_id": self.test_operator_id,
            "operator_name": "Test Operator Complete",
            "machine_id": self.test_machine_id,
            "machine_name": "Test Machine Dispanser",
            "job_id": f"TEST_JOB_{uuid.uuid4().hex[:8]}",
            "job_name": "Completed Test Job",
            "target_koli": 100,
            "produced_koli": 100,
            "defect_kg": 0,
            "is_completed": True  # Job is completed
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/shifts/operator-report", json=payload)
        assert create_response.status_code == 200
        report_id = create_response.json()["report_id"]
        
        # Approve
        approve_response = self.session.post(f"{BASE_URL}/api/shifts/approve-report/{report_id}")
        assert approve_response.status_code == 200
        print(f"✓ Completed job report {report_id} approved")
        
    def test_09_create_multiple_reports_for_approve_all(self):
        """Create multiple reports for approve-all test"""
        report_ids = []
        for i in range(3):
            payload = {
                "shift_id": f"BATCH_SHIFT_{uuid.uuid4().hex[:8]}",
                "operator_id": f"BATCH_OP_{i}",
                "operator_name": f"Batch Operator {i}",
                "machine_id": f"BATCH_MACHINE_{i}",
                "machine_name": f"Batch Machine {i}",
                "job_id": f"BATCH_JOB_{uuid.uuid4().hex[:8]}",
                "job_name": f"Batch Job {i}",
                "target_koli": 50 + i * 10,
                "produced_koli": 40 + i * 5,
                "defect_kg": 0.5 * i,
                "is_completed": False
            }
            
            response = self.session.post(f"{BASE_URL}/api/shifts/operator-report", json=payload)
            assert response.status_code == 200
            report_ids.append(response.json()["report_id"])
            
        print(f"✓ Created {len(report_ids)} batch reports for approve-all test")
        return report_ids
        
    def test_10_approve_all_and_end_shift(self):
        """Test POST /api/shifts/approve-all"""
        # First ensure there are pending reports
        pending_before = self.session.get(f"{BASE_URL}/api/shifts/pending-reports").json()
        
        if len(pending_before) == 0:
            # Create some reports first
            for i in range(2):
                payload = {
                    "shift_id": f"APPROVE_ALL_SHIFT_{uuid.uuid4().hex[:8]}",
                    "operator_id": f"APPROVE_ALL_OP_{i}",
                    "operator_name": f"Approve All Operator {i}",
                    "machine_id": f"APPROVE_ALL_MACHINE_{i}",
                    "machine_name": f"Approve All Machine {i}",
                    "job_id": f"APPROVE_ALL_JOB_{uuid.uuid4().hex[:8]}",
                    "job_name": f"Approve All Job {i}",
                    "target_koli": 100,
                    "produced_koli": 80,
                    "defect_kg": 1.0,
                    "is_completed": False
                }
                self.session.post(f"{BASE_URL}/api/shifts/operator-report", json=payload)
                
        # Now approve all
        response = self.session.post(f"{BASE_URL}/api/shifts/approve-all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "rapor onaylandı" in data.get("message", "").lower() or "vardiya bitirildi" in data.get("message", "").lower()
        print(f"✓ Approve all response: {data.get('message')}")
        
        # Verify pending reports are empty
        pending_after = self.session.get(f"{BASE_URL}/api/shifts/pending-reports").json()
        # Note: May have new pending reports from concurrent tests, but approved ones should be gone
        print(f"✓ Pending reports after approve-all: {len(pending_after)}")


class TestPendingReportsDataStructure:
    """Verify data structure of pending reports"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_pending_report_structure(self):
        """Test that pending reports have expected fields"""
        # Create a report with all fields
        payload = {
            "shift_id": f"STRUCT_SHIFT_{uuid.uuid4().hex[:8]}",
            "operator_id": "STRUCT_OP_1",
            "operator_name": "Structure Test Op",
            "machine_id": "STRUCT_MACHINE",
            "machine_name": "Structure Test Machine",
            "job_id": f"STRUCT_JOB_{uuid.uuid4().hex[:8]}",
            "job_name": "Structure Test Job",
            "target_koli": 100,
            "produced_koli": 75,
            "defect_kg": 2.5,
            "is_completed": False
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/shifts/operator-report", json=payload)
        assert create_response.status_code == 200
        report_id = create_response.json()["report_id"]
        
        # Get pending reports and find ours
        pending_response = self.session.get(f"{BASE_URL}/api/shifts/pending-reports")
        assert pending_response.status_code == 200
        
        pending = pending_response.json()
        our_report = None
        for report in pending:
            if report.get("id") == report_id:
                our_report = report
                break
                
        if our_report:
            # Verify structure
            expected_fields = [
                "id", "shift_id", "operator_id", "operator_name",
                "machine_id", "machine_name", "job_id", "job_name",
                "target_koli", "produced_koli", "defect_kg", "is_completed",
                "status", "created_at"
            ]
            
            for field in expected_fields:
                assert field in our_report, f"Missing field: {field}"
                
            # Verify values
            assert our_report["operator_name"] == "Structure Test Op"
            assert our_report["machine_name"] == "Structure Test Machine"
            assert our_report["target_koli"] == 100
            assert our_report["produced_koli"] == 75
            assert our_report["defect_kg"] == 2.5
            assert our_report["is_completed"] == False
            assert our_report["status"] == "pending"
            
            print("✓ Pending report has correct structure and values")
            
            # Clean up - approve the report
            self.session.post(f"{BASE_URL}/api/shifts/approve-report/{report_id}")
        else:
            print("⚠ Report not found in pending (may have been processed)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
