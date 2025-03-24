import unittest
import inventory

class TestInventory(unittest.TestCase):
    def setUp(self):
        self.app = inventory.app.test_client()
        self.app.testing = True

    def test_getAllInventory(self):
        # Make a GET request to the `/inventory` route
        response = self.app.get('/inventory')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['total_count'], 4)

    def test_getCharityInventory(self):
        expected_data_response = [
                                {
                                    "charityID": 1,
                                    "expiry_date": "2025-03-10",
                                    "fill_factor": 2,
                                    "id": "a600288e-27ea-4d73-a4a5-af106b567504",
                                    "name": "Test Olive Oil",
                                    "quantity": 150,
                                    "restrictions": None,
                                    "category": "Cooking Essentials",
                                    "type": "Fats"
                                }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.get('/inventory/1')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['response'], expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)

    def test_getRestrictions(self):
        expected_data_response = ["Vegetarian","Halal"]
                    
        # Make a GET request to the `/restrictions` route
        response = self.app.get('/restrictions')
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertCountEqual(json_data, expected_data_response)

# Running the unittests (run code within python environment)
unittest.TextTestRunner().run(unittest.TestLoader().loadTestsFromTestCase(TestInventory))