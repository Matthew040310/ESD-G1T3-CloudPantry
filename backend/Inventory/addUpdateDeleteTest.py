# Need a seperate file for testing databate modification functions
# If not the inventoryTest.py test functions will fail

import unittest
import inventory

class addUpdateDeleteTest(unittest.TestCase):
    test_itemA_id = None
    test_itemB1_id = None
    test_itemB2_id = None
    test_date_id = None

    @classmethod
    def setUpClass(cls):
        cls.app = inventory.app.test_client()
        cls.app.testing = True
        
    # Test function when adding one item
    def test_addInventory1(self):
        data = [{
                        "expiry_date": "2025-03-07",
                        "fill_factor": 2,
                        "name": "Test Item A",
                        "quantity": 1,
                        "restrictions": ["halal","vegatarian"],
                        "category": "Canned Goods",
                        "type":"Protein"
                    }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.post('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)
        addUpdateDeleteTest.test_itemA_id =  json_data['data']['response'][0]['id']

    # Test function when adding more than one item
    def test_addInventory2(self):
        data = [{
                        "expiry_date": "2025-03-07",
                        "fill_factor": 2,
                        "name": "Test Item B1",
                        "quantity": 1,
                        "category": "Pasta & Grains",
                        "type": "Carbs"
                    },
                    {
                        "expiry_date": "2025-03-07",
                        "fill_factor": 2,
                        "name": "Test Item B2",
                        "quantity": 1,
                        "category": "Baby Food",
                        "type": "Carbs"
                    }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.post('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 2)
        addUpdateDeleteTest.test_itemB1_id = json_data['data']['response'][0]['id']
        addUpdateDeleteTest.test_itemB2_id = json_data['data']['response'][1]['id']
    
    # Test function when adding using different date format
    from datetime import datetime
    now = datetime.now()
    def test_addInventoryWithDifferentDate(self):
        data = [{
                        "expiry_date": self.now,
                        "fill_factor": 2,
                        "name": "Test Date Item",
                        "quantity": 1,
                        "category": "Cooking Essentials",
                        "type": "Fats"
                    }]

        # Make a GET request to the `/inventory/<CharityID>` route
        response = self.app.post('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)
        addUpdateDeleteTest.test_date_id = json_data['data']['response'][0]['id']

    # Test updating the details of one item
    def test_updateInventory1(self):
        data = [{
                        "expiry_date": "03-07-2025",
                        "fill_factor": 2,
                        "name": "Modified Item A",
                        "quantity": 0,
                        "category": "Pasta & Grains",
                        "type": "Carbs",
                        "restrictions": ["halal","kosher"],
                        "ID":addUpdateDeleteTest.test_itemA_id
                    }]
        response = self.app.put('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)

    # Test updating the details of more than one item
    def test_updateInventory2(self):
        data = [{
                        "name": "Modified Item B1",
                        "fill_factor": 2,
                        "quantity": 0,
                        "charityID": 1,
                        "category": "Baby Food",
                        "type": "Carbs",
                        "expiry_date": "03-07-2025",
                        "restrictions": [],
                        "ID":addUpdateDeleteTest.test_itemB1_id
                    },
                    {
                        "name": "Modified Item B2",
                        "fill_factor": 2,
                        "quantity": 0,
                        "charityID": 1,
                        "category": "Cooking Essentials",
                        "type": "Fats",
                        "expiry_date": "03-07-2025",
                        "restrictions": [],
                        "ID":addUpdateDeleteTest.test_itemB2_id
                    },
                    {
                        "name": "Modified Date Item",
                        "fill_factor": 2,
                        "quantity": 0,
                        "charityID": 1,
                        "category": "Canned Goods",
                        "type": "Protein",
                        "expiry_date": "03-07-2025",
                        "restrictions": [],
                        "ID":addUpdateDeleteTest.test_date_id
                    }]
        response = self.app.put('/inventory/0',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 3)

    # Test deleting the details of one item
    def test_deleteInventoryItem1(self):
        data = [{
                        "name": "Modified Item A",
                        "ID":addUpdateDeleteTest.test_itemA_id
                    }]
        response = self.app.delete('/inventory',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 1)

    # Test deleting more than one item. Clears remaining test items used in this test file
    def test_deleteTestItems(self):
        data = [{
                        "name": "Modified Item B1",
                        "ID":addUpdateDeleteTest.test_itemB1_id
                    },
                    {
                        "name": "Modified Item B2",
                        "ID":addUpdateDeleteTest.test_itemB2_id
                    },
                    {
                        "name": "Modified Date Item",
                        "ID":addUpdateDeleteTest.test_date_id
                    }]
        response = self.app.delete('/inventory',json=data)
            
        # Assert the response status code and data
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['code'], 200)
        self.assertEqual(json_data['data']['total_count'], 3)

    @classmethod
    def tearDownClass(cls):
        testids = [
                    {
                        "name": "Modified Item A",
                        "ID":addUpdateDeleteTest.test_itemA_id
                    },
                    {
                        "name": "Modified Item B1",
                        "ID":addUpdateDeleteTest.test_itemB1_id
                    },
                    {
                        "name": "Modified Item B2",
                        "ID":addUpdateDeleteTest.test_itemB2_id
                    },
                    {
                        "name": "Modified Date Item",
                        "ID":addUpdateDeleteTest.test_date_id
                    }]
        response = cls.app.delete('/inventory',json=testids)
        # Assert response status code
        assert response.status_code == 200
        json_data = response.get_json()
        # Assert all 4 test cases were removed
        assert json_data['data']['total_count'] == 4
        

# Running the unittests (run code within python environment) NOTE: Does not return exit code 1 if run from terminal
# unittest.TextTestRunner().run(unittest.TestLoader().loadTestsFromTestCase(addUpdateDeleteTest))

# Return exit code 1 if any of the tests fail, which will prevent starting up of the container
if __name__ == '__main__':
    unittest.main()