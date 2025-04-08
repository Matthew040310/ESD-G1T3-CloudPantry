import unittest
import requests
import os
import time
import json
import uuid # Import uuid

# --- Configuration ---
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5199") # Keep host port 5199
SENDER_CHARITY_ID = os.getenv("SENDER_CHARITY_ID", "1")
RECIPIENT_CHARITY_ID = os.getenv("RECIPIENT_CHARITY_ID", "2")
# --- Use fields matching new schema ---
ITEM_ID_TO_REQUEST = os.getenv("ITEM_ID_TO_REQUEST", str(uuid.uuid4())) # Generate a valid UUID string
NOTIFICATION_TEXT = os.getenv("NOTIFICATION_TEXT", "Requesting Item via Notification")
CATEGORY_TEXT = os.getenv("CATEGORY_TEXT", "General Request")
# ------------------------------------

created_request_id = None # Combined ID variable for simplicity now

class TestCharityRequestAPI(unittest.TestCase):

    # Keep setUpClass and tearDownClass as they are (for listener cleanup)
    @classmethod
    def setUpClass(cls):
        print(f"--- Starting API Tests against {BASE_URL} ---")
        print("Attempting initial listener stop (sender)..."); requests.post(f"{BASE_URL}/listener/stop/{SENDER_CHARITY_ID}")
        print("Attempting initial listener stop (recipient)..."); requests.post(f"{BASE_URL}/listener/stop/{RECIPIENT_CHARITY_ID}")
        time.sleep(1)

    @classmethod
    def tearDownClass(cls):
        print("--- Cleaning up listeners ---")
        r_sender = requests.post(f"{BASE_URL}/listener/stop/{SENDER_CHARITY_ID}"); print(f"Stop Sender: {r_sender.status_code}")
        r_recipient = requests.post(f"{BASE_URL}/listener/stop/{RECIPIENT_CHARITY_ID}"); print(f"Stop Recipient: {r_recipient.status_code}")
        print("--- API Tests Finished ---")

    # Test Methods - Simplified structure, less dependency

    def test_01_health_check(self):
        """Verify the health endpoint (Simplified)."""
        print("\n[Test] Health Check")
        response = requests.get(f"{BASE_URL}/health")
        self.assertIn(response.status_code, [200, 503])
        self.assertIn("status", response.json())
        print(f"Health Status: {response.json()['status']}")

    def test_02_listener_management(self):
        """Test starting and stopping listeners."""
        print("\n[Test] Listener Management")
        # Start Sender
        res_start_sender = requests.post(f"{BASE_URL}/listener/start/{SENDER_CHARITY_ID}")
        self.assertIn(res_start_sender.status_code, [200, 201]); self.assertEqual(res_start_sender.json()["status"], "success")
        print("Sender listener started/running.")
        # Start Recipient
        res_start_recipient = requests.post(f"{BASE_URL}/listener/start/{RECIPIENT_CHARITY_ID}")
        self.assertIn(res_start_recipient.status_code, [200, 201]); self.assertEqual(res_start_recipient.json()["status"], "success")
        print("Recipient listener started/running.")
        time.sleep(2) # Allow time to start
        # Stop Sender
        res_stop_sender = requests.post(f"{BASE_URL}/listener/stop/{SENDER_CHARITY_ID}")
        self.assertEqual(res_stop_sender.status_code, 200); self.assertEqual(res_stop_sender.json()["status"], "success")
        print("Sender listener stopped.")
        # Stop Recipient
        res_stop_recipient = requests.post(f"{BASE_URL}/listener/stop/{RECIPIENT_CHARITY_ID}")
        self.assertEqual(res_stop_recipient.status_code, 200); self.assertEqual(res_stop_recipient.json()["status"], "success")
        print("Recipient listener stopped.")

    def test_03_create_and_get_request(self):
        """Test creating a request and retrieving it."""
        global created_request_id
        print("\n[Test] Create & Get Request")
        # Create
        payload = {
            "sender_id": SENDER_CHARITY_ID,
            f"{RECIPIENT_CHARITY_ID}": [{
                "notification": NOTIFICATION_TEXT, "category": CATEGORY_TEXT,
                "quantity": 3, "item_id": ITEM_ID_TO_REQUEST
            }]
        }
        headers = {'Content-Type': 'application/json'}
        response_create = requests.post(f"{BASE_URL}/requests", json=payload, headers=headers)
        print(f"Create Resp Status: {response_create.status_code}, Body: {response_create.text}")
        self.assertEqual(response_create.status_code, 201)
        data_create = response_create.json()
        self.assertEqual(data_create["status"], "success")
        created_request_id = data_create["data"]["created_requests_info"][0]["id"]
        self.assertIsNotNone(created_request_id)
        print(f"Created Request ID: {created_request_id}")

        # Get (check recipient incoming)
        time.sleep(0.5) # Brief delay
        params_get = {"charity_id": RECIPIENT_CHARITY_ID, "direction": "incoming", "status": "pending"}
        response_get = requests.get(f"{BASE_URL}/requests", params=params_get)
        self.assertEqual(response_get.status_code, 200)
        data_get = response_get.json()
        found = any(req["id"] == created_request_id for req in data_get["data"])
        self.assertTrue(found, "Created request not found via GET")
        print("Verified created request exists via GET.")

    def test_04_update_status_accept(self):
        """Test accepting the created request."""
        print("\n[Test] Accept Request")
        self.assertIsNotNone(created_request_id, "Request ID not set from previous test")
        payload = {"status": "accepted", "responder_id": RECIPIENT_CHARITY_ID }
        headers = {'Content-Type': 'application/json'}
        response = requests.put(f"{BASE_URL}/requests/{created_request_id}/status", json=payload, headers=headers)
        print(f"Update Resp Status: {response.status_code}, Body: {response.text}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "accepted")

        # Verify status change via GET
        time.sleep(1.5) # Allow for MQ potentially
        params_verify = {"charity_id": RECIPIENT_CHARITY_ID, "direction": "incoming", "status": "accepted"}
        response_verify = requests.get(f"{BASE_URL}/requests", params=params_verify)
        self.assertEqual(response_verify.status_code, 200)
        data_verify = response_verify.json()
        found_accepted = any(req["id"] == created_request_id and req["status"] == "accepted" for req in data_verify["data"])
        self.assertTrue(found_accepted, "Request not found with accepted status via GET")
        print("Verified request status updated to accepted.")

    def test_05_update_status_reject(self):
        """Test rejecting a request (re-use the same ID and expect 200 OK)."""
        # Note: This test now verifies that the API ALLOWS changing status
        # from 'accepted' (set in test_04) to 'rejected'.
        print("\n[Test] Reject Request (Attempting on previously accepted, expecting 200 OK)")
        self.assertIsNotNone(created_request_id, "Request ID not set from previous test") # Use the ID from create test

        payload = {"status": "rejected", "responder_id": RECIPIENT_CHARITY_ID}
        headers = {'Content-Type': 'application/json'}
        response = requests.put(f"{BASE_URL}/requests/{created_request_id}/status", json=payload, headers=headers)

        print(f"Update Resp Status: {response.status_code}, Body: {response.text}")

        # --- CHANGE ASSERTION ---
        # Verify that the API call itself was successful (200 OK)
        self.assertEqual(response.status_code, 200, "Expected 200 OK when changing status from accepted to rejected")
        # ------------------------

        # Verify the status in the response body is now 'rejected'
        data = response.json()
        self.assertEqual(data["data"]["status"], "rejected")
        self.assertEqual(data["data"]["id"], created_request_id)
        print("Verified rejection attempt succeeded (API returned 200 OK and status changed).")

        # Optional: Verify the change persists with a GET request
        print("Waiting briefly...")
        time.sleep(1.5)
        params_verify = {"charity_id": RECIPIENT_CHARITY_ID, "direction": "incoming", "status": "rejected"}
        response_verify = requests.get(f"{BASE_URL}/requests", params=params_verify)
        self.assertEqual(response_verify.status_code, 200)
        data_verify = response_verify.json()
        found_rejected = any(req["id"] == created_request_id and req["status"] == "rejected" for req in data_verify["data"])
        self.assertTrue(found_rejected, "Request not found with rejected status via GET")
        print("Verified request status is now rejected via GET.")


# --- Running the tests ---
if __name__ == '__main__':
    runner = unittest.TextTestRunner(verbosity=2)
    unittest.main(testRunner=runner)