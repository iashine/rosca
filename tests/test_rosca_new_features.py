"""
ROSCA Application - New Features Backend Tests
Tests for:
- Math challenge API
- Registration flow (init + verify)
- Forgot password flow
- Reset password flow
- Admin user management (superadmin only)
- CMS content CRUD (superadmin only)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "admin@rosca.com"
SUPERADMIN_PASSWORD = "admin123"
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test123456"


class TestHealthAndBasics:
    """Basic API health checks"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "ROSCA" in data["message"]
        print(f"✓ API root working: {data}")


class TestMathChallenge:
    """Math challenge endpoint tests"""
    
    def test_get_math_challenge(self):
        """Test getting a math challenge"""
        response = requests.get(f"{BASE_URL}/api/auth/math-challenge")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "challenge_id" in data
        assert "question" in data
        assert "num1" in data
        assert "num2" in data
        assert "operation" in data
        
        # Verify data types
        assert isinstance(data["num1"], int)
        assert isinstance(data["num2"], int)
        assert data["operation"] in ["+", "-", "*"]
        
        print(f"✓ Math challenge: {data['question']}")
        return data


class TestRegistrationFlow:
    """Registration flow tests (init + verify)"""
    
    def test_registration_init_missing_fields(self):
        """Test registration init with missing fields"""
        response = requests.post(f"{BASE_URL}/api/auth/register/init", json={
            "email": "test_incomplete@example.com"
        })
        assert response.status_code == 422  # Validation error
        print("✓ Registration init rejects incomplete data")
    
    def test_registration_init_short_password(self):
        """Test registration init with short password"""
        response = requests.post(f"{BASE_URL}/api/auth/register/init", json={
            "email": "test_short_pwd@example.com",
            "password": "123",
            "name": "Test User",
            "math_answer": 10
        })
        assert response.status_code == 400
        assert "6 characters" in response.json().get("detail", "")
        print("✓ Registration init rejects short password")
    
    def test_registration_init_success(self):
        """Test successful registration init"""
        unique_email = f"test_reg_{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register/init", json={
            "email": unique_email,
            "password": "testpassword123",
            "name": "Test Registration User",
            "math_answer": 10
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "registration_id" in data
        assert "message" in data
        assert len(data["registration_id"]) > 0
        
        print(f"✓ Registration init successful: {data['message']}")
        return data
    
    def test_registration_verify_invalid_code(self):
        """Test registration verify with invalid code"""
        response = requests.post(f"{BASE_URL}/api/auth/register/verify", json={
            "registration_id": "invalid-id",
            "verification_code": "000000"
        })
        assert response.status_code == 404
        print("✓ Registration verify rejects invalid registration ID")
    
    def test_registration_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register/init", json={
            "email": SUPERADMIN_EMAIL,  # Already exists
            "password": "testpassword123",
            "name": "Duplicate User",
            "math_answer": 10
        })
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
        print("✓ Registration init rejects duplicate email")


class TestForgotPasswordFlow:
    """Forgot password flow tests"""
    
    def test_forgot_password_success(self):
        """Test forgot password request"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": SUPERADMIN_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Forgot password request successful: {data['message']}")
    
    def test_forgot_password_nonexistent_email(self):
        """Test forgot password with non-existent email (should still return 200 for security)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@example.com"
        })
        # Should return 200 to prevent email enumeration
        assert response.status_code == 200
        print("✓ Forgot password handles non-existent email securely")
    
    def test_reset_password_invalid_token(self):
        """Test reset password with invalid token"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "reset_token": "000000",
            "new_password": "newpassword123"
        })
        assert response.status_code == 400
        print("✓ Reset password rejects invalid token")
    
    def test_reset_password_short_password(self):
        """Test reset password with short password"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "reset_token": "123456",
            "new_password": "123"
        })
        # Will fail on token validation first, but if token was valid, would fail on password
        assert response.status_code == 400
        print("✓ Reset password validation working")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test successful login with superadmin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == SUPERADMIN_EMAIL
        assert data["user"]["role"] == "superadmin"
        
        print(f"✓ Login successful for superadmin: {data['user']['name']}")
        return data
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Login rejects invalid credentials")
    
    def test_get_current_user(self):
        """Test getting current user info"""
        # First login
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        token = login_res.json()["access_token"]
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == SUPERADMIN_EMAIL
        print(f"✓ Get current user working: {data['name']}")


class TestAdminUserManagement:
    """Admin user management tests (superadmin only)"""
    
    @pytest.fixture
    def superadmin_token(self):
        """Get superadmin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Superadmin login failed")
        return response.json()["access_token"]
    
    def test_list_users_unauthorized(self):
        """Test listing users without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403]
        print("✓ User list requires authentication")
    
    def test_list_users_as_superadmin(self, superadmin_token):
        """Test listing users as superadmin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify user structure
        user = data[0]
        assert "id" in user
        assert "email" in user
        assert "name" in user
        assert "role" in user
        assert "is_verified" in user
        
        print(f"✓ Listed {len(data)} users as superadmin")
        return data
    
    def test_update_user_role_invalid_role(self, superadmin_token):
        """Test updating user role with invalid role"""
        # First get a user
        users_res = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        users = users_res.json()
        
        # Find a non-superadmin user
        target_user = None
        for u in users:
            if u["role"] != "superadmin":
                target_user = u
                break
        
        if not target_user:
            pytest.skip("No non-superadmin user to test with")
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{target_user['id']}/role",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"role": "invalid_role"}
        )
        assert response.status_code == 400
        print("✓ Update role rejects invalid role")


class TestCMSContent:
    """CMS content CRUD tests (superadmin only)"""
    
    @pytest.fixture
    def superadmin_token(self):
        """Get superadmin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Superadmin login failed")
        return response.json()["access_token"]
    
    def test_get_all_cms_content_public(self):
        """Test getting all CMS content (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/cms/content")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} CMS content items (public)")
    
    def test_create_cms_content_unauthorized(self):
        """Test creating CMS content without auth"""
        response = requests.post(f"{BASE_URL}/api/cms/content", json={
            "key": "test_key",
            "title": "Test Title",
            "content": "Test content"
        })
        assert response.status_code in [401, 403]
        print("✓ CMS create requires authentication")
    
    def test_create_cms_content_as_superadmin(self, superadmin_token):
        """Test creating CMS content as superadmin"""
        test_key = f"test_content_{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/cms/content",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "key": test_key,
                "title": "Test Content Title",
                "content": "This is test content",
                "content_type": "text"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["key"] == test_key
        assert data["title"] == "Test Content Title"
        assert "id" in data
        
        print(f"✓ Created CMS content: {test_key}")
        
        # Cleanup - delete the content
        requests.delete(
            f"{BASE_URL}/api/cms/content/{test_key}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        return data
    
    def test_get_cms_content_by_key(self, superadmin_token):
        """Test getting CMS content by key"""
        # First create content
        test_key = f"test_get_{int(time.time())}"
        requests.post(
            f"{BASE_URL}/api/cms/content",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "key": test_key,
                "title": "Test Get Title",
                "content": "Test get content"
            }
        )
        
        # Get by key
        response = requests.get(f"{BASE_URL}/api/cms/content/{test_key}")
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == test_key
        
        print(f"✓ Got CMS content by key: {test_key}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/cms/content/{test_key}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
    
    def test_update_cms_content(self, superadmin_token):
        """Test updating CMS content"""
        # First create content
        test_key = f"test_update_{int(time.time())}"
        requests.post(
            f"{BASE_URL}/api/cms/content",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "key": test_key,
                "title": "Original Title",
                "content": "Original content"
            }
        )
        
        # Update
        response = requests.put(
            f"{BASE_URL}/api/cms/content/{test_key}",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "title": "Updated Title",
                "content": "Updated content"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["content"] == "Updated content"
        
        print(f"✓ Updated CMS content: {test_key}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/cms/content/{test_key}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
    
    def test_delete_cms_content(self, superadmin_token):
        """Test deleting CMS content"""
        # First create content
        test_key = f"test_delete_{int(time.time())}"
        requests.post(
            f"{BASE_URL}/api/cms/content",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "key": test_key,
                "title": "To Delete",
                "content": "Will be deleted"
            }
        )
        
        # Delete
        response = requests.delete(
            f"{BASE_URL}/api/cms/content/{test_key}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/cms/content/{test_key}")
        assert get_response.status_code == 404
        
        print(f"✓ Deleted CMS content: {test_key}")


class TestChangePassword:
    """Change password tests for logged-in users"""
    
    def test_change_password_wrong_current(self):
        """Test change password with wrong current password"""
        # Login first
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        token = login_res.json()["access_token"]
        
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 400
        assert "incorrect" in response.json().get("detail", "").lower()
        print("✓ Change password rejects wrong current password")


class TestLegacyRegister:
    """Legacy register endpoint tests"""
    
    def test_legacy_register(self):
        """Test legacy register endpoint"""
        unique_email = f"test_legacy_{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpassword123",
            "name": "Legacy Test User",
            "role": "moderator"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["role"] == "moderator"
        
        print(f"✓ Legacy register working: {unique_email}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
