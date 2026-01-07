import requests
import sys
import json
from datetime import datetime

class MemberPortalTester:
    def __init__(self, base_url="https://trustcycle.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")

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

    def test_member_portal_session_id(self):
        """Test complete member portal flow with session_id verification"""
        print(f"\n🔍 Testing Member Portal API session_id functionality...")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Step 1: Login as admin
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
        
        if not success or 'access_token' not in response:
            print("❌ Cannot login as admin. Stopping test.")
            return False
        
        self.token = response['access_token']
        self.user_id = response['user']['id']
        
        # Step 2: Create a group
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Create Group",
            "POST",
            "groups",
            200,
            data={
                "name": f"Test Group {timestamp}",
                "description": "Test group for member portal testing",
                "contribution_amount": 100.0,
                "currency": "USD"
            }
        )
        
        if not success or 'id' not in response:
            return False
        
        group_id = response['id']
        
        # Step 3: Add first member
        success, response = self.run_test(
            "Add First Member",
            "POST",
            f"groups/{group_id}/members",
            200,
            data={
                "name": f"Test Member {timestamp}",
                "email": f"member_{timestamp}@example.com",
                "phone": "+1234567890"
            }
        )
        
        if not success or 'id' not in response:
            return False
        
        member_id = response['id']
        
        # Step 4: Add second member (required for session)
        success, response = self.run_test(
            "Add Second Member",
            "POST",
            f"groups/{group_id}/members",
            200,
            data={
                "name": f"Second Member {timestamp}",
                "email": f"member2_{timestamp}@example.com",
                "phone": "+1234567891"
            }
        )
        
        if not success:
            return False
        
        # Step 5: Create session
        success, response = self.run_test(
            "Create Session",
            "POST",
            f"groups/{group_id}/sessions",
            200,
            data={
                "notes": "Test session"
            }
        )
        
        if not success or 'id' not in response:
            return False
        
        session_id = response['id']
        
        # Step 6: Record a spin
        success, response = self.run_test(
            "Record Spin",
            "POST",
            "spins",
            200,
            data={
                "session_id": session_id,
                "winner_member_id": member_id,
                "winner_name": f"Test Member {timestamp}",
                "members_at_spin": [{"id": member_id, "name": f"Test Member {timestamp}"}],
                "spin_angle": 180.5,
                "random_seed": "abc123"
            }
        )
        
        if not success:
            return False
        
        # Step 7: Get member access info
        success, response = self.run_test(
            "Get Members with Access",
            "GET",
            f"groups/{group_id}/members-access",
            200
        )
        
        if not success or not response or len(response) == 0:
            return False
        
        member_passcode = response[0].get('passcode')
        if not member_passcode:
            self.log_test("Get Member Passcode", False, "No passcode found")
            return False
        
        # Step 8: Get group access link
        success, response = self.run_test(
            "Get Group Access Link",
            "GET",
            f"groups/{group_id}/access-link",
            200
        )
        
        if not success or 'access_code' not in response:
            return False
        
        access_code = response['access_code']
        
        # Step 9: Login as member
        success, response = self.run_test(
            "Member Portal Login",
            "POST",
            f"group-access/{access_code}/login",
            200,
            data={
                "passcode": member_passcode
            }
        )
        
        if not success or 'access_token' not in response:
            return False
        
        member_token = response['access_token']
        
        # Step 10: Test member portal endpoint for session_id
        original_token = self.token
        self.token = member_token
        
        success, response = self.run_test(
            "Member Portal Group Data",
            "GET",
            "member-portal/group",
            200
        )
        
        self.token = original_token
        
        if not success:
            return False
        
        # Step 11: Verify session_id in recent_spins
        recent_spins = response.get('recent_spins', [])
        if not recent_spins:
            self.log_test("Session ID Verification", False, "No recent_spins found")
            return False
        
        first_spin = recent_spins[0]
        if 'session_id' not in first_spin or first_spin['session_id'] is None:
            self.log_test("Session ID Verification", False, "session_id missing or null in recent_spins")
            return False
        
        self.log_test("Session ID Verification", True, f"session_id found: {first_spin['session_id']}")
        
        # Cleanup: Delete the test group
        self.run_test(
            "Cleanup - Delete Group",
            "DELETE",
            f"groups/{group_id}",
            200
        )
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print(f"📊 Member Portal Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All member portal tests passed!")
            return True
        else:
            print("⚠️  Some member portal tests failed.")
            return False

def main():
    tester = MemberPortalTester()
    
    try:
        success = tester.test_member_portal_session_id()
        tester.print_summary()
        
        if success:
            print("\n✅ MEMBER PORTAL API SESSION_ID TEST: PASSED")
            print("The member portal endpoint correctly returns session_id in recent_spins")
        else:
            print("\n❌ MEMBER PORTAL API SESSION_ID TEST: FAILED")
        
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n❌ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())