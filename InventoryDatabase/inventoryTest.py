import unittest
import inventory

class TestInventory(unittest.TestCase):
    def setUp(self):
        self.app = inventory.app.test_client()
        self.app.testing = True

    def test_getAllInventory(self):
        expected_data_response = [
                                {
                                    "charityID": 1,
                                    "expiry_date": "2025-03-10",
                                    "fill_factor": 2,
                                    "id": "a600288e-27ea-4d73-a4a5-af106b567504",
                                    "name": "Chicken",
                                    "quantity": 1,
                                    "restrictions": None,
                                    "type": "Protein"
                                },
                                {
                                    "charityID": 0,
                                    "expiry_date": "2025-03-07",
                                    "fill_factor": 2,
                                    "id": "ba3f8d20-de29-425d-aab7-7a42d5f10909",
                                    "name": "Bread",
                                    "quantity": 1,
                                    "restrictions": ["Halal","Vegetarian"],
                                    "type": "Carbs"
                                }]
        # Make a GET request to the `/inventory` route
        response = self.app.get('/inventory')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['response'], expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 2)

    def test_getCharityInventory(self):
        expected_data_response = [{
                        "charityID": 0,
                        "expiry_date": "2025-03-07",
                        "fill_factor": 2,
                        "id": "ba3f8d20-de29-425d-aab7-7a42d5f10909",
                        "name": "Bread",
                        "quantity": 1,
                        "restrictions": ["Halal","Vegetarian"],
                        "type": "Carbs"
                    }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.get('/inventory/0')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['response'], expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)

    def test_getRestrictions(self):
        expected_data_response = ["Halal","Vegetarian"]
                    
        # Make a GET request to the `/restrictions` route
        response = self.app.get('/restrictions')
            
        # Assert the response status code and data
        print(response)
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data, expected_data_response)

# Running the unittests (run code within python environment)
unittest.TextTestRunner().run(unittest.TestLoader().loadTestsFromTestCase(TestInventory))