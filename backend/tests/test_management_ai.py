"""
Test Management AI Assistant APIs - Iteration 12
Tests for:
- GET /api/ai/management-overview - Factory analysis overview
- POST /api/ai/management-chat - Management chat with AI
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestManagementAIOverview:
    """Tests for GET /api/ai/management-overview endpoint"""
    
    def test_management_overview_returns_200(self):
        """Test that management overview endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/ai/management-overview", timeout=60)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Management overview returned 200")
    
    def test_management_overview_has_overview_text(self):
        """Test that response contains overview text"""
        response = requests.get(f"{BASE_URL}/api/ai/management-overview", timeout=60)
        assert response.status_code == 200
        data = response.json()
        assert "overview" in data, "Response missing 'overview' field"
        assert isinstance(data["overview"], str), "Overview should be a string"
        assert len(data["overview"]) > 50, "Overview text should be substantial"
        print(f"✓ Overview text present: {data['overview'][:100]}...")
    
    def test_management_overview_has_stats_object(self):
        """Test that response contains stats object with required fields"""
        response = requests.get(f"{BASE_URL}/api/ai/management-overview", timeout=60)
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data, "Response missing 'stats' field"
        
        stats = data["stats"]
        required_fields = [
            "total_machines", "working", "idle", "maintenance",
            "pending_jobs", "completed_today", "koli_today",
            "completed_7d", "koli_7d", "defect_kg_7d", "active_operators"
        ]
        
        for field in required_fields:
            assert field in stats, f"Stats missing required field: {field}"
            print(f"  ✓ stats.{field} = {stats[field]}")
        
        print(f"✓ All required stats fields present")
    
    def test_management_overview_stats_are_numeric(self):
        """Test that stats values are numeric"""
        response = requests.get(f"{BASE_URL}/api/ai/management-overview", timeout=60)
        assert response.status_code == 200
        data = response.json()
        stats = data["stats"]
        
        for key, value in stats.items():
            assert isinstance(value, (int, float)), f"stats.{key} should be numeric, got {type(value)}"
        
        print(f"✓ All stats values are numeric")
    
    def test_management_overview_turkish_response(self):
        """Test that AI response is in Turkish"""
        response = requests.get(f"{BASE_URL}/api/ai/management-overview", timeout=60)
        assert response.status_code == 200
        data = response.json()
        overview = data["overview"].lower()
        
        # Check for common Turkish words
        turkish_indicators = ["makine", "üretim", "iş", "koli", "fabrika", "durum", "verimlilik", "operatör"]
        found_turkish = any(word in overview for word in turkish_indicators)
        assert found_turkish, f"Response doesn't appear to be in Turkish: {overview[:200]}"
        print(f"✓ Response is in Turkish")


class TestManagementAIChat:
    """Tests for POST /api/ai/management-chat endpoint"""
    
    def test_management_chat_returns_200(self):
        """Test that management chat endpoint returns 200"""
        payload = {
            "message": "Fabrikada kaç makine var?",
            "session_id": "test_session_001"
        }
        response = requests.post(f"{BASE_URL}/api/ai/management-chat", json=payload, timeout=60)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Management chat returned 200")
    
    def test_management_chat_response_structure(self):
        """Test that chat response has correct structure"""
        payload = {
            "message": "En verimli operatör kim?",
            "session_id": "test_session_002"
        }
        response = requests.post(f"{BASE_URL}/api/ai/management-chat", json=payload, timeout=60)
        assert response.status_code == 200
        data = response.json()
        
        assert "response" in data, "Response missing 'response' field"
        assert "session_id" in data, "Response missing 'session_id' field"
        assert isinstance(data["response"], str), "Response should be a string"
        assert len(data["response"]) > 10, "Response should be substantial"
        print(f"✓ Chat response structure correct")
        print(f"  Response: {data['response'][:150]}...")
    
    def test_management_chat_turkish_response(self):
        """Test that chat response is in Turkish"""
        payload = {
            "message": "Hangi makine bakımda?",
            "session_id": "test_session_003"
        }
        response = requests.post(f"{BASE_URL}/api/ai/management-chat", json=payload, timeout=60)
        assert response.status_code == 200
        data = response.json()
        
        # Check for Turkish characters or common words
        response_text = data["response"].lower()
        turkish_indicators = ["makine", "bakım", "yok", "var", "şu", "an", "hiç", "durum"]
        found_turkish = any(word in response_text for word in turkish_indicators)
        # Also check for Turkish characters
        has_turkish_chars = any(c in data["response"] for c in "ğüşıöçĞÜŞİÖÇ")
        
        assert found_turkish or has_turkish_chars, f"Response doesn't appear to be in Turkish: {response_text[:200]}"
        print(f"✓ Chat response is in Turkish")
    
    def test_management_chat_session_continuity(self):
        """Test that chat session maintains context"""
        session_id = f"test_session_continuity_{int(time.time())}"
        
        # First message
        payload1 = {
            "message": "Bugün kaç koli üretildi?",
            "session_id": session_id
        }
        response1 = requests.post(f"{BASE_URL}/api/ai/management-chat", json=payload1, timeout=60)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["session_id"] == session_id
        print(f"✓ First message sent, session_id preserved")
        
        # Second message in same session
        payload2 = {
            "message": "Peki dün ne kadar üretildi?",
            "session_id": session_id
        }
        response2 = requests.post(f"{BASE_URL}/api/ai/management-chat", json=payload2, timeout=60)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["session_id"] == session_id
        print(f"✓ Second message sent, session_id preserved")
        print(f"✓ Chat session continuity works")
    
    def test_management_chat_missing_message_returns_422(self):
        """Test that missing message field returns 422"""
        payload = {
            "session_id": "test_session_004"
        }
        response = requests.post(f"{BASE_URL}/api/ai/management-chat", json=payload, timeout=30)
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print(f"✓ Missing message returns 422")
    
    def test_management_chat_empty_message_handled(self):
        """Test that empty message is handled"""
        payload = {
            "message": "",
            "session_id": "test_session_005"
        }
        response = requests.post(f"{BASE_URL}/api/ai/management-chat", json=payload, timeout=30)
        # Should either return 422 or handle gracefully
        assert response.status_code in [200, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Empty message handled (status: {response.status_code})")


class TestOperatorAIRegression:
    """Regression tests for Operator AI Assistant (from iteration 11)"""
    
    def test_operator_suggestion_still_works(self):
        """Test that operator suggestion endpoint still works"""
        # Get a machine ID first
        machines_response = requests.get(f"{BASE_URL}/api/machines", timeout=30)
        assert machines_response.status_code == 200
        machines = machines_response.json()
        assert len(machines) > 0, "No machines found"
        
        machine_id = machines[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/ai/operator-suggestion",
            params={"machine_id": machine_id, "operator_name": "test_operator"},
            timeout=60
        )
        assert response.status_code == 200, f"Operator suggestion failed: {response.status_code}"
        data = response.json()
        assert "suggestions" in data
        print(f"✓ Operator AI suggestion endpoint still works")
    
    def test_operator_chat_still_works(self):
        """Test that operator chat endpoint still works"""
        # Get a machine ID first
        machines_response = requests.get(f"{BASE_URL}/api/machines", timeout=30)
        machines = machines_response.json()
        machine_id = machines[0]["id"]
        
        payload = {
            "message": "Test message",
            "machine_id": machine_id,
            "operator_name": "test_operator",
            "session_id": "regression_test_session"
        }
        response = requests.post(f"{BASE_URL}/api/ai/operator-chat", json=payload, timeout=60)
        assert response.status_code == 200, f"Operator chat failed: {response.status_code}"
        data = response.json()
        assert "response" in data
        print(f"✓ Operator AI chat endpoint still works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
