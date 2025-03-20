import unittest
import notification

class TestInventory(unittest.TestCase):
    def setUp(self):
        self.app = notification.app.test_client()
        self.app.testing = True

    def test_getAllNotification(self):
        expected_data_response = [
            {
                "created_at": "2025-03-20T10:27:09",
                "id": "5a5e7baa-1506-41da-89c0-71ff228da200",
                "notification": "This is charity 0 talking to charity 1",
                "recipient_ids": [
                    1
                ],
                "sender_id": 0
            },
            {
                "created_at": "2025-03-20T10:27:11",
                "id": "cf483ba6-9cde-4e54-8846-46ed108e3721",
                "notification": "This is charity 0 talking to 1 and 2",
                "recipient_ids": [
                    1,
                    2
                ],
                "sender_id": 0
            }]
        # Make a GET request to the `/notification` route
        response = self.app.get('/notification')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['response'], expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 2)

    def test_getCharityNotification(self):
        expected_data_response = [
            {
                "created_at": "2025-03-20T10:27:11",
                "id": "cf483ba6-9cde-4e54-8846-46ed108e3721",
                "notification": "This is charity 0 talking to 1 and 2",
                "recipient_ids": [
                    1,
                    2
                ],
                "sender_id": 0
            }
        ]

        # Make a GET request to the `/notification/<CharityID>` route
        response = self.app.get('/notification/2')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['response'], expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)

# Running the unittests (run code within python environment)
unittest.TextTestRunner().run(unittest.TestLoader().loadTestsFromTestCase(TestInventory))