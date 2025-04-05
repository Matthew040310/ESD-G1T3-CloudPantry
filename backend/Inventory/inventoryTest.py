import unittest
import inventory

class TestInventory(unittest.TestCase):
    expected_data_response = [
                                {
                                    "charityID": 0,
                                    "expiry_date": "1970-01-01",
                                    "fill_factor": 1970,
                                    "id": "580596f9-afab-4413-b9a2-09107926930a",
                                    "name": "Test",
                                    "quantity": 1970,
                                    "restrictions": ["Test"],
                                    "category": "Test",
                                    "type": "Test"
                                }]

    def setUp(self):
        self.app = inventory.app.test_client()
        self.app.testing = True

    def test_getAllInventory(self):
        response = self.app.get('/inventory')
        
        # Test Case
        self.assertEqual(response.status_code, 200)

    def test_getCharityInventory(self):
        response = self.app.get('/inventory/0')

        # Test Case
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['response'], TestInventory.expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)
    
    def test_getInventory(self):
        response = self.app.get('/inventory/item/580596f9-afab-4413-b9a2-09107926930a')

        # Test Case
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['data']['response'], TestInventory.expected_data_response)
        self.assertEqual(json_data['data']['total_count'], 1)

    def test_getRestrictions(self):
        response = self.app.get('/inventory/restrictions')
            
        # Test Case
        self.assertEqual(response.status_code, 200)

# Return exit code 1 if any of the tests fail, which will prevent starting up of the container
if __name__ == '__main__':
    unittest.main()