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
                        "Expiry Date": "2025-03-07",
                        "Fill Factor": 2,
                        "Name": "Test Item A",
                        "Quantity": 1,
                        "Restrictions": ["halal","vegatarian"],
                        "Type": "Carbs"
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
        addUpdateDeleteTest.test_itemB1_id = json_data['data']['response'][0]['id']
        addUpdateDeleteTest.test_itemB2_id = json_data['data']['response'][1]['id']
    
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
        addUpdateDeleteTest.test_date_id = json_data['data']['response'][0]['id']

    # Test updating the details of one item
    def test_updateInventory1(self):
        data = [{
                        "Expiry Date": "03-07-2025",
                        "Fill Factor": 2,
                        "Name": "Modified Item A",
                        "Quantity": 0,
                        "Type": "Fats",
                        "Restrictions": ["halal","kosher"],
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
                        "Name": "Modified Item B1",
                        "Fill Factor": 2,
                        "Quantity": 0,
                        "CharityID": 1,
                        "Type": "Fats",
                        "Expiry Date": "03-07-2025",
                        "Restrictions": [],
                        "ID":addUpdateDeleteTest.test_itemB1_id
                    },
                    {
                        "Name": "Modified Item B2",
                        "Fill Factor": 2,
                        "Quantity": 0,
                        "CharityID": 1,
                        "Type": "Fats",
                        "Expiry Date": "03-07-2025",
                        "Restrictions": [],
                        "ID":addUpdateDeleteTest.test_itemB2_id
                    },
                    {
                        "Name": "Modified Date Item",
                        "Fill Factor": 2,
                        "Quantity": 0,
                        "CharityID": 1,
                        "Type": "Fats",
                        "Expiry Date": "03-07-2025",
                        "Restrictions": [],
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
                        "Name": "Modified Item A",
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
                        "Name": "Modified Item B1",
                        "ID":addUpdateDeleteTest.test_itemB1_id
                    },
                    {
                        "Name": "Modified Item B2",
                        "ID":addUpdateDeleteTest.test_itemB2_id
                    },
                    {
                        "Name": "Modified Date Item",
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
                        "Name": "Modified Item A",
                        "ID":addUpdateDeleteTest.test_itemA_id
                    },
                    {
                        "Name": "Modified Item B1",
                        "ID":addUpdateDeleteTest.test_itemB1_id
                    },
                    {
                        "Name": "Modified Item B2",
                        "ID":addUpdateDeleteTest.test_itemB2_id
                    },
                    {
                        "Name": "Modified Date Item",
                        "ID":addUpdateDeleteTest.test_date_id
                    }]
        response = cls.app.delete('/inventory',json=testids)
        # Assert response status code
        assert response.status_code == 200
        json_data = response.get_json()
        # Assert all 4 test cases were removed
        assert json_data['data']['total_count'] == 4
        

# Running the unittests (run code within python environment)
unittest.TextTestRunner().run(unittest.TestLoader().loadTestsFromTestCase(addUpdateDeleteTest))