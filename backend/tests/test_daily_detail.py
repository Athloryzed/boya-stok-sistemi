"""
Test Daily Analytics Drill-Down API - Iteration 9
Tests the GET /api/analytics/daily-detail endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://plan-batch-complete.preview.emergentagent.com')


class TestDailyDetailAnalytics:
    """Tests for the daily detail analytics endpoint"""
    
    def test_daily_detail_with_data(self):
        """Test daily detail for a day with production data (2026-03-31)"""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-detail?date=2026-03-31")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert "date" in data, "Response should contain 'date'"
        assert "summary" in data, "Response should contain 'summary'"
        assert "machine_chart" in data, "Response should contain 'machine_chart'"
        assert "operator_chart" in data, "Response should contain 'operator_chart'"
        assert "job_details" in data, "Response should contain 'job_details'"
        assert "defect_by_machine" in data, "Response should contain 'defect_by_machine'"
        
        # Verify date
        assert data["date"] == "2026-03-31", f"Expected date 2026-03-31, got {data['date']}"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_koli" in summary, "Summary should contain 'total_koli'"
        assert "completed_jobs" in summary, "Summary should contain 'completed_jobs'"
        assert "started_jobs" in summary, "Summary should contain 'started_jobs'"
        assert "partial_koli" in summary, "Summary should contain 'partial_koli'"
        assert "active_operators" in summary, "Summary should contain 'active_operators'"
        assert "total_defect_kg" in summary, "Summary should contain 'total_defect_kg'"
        
        # Verify data values (based on known test data)
        assert summary["total_koli"] == 100, f"Expected 100 koli, got {summary['total_koli']}"
        assert summary["completed_jobs"] == 2, f"Expected 2 completed jobs, got {summary['completed_jobs']}"
        assert summary["active_operators"] == 2, f"Expected 2 operators, got {summary['active_operators']}"
        
        # Verify machine_chart has data
        assert len(data["machine_chart"]) > 0, "machine_chart should have data"
        assert "name" in data["machine_chart"][0], "machine_chart items should have 'name'"
        assert "koli" in data["machine_chart"][0], "machine_chart items should have 'koli'"
        
        # Verify operator_chart has data
        assert len(data["operator_chart"]) > 0, "operator_chart should have data"
        assert "name" in data["operator_chart"][0], "operator_chart items should have 'name'"
        assert "koli" in data["operator_chart"][0], "operator_chart items should have 'koli'"
        assert "jobs" in data["operator_chart"][0], "operator_chart items should have 'jobs'"
        
        # Verify job_details has data
        assert len(data["job_details"]) > 0, "job_details should have data"
        job = data["job_details"][0]
        assert "id" in job, "job_details items should have 'id'"
        assert "name" in job, "job_details items should have 'name'"
        assert "machine_name" in job, "job_details items should have 'machine_name'"
        assert "operator_name" in job, "job_details items should have 'operator_name'"
        assert "koli_count" in job, "job_details items should have 'koli_count'"
        assert "duration_min" in job, "job_details items should have 'duration_min'"
        
        print(f"PASS: Daily detail for 2026-03-31 - {summary['total_koli']} koli, {summary['completed_jobs']} jobs, {summary['active_operators']} operators")
    
    def test_daily_detail_empty_day(self):
        """Test daily detail for a day with no production data (2026-04-07)"""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-detail?date=2026-04-07")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure exists
        assert "date" in data, "Response should contain 'date'"
        assert "summary" in data, "Response should contain 'summary'"
        
        # Verify date
        assert data["date"] == "2026-04-07", f"Expected date 2026-04-07, got {data['date']}"
        
        # Verify empty/zero data
        summary = data["summary"]
        assert summary["total_koli"] == 0, f"Expected 0 koli, got {summary['total_koli']}"
        assert summary["completed_jobs"] == 0, f"Expected 0 completed jobs, got {summary['completed_jobs']}"
        assert summary["started_jobs"] == 0, f"Expected 0 started jobs, got {summary['started_jobs']}"
        assert summary["active_operators"] == 0, f"Expected 0 operators, got {summary['active_operators']}"
        
        # Verify empty arrays
        assert len(data["machine_chart"]) == 0, "machine_chart should be empty"
        assert len(data["operator_chart"]) == 0, "operator_chart should be empty"
        assert len(data["job_details"]) == 0, "job_details should be empty"
        
        print("PASS: Daily detail for empty day (2026-04-07) returns zero data")
    
    def test_daily_detail_invalid_date_format(self):
        """Test daily detail with invalid date format"""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-detail?date=invalid-date")
        
        # Status code assertion - API returns 200 with error message
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify error message
        assert "error" in data, "Response should contain 'error' for invalid date"
        assert "YYYY-MM-DD" in data["error"], "Error message should mention correct format"
        
        print(f"PASS: Invalid date format returns error: {data['error']}")
    
    def test_daily_detail_missing_date_param(self):
        """Test daily detail without date parameter"""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-detail")
        
        # Should return 422 (validation error) for missing required parameter
        assert response.status_code == 422, f"Expected 422 for missing date param, got {response.status_code}"
        
        print("PASS: Missing date parameter returns 422 validation error")
    
    def test_daily_detail_future_date(self):
        """Test daily detail for a future date (should return empty data)"""
        response = requests.get(f"{BASE_URL}/api/analytics/daily-detail?date=2030-12-31")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify empty data for future date
        assert data["summary"]["total_koli"] == 0, "Future date should have 0 koli"
        assert data["summary"]["completed_jobs"] == 0, "Future date should have 0 completed jobs"
        
        print("PASS: Future date returns empty data")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
