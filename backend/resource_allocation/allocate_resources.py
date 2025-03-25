# Allocate Resources Microservice - Allocate food items to beneficiaries based on needs (demand forecasting, not actual allocation)
# Real necessary imports
from flask import Flask, jsonify, request
from datetime import datetime, timedelta
from allocation_logic import allocate_resources

# Import dummy data
# from fake_data3 import current_inventory_list, recipient_list

app = Flask(__name__)

# Fix number of dummy data for inventory (max 1000 rows) and recipient (max 1000 rows)
# NUMBER_OF_PEOPLE = 1
# NUMBER_OF_INVENTORY_ITEMS = 30

# current_inventory_list = current_inventory_list[:NUMBER_OF_INVENTORY_ITEMS]
# recipient_list = recipient_list[:NUMBER_OF_PEOPLE]

# Real implementation
recipient_allocation_list = []
excess_item_list = []
shortage_item_list = []

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

# Inventory/ Excess Inventory database row structure: 
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
@app.route('/allocate/<int:charity_id>', methods=['GET'])
def handle_allocation(charity_id):
    try:
        print(type(charity_id))
        print(charity_id)
        # recipient_allocation_list, excess_item_list, shortage_item_list = allocate_resources(recipient_list, current_inventory_list) # Hardcoded for now, should only need charity id
        recipient_allocation_list, excess_item_list, shortage_item_list, potential_charities = allocate_resources(charity_id)
        

        response = {
            "status": "success",
            "allocation_list": recipient_allocation_list,
            "excess_items": excess_item_list,
            "shortage_items": shortage_item_list,
            "potential_charities": potential_charities,
            "message": "success",
        }
        
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# For reading dummy data
# @app.route('/inventory', methods=['GET'])
# def get_inventory():
#     return jsonify(current_inventory_list), 200

# @app.route('/recipients', methods=['GET'])
# def get_recipients():
#     return jsonify(recipient_list), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)


