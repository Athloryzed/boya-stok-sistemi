"""
Test suite for Live Dashboard and AI Paint Forecast features (Iteration 13)
- GET /api/dashboard/live - Live dashboard data (no auth required)
- GET /api/ai/paint-forecast - AI paint consumption forecast
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLiveDashboard:
    """Live Dashboard endpoint tests - NO AUTH REQUIRED"""
    
    def test_dashboard_live_returns_200(self):
        """Dashboard live endpoint should return 200 without authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Dashboard live endpoint returns 200")
    
    def test_dashboard_live_has_summary(self):
        """Dashboard should return summary with machine counts"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200
        data = response.json()
        
        assert "summary" in data, "Response missing 'summary' field"
        summary = data["summary"]
        
        # Check required summary fields
        required_fields = ["total_machines", "working", "idle", "koli_today", "completed_today", "pending_total"]
        for field in required_fields:
            assert field in summary, f"Summary missing '{field}' field"
        
        print(f"✓ Dashboard summary: {summary['working']}/{summary['total_machines']} working, {summary['koli_today']} koli today, {summary['pending_total']} pending")
    
    def test_dashboard_live_has_machines_array(self):
        """Dashboard should return machines array with status info"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200
        data = response.json()
        
        assert "machines" in data, "Response missing 'machines' field"
        assert isinstance(data["machines"], list), "Machines should be a list"
        assert len(data["machines"]) > 0, "Machines list should not be empty"
        
        # Check machine structure
        machine = data["machines"][0]
        assert "name" in machine, "Machine missing 'name'"
        assert "status" in machine, "Machine missing 'status'"
        assert machine["status"] in ["working", "idle", "maintenance"], f"Invalid status: {machine['status']}"
        
        print(f"✓ Dashboard has {len(data['machines'])} machines")
        for m in data["machines"]:
            print(f"  - {m['name']}: {m['status']}")
    
    def test_dashboard_live_has_operator_ranking(self):
        """Dashboard should return operator ranking array"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200
        data = response.json()
        
        assert "operator_ranking" in data, "Response missing 'operator_ranking' field"
        assert isinstance(data["operator_ranking"], list), "Operator ranking should be a list"
        
        if len(data["operator_ranking"]) > 0:
            op = data["operator_ranking"][0]
            assert "name" in op, "Operator missing 'name'"
            assert "koli" in op, "Operator missing 'koli'"
            assert "jobs" in op, "Operator missing 'jobs'"
            print(f"✓ Top operator: {op['name']} with {op['koli']} koli")
        else:
            print("✓ Operator ranking is empty (no completed jobs today)")
    
    def test_dashboard_live_has_daily_koli(self):
        """Dashboard should return daily_koli array for chart"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200
        data = response.json()
        
        assert "daily_koli" in data, "Response missing 'daily_koli' field"
        assert isinstance(data["daily_koli"], list), "daily_koli should be a list"
        
        if len(data["daily_koli"]) > 0:
            day = data["daily_koli"][0]
            assert "date" in day, "Daily entry missing 'date'"
            assert "koli" in day, "Daily entry missing 'koli'"
            print(f"✓ Daily koli data: {len(data['daily_koli'])} days")
        else:
            print("✓ Daily koli is empty (no completed jobs in last 7 days)")
    
    def test_dashboard_live_has_timestamp(self):
        """Dashboard should return timestamp"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live")
        assert response.status_code == 200
        data = response.json()
        
        assert "timestamp" in data, "Response missing 'timestamp' field"
        print(f"✓ Dashboard timestamp: {data['timestamp']}")


class TestAIPaintForecast:
    """AI Paint Forecast endpoint tests"""
    
    def test_paint_forecast_returns_200(self):
        """Paint forecast endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/ai/paint-forecast", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Paint forecast endpoint returns 200")
    
    def test_paint_forecast_has_forecast_text(self):
        """Paint forecast should return AI-generated forecast text"""
        response = requests.get(f"{BASE_URL}/api/ai/paint-forecast", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert "forecast" in data, "Response missing 'forecast' field"
        assert isinstance(data["forecast"], str), "Forecast should be a string"
        assert len(data["forecast"]) > 10, "Forecast text seems too short"
        
        print(f"✓ AI Forecast (first 200 chars): {data['forecast'][:200]}...")
    
    def test_paint_forecast_has_paints_array(self):
        """Paint forecast should return paints array with days_left"""
        response = requests.get(f"{BASE_URL}/api/ai/paint-forecast", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert "paints" in data, "Response missing 'paints' field"
        assert isinstance(data["paints"], list), "Paints should be a list"
        
        if len(data["paints"]) > 0:
            paint = data["paints"][0]
            assert "name" in paint, "Paint missing 'name'"
            assert "stock" in paint, "Paint missing 'stock'"
            assert "daily_avg" in paint, "Paint missing 'daily_avg'"
            assert "days_left" in paint, "Paint missing 'days_left'"
            assert "critical" in paint, "Paint missing 'critical'"
            
            print(f"✓ Paint forecast has {len(data['paints'])} paints")
            for p in data["paints"][:5]:
                days = p['days_left'] if p['days_left'] else 'N/A'
                critical = "⚠️ CRITICAL" if p['critical'] else ""
                print(f"  - {p['name']}: {p['stock']}L, ~{days} days {critical}")
    
    def test_paint_forecast_has_critical_count(self):
        """Paint forecast should return critical_count"""
        response = requests.get(f"{BASE_URL}/api/ai/paint-forecast", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert "critical_count" in data, "Response missing 'critical_count' field"
        assert isinstance(data["critical_count"], int), "critical_count should be an integer"
        
        print(f"✓ Critical paints count: {data['critical_count']}")
    
    def test_paint_forecast_has_total_paints(self):
        """Paint forecast should return total_paints count"""
        response = requests.get(f"{BASE_URL}/api/ai/paint-forecast", timeout=30)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_paints" in data, "Response missing 'total_paints' field"
        assert isinstance(data["total_paints"], int), "total_paints should be an integer"
        
        print(f"✓ Total paints: {data['total_paints']}")


class TestDashboardNoAuth:
    """Verify dashboard requires NO authentication"""
    
    def test_dashboard_accessible_without_headers(self):
        """Dashboard should be accessible without any auth headers"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live", headers={})
        assert response.status_code == 200, "Dashboard should work without auth headers"
        print("✓ Dashboard accessible without auth headers")
    
    def test_dashboard_accessible_with_random_headers(self):
        """Dashboard should work even with random/invalid headers"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/live",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code == 200, "Dashboard should ignore invalid auth"
        print("✓ Dashboard ignores invalid auth headers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
