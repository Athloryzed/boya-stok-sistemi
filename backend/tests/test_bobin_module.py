"""
Bobin (Paper Roll) Module Tests
Tests for the new bobin tracking feature including:
- CRUD operations for bobin types
- Stock management (purchase, to-machine, sale)
- Movement history tracking
- Excel export
- Authentication requirements
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBobinAuth:
    """Test authentication requirements for bobin endpoints"""
    
    def test_bobins_list_requires_auth(self):
        """GET /api/bobins should return 401 without token"""
        response = requests.get(f"{BASE_URL}/api/bobins")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/bobins requires auth (401 without token)")
    
    def test_bobins_create_requires_auth(self):
        """POST /api/bobins should return 401 without token"""
        response = requests.post(f"{BASE_URL}/api/bobins", json={
            "brand": "Test", "width_cm": 24, "grammage": 17, "quantity": 1, "total_weight_kg": 100
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: POST /api/bobins requires auth (401 without token)")
    
    def test_bobins_movements_requires_auth(self):
        """GET /api/bobins/movements should return 401 without token"""
        response = requests.get(f"{BASE_URL}/api/bobins/movements")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/bobins/movements requires auth (401 without token)")
    
    def test_bobins_export_requires_auth(self):
        """GET /api/bobins/export should return 401 without token"""
        response = requests.get(f"{BASE_URL}/api/bobins/export")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/bobins/export requires auth (401 without token)")


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token using depo1 credentials"""
    response = requests.post(f"{BASE_URL}/api/users/login", json={
        "username": "depo1",
        "password": "depo123",
        "role": "depo"
    })
    if response.status_code == 200:
        token = response.json().get("token")
        print(f"PASS: Login with depo1/depo123 successful, got token")
        return token
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestBobinCRUD:
    """Test bobin CRUD operations"""
    
    def test_list_bobins(self, auth_headers):
        """GET /api/bobins - List all bobin types"""
        response = requests.get(f"{BASE_URL}/api/bobins", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/bobins returns {len(data)} bobin types")
        return data
    
    def test_create_new_bobin_type(self, auth_headers):
        """POST /api/bobins - Create new bobin type with initial stock"""
        payload = {
            "brand": "TEST_Marka",
            "width_cm": 30,
            "grammage": 20,
            "color": "Kraft",
            "quantity": 5,
            "total_weight_kg": 500,
            "supplier": "Test Tedarikci",
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "bobin" in data, "Response should contain 'bobin'"
        assert "message" in data, "Response should contain 'message'"
        bobin = data["bobin"]
        assert bobin["brand"] == "TEST_Marka", "Brand should match"
        assert bobin["width_cm"] == 30, "Width should match"
        assert bobin["grammage"] == 20, "Grammage should match"
        assert bobin["color"] == "Kraft", "Color should match"
        assert bobin["quantity"] == 5, "Quantity should match"
        assert bobin["total_weight_kg"] == 500, "Total weight should match"
        # Weight per piece should be auto-calculated
        assert bobin["weight_per_piece_kg"] == 100, f"Weight per piece should be 100, got {bobin['weight_per_piece_kg']}"
        print(f"PASS: Created new bobin type: {data['message']}")
        return bobin
    
    def test_create_duplicate_bobin_merges_stock(self, auth_headers):
        """POST /api/bobins - Adding same brand/width/grammage/color merges into existing stock"""
        # First create a bobin
        payload1 = {
            "brand": "TEST_Merge",
            "width_cm": 24,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 2,
            "total_weight_kg": 200,
            "user_name": "Test User"
        }
        response1 = requests.post(f"{BASE_URL}/api/bobins", json=payload1, headers=auth_headers)
        assert response1.status_code == 200
        bobin1 = response1.json()["bobin"]
        initial_qty = bobin1["quantity"]
        initial_weight = bobin1["total_weight_kg"]
        
        # Add more of the same type
        payload2 = {
            "brand": "TEST_Merge",
            "width_cm": 24,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 3,
            "total_weight_kg": 300,
            "user_name": "Test User"
        }
        response2 = requests.post(f"{BASE_URL}/api/bobins", json=payload2, headers=auth_headers)
        assert response2.status_code == 200
        data2 = response2.json()
        bobin2 = data2["bobin"]
        
        # Verify stock was merged
        assert bobin2["quantity"] == initial_qty + 3, f"Quantity should be merged: {initial_qty} + 3 = {initial_qty + 3}"
        assert bobin2["total_weight_kg"] == initial_weight + 300, "Weight should be merged"
        assert "stoka eklendi" in data2["message"], "Message should indicate stock was added"
        print(f"PASS: Duplicate bobin merged into existing stock: {data2['message']}")
    
    def test_create_bobin_validation(self, auth_headers):
        """POST /api/bobins - Validation for required fields"""
        # Missing brand
        response = requests.post(f"{BASE_URL}/api/bobins", json={
            "width_cm": 24, "grammage": 17, "quantity": 1, "total_weight_kg": 100
        }, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for missing brand, got {response.status_code}"
        
        # Invalid width
        response = requests.post(f"{BASE_URL}/api/bobins", json={
            "brand": "Test", "width_cm": 0, "grammage": 17, "quantity": 1, "total_weight_kg": 100
        }, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for invalid width, got {response.status_code}"
        print("PASS: Bobin creation validation works correctly")


class TestBobinStockOperations:
    """Test stock operations: purchase, to-machine, sale"""
    
    @pytest.fixture(scope="class")
    def test_bobin(self, auth_headers):
        """Create a test bobin for stock operations"""
        payload = {
            "brand": "TEST_Stock",
            "width_cm": 33,
            "grammage": 28,
            "color": "Beyaz",
            "quantity": 10,
            "total_weight_kg": 1000,
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=auth_headers)
        assert response.status_code == 200
        return response.json()["bobin"]
    
    def test_purchase_add_stock(self, auth_headers, test_bobin):
        """POST /api/bobins/{id}/purchase - Add more stock to existing bobin"""
        bobin_id = test_bobin["id"]
        initial_qty = test_bobin["quantity"]
        
        payload = {
            "quantity": 5,
            "weight_kg": 500,
            "supplier": "New Supplier",
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins/{bobin_id}/purchase", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["new_quantity"] == initial_qty + 5, f"New quantity should be {initial_qty + 5}"
        print(f"PASS: Purchase added stock: {data['message']}")
    
    def test_purchase_validation(self, auth_headers, test_bobin):
        """POST /api/bobins/{id}/purchase - Validation for quantity and weight"""
        bobin_id = test_bobin["id"]
        
        # Zero quantity
        response = requests.post(f"{BASE_URL}/api/bobins/{bobin_id}/purchase", json={
            "quantity": 0, "weight_kg": 100
        }, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for zero quantity, got {response.status_code}"
        
        # Zero weight
        response = requests.post(f"{BASE_URL}/api/bobins/{bobin_id}/purchase", json={
            "quantity": 1, "weight_kg": 0
        }, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for zero weight, got {response.status_code}"
        print("PASS: Purchase validation works correctly")
    
    def test_to_machine_deducts_stock(self, auth_headers):
        """POST /api/bobins/{id}/to-machine - Give bobin to machine (stock decreases)"""
        # Create a fresh bobin for this test
        create_payload = {
            "brand": "TEST_Machine",
            "width_cm": 40,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 8,
            "total_weight_kg": 800,
            "user_name": "Test User"
        }
        create_response = requests.post(f"{BASE_URL}/api/bobins", json=create_payload, headers=auth_headers)
        assert create_response.status_code == 200
        bobin = create_response.json()["bobin"]
        bobin_id = bobin["id"]
        initial_qty = bobin["quantity"]
        
        # Get machines list
        machines_response = requests.get(f"{BASE_URL}/api/machines", headers=auth_headers)
        assert machines_response.status_code == 200
        machines = machines_response.json()
        if not machines:
            pytest.skip("No machines available for testing")
        
        machine = machines[0]
        
        # Give to machine
        payload = {
            "quantity": 2,
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins/{bobin_id}/to-machine", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["new_quantity"] == initial_qty - 2, f"Stock should decrease by 2"
        print(f"PASS: To-machine deducted stock: {data['message']}")
    
    def test_to_machine_insufficient_stock(self, auth_headers):
        """POST /api/bobins/{id}/to-machine - Reject if insufficient stock"""
        # Create a bobin with low stock
        create_payload = {
            "brand": "TEST_LowStock",
            "width_cm": 24,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 2,
            "total_weight_kg": 200,
            "user_name": "Test User"
        }
        create_response = requests.post(f"{BASE_URL}/api/bobins", json=create_payload, headers=auth_headers)
        assert create_response.status_code == 200
        bobin = create_response.json()["bobin"]
        bobin_id = bobin["id"]
        
        # Try to give more than available
        payload = {
            "quantity": 10,  # More than available (2)
            "machine_id": "test-machine",
            "machine_name": "Test Machine",
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins/{bobin_id}/to-machine", json=payload, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for insufficient stock, got {response.status_code}"
        assert "Yetersiz stok" in response.json().get("detail", ""), "Error should mention insufficient stock"
        print("PASS: To-machine rejects insufficient stock")
    
    def test_sale_deducts_stock(self, auth_headers):
        """POST /api/bobins/{id}/sale - Sell bobin to customer (stock decreases)"""
        # Create a fresh bobin for this test
        create_payload = {
            "brand": "TEST_Sale",
            "width_cm": 30,
            "grammage": 20,
            "color": "Kraft",
            "quantity": 6,
            "total_weight_kg": 600,
            "user_name": "Test User"
        }
        create_response = requests.post(f"{BASE_URL}/api/bobins", json=create_payload, headers=auth_headers)
        assert create_response.status_code == 200
        bobin = create_response.json()["bobin"]
        bobin_id = bobin["id"]
        initial_qty = bobin["quantity"]
        
        # Sell to customer
        payload = {
            "quantity": 2,
            "customer_name": "Test Musteri",
            "note": "Test satisi",
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins/{bobin_id}/sale", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["new_quantity"] == initial_qty - 2, f"Stock should decrease by 2"
        print(f"PASS: Sale deducted stock: {data['message']}")
    
    def test_sale_requires_customer_name(self, auth_headers):
        """POST /api/bobins/{id}/sale - Reject if no customer_name"""
        # Create a bobin
        create_payload = {
            "brand": "TEST_SaleNoCustomer",
            "width_cm": 24,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 5,
            "total_weight_kg": 500,
            "user_name": "Test User"
        }
        create_response = requests.post(f"{BASE_URL}/api/bobins", json=create_payload, headers=auth_headers)
        assert create_response.status_code == 200
        bobin = create_response.json()["bobin"]
        bobin_id = bobin["id"]
        
        # Try to sell without customer name
        payload = {
            "quantity": 1,
            "customer_name": "",  # Empty customer name
            "user_name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/bobins/{bobin_id}/sale", json=payload, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for missing customer name, got {response.status_code}"
        assert "Müşteri adı zorunludur" in response.json().get("detail", ""), "Error should mention customer name required"
        print("PASS: Sale rejects missing customer name")


class TestBobinMovements:
    """Test movement history"""
    
    def test_list_movements(self, auth_headers):
        """GET /api/bobins/movements - List all movements with user_name"""
        response = requests.get(f"{BASE_URL}/api/bobins/movements", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Check movement structure if any exist
        if data:
            movement = data[0]
            assert "id" in movement, "Movement should have id"
            assert "bobin_id" in movement, "Movement should have bobin_id"
            assert "bobin_label" in movement, "Movement should have bobin_label"
            assert "movement_type" in movement, "Movement should have movement_type"
            assert "quantity" in movement, "Movement should have quantity"
            assert "weight_kg" in movement, "Movement should have weight_kg"
            assert "user_name" in movement, "Movement should have user_name"
            assert "created_at" in movement, "Movement should have created_at"
        print(f"PASS: GET /api/bobins/movements returns {len(data)} movements")
    
    def test_filter_movements_by_type(self, auth_headers):
        """GET /api/bobins/movements?movement_type=purchase - Filter by type"""
        response = requests.get(f"{BASE_URL}/api/bobins/movements?movement_type=purchase", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # All returned movements should be purchase type
        for m in data:
            assert m["movement_type"] == "purchase", f"Expected purchase type, got {m['movement_type']}"
        print(f"PASS: Movement filter by type works ({len(data)} purchase movements)")


class TestBobinExport:
    """Test Excel export"""
    
    def test_export_excel(self, auth_headers):
        """GET /api/bobins/export - Downloads Excel file"""
        response = requests.get(f"{BASE_URL}/api/bobins/export", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check content type
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheetml" in content_type or "application/vnd" in content_type, f"Expected Excel content type, got {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, "Should be attachment download"
        assert "bobin_stok" in content_disp, "Filename should contain bobin_stok"
        assert ".xlsx" in content_disp, "Should be xlsx file"
        
        # Check file has content
        assert len(response.content) > 0, "Excel file should have content"
        print(f"PASS: Excel export works (file size: {len(response.content)} bytes)")


class TestBobinDelete:
    """Test bobin deletion"""
    
    def test_delete_bobin_with_stock_rejected(self, auth_headers):
        """DELETE /api/bobins/{id} - Reject if stock > 0"""
        # Create a bobin with stock
        create_payload = {
            "brand": "TEST_DeleteWithStock",
            "width_cm": 24,
            "grammage": 17,
            "color": "Beyaz",
            "quantity": 5,
            "total_weight_kg": 500,
            "user_name": "Test User"
        }
        create_response = requests.post(f"{BASE_URL}/api/bobins", json=create_payload, headers=auth_headers)
        assert create_response.status_code == 200
        bobin = create_response.json()["bobin"]
        bobin_id = bobin["id"]
        
        # Try to delete
        response = requests.delete(f"{BASE_URL}/api/bobins/{bobin_id}", headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for delete with stock, got {response.status_code}"
        assert "silinemez" in response.json().get("detail", "").lower(), "Error should mention cannot delete"
        print("PASS: Delete rejected for bobin with stock > 0")
    
    def test_delete_bobin_not_found(self, auth_headers):
        """DELETE /api/bobins/{id} - 404 for non-existent bobin"""
        response = requests.delete(f"{BASE_URL}/api/bobins/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Delete returns 404 for non-existent bobin")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_bobins(self, auth_headers):
        """Clean up TEST_ prefixed bobins"""
        # Get all bobins
        response = requests.get(f"{BASE_URL}/api/bobins", headers=auth_headers)
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
                requests.post(f"{BASE_URL}/api/bobins/{bobin['id']}/sale", json=sale_payload, headers=auth_headers)
            
            # Then delete
            del_response = requests.delete(f"{BASE_URL}/api/bobins/{bobin['id']}", headers=auth_headers)
            if del_response.status_code in [200, 204]:
                cleaned += 1
        
        print(f"PASS: Cleaned up {cleaned} test bobins")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
