"""
Bobin Module Upgrade Tests - Iteration 22
Tests for the upgraded bobin tracking feature including:
- Barcode endpoint (GET /api/bobins/barcode/{code})
- Barcode field in POST /api/bobins
- Stock merge by barcode
- Role restriction (depo/plan only - frontend side)
- Color options (Beyaz, Kraft, Diger)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ==================== AUTH FIXTURES ====================

@pytest.fixture(scope="module")
def depo_token():
    """Get authentication token using depo1 credentials (role=depo)"""
    response = requests.post(f"{BASE_URL}/api/users/login", json={
        "username": "depo1",
        "password": "depo123"
    })
    if response.status_code == 200:
        data = response.json()
        assert data.get("role") == "depo", f"Expected role=depo, got {data.get('role')}"
        print(f"PASS: Login with depo1/depo123 successful (role=depo)")
        return data.get("token")
    pytest.skip(f"Depo authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def plan_token():
    """Get authentication token using emrecan credentials (role=plan)"""
    response = requests.post(f"{BASE_URL}/api/users/login", json={
        "username": "emrecan",
        "password": "testtest12"
    })
    if response.status_code == 200:
        data = response.json()
        assert data.get("role") == "plan", f"Expected role=plan, got {data.get('role')}"
        print(f"PASS: Login with emrecan/testtest12 successful (role=plan)")
        return data.get("token")
    pytest.skip(f"Plan authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def operator_token():
    """Get authentication token using ali credentials (role=operator)"""
    response = requests.post(f"{BASE_URL}/api/users/login", json={
        "username": "ali",
        "password": "134679"
    })
    if response.status_code == 200:
        data = response.json()
        assert data.get("role") == "operator", f"Expected role=operator, got {data.get('role')}"
        print(f"PASS: Login with ali/134679 successful (role=operator)")
        return data.get("token"), data.get("role")
    pytest.skip(f"Operator authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def depo_headers(depo_token):
    """Return headers with depo auth token"""
    return {"Authorization": f"Bearer {depo_token}"}


@pytest.fixture(scope="module")
def plan_headers(plan_token):
    """Return headers with plan auth token"""
    return {"Authorization": f"Bearer {plan_token}"}


# ==================== BARCODE ENDPOINT TESTS ====================

class TestBarcodeEndpoint:
    """Test GET /api/bobins/barcode/{code} endpoint"""
    
    def test_barcode_endpoint_requires_auth(self):
        """GET /api/bobins/barcode/{code} should return 401 without token"""
        response = requests.get(f"{BASE_URL}/api/bobins/barcode/test123")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/bobins/barcode/{code} requires auth (401 without token)")
    
    def test_barcode_endpoint_returns_404_for_nonexistent(self, depo_headers):
        """GET /api/bobins/barcode/nonexistent should return 404"""
        response = requests.get(f"{BASE_URL}/api/bobins/barcode/NONEXISTENT_BARCODE_12345", headers=depo_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "bulunamadi" in data.get("detail", "").lower(), "Error should mention not found"
        print("PASS: GET /api/bobins/barcode/nonexistent returns 404")
    
    def test_create_bobin_with_barcode(self, depo_headers):
        """POST /api/bobins with barcode field stores barcode"""
        payload = {
            "barcode": "TEST_BARCODE_001",
            "brand": "TEST_BarcodeTest",
            "width_cm": 24,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 3,
            "total_weight_kg": 300,
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=depo_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        bobin = data["bobin"]
        assert bobin["barcode"] == "TEST_BARCODE_001", f"Barcode should be stored, got {bobin.get('barcode')}"
        print(f"PASS: Created bobin with barcode: {bobin['barcode']}")
        return bobin
    
    def test_get_bobin_by_barcode(self, depo_headers):
        """GET /api/bobins/barcode/{code} returns bobin by barcode"""
        # First create a bobin with known barcode
        payload = {
            "barcode": "TEST_BARCODE_LOOKUP",
            "brand": "TEST_BarcodeLookup",
            "width_cm": 30,
            "grammage": 20,
            "color": "Kraft",
            "quantity": 5,
            "total_weight_kg": 500,
            "user_name": "Test User"
        }
        create_response = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=depo_headers)
        assert create_response.status_code == 200
        
        # Now lookup by barcode
        response = requests.get(f"{BASE_URL}/api/bobins/barcode/TEST_BARCODE_LOOKUP", headers=depo_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["barcode"] == "TEST_BARCODE_LOOKUP", "Barcode should match"
        assert data["brand"] == "TEST_BarcodeLookup", "Brand should match"
        assert data["width_cm"] == 30, "Width should match"
        assert data["grammage"] == 20, "Grammage should match"
        print(f"PASS: GET /api/bobins/barcode/TEST_BARCODE_LOOKUP returns correct bobin")
    
    def test_create_bobin_with_existing_barcode_merges_stock(self, depo_headers):
        """POST /api/bobins with existing barcode merges stock"""
        # Create initial bobin with barcode
        payload1 = {
            "barcode": "TEST_BARCODE_MERGE",
            "brand": "TEST_BarcodeMerge",
            "width_cm": 33,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 4,
            "total_weight_kg": 400,
            "user_name": "Test User"
        }
        response1 = requests.post(f"{BASE_URL}/api/bobins", json=payload1, headers=depo_headers)
        assert response1.status_code == 200
        bobin1 = response1.json()["bobin"]
        initial_qty = bobin1["quantity"]
        initial_weight = bobin1["total_weight_kg"]
        
        # Add more with same barcode
        payload2 = {
            "barcode": "TEST_BARCODE_MERGE",
            "brand": "TEST_BarcodeMerge",  # Same brand
            "width_cm": 33,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 2,
            "total_weight_kg": 200,
            "user_name": "Test User"
        }
        response2 = requests.post(f"{BASE_URL}/api/bobins", json=payload2, headers=depo_headers)
        assert response2.status_code == 200
        data2 = response2.json()
        bobin2 = data2["bobin"]
        
        # Verify stock was merged
        assert bobin2["quantity"] == initial_qty + 2, f"Quantity should be merged: {initial_qty} + 2"
        assert bobin2["total_weight_kg"] == initial_weight + 200, "Weight should be merged"
        print(f"PASS: Barcode merge works: {data2['message']}")


# ==================== ROLE TESTS ====================

class TestRoleAccess:
    """Test role-based access - Note: Role restriction is frontend-side"""
    
    def test_depo_user_can_access_bobins(self, depo_headers):
        """Depo user (role=depo) can access bobin endpoints"""
        response = requests.get(f"{BASE_URL}/api/bobins", headers=depo_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Depo user can access /api/bobins")
    
    def test_plan_user_can_access_bobins(self, plan_headers):
        """Plan user (role=plan) can access bobin endpoints"""
        response = requests.get(f"{BASE_URL}/api/bobins", headers=plan_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: Plan user can access /api/bobins")
    
    def test_operator_login_returns_operator_role(self):
        """Operator login returns role=operator (frontend will reject)"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": "ali",
            "password": "134679"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("role") == "operator", f"Expected role=operator, got {data.get('role')}"
        print("PASS: Operator login returns role=operator (frontend will reject at /bobin page)")


# ==================== COLOR OPTIONS TESTS ====================

class TestColorOptions:
    """Test color options: Beyaz, Kraft, Diger"""
    
    def test_create_bobin_with_beyaz_color(self, depo_headers):
        """Create bobin with color=Beyaz"""
        payload = {
            "brand": "TEST_ColorBeyaz",
            "width_cm": 24,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 2,
            "total_weight_kg": 200,
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=depo_headers)
        assert response.status_code == 200
        bobin = response.json()["bobin"]
        assert bobin["color"] == "Beyaz", f"Color should be Beyaz, got {bobin['color']}"
        print("PASS: Created bobin with color=Beyaz")
    
    def test_create_bobin_with_kraft_color(self, depo_headers):
        """Create bobin with color=Kraft"""
        payload = {
            "brand": "TEST_ColorKraft",
            "width_cm": 30,
            "grammage": 20,
            "color": "Kraft",
            "quantity": 3,
            "total_weight_kg": 300,
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=depo_headers)
        assert response.status_code == 200
        bobin = response.json()["bobin"]
        assert bobin["color"] == "Kraft", f"Color should be Kraft, got {bobin['color']}"
        print("PASS: Created bobin with color=Kraft")
    
    def test_create_bobin_with_custom_color(self, depo_headers):
        """Create bobin with custom color (Diger option)"""
        payload = {
            "brand": "TEST_ColorCustom",
            "width_cm": 33,
            "grammage": 17,
            "color": "Mavi",  # Custom color
            "quantity": 2,
            "total_weight_kg": 200,
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=depo_headers)
        assert response.status_code == 200
        bobin = response.json()["bobin"]
        assert bobin["color"] == "Mavi", f"Color should be Mavi, got {bobin['color']}"
        print("PASS: Created bobin with custom color=Mavi")


# ==================== EXISTING BARCODE DATA TEST ====================

class TestExistingBarcodeData:
    """Test with existing barcode data mentioned in requirements"""
    
    def test_lookup_existing_barcode_8690101234567(self, depo_headers):
        """Check if barcode 8690101234567 exists (Hayat 33cm 17gr Kraft)"""
        response = requests.get(f"{BASE_URL}/api/bobins/barcode/8690101234567", headers=depo_headers)
        if response.status_code == 200:
            data = response.json()
            print(f"PASS: Found existing barcode 8690101234567: {data['brand']} {data['width_cm']}cm {data['grammage']}gr {data['color']}")
            print(f"      Stock: {data['quantity']} adet, {data['total_weight_kg']}kg")
        elif response.status_code == 404:
            print("INFO: Barcode 8690101234567 not found - may need to be seeded")
        else:
            print(f"WARN: Unexpected status {response.status_code} for barcode lookup")


# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_bobins(self, depo_headers):
        """Clean up TEST_ prefixed bobins"""
        response = requests.get(f"{BASE_URL}/api/bobins", headers=depo_headers)
        if response.status_code != 200:
            print("SKIP: Could not fetch bobins for cleanup")
            return
        
        bobins = response.json()
        test_bobins = [b for b in bobins if b.get("brand", "").startswith("TEST_")]
        
        cleaned = 0
        for bobin in test_bobins:
            # First deplete stock by selling (if any)
            if bobin.get("quantity", 0) > 0:
                sale_payload = {
                    "quantity": bobin["quantity"],
                    "customer_name": "Cleanup",
                    "user_name": "Test Cleanup"
                }
                requests.post(f"{BASE_URL}/api/bobins/{bobin['id']}/sale", json=sale_payload, headers=depo_headers)
            
            # Then delete
            del_response = requests.delete(f"{BASE_URL}/api/bobins/{bobin['id']}", headers=depo_headers)
            if del_response.status_code in [200, 204]:
                cleaned += 1
        
        print(f"PASS: Cleaned up {cleaned} test bobins")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
