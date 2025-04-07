import unittest
import notification

class TestNotification(unittest.TestCase):
    expected_data_response = [
            {
                "created_at": "1970-01-01T00:00:00",
                "id": "5a5e7baa-1506-41da-89c0-71ff228da200",
                "item_id": "0816aef5-b625-41e3-815e-f0fa662c49b8",
                "notification": "Test Notification",
                "quantity": 1,
                "recipient_id": 0,
                "category": "Canned Goods",
                "sender_id": 0,
                "status": "PENDING",
                "read_update": True
            }
        ]
    
    def setUp(self):
        self.app = notification.app.test_client()
        self.app.testing = True

    def test_getAllNotification(self):
        response = self.app.get('/notification')
            
        # Assert the response status code
        self.assertEqual(response.status_code, 200)

    def test_getCharityNotification(self):

        # Make a GET request to the `/notification/<CharityID>` route
        response = self.app.get('/notification/0')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['response'], TestNotification.expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)

    def test_getCharityNewNotification(self):
    
        response = self.app.get('/notification/new/0')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['response'], TestNotification.expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)
    
    def test_readCharityNotification(self):
        test_expected_response = TestNotification.expected_data_response
        test_expected_response[0]['read_update'] = False
    
        response = self.app.post('/notification/read/0')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['response'], test_expected_response)
        self.assertEqual(json_data['data']['total_count'], 1)
    
    def test_updateNotificationA(self):
        data = {
                "id":"5a5e7baa-1506-41da-89c0-71ff228da200",
                "Notification": "Test Notification",
                "Quantity": 1,
                "Recipient": 0,
                "Status": "PENDING"
            }
        response = self.app.put('/notification',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['total_count'], 1)

# Return exit code 1 if any of the tests fail, which will prevent starting up of the container
if __name__ == '__main__':
    unittest.main()