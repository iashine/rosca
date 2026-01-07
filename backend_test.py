import requests
import sys
import json
from datetime import datetime

class ROSCAAPITester:
    def __init__(self, base_url="https://trustcycle.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_register(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"test_user_{timestamp}@example.com"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "test123456",
                "name": f"Test User {timestamp}",
                "role": "moderator"
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_login(self):
        """Test user login with existing test credentials"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "test@example.com",
                "password": "test123456"
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_create_group(self):
        """Test group creation"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Create Group",
            "POST",
            "groups",
            200,
            data={
                "name": f"Test Group {timestamp}",
                "description": "Test group for API testing",
                "contribution_amount": 100.0,
                "currency": "USD"
            }
        )
        
        if success and 'id' in response:
            self.group_id = response['id']
            return True
        return False

    def test_get_groups(self):
        """Test get user groups"""
        success, response = self.run_test(
            "Get Groups",
            "GET",
            "groups",
            200
        )
        return success

    def test_get_group_detail(self):
        """Test get specific group"""
        if not hasattr(self, 'group_id'):
            self.log_test("Get Group Detail", False, "No group_id available")
            return False
            
        success, response = self.run_test(
            "Get Group Detail",
            "GET",
            f"groups/{self.group_id}",
            200
        )
        return success

    def test_update_group(self):
        """Test group update"""
        if not hasattr(self, 'group_id'):
            self.log_test("Update Group", False, "No group_id available")
            return False
            
        success, response = self.run_test(
            "Update Group",
            "PUT",
            f"groups/{self.group_id}",
            200,
            data={
                "name": "Updated Test Group",
                "description": "Updated description",
                "contribution_amount": 150.0,
                "currency": "USD"
            }
        )
        return success

    def test_add_member(self):
        """Test adding member to group"""
        if not hasattr(self, 'group_id'):
            self.log_test("Add Member", False, "No group_id available")
            return False
            
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Add Member",
            "POST",
            f"groups/{self.group_id}/members",
            200,
            data={
                "name": f"Test Member {timestamp}",
                "email": f"member_{timestamp}@example.com",
                "phone": "+1234567890"
            }
        )
        
        if success and 'id' in response:
            self.member_id = response['id']
            return True
        return False

    def test_get_members(self):
        """Test get group members"""
        if not hasattr(self, 'group_id'):
            self.log_test("Get Members", False, "No group_id available")
            return False
            
        success, response = self.run_test(
            "Get Members",
            "GET",
            f"groups/{self.group_id}/members",
            200
        )
        return success

    def test_create_session(self):
        """Test creating spin session"""
        if not hasattr(self, 'group_id'):
            self.log_test("Create Session", False, "No group_id available")
            return False
            
        success, response = self.run_test(
            "Create Session",
            "POST",
            f"groups/{self.group_id}/sessions",
            200,
            data={
                "notes": "Test session"
            }
        )
        
        if success and 'id' in response:
            self.session_id = response['id']
            return True
        return False

    def test_get_sessions(self):
        """Test get user sessions"""
        success, response = self.run_test(
            "Get Sessions",
            "GET",
            "sessions",
            200
        )
        return success

    def test_get_session_detail(self):
        """Test get specific session"""
        if not hasattr(self, 'session_id'):
            self.log_test("Get Session Detail", False, "No session_id available")
            return False
            
        success, response = self.run_test(
            "Get Session Detail",
            "GET",
            f"sessions/{self.session_id}",
            200
        )
        return success

    def test_record_spin(self):
        """Test recording spin result"""
        if not hasattr(self, 'session_id') or not hasattr(self, 'member_id'):
            self.log_test("Record Spin", False, "No session_id or member_id available")
            return False
            
        success, response = self.run_test(
            "Record Spin",
            "POST",
            "spins",
            200,
            data={
                "session_id": self.session_id,
                "winner_member_id": self.member_id,
                "winner_name": "Test Member",
                "members_at_spin": [{"id": self.member_id, "name": "Test Member"}],
                "spin_angle": 180.5,
                "random_seed": "abc123"
            }
        )
        return success

    def test_get_session_spins(self):
        """Test get session spin results"""
        if not hasattr(self, 'session_id'):
            self.log_test("Get Session Spins", False, "No session_id available")
            return False
            
        success, response = self.run_test(
            "Get Session Spins",
            "GET",
            f"sessions/{self.session_id}/spins",
            200
        )
        return success

    def test_end_session(self):
        """Test ending session"""
        if not hasattr(self, 'session_id'):
            self.log_test("End Session", False, "No session_id available")
            return False
            
        success, response = self.run_test(
            "End Session",
            "POST",
            f"sessions/{self.session_id}/end",
            200
        )
        return success

    def test_get_theme(self):
        """Test get theme preferences"""
        success, response = self.run_test(
            "Get Theme",
            "GET",
            "theme",
            200
        )
        return success

    def test_update_theme(self):
        """Test update theme preferences"""
        success, response = self.run_test(
            "Update Theme",
            "PUT",
            "theme",
            200,
            data={
                "wheel_colors": ["#FF0000", "#00FF00", "#0000FF"],
                "background_color": "#000000",
                "text_color": "#FFFFFF",
                "accent_color": "#FF6600"
            }
        )
        return success

    def test_get_audit_logs(self):
        """Test get audit logs"""
        success, response = self.run_test(
            "Get Audit Logs",
            "GET",
            "audit-logs",
            200
        )
        return success

    def test_get_stats(self):
        """Test get user statistics"""
        success, response = self.run_test(
            "Get Stats",
            "GET",
            "stats",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": "admin@rosca.com",
                "password": "admin123"
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_add_second_member(self):
        """Test adding second member to group"""
        if not hasattr(self, 'group_id'):
            self.log_test("Add Second Member", False, "No group_id available")
            return False
            
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Add Second Member",
            "POST",
            f"groups/{self.group_id}/members",
            200,
            data={
                "name": f"Second Member {timestamp}",
                "email": f"member2_{timestamp}@example.com",
                "phone": "+1234567891"
            }
        )
        
        if success and 'id' in response:
            self.second_member_id = response['id']
            return True
        return False
        """Test get members with access info (passcodes)"""
        if not hasattr(self, 'group_id'):
            self.log_test("Get Members with Access", False, "No group_id available")
            return False
            
        success, response = self.run_test(
            "Get Members with Access",
            "GET",
            f"groups/{self.group_id}/members-access",
            200
        )
        
        if success and response:
            # Store member passcode for later use
            if len(response) > 0:
                self.member_passcode = response[0].get('passcode')
                self.member_name = response[0].get('name')
                self.member_id = response[0].get('id')
            return True
        return False

    def test_get_group_access_link(self):
        """Test get group access link"""
        if not hasattr(self, 'group_id'):
            self.log_test("Get Group Access Link", False, "No group_id available")
            return False
            
        success, response = self.run_test(
            "Get Group Access Link",
            "GET",
            f"groups/{self.group_id}/access-link",
            200
        )
        
        if success and 'access_code' in response:
            self.access_code = response['access_code']
            return True
        return False

    def test_member_portal_login(self):
        """Test member login via group access"""
        if not hasattr(self, 'access_code') or not hasattr(self, 'member_passcode'):
            self.log_test("Member Portal Login", False, "No access_code or member_passcode available")
            return False
            
        success, response = self.run_test(
            "Member Portal Login",
            "POST",
            f"group-access/{self.access_code}/login",
            200,
            data={
                "passcode": self.member_passcode
            }
        )
        
        if success and 'access_token' in response:
            self.member_token = response['access_token']
            return True
        return False

    def test_member_portal_group_data(self):
        """Test member portal group data endpoint - verify session_id in recent_spins"""
        if not hasattr(self, 'member_token'):
            self.log_test("Member Portal Group Data", False, "No member_token available")
            return False
            
        # Use member token for this request
        original_token = self.token
        self.token = self.member_token
        
        success, response = self.run_test(
            "Member Portal Group Data",
            "GET",
            "member-portal/group",
            200
        )
        
        # Restore original token
        self.token = original_token
        
        if success:
            # Check if recent_spins contains session_id
            recent_spins = response.get('recent_spins', [])
            if recent_spins:
                first_spin = recent_spins[0]
                if 'session_id' in first_spin and first_spin['session_id'] is not None:
                    self.log_test("Member Portal Session ID Check", True, f"session_id found: {first_spin['session_id']}")
                    return True
                else:
                    self.log_test("Member Portal Session ID Check", False, "session_id missing or null in recent_spins")
                    return False
            else:
                self.log_test("Member Portal Session ID Check", False, "No recent_spins found")
                return False
        return False

    def test_member_portal_complete_flow(self):
        """Test complete member portal flow with session_id verification"""
        print("\n🔍 Testing Member Portal API session_id functionality...")
        
        # Step 1: Login as admin
        if not self.test_admin_login():
            return False
        
        # Step 2: Create a group
        if not self.test_create_group():
            return False
        
        # Step 3: Add a member
        if not self.test_add_member():
            return False
        
        # Step 4: Create and complete a spin session
        if not self.test_create_session():
            return False
        
        if not self.test_record_spin():
            return False
        
        # Step 5: Get member access info
        if not self.test_get_members_with_access():
            return False
        
        # Step 6: Get group access link
        if not self.test_get_group_access_link():
            return False
        
        # Step 7: Login as member
        if not self.test_member_portal_login():
            return False
        
        # Step 8: Test member portal endpoint for session_id
        return self.test_member_portal_group_data()

    def test_remove_member(self):
        """Test removing member from group"""
        if not hasattr(self, 'group_id') or not hasattr(self, 'member_id'):
            self.log_test("Remove Member", False, "No group_id or member_id available")
            return False
            
        success, response = self.run_test(
            "Remove Member",
            "DELETE",
            f"groups/{self.group_id}/members/{self.member_id}",
            200
        )
        return success

    def test_delete_group(self):
        """Test deleting group"""
        if not hasattr(self, 'group_id'):
            self.log_test("Delete Group", False, "No group_id available")
            return False
            
        success, response = self.run_test(
            "Delete Group",
            "DELETE",
            f"groups/{self.group_id}",
            200
        )
        return success

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print(f"\n🔍 Starting ROSCA API Tests...")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)

        # Test basic connectivity
        if not self.test_root_endpoint():
            print("❌ Cannot connect to API. Stopping tests.")
            return False

        # Test authentication flow
        auth_success = False
        
        # Try login with existing test user first
        if self.test_login():
            auth_success = True
            print("✅ Using existing test user")
        else:
            # If login fails, try registration
            if self.test_register():
                auth_success = True
                print("✅ Created new test user")
        
        if not auth_success:
            print("❌ Authentication failed. Stopping tests.")
            return False

        # Test authenticated endpoints
        self.test_get_me()
        
        # Test group management
        if self.test_create_group():
            self.test_get_groups()
            self.test_get_group_detail()
            self.test_update_group()
            
            # Test member management
            if self.test_add_member():
                self.test_get_members()
                
                # Test session and spin functionality
                if self.test_create_session():
                    self.test_get_sessions()
                    self.test_get_session_detail()
                    self.test_record_spin()
                    self.test_get_session_spins()
                
                # Clean up member
                self.test_remove_member()
            
            # Clean up group
            self.test_delete_group()
        
        # Test other features
        self.test_get_theme()
        self.test_update_theme()
        self.test_get_audit_logs()
        self.test_get_stats()

        # Test member portal functionality with session_id
        self.test_member_portal_complete_flow()

        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print(f"📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

def main():
    tester = ROSCAAPITester()
    
    try:
        tester.run_all_tests()
        success = tester.print_summary()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n❌ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())