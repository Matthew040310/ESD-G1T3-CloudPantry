# Allocate Resources Microservice - Allocate food items to beneficiaries based on needs (demand forecasting, not actual allocation)
# Real necessary imports
from flask import Flask, jsonify, request
from datetime import datetime, timedelta
from allocation_logic import allocate_resources

# Import dummy data
from fake_data import current_inventory_list, recipient_list

app = Flask(__name__)

# Fix number of dummy data for inventory (max 1000 rows) and recipient (max 1000 rows)
NUMBER_OF_PEOPLE = 100
NUMBER_OF_INVENTORY_ITEMS = 190

current_inventory_list = current_inventory_list[:NUMBER_OF_INVENTORY_ITEMS]
recipient_list = recipient_list[:NUMBER_OF_PEOPLE]

# Real implementation
recipient_allocation_list = []
excess_item_list = []
shortage_item_list = []

# Logic to get recipient objects (from database in Recipient microservice) 
# who are supposed to get items (for now dummy data to be filled in), 
# determine based on last_delivery_date
# Recipient database row structure: 
''' 
    {
        id (auto_increment, identifier), 
        name (varchar), 
        address (varchar), 
        dietary_restriction (varchar), 
        phone_number (varchar), 
        household_avg_income (int), 
        calorie_requirement (int), 
        last_delivery_date (date), 
        dependents (int)
    }
'''

# recipient_list = [] # to be filled with database query

# Get available item objects (from database in Inventory microservice) 
# (for now dummy data to be filled in)
# Inventory database row structure: 
'''
    {
        id (auto_increment, identifier), 
        name (varchar), 
        type (varchar => carb/protein/fat/vegetable), 
        expiry_date (date), 
        quantity (int), 
        filling_factor (int), 
        halal (boolean), 
        kosher (boolean)
    }
'''

# current_inventory_list = [] # to be filled with database query

# Resource allocation logic (determine what are in excess, what are in shortage)
'''
For now the resource allocation will be based on household average income, 
calorie requirement, dietary restrictions and needs to ensure proper variety
of food (fulfil nutrition requirements) => I need an algorithm for this, no need to 
be too sophisticated, just need it to run quick
'''
@app.route('/allocate', methods=['GET'])
def handle_allocation():
    try:

        recipient_allocation_list, excess_item_list, shortage_item_list = allocate_resources(recipient_list, current_inventory_list)
        
        response = {
            "status": "success",
            "allocation_list": recipient_allocation_list,
            "excess_items": excess_item_list,
            "shortage_items": shortage_item_list,
            "message": "success",
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/inventory', methods=['GET'])
def get_inventory():
    return jsonify(current_inventory_list), 200

@app.route('/recipients', methods=['GET'])
def get_recipients():
    return jsonify(recipient_list), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


