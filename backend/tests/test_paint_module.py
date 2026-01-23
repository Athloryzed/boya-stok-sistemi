"""
Paint Module Backend Tests
Tests for Boya (Paint) management system - stock tracking, transactions, movements, analytics
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPaintInit:
    """Test paint initialization endpoint"""
    
    def test_init_paints(self):
        """POST /api/paints/init - Initialize 12 default paints"""
        response = requests.post(f"{BASE_URL}/api/paints/init")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Paint init response: {data}")


class TestPaintCRUD:
    """Test paint CRUD operations"""
    
    def test_get_all_paints(self):
        """GET /api/paints - Should return 12 paints"""
        response = requests.get(f"{BASE_URL}/api/paints")
        assert response.status_code == 200
        paints = response.json()
        assert isinstance(paints, list)
        assert len(paints) == 12, f"Expected 12 paints, got {len(paints)}"
        
        # Verify paint structure
        for paint in paints:
            assert "id" in paint
            assert "name" in paint
            assert "stock_kg" in paint
            assert "created_at" in paint
        
        # Verify all 12 paint names exist
        paint_names = [p["name"] for p in paints]
        expected_names = ["Siyah", "Beyaz", "Kırmızı", "Mavi", "Yeşil", "Sarı",
                        "Turuncu", "Mor", "Pembe", "Kahverengi", "Gri", "Turkuaz"]
        for name in expected_names:
            assert name in paint_names, f"Missing paint: {name}"
        
        print(f"Found {len(paints)} paints: {paint_names}")
    
    def test_beyaz_has_initial_stock(self):
        """Verify Beyaz paint has 50kg initial stock"""
        response = requests.get(f"{BASE_URL}/api/paints")
        assert response.status_code == 200
        paints = response.json()
        
        beyaz = next((p for p in paints if p["name"] == "Beyaz"), None)
        assert beyaz is not None, "Beyaz paint not found"
        assert beyaz["stock_kg"] == 50.0, f"Expected 50kg, got {beyaz['stock_kg']}"
        print(f"Beyaz stock: {beyaz['stock_kg']} kg")


class TestPaintTransactions:
    """Test paint transaction operations (add, remove, to_machine, from_machine)"""
    
    @pytest.fixture
    def get_test_paint(self):
        """Get a paint for testing"""
        response = requests.get(f"{BASE_URL}/api/paints")
        paints = response.json()
        # Use Gri (Gray) for testing as it starts with 0 stock
        return next((p for p in paints if p["name"] == "Gri"), paints[0])
    
    @pytest.fixture
    def get_machine(self):
        """Get a machine for testing"""
        response = requests.get(f"{BASE_URL}/api/machines")
        machines = response.json()
        return machines[0] if machines else None
    
    def test_add_stock(self, get_test_paint):
        """POST /api/paints/transaction - Add stock"""
        paint = get_test_paint
        initial_stock = paint["stock_kg"]
        add_amount = 25.5
        
        response = requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "add",
            "amount_kg": add_amount,
            "note": "TEST_add_stock"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "new_stock" in data
        assert data["new_stock"] == initial_stock + add_amount
        assert "movement_id" in data
        print(f"Added {add_amount}kg to {paint['name']}, new stock: {data['new_stock']}")
        
        # Verify stock was updated
        verify_response = requests.get(f"{BASE_URL}/api/paints")
        paints = verify_response.json()
        updated_paint = next((p for p in paints if p["id"] == paint["id"]), None)
        assert updated_paint["stock_kg"] == initial_stock + add_amount
    
    def test_remove_stock_success(self, get_test_paint):
        """POST /api/paints/transaction - Remove stock (sufficient stock)"""
        paint = get_test_paint
        
        # First add some stock
        requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "add",
            "amount_kg": 50.0,
            "note": "TEST_prep_for_remove"
        })
        
        # Get current stock
        response = requests.get(f"{BASE_URL}/api/paints")
        paints = response.json()
        current_paint = next((p for p in paints if p["id"] == paint["id"]), None)
        current_stock = current_paint["stock_kg"]
        
        remove_amount = 10.0
        response = requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "remove",
            "amount_kg": remove_amount,
            "note": "TEST_remove_stock"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["new_stock"] == current_stock - remove_amount
        print(f"Removed {remove_amount}kg from {paint['name']}, new stock: {data['new_stock']}")
    
    def test_remove_stock_insufficient(self):
        """POST /api/paints/transaction - Remove stock (insufficient stock) should fail"""
        # Get a paint with 0 stock
        response = requests.get(f"{BASE_URL}/api/paints")
        paints = response.json()
        
        # Find paint with lowest stock
        paint = min(paints, key=lambda p: p["stock_kg"])
        
        # Try to remove more than available
        response = requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "remove",
            "amount_kg": paint["stock_kg"] + 1000  # More than available
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "Yetersiz stok" in data.get("detail", "")
        print(f"Correctly rejected insufficient stock removal: {data}")
    
    def test_to_machine(self, get_test_paint, get_machine):
        """POST /api/paints/transaction - Send to machine"""
        paint = get_test_paint
        machine = get_machine
        
        if not machine:
            pytest.skip("No machines available")
        
        # First ensure we have stock
        requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "add",
            "amount_kg": 100.0,
            "note": "TEST_prep_for_machine"
        })
        
        # Get current stock
        response = requests.get(f"{BASE_URL}/api/paints")
        paints = response.json()
        current_paint = next((p for p in paints if p["id"] == paint["id"]), None)
        current_stock = current_paint["stock_kg"]
        
        send_amount = 15.0
        response = requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "to_machine",
            "amount_kg": send_amount,
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "note": "TEST_to_machine"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["new_stock"] == current_stock - send_amount
        print(f"Sent {send_amount}kg to {machine['name']}, new stock: {data['new_stock']}")
    
    def test_from_machine(self, get_test_paint, get_machine):
        """POST /api/paints/transaction - Receive from machine"""
        paint = get_test_paint
        machine = get_machine
        
        if not machine:
            pytest.skip("No machines available")
        
        # Get current stock
        response = requests.get(f"{BASE_URL}/api/paints")
        paints = response.json()
        current_paint = next((p for p in paints if p["id"] == paint["id"]), None)
        current_stock = current_paint["stock_kg"]
        
        receive_amount = 5.0
        response = requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "from_machine",
            "amount_kg": receive_amount,
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "note": "TEST_from_machine"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["new_stock"] == current_stock + receive_amount
        print(f"Received {receive_amount}kg from {machine['name']}, new stock: {data['new_stock']}")
    
    def test_invalid_movement_type(self, get_test_paint):
        """POST /api/paints/transaction - Invalid movement type should fail"""
        paint = get_test_paint
        
        response = requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": paint["id"],
            "movement_type": "invalid_type",
            "amount_kg": 10.0
        })
        
        assert response.status_code == 400
        print(f"Correctly rejected invalid movement type")
    
    def test_paint_not_found(self):
        """POST /api/paints/transaction - Non-existent paint should fail"""
        response = requests.post(f"{BASE_URL}/api/paints/transaction", json={
            "paint_id": "non-existent-id",
            "movement_type": "add",
            "amount_kg": 10.0
        })
        
        assert response.status_code == 404
        print(f"Correctly rejected non-existent paint")


class TestPaintMovements:
    """Test paint movement history endpoint"""
    
    def test_get_all_movements(self):
        """GET /api/paints/movements - Get all movements"""
        response = requests.get(f"{BASE_URL}/api/paints/movements")
        assert response.status_code == 200
        movements = response.json()
        assert isinstance(movements, list)
        
        if movements:
            mov = movements[0]
            assert "id" in mov
            assert "paint_id" in mov
            assert "paint_name" in mov
            assert "movement_type" in mov
            assert "amount_kg" in mov
            assert "created_at" in mov
        
        print(f"Found {len(movements)} movements")
    
    def test_get_movements_with_limit(self):
        """GET /api/paints/movements?limit=5 - Get limited movements"""
        response = requests.get(f"{BASE_URL}/api/paints/movements?limit=5")
        assert response.status_code == 200
        movements = response.json()
        assert len(movements) <= 5
        print(f"Got {len(movements)} movements with limit=5")
    
    def test_get_movements_by_paint(self):
        """GET /api/paints/movements?paint_id=xxx - Filter by paint"""
        # Get a paint
        paints_response = requests.get(f"{BASE_URL}/api/paints")
        paints = paints_response.json()
        paint = paints[0]
        
        response = requests.get(f"{BASE_URL}/api/paints/movements?paint_id={paint['id']}")
        assert response.status_code == 200
        movements = response.json()
        
        # All movements should be for this paint
        for mov in movements:
            assert mov["paint_id"] == paint["id"]
        
        print(f"Found {len(movements)} movements for paint {paint['name']}")


class TestPaintAnalytics:
    """Test paint analytics endpoint"""
    
    def test_weekly_analytics(self):
        """GET /api/paints/analytics?period=weekly"""
        response = requests.get(f"{BASE_URL}/api/paints/analytics?period=weekly")
        assert response.status_code == 200
        data = response.json()
        
        assert "period" in data
        assert data["period"] == "weekly"
        assert "paint_consumption" in data
        assert "machine_consumption" in data
        assert "daily_consumption" in data
        assert "total_consumed" in data
        
        print(f"Weekly analytics: total consumed = {data['total_consumed']} kg")
    
    def test_monthly_analytics(self):
        """GET /api/paints/analytics?period=monthly"""
        response = requests.get(f"{BASE_URL}/api/paints/analytics?period=monthly")
        assert response.status_code == 200
        data = response.json()
        
        assert data["period"] == "monthly"
        assert "paint_consumption" in data
        assert "total_consumed" in data
        
        print(f"Monthly analytics: total consumed = {data['total_consumed']} kg")


class TestMachinesEndpoint:
    """Test machines endpoint (needed for paint module)"""
    
    def test_get_machines(self):
        """GET /api/machines - Get all machines"""
        response = requests.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 200
        machines = response.json()
        assert isinstance(machines, list)
        assert len(machines) == 8, f"Expected 8 machines, got {len(machines)}"
        
        machine_names = [m["name"] for m in machines]
        print(f"Found {len(machines)} machines: {machine_names}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
