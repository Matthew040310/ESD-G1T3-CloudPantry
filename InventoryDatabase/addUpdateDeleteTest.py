# Need a seperate file for testing databate modification functions
# If not the inventoryTest.py test functions will fail

import unittest
import inventory

class addUpdateDeleteTest(unittest.TestCase):
    def setUp(self):
        self.app = inventory.app.test_client()
        self.app.testing = True

    # Test function when adding one item
    def test_addInventory1(self):
        data = [{
                        "Expiry Date": "2025-03-07",
                        "Fill Factor": 2,
                        "Name": "Test Item A",
                        "Quantity": 1,
                        "Type": "Carbs"
                    }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.post('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)

    # Test function when adding more than one item
    def test_addInventory2(self):
        data = [{
                        "Expiry Date": "2025-03-07",
                        "Fill Factor": 2,
                        "Name": "Test Item B1",
                        "Quantity": 1,
                        "Type": "Carbs"
                    },
                    {
                        "Expiry Date": "2025-03-07",
                        "Fill Factor": 2,
                        "Name": "Test Item B2",
                        "Quantity": 1,
                        "Type": "Carbs"
                    }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.post('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 2)
    
    # Test function when adding using different date format
    from datetime import datetime
    now = datetime.now()
    def test_addInventoryWithDifferentDate(self):
        data = [{
                        "Expiry Date": self.now,
                        "Fill Factor": 2,
                        "Name": "Test Date Item",
                        "Quantity": 1,
                        "Type": "Carbs"
                    }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.post('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)

# Running the unittests (run code within python environment)
unittest.TextTestRunner().run(unittest.TestLoader().loadTestsFromTestCase(addUpdateDeleteTest))