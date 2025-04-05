import unittest
import notification

class TestNotification(unittest.TestCase):
    def setUp(self):
        self.app = notification.app.test_client()
        self.app.testing = True

    def test_getAllNotification(self):
        response = self.app.get('/notification')
            
        # Assert the response status code
        self.assertEqual(response.status_code, 200)

    def test_getCharityNotification(self):
        expected_data_response = [
            {
                "created_at": "1970-01-01T00:00:00",
                "id": "5a5e7baa-1506-41da-89c0-71ff228da200",
                "notification": "Test Notification",
                "recipient_ids": [0],
                "sender_id": 0
            }
        ]

        # Make a GET request to the `/notification/<CharityID>` route
        response = self.app.get('/notification/0')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['response'], expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)

# Return exit code 1 if any of the tests fail, which will prevent starting up of the container
if __name__ == '__main__':
    unittest.main()