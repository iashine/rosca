"""
ROSCA Application - Geoblocking Feature Backend Tests
Tests for:
- GET /api/admin/geoblocking - returns geoblocking settings
- PUT /api/admin/geoblocking - updates settings (enable/disable, allowed countries, block message)
- GET /api/admin/ip-logs - returns visitor IP logs
- GET /api/admin/ip-logs/stats - returns IP statistics
- GET /api/admin/ip-whitelist - returns whitelisted IPs
- POST /api/admin/ip-whitelist - adds IP to whitelist
- DELETE /api/admin/ip-whitelist/{ip} - removes IP from whitelist
- GET /api/geoblocking/check - public endpoint to check if current IP is blocked
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "admin@rosca.com"
SUPERADMIN_PASSWORD = "admin123"


class TestGeoblockingPublicEndpoint:
    """Test public geoblocking check endpoint"""
    
    def test_geoblocking_check_public(self):
        """Test GET /api/geoblocking/check - public endpoint"""
        response = requests.get(f"{BASE_URL}/api/geoblocking/check")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "blocked" in data
        assert isinstance(data["blocked"], bool)
        
        # Should have IP info
        assert "ip" in data
        
        print(f"✓ Geoblocking check: blocked={data['blocked']}, ip={data.get('ip', 'N/A')}")
        return data


class TestGeoblockingAdminEndpoints:
    """Test admin geoblocking endpoints (superadmin only)"""
    
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
    
    def test_get_geoblocking_settings_unauthorized(self):
        """Test GET /api/admin/geoblocking without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/geoblocking")
        assert response.status_code in [401, 403]
        print("✓ Geoblocking settings requires authentication")
    
    def test_get_geoblocking_settings(self, superadmin_token):
        """Test GET /api/admin/geoblocking - returns settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "enabled" in data
        assert "allowed_countries" in data
        assert "block_message" in data
        
        # Verify data types
        assert isinstance(data["enabled"], bool)
        assert isinstance(data["allowed_countries"], list)
        assert isinstance(data["block_message"], str)
        
        print(f"✓ Geoblocking settings: enabled={data['enabled']}, countries={data['allowed_countries']}")
        return data
    
    def test_update_geoblocking_settings_enable(self, superadmin_token):
        """Test PUT /api/admin/geoblocking - enable geoblocking"""
        response = requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"enabled": True}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == True
        print("✓ Geoblocking enabled successfully")
        
        # Disable it back for other tests
        requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"enabled": False}
        )
    
    def test_update_geoblocking_settings_disable(self, superadmin_token):
        """Test PUT /api/admin/geoblocking - disable geoblocking"""
        response = requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"enabled": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == False
        print("✓ Geoblocking disabled successfully")
    
    def test_update_geoblocking_allowed_countries(self, superadmin_token):
        """Test PUT /api/admin/geoblocking - update allowed countries"""
        # First get current settings
        get_res = requests.get(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        original_countries = get_res.json()["allowed_countries"]
        
        # Update to new countries
        new_countries = ["US", "CA", "GB"]
        response = requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"allowed_countries": new_countries}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["allowed_countries"] == new_countries
        print(f"✓ Allowed countries updated to: {new_countries}")
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"allowed_countries": original_countries}
        )
    
    def test_update_geoblocking_block_message(self, superadmin_token):
        """Test PUT /api/admin/geoblocking - update block message"""
        new_message = "TEST: Access restricted in your region."
        response = requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"block_message": new_message}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["block_message"] == new_message
        print(f"✓ Block message updated")
        
        # Restore default
        requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"block_message": "Access to this site is restricted in your region."}
        )


class TestIPLogs:
    """Test IP logs endpoints"""
    
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
    
    def test_get_ip_logs_unauthorized(self):
        """Test GET /api/admin/ip-logs without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/ip-logs")
        assert response.status_code in [401, 403]
        print("✓ IP logs requires authentication")
    
    def test_get_ip_logs(self, superadmin_token):
        """Test GET /api/admin/ip-logs - returns visitor IP logs"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ip-logs",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list)
        
        # If there are logs, verify structure
        if len(data) > 0:
            log = data[0]
            assert "id" in log
            assert "ip_address" in log
            assert "is_blocked" in log
            assert "is_whitelisted" in log
            assert "visit_count" in log
            print(f"✓ Got {len(data)} IP logs")
        else:
            print("✓ IP logs endpoint working (no logs yet)")
        
        return data
    
    def test_get_ip_logs_with_filters(self, superadmin_token):
        """Test GET /api/admin/ip-logs with query filters"""
        # Test with country filter
        response = requests.get(
            f"{BASE_URL}/api/admin/ip-logs?country_filter=US",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        print("✓ IP logs with country filter working")
        
        # Test with blocked_only filter
        response = requests.get(
            f"{BASE_URL}/api/admin/ip-logs?blocked_only=true",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        print("✓ IP logs with blocked_only filter working")
    
    def test_get_ip_logs_stats_unauthorized(self):
        """Test GET /api/admin/ip-logs/stats without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/ip-logs/stats")
        assert response.status_code in [401, 403]
        print("✓ IP logs stats requires authentication")
    
    def test_get_ip_logs_stats(self, superadmin_token):
        """Test GET /api/admin/ip-logs/stats - returns IP statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ip-logs/stats",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total_unique_ips" in data
        assert "blocked_ips" in data
        assert "whitelisted_ips" in data
        assert "top_countries" in data
        
        # Verify data types
        assert isinstance(data["total_unique_ips"], int)
        assert isinstance(data["blocked_ips"], int)
        assert isinstance(data["whitelisted_ips"], int)
        assert isinstance(data["top_countries"], list)
        
        print(f"✓ IP stats: {data['total_unique_ips']} unique IPs, {data['blocked_ips']} blocked, {data['whitelisted_ips']} whitelisted")
        return data


class TestIPWhitelist:
    """Test IP whitelist CRUD endpoints"""
    
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
    
    def test_get_ip_whitelist_unauthorized(self):
        """Test GET /api/admin/ip-whitelist without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/ip-whitelist")
        assert response.status_code in [401, 403]
        print("✓ IP whitelist requires authentication")
    
    def test_get_ip_whitelist(self, superadmin_token):
        """Test GET /api/admin/ip-whitelist - returns whitelisted IPs"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list)
        
        # If there are entries, verify structure
        if len(data) > 0:
            entry = data[0]
            assert "id" in entry
            assert "ip_address" in entry
            assert "description" in entry
            assert "added_by" in entry
            assert "created_at" in entry
        
        print(f"✓ Got {len(data)} whitelisted IPs")
        return data
    
    def test_add_ip_to_whitelist(self, superadmin_token):
        """Test POST /api/admin/ip-whitelist - adds IP to whitelist"""
        test_ip = f"192.168.100.{int(time.time()) % 255}"
        
        response = requests.post(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={
                "ip_address": test_ip,
                "description": "TEST: Automated test IP"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert data["ip_address"] == test_ip
        assert data["description"] == "TEST: Automated test IP"
        assert "id" in data
        assert "added_by" in data
        assert "created_at" in data
        
        print(f"✓ Added IP to whitelist: {test_ip}")
        
        # Cleanup - remove the test IP
        requests.delete(
            f"{BASE_URL}/api/admin/ip-whitelist/{test_ip}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        
        return data
    
    def test_add_duplicate_ip_to_whitelist(self, superadmin_token):
        """Test POST /api/admin/ip-whitelist - rejects duplicate IP"""
        test_ip = f"192.168.200.{int(time.time()) % 255}"
        
        # Add first time
        requests.post(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"ip_address": test_ip, "description": "First add"}
        )
        
        # Try to add again
        response = requests.post(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"ip_address": test_ip, "description": "Duplicate add"}
        )
        assert response.status_code == 400
        assert "already whitelisted" in response.json().get("detail", "").lower()
        
        print("✓ Duplicate IP whitelist rejected")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/admin/ip-whitelist/{test_ip}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
    
    def test_remove_ip_from_whitelist(self, superadmin_token):
        """Test DELETE /api/admin/ip-whitelist/{ip} - removes IP from whitelist"""
        test_ip = f"192.168.150.{int(time.time()) % 255}"
        
        # First add the IP
        requests.post(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"ip_address": test_ip, "description": "To be deleted"}
        )
        
        # Now delete it
        response = requests.delete(
            f"{BASE_URL}/api/admin/ip-whitelist/{test_ip}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 200
        assert "removed" in response.json().get("message", "").lower()
        
        print(f"✓ Removed IP from whitelist: {test_ip}")
        
        # Verify it's gone
        whitelist_res = requests.get(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        whitelist = whitelist_res.json()
        assert not any(w["ip_address"] == test_ip for w in whitelist)
        print("✓ Verified IP is no longer in whitelist")
    
    def test_remove_nonexistent_ip_from_whitelist(self, superadmin_token):
        """Test DELETE /api/admin/ip-whitelist/{ip} - returns 404 for non-existent IP"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/ip-whitelist/1.2.3.4",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert response.status_code == 404
        print("✓ Delete non-existent IP returns 404")


class TestGeoblockingRBAC:
    """Test RBAC for geoblocking endpoints - only superadmin should have access"""
    
    @pytest.fixture
    def moderator_token(self):
        """Create and login as moderator"""
        unique_email = f"test_mod_{int(time.time())}@example.com"
        
        # Register as moderator
        reg_res = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpassword123",
            "name": "Test Moderator",
            "role": "moderator"
        })
        
        if reg_res.status_code != 200:
            pytest.skip("Could not create moderator user")
        
        return reg_res.json()["access_token"]
    
    def test_geoblocking_settings_moderator_denied(self, moderator_token):
        """Test that moderator cannot access geoblocking settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 403
        print("✓ Moderator denied access to geoblocking settings")
    
    def test_ip_logs_moderator_denied(self, moderator_token):
        """Test that moderator cannot access IP logs"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ip-logs",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 403
        print("✓ Moderator denied access to IP logs")
    
    def test_ip_whitelist_moderator_denied(self, moderator_token):
        """Test that moderator cannot access IP whitelist"""
        response = requests.get(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 403
        print("✓ Moderator denied access to IP whitelist")


class TestGeoblockingIntegration:
    """Integration tests for geoblocking feature"""
    
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
    
    def test_full_whitelist_flow(self, superadmin_token):
        """Test complete whitelist flow: add -> verify -> remove -> verify"""
        test_ip = f"10.0.0.{int(time.time()) % 255}"
        
        # 1. Add IP to whitelist
        add_res = requests.post(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"ip_address": test_ip, "description": "Integration test"}
        )
        assert add_res.status_code == 200
        print(f"✓ Step 1: Added {test_ip} to whitelist")
        
        # 2. Verify IP is in whitelist
        list_res = requests.get(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        whitelist = list_res.json()
        assert any(w["ip_address"] == test_ip for w in whitelist)
        print("✓ Step 2: Verified IP is in whitelist")
        
        # 3. Check stats updated
        stats_res = requests.get(
            f"{BASE_URL}/api/admin/ip-logs/stats",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert stats_res.status_code == 200
        print("✓ Step 3: Stats endpoint working")
        
        # 4. Remove IP from whitelist
        del_res = requests.delete(
            f"{BASE_URL}/api/admin/ip-whitelist/{test_ip}",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        assert del_res.status_code == 200
        print(f"✓ Step 4: Removed {test_ip} from whitelist")
        
        # 5. Verify IP is no longer in whitelist
        list_res2 = requests.get(
            f"{BASE_URL}/api/admin/ip-whitelist",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        whitelist2 = list_res2.json()
        assert not any(w["ip_address"] == test_ip for w in whitelist2)
        print("✓ Step 5: Verified IP is removed from whitelist")
        
        print("✓ Full whitelist flow completed successfully")
    
    def test_geoblocking_toggle_flow(self, superadmin_token):
        """Test enable/disable geoblocking flow"""
        # Get initial state
        initial_res = requests.get(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"}
        )
        initial_state = initial_res.json()["enabled"]
        print(f"✓ Initial geoblocking state: {initial_state}")
        
        # Toggle to opposite state
        toggle_res = requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"enabled": not initial_state}
        )
        assert toggle_res.status_code == 200
        assert toggle_res.json()["enabled"] == (not initial_state)
        print(f"✓ Toggled geoblocking to: {not initial_state}")
        
        # Verify public endpoint reflects change
        check_res = requests.get(f"{BASE_URL}/api/geoblocking/check")
        assert check_res.status_code == 200
        print("✓ Public check endpoint working after toggle")
        
        # Restore original state
        restore_res = requests.put(
            f"{BASE_URL}/api/admin/geoblocking",
            headers={"Authorization": f"Bearer {superadmin_token}"},
            json={"enabled": initial_state}
        )
        assert restore_res.status_code == 200
        print(f"✓ Restored geoblocking to: {initial_state}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
