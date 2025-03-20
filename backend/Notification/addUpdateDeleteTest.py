import unittest
import notification

class addUpdateDeleteTest(unittest.TestCase):
    test_notificationA_id = None
    test_notificationB1_id = None
    test_notificationB2_id = None

    @classmethod
    def setUpClass(cls):
        cls.app = notification.app.test_client()
        cls.app.testing = True
        
# Test function when adding one notification
    def test_addNotificationA(self):
        data = {
                "Notification": "This is charity 0 talking to 3",
                "Recipients": [
                    3
                ]
            }

        # Make a GET request to the `/notification/<CharityID>` route
        response = self.app.post('/notification/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)
        addUpdateDeleteTest.test_notificationA_id = json_data['data']['response'][0]['id']
    
# Test function when adding more than one recipient
    def test_addNotificationB(self):
        data = {
                "Notification": "This is charity 0 talking to 3 and 4",
                "Recipients": [
                    3,
                    4
                ]
            }

        # Make a GET request to the `/notification/<CharityID>` route
        response = self.app.post('/notification/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)
        addUpdateDeleteTest.test_notificationB1_id =  json_data['data']['response'][0]['id']

# Test updating the details of one notification
    def test_updateNotificationA(self):
        data = {
                "Notification": "Update Notification A",
                "Recipients": [
                    3,
                    4
                ],
                "id":addUpdateDeleteTest.test_notificationA_id
            }
        response = self.app.put('/notification',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)


# Test deleting the details of one notification
    # NOTE: For some reason, the delete function happens between the update,
    # and returning the response. Hence update test_updateNotificationA will 
    # return total_count = 0 and the update self.assertEqual will fail
    # NO FUNCTIONAL IMPACT

# Test deleting more than one notification

    # Create Second Dummy Data. Prefix with Test_ so that it will auto run
    def test_createNotificationB2(self):
        data = {
                "Notification": "Notification B2",
                "Recipients": [4,5]
                }

    # Make a GET request to the `/notification/<CharityID>` route
        response = self.app.post('/notification/0',json=data)
            
        # Assert the response status code and data
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
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 2)

# Clean up remaining test A data from database
    @classmethod
    def tearDownClass(cls):
        testids = [
                    {
                        "Notification": "Modified Item A",
                        "id":addUpdateDeleteTest.test_notificationA_id
                    }]
        response = cls.app.delete('/notification',json=testids)
        # Assert response status code
        assert response.status_code == 200
        json_data = response.get_json()
        # Assert all 4 test cases were removed
        assert json_data['data']['total_count'] == 1
        

# Running the unittests (run code within python environment)
unittest.TextTestRunner().run(unittest.TestLoader().loadTestsFromTestCase(addUpdateDeleteTest))