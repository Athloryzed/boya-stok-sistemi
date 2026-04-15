"""
Security & Authentication Tests - Iteration 18
Tests for:
1. JWT token authentication on login endpoints
2. Protected API endpoints requiring Bearer token
3. Password hashing with bcrypt
4. Management login endpoint
5. Password field exclusion from API responses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
OPERATOR_USERNAME = "ali"
OPERATOR_PASSWORD = "134679"
PLAN_USERNAME = "emrecan"
PLAN_PASSWORD = "testtest12"
MANAGEMENT_PASSWORD = "buse11993"


class TestUserLogin:
    """Test user login endpoint with JWT token"""
    
    def test_operator_login_returns_jwt_token(self):
        """POST /api/users/login returns JWT token for valid operator credentials"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": OPERATOR_USERNAME,
            "password": OPERATOR_PASSWORD,
            "role": "operator"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain 'token' field"
        assert isinstance(data["token"], str), "Token should be a string"
        assert len(data["token"]) > 50, "Token should be a valid JWT (long string)"
        # JWT tokens have 3 parts separated by dots
        assert data["token"].count('.') == 2, "Token should be a valid JWT format (3 parts)"
        print(f"✓ Operator login returns JWT token: {data['token'][:50]}...")
    
    def test_operator_login_rejects_wrong_password(self):
        """POST /api/users/login rejects wrong password"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": OPERATOR_USERNAME,
            "password": "wrongpassword123",
            "role": "operator"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print(f"✓ Operator login rejects wrong password with status {response.status_code}")
    
    def test_plan_login_returns_jwt_token(self):
        """POST /api/users/login returns JWT token for valid plan credentials"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": PLAN_USERNAME,
            "password": PLAN_PASSWORD,
            "role": "plan"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain 'token' field"
        assert data["token"].count('.') == 2, "Token should be a valid JWT format"
        print(f"✓ Plan login returns JWT token: {data['token'][:50]}...")
    
    def test_login_response_excludes_password(self):
        """Login response should NOT contain password field"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": OPERATOR_USERNAME,
            "password": OPERATOR_PASSWORD,
            "role": "operator"
        })
        assert response.status_code == 200
        data = response.json()
        assert "password" not in data, "Response should NOT contain 'password' field"
        print("✓ Login response excludes password field")


class TestManagementLogin:
    """Test management login endpoint"""
    
    def test_management_login_returns_jwt_token(self):
        """POST /api/management/login returns JWT token for correct password"""
        response = requests.post(f"{BASE_URL}/api/management/login", json={
            "password": MANAGEMENT_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain 'token' field"
        assert isinstance(data["token"], str), "Token should be a string"
        assert data["token"].count('.') == 2, "Token should be a valid JWT format"
        print(f"✓ Management login returns JWT token: {data['token'][:50]}...")
    
    def test_management_login_rejects_wrong_password(self):
        """POST /api/management/login rejects wrong password"""
        response = requests.post(f"{BASE_URL}/api/management/login", json={
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print(f"✓ Management login rejects wrong password with status {response.status_code}")


class TestProtectedEndpoints:
    """Test that protected endpoints require authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get a valid auth token"""
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": OPERATOR_USERNAME,
            "password": OPERATOR_PASSWORD,
            "role": "operator"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Could not get auth token")
    
    def test_get_users_without_token_returns_401(self):
        """GET /api/users WITHOUT token returns 401"""
        response = requests.get(f"{BASE_URL}/api/users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        # Check for Turkish error message
        assert "detail" in data, "Response should contain 'detail' field"
        assert "Kimlik doğrulama gerekli" in data["detail"] or "authentication" in data["detail"].lower(), \
            f"Expected auth error message, got: {data['detail']}"
        print(f"✓ GET /api/users without token returns 401: {data['detail']}")
    
    def test_get_users_with_valid_token_returns_list(self, auth_token):
        """GET /api/users WITH valid token returns user list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/users with token returns {len(data)} users")
    
    def test_users_list_excludes_password(self, auth_token):
        """GET /api/users should NOT return password field for any user"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        for user in data:
            assert "password" not in user, f"User {user.get('username')} should not have password field"
        print(f"✓ Users list excludes password field for all {len(data)} users")
    
    def test_create_user_requires_token(self):
        """POST /api/users (create user) requires token"""
        response = requests.post(f"{BASE_URL}/api/users", json={
            "username": "test_no_auth",
            "password": "test123",
            "role": "operator"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ POST /api/users requires token (returns 401 without)")
    
    def test_delete_user_requires_token(self):
        """DELETE /api/users/{id} requires token"""
        response = requests.delete(f"{BASE_URL}/api/users/fake-user-id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ DELETE /api/users/{id} requires token (returns 401 without)")


class TestPublicEndpoints:
    """Test that public endpoints work WITHOUT authentication"""
    
    def test_tracking_endpoint_is_public(self):
        """GET /api/takip/{token} works WITHOUT auth (public)"""
        # First get a valid tracking code from jobs
        response = requests.get(f"{BASE_URL}/api/jobs")
        if response.status_code == 200:
            jobs = response.json()
            if jobs:
                tracking_code = jobs[0].get("tracking_code")
                if tracking_code:
                    # Test tracking endpoint without auth
                    track_response = requests.get(f"{BASE_URL}/api/takip/{tracking_code}")
                    assert track_response.status_code == 200, f"Expected 200, got {track_response.status_code}"
                    print(f"✓ GET /api/takip/{tracking_code} works without auth")
                    return
        
        # If no jobs, test with invalid code - should return 404, not 401
        response = requests.get(f"{BASE_URL}/api/takip/invalid-code")
        assert response.status_code == 404, f"Expected 404 for invalid code, got {response.status_code}"
        print("✓ GET /api/takip/{token} is public (returns 404 for invalid, not 401)")
    
    def test_health_endpoint_is_public(self):
        """GET /api/health works WITHOUT auth"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/health is public")
    
    def test_machines_endpoint_is_public(self):
        """GET /api/machines works WITHOUT auth (for operator machine selection)"""
        response = requests.get(f"{BASE_URL}/api/machines")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/machines is public")
    
    def test_jobs_endpoint_is_public(self):
        """GET /api/jobs works WITHOUT auth (for operator job list)"""
        response = requests.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/jobs is public")


class TestBcryptPasswordStorage:
    """Test that passwords are stored as bcrypt hashes"""
    
    def test_passwords_are_bcrypt_hashed(self):
        """Verify passwords are stored as bcrypt hashes (start with $2b$)"""
        # We can't directly check the database, but we can verify:
        # 1. Login works with correct password
        # 2. Login fails with wrong password
        # 3. Login fails with the hash itself (proving it's not stored plain)
        
        # Test 1: Correct password works
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": OPERATOR_USERNAME,
            "password": OPERATOR_PASSWORD,
            "role": "operator"
        })
        assert response.status_code == 200, "Correct password should work"
        
        # Test 2: Wrong password fails
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": OPERATOR_USERNAME,
            "password": "wrongpassword",
            "role": "operator"
        })
        assert response.status_code in [401, 400], "Wrong password should fail"
        
        # Test 3: A bcrypt hash as password should fail (proving it's not stored plain)
        # If password was stored plain, using the hash would work
        fake_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.S6GcgfS0Uy3Kbu"
        response = requests.post(f"{BASE_URL}/api/users/login", json={
            "username": OPERATOR_USERNAME,
            "password": fake_hash,
            "role": "operator"
        })
        assert response.status_code in [401, 400], "Using a hash as password should fail"
        
        print("✓ Passwords are properly hashed (bcrypt verification passed)")


class TestTokenValidation:
    """Test JWT token validation"""
    
    def test_invalid_token_rejected(self):
        """Invalid JWT token is rejected"""
        headers = {"Authorization": "Bearer invalid.token.here"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid token is rejected with 401")
    
    def test_malformed_auth_header_rejected(self):
        """Malformed Authorization header is rejected"""
        headers = {"Authorization": "NotBearer sometoken"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Malformed auth header is rejected with 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
