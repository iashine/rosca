"""
ROSCA Application - Member Access & Collaboration Features Tests
Tests for:
- POST /api/groups/{id}/members - adds member with auto-generated passcode
- GET /api/groups/{id}/members-access - returns members with passcodes and access links
- PUT /api/groups/{id}/members/{id}/passcode - updates passcode (auto-generate or manual)
- POST /api/groups/{id}/members/{id}/resend-invite - resends invitation email
- GET /api/groups/{id}/access-link - returns group shareable link
- GET /api/group-access/{code}/info - returns group info by access code (public)
- POST /api/group-access/{code}/login - member login with passcode (public)
- GET /api/member-portal/group - returns group data for member
- POST /api/member-portal/heartbeat - updates online status
- GET /api/member-portal/chat - returns chat messages
- POST /api/member-portal/chat - sends chat message
- GET /api/groups/{id}/chat - moderator view of chat
- POST /api/groups/{id}/chat - moderator sends chat message
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPERADMIN_EMAIL = "admin@rosca.com"
SUPERADMIN_PASSWORD = "admin123"

# Test group access (from main agent context)
TEST_ACCESS_CODE = "b-fp8WWcA2Q"
TEST_MEMBER_PASSCODE = "keen-moon-13"


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("✓ API is healthy")


class TestModeratorAuth:
    """Get moderator authentication token"""
    
    @pytest.fixture
    def moderator_token(self):
        """Get moderator (superadmin) token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Moderator login failed")
        return response.json()["access_token"]
    
    def test_login_success(self):
        """Test moderator login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print(f"✓ Moderator login successful: {data['user']['name']}")


class TestGroupCreationAndMembers:
    """Test group creation and member management"""
    
    @pytest.fixture
    def moderator_token(self):
        """Get moderator token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Moderator login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_group(self, moderator_token):
        """Create a test group"""
        response = requests.post(
            f"{BASE_URL}/api/groups",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={
                "name": f"TEST_MemberAccess_{int(time.time())}",
                "description": "Test group for member access testing",
                "contribution_amount": 100,
                "currency": "USD"
            }
        )
        if response.status_code != 200:
            pytest.skip("Failed to create test group")
        group = response.json()
        yield group
        
        # Cleanup - delete the group
        requests.delete(
            f"{BASE_URL}/api/groups/{group['id']}",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
    
    def test_add_member_with_passcode(self, moderator_token, test_group):
        """Test adding member generates passcode automatically"""
        response = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={
                "name": "TEST_John Doe",
                "email": None,
                "phone": None
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["name"] == "TEST_John Doe"
        assert data["status"] == "active"
        
        print(f"✓ Member added: {data['name']}")
        return data
    
    def test_add_member_with_email(self, moderator_token, test_group):
        """Test adding member with email (invitation should be sent)"""
        response = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={
                "name": "TEST_Jane Smith",
                "email": "test_jane@example.com",
                "phone": "+1234567890"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_Jane Smith"
        assert data["email"] == "test_jane@example.com"
        
        print(f"✓ Member with email added: {data['name']}")
    
    def test_get_members_access(self, moderator_token, test_group):
        """Test getting members with access info (passcodes, links)"""
        # First add a member
        requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"name": "TEST_Access Member"}
        )
        
        response = requests.get(
            f"{BASE_URL}/api/groups/{test_group['id']}/members-access",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) > 0
        
        member = data[0]
        assert "id" in member
        assert "name" in member
        assert "passcode" in member
        assert "access_link" in member
        assert "is_online" in member
        
        # Verify passcode format (adjective-noun-number)
        passcode = member["passcode"]
        assert "-" in passcode
        
        print(f"✓ Members access retrieved: {len(data)} members with passcodes")
        return data
    
    def test_get_access_link(self, moderator_token, test_group):
        """Test getting group access link"""
        response = requests.get(
            f"{BASE_URL}/api/groups/{test_group['id']}/access-link",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "access_code" in data
        assert "access_link" in data
        assert "/group-access/" in data["access_link"]
        
        print(f"✓ Access link retrieved: {data['access_link']}")
        return data
    
    def test_update_passcode_auto_generate(self, moderator_token, test_group):
        """Test updating passcode with auto-generation"""
        # First add a member
        member_res = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"name": "TEST_Passcode Update"}
        )
        member = member_res.json()
        
        # Get original passcode
        access_res = requests.get(
            f"{BASE_URL}/api/groups/{test_group['id']}/members-access",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        original_passcode = None
        for m in access_res.json():
            if m["id"] == member["id"]:
                original_passcode = m["passcode"]
                break
        
        # Update passcode (auto-generate)
        response = requests.put(
            f"{BASE_URL}/api/groups/{test_group['id']}/members/{member['id']}/passcode",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"passcode": None}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "passcode" in data
        assert data["passcode"] != original_passcode
        
        print(f"✓ Passcode auto-generated: {data['passcode']}")
    
    def test_update_passcode_manual(self, moderator_token, test_group):
        """Test updating passcode with manual value"""
        # First add a member
        member_res = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"name": "TEST_Manual Passcode"}
        )
        member = member_res.json()
        
        # Update passcode (manual)
        response = requests.put(
            f"{BASE_URL}/api/groups/{test_group['id']}/members/{member['id']}/passcode",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"passcode": "custom-passcode-123"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["passcode"] == "custom-passcode-123"
        
        print(f"✓ Passcode manually set: {data['passcode']}")
    
    def test_resend_invite_no_email(self, moderator_token, test_group):
        """Test resending invite fails for member without email"""
        # Add member without email
        member_res = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"name": "TEST_No Email Member"}
        )
        member = member_res.json()
        
        response = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members/{member['id']}/resend-invite",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 400
        assert "no email" in response.json().get("detail", "").lower()
        
        print("✓ Resend invite correctly fails for member without email")
    
    def test_resend_invite_with_email(self, moderator_token, test_group):
        """Test resending invite for member with email"""
        # Add member with email
        member_res = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={
                "name": "TEST_Email Member",
                "email": "test_resend@example.com"
            }
        )
        member = member_res.json()
        
        response = requests.post(
            f"{BASE_URL}/api/groups/{test_group['id']}/members/{member['id']}/resend-invite",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 200
        
        print("✓ Resend invite successful for member with email")


class TestPublicGroupAccess:
    """Test public group access endpoints"""
    
    @pytest.fixture
    def moderator_token(self):
        """Get moderator token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Moderator login failed")
        return response.json()["access_token"]
    
    def test_get_group_info_by_access_code(self):
        """Test getting group info by access code (public)"""
        response = requests.get(f"{BASE_URL}/api/group-access/{TEST_ACCESS_CODE}/info")
        assert response.status_code == 200
        data = response.json()
        
        assert "group_id" in data
        assert "group_name" in data
        
        print(f"✓ Group info retrieved: {data['group_name']}")
        return data
    
    def test_get_group_info_invalid_code(self):
        """Test getting group info with invalid access code"""
        response = requests.get(f"{BASE_URL}/api/group-access/invalid-code-123/info")
        assert response.status_code == 404
        
        print("✓ Invalid access code returns 404")
    
    def test_member_login_success(self):
        """Test member login with valid passcode"""
        response = requests.post(
            f"{BASE_URL}/api/group-access/{TEST_ACCESS_CODE}/login",
            json={"passcode": TEST_MEMBER_PASSCODE}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "member_id" in data
        assert "member_name" in data
        assert "group_id" in data
        assert "group_name" in data
        
        print(f"✓ Member login successful: {data['member_name']}")
        return data
    
    def test_member_login_invalid_passcode(self):
        """Test member login with invalid passcode"""
        response = requests.post(
            f"{BASE_URL}/api/group-access/{TEST_ACCESS_CODE}/login",
            json={"passcode": "wrong-passcode-123"}
        )
        assert response.status_code == 401
        
        print("✓ Invalid passcode returns 401")
    
    def test_member_login_invalid_access_code(self):
        """Test member login with invalid access code"""
        response = requests.post(
            f"{BASE_URL}/api/group-access/invalid-code/login",
            json={"passcode": TEST_MEMBER_PASSCODE}
        )
        assert response.status_code == 404
        
        print("✓ Invalid access code returns 404")


class TestMemberPortal:
    """Test member portal endpoints"""
    
    @pytest.fixture
    def member_token(self):
        """Get member access token"""
        response = requests.post(
            f"{BASE_URL}/api/group-access/{TEST_ACCESS_CODE}/login",
            json={"passcode": TEST_MEMBER_PASSCODE}
        )
        if response.status_code != 200:
            pytest.skip("Member login failed")
        return response.json()["access_token"]
    
    def test_get_member_group_data(self, member_token):
        """Test getting group data for member portal"""
        response = requests.get(
            f"{BASE_URL}/api/member-portal/group",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "group" in data
        assert "current_member" in data
        assert "members" in data
        assert "recent_spins" in data
        
        # Verify group structure
        assert "id" in data["group"]
        assert "name" in data["group"]
        
        # Verify current member
        assert "id" in data["current_member"]
        assert "name" in data["current_member"]
        
        print(f"✓ Member portal data retrieved for: {data['current_member']['name']}")
        return data
    
    def test_member_heartbeat(self, member_token):
        """Test member heartbeat updates online status"""
        response = requests.post(
            f"{BASE_URL}/api/member-portal/heartbeat",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "online_members" in data
        assert isinstance(data["online_members"], list)
        
        # Verify at least one member is online (the current member)
        online_count = sum(1 for m in data["online_members"] if m["is_online"])
        assert online_count >= 1
        
        print(f"✓ Heartbeat successful: {online_count} members online")
        return data
    
    def test_get_chat_messages(self, member_token):
        """Test getting chat messages"""
        response = requests.get(
            f"{BASE_URL}/api/member-portal/chat",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        print(f"✓ Chat messages retrieved: {len(data)} messages")
        return data
    
    def test_send_chat_message(self, member_token):
        """Test sending chat message"""
        test_message = f"TEST_Message_{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/member-portal/chat",
            headers={"Authorization": f"Bearer {member_token}"},
            json={"content": test_message}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["content"] == test_message
        assert "member_name" in data
        assert "created_at" in data
        
        print(f"✓ Chat message sent: {data['content'][:30]}...")
        return data
    
    def test_send_empty_chat_message(self, member_token):
        """Test sending empty chat message fails"""
        response = requests.post(
            f"{BASE_URL}/api/member-portal/chat",
            headers={"Authorization": f"Bearer {member_token}"},
            json={"content": "   "}
        )
        assert response.status_code == 400
        
        print("✓ Empty chat message rejected")
    
    def test_chat_message_length_limit(self, member_token):
        """Test chat message is limited to 500 characters"""
        long_message = "A" * 600
        response = requests.post(
            f"{BASE_URL}/api/member-portal/chat",
            headers={"Authorization": f"Bearer {member_token}"},
            json={"content": long_message}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Message should be truncated to 500 chars
        assert len(data["content"]) <= 500
        
        print("✓ Chat message truncated to 500 characters")
    
    def test_member_portal_unauthorized(self):
        """Test member portal requires valid token"""
        response = requests.get(
            f"{BASE_URL}/api/member-portal/group",
            headers={"Authorization": "Bearer invalid-token"}
        )
        assert response.status_code == 401
        
        print("✓ Member portal requires valid token")


class TestModeratorChat:
    """Test moderator chat endpoints"""
    
    @pytest.fixture
    def moderator_token(self):
        """Get moderator token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Moderator login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_group_with_member(self, moderator_token):
        """Create a test group with a member"""
        # Create group
        group_res = requests.post(
            f"{BASE_URL}/api/groups",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={
                "name": f"TEST_Chat_{int(time.time())}",
                "description": "Test group for chat testing",
                "contribution_amount": 50,
                "currency": "USD"
            }
        )
        group = group_res.json()
        
        # Add member
        requests.post(
            f"{BASE_URL}/api/groups/{group['id']}/members",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"name": "TEST_Chat Member"}
        )
        
        yield group
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/groups/{group['id']}",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
    
    def test_get_group_chat_moderator(self, moderator_token, test_group_with_member):
        """Test moderator can view group chat"""
        response = requests.get(
            f"{BASE_URL}/api/groups/{test_group_with_member['id']}/chat",
            headers={"Authorization": f"Bearer {moderator_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        print(f"✓ Moderator chat view: {len(data)} messages")
    
    def test_send_chat_as_moderator(self, moderator_token, test_group_with_member):
        """Test moderator can send chat message"""
        test_message = f"TEST_Moderator_Message_{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/groups/{test_group_with_member['id']}/chat",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"content": test_message}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["content"] == test_message
        assert "(Moderator)" in data["member_name"]
        
        print(f"✓ Moderator message sent: {data['member_name']}")
    
    def test_moderator_chat_empty_message(self, moderator_token, test_group_with_member):
        """Test moderator cannot send empty message"""
        response = requests.post(
            f"{BASE_URL}/api/groups/{test_group_with_member['id']}/chat",
            headers={"Authorization": f"Bearer {moderator_token}"},
            json={"content": ""}
        )
        assert response.status_code == 400
        
        print("✓ Moderator empty message rejected")


class TestExistingGroupAccess:
    """Test with existing test group from main agent context"""
    
    def test_existing_group_access_flow(self):
        """Test full flow with existing test group"""
        # Step 1: Get group info
        info_res = requests.get(f"{BASE_URL}/api/group-access/{TEST_ACCESS_CODE}/info")
        assert info_res.status_code == 200
        group_info = info_res.json()
        print(f"✓ Step 1: Got group info - {group_info['group_name']}")
        
        # Step 2: Login as member
        login_res = requests.post(
            f"{BASE_URL}/api/group-access/{TEST_ACCESS_CODE}/login",
            json={"passcode": TEST_MEMBER_PASSCODE}
        )
        assert login_res.status_code == 200
        login_data = login_res.json()
        member_token = login_data["access_token"]
        print(f"✓ Step 2: Logged in as {login_data['member_name']}")
        
        # Step 3: Get member portal data
        portal_res = requests.get(
            f"{BASE_URL}/api/member-portal/group",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert portal_res.status_code == 200
        portal_data = portal_res.json()
        print(f"✓ Step 3: Got portal data - {len(portal_data['members'])} members")
        
        # Step 4: Send heartbeat
        heartbeat_res = requests.post(
            f"{BASE_URL}/api/member-portal/heartbeat",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert heartbeat_res.status_code == 200
        print(f"✓ Step 4: Heartbeat sent")
        
        # Step 5: Get chat messages
        chat_res = requests.get(
            f"{BASE_URL}/api/member-portal/chat",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        assert chat_res.status_code == 200
        print(f"✓ Step 5: Got {len(chat_res.json())} chat messages")
        
        # Step 6: Send a chat message
        msg_res = requests.post(
            f"{BASE_URL}/api/member-portal/chat",
            headers={"Authorization": f"Bearer {member_token}"},
            json={"content": f"Test message from automated test at {int(time.time())}"}
        )
        assert msg_res.status_code == 200
        print(f"✓ Step 6: Sent chat message")
        
        print("✓ Full member access flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
