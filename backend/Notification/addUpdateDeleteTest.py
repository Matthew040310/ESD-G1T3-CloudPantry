import unittest
import notification

class addUpdateDeleteTest(unittest.TestCase):
    test_notificationB1_id = None
    test_notificationB2_id = None

    @classmethod
    def setUpClass(cls):
        cls.app = notification.app.test_client()
        cls.app.testing = True
        
# Test function when adding one notification
    def test_addNotificationA(self):
        data = {
                "ItemID": "0816aef5-b625-41e3-815e-f0fa662c49b1",
                "Notification": "Test Notification",
                "Quantity": 1,
                "Recipient": 0,
                "Category": "Canned Goods",
                "Status": "pending"
            }

        response = self.app.post('/notification/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['total_count'], 1)
        addUpdateDeleteTest.test_notificationB1_id = json_data['data']['response'][0]['id']

# Test deleting the details of one notification
    # NOTE: For some reason, the delete function happens between the update,
    # and returning the response. Hence update test_updateNotificationA will 
    # return total_count = 0 and the update self.assertEqual will fail
    # NO FUNCTIONAL IMPACT

# Test deleting more than one notification

    # Create Second Dummy Data. Prefix with Test_ so that it will auto run
    # Not an actual test
    def test_createNotificationB2(self):
        data = {
                "ItemID": "0816aef5-b625-41e3-815e-f0fa662c49b1",
                "Notification": "Test Notification",
                "Quantity": 1,
                "Recipient": 0,
                "Category": "Canned Goods",
                "Status": "pending"
            }
        response = self.app.post('/notification/0',json=data)
        json_data = response.get_json()
        addUpdateDeleteTest.test_notificationB2_id =  json_data['data']['response'][0]['id']

    def test_deleteNotificationItem2(self):
        data = [{
                        "Notification": "Modified Item B1",
                        "id":addUpdateDeleteTest.test_notificationB1_id
                    },
                    {
                        "Notification": "Modified Item B2",
                        "id":addUpdateDeleteTest.test_notificationB2_id
                    }]
        response = self.app.delete('/notification',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['total_count'], 2)

# Return exit code 1 if any of the tests fail, which will prevent starting up of the container
if __name__ == '__main__':
    unittest.main()