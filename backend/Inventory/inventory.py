from dotenv import load_dotenv
import os
from supabase import create_client, Client
from flask import Flask, request, jsonify
from flask_cors import CORS

# Load environment variables from .env file
load_dotenv()

# Define Supabase Connection Variables
SUPABASE_API_KEY: str = os.getenv('SUPABASE_API_KEY')
SUPABASE_URL: str = os.getenv('SUPABASE_URL')

# To change code later for auto retrieval from docker yaml, so that code can be reused for excess_inventory table
TARGET_TABLE: str = os.getenv('TABLE_NAME', "Excess_Inventory")
# TARGET_TABLE = "Inventory"
# TARGET_TABLE = "Excess_Inventory"

# Connect to database
supabase : Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)

# Initialise Flask Application
app = Flask(__name__)
CORS(app)

# To jsonify successful results
def successful_result(response):
    return jsonify(
            {
                "code": 200,
                "data": {
                    "response": response.data,
                    "total_count": len(response.data)
                    },
            }
        ), 200

@app.route("/inventory")
def getAllInventory():
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .select("*")
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": "Unexpected error occurred. Please try again."
                }
        ), 400
    
@app.route("/restrictions")
def getAllRestrictions():
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .select("restrictions")
            .execute()
        )
        restriction_list = set()
        for restriction in response.data:
            if restriction['restrictions']:
                restriction_list.update(restriction['restrictions'])
        return jsonify(list(restriction_list))
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": "Unexpected error occurred. Please try again."
                }
        ), 400

@app.route("/inventory/<int:charityID>")
def getCharityInventory(charityID):
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .select("*")
            .eq("charityID",charityID)
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 400

# Consider filtering items within UI, rather than recalling database
# Type / Expiry Date

@app.route("/inventory/<int:charityID>", methods=['POST'])
def addInventory(charityID):
    data = request.get_json()
    new_inventory = []
    for item_data in data:
        item_dict = {}
        item_dict['name'] = item_data.get('name')
        item_dict['category'] = item_data.get('category')
        item_dict['type'] = item_data.get('type')
        item_dict['expiry_date'] = item_data.get('expiry_date')
        item_dict['quantity'] = item_data.get('quantity')
        item_dict['fill_factor'] = item_data.get('fill_factor')
        if item_data.get('restrictions'):
            item_dict['restrictions'] = [item.capitalize() for item in item_data.get('restrictions')]
        else:
            item_dict['restrictions'] = item_data.get('restrictions')
        item_dict['charityID'] = charityID
        new_inventory.append(item_dict)
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .insert(new_inventory)
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 400

@app.route("/inventory/<int:charityID>", methods=['PUT'])
def updateInventory(charityID):
    data = request.get_json()
    update_inventory = []
    for item_data in data:
        item_dict = {}
        item_dict['id'] = item_data.get('ID')
        item_dict['name'] = item_data.get('name')
        item_dict['category'] = item_data.get('category')
        item_dict['type'] = item_data.get('type')
        item_dict['expiry_date'] = item_data.get('expiry_date')
        item_dict['quantity'] = item_data.get('quantity')
        item_dict['fill_factor'] = item_data.get('fill_factor')
        if item_data.get('restrictions'):
            item_dict['restrictions'] = [item.capitalize() for item in item_data.get('restrictions')]
        else:
            item_dict['restrictions'] = item_data.get('restrictions')
        item_dict['charityID'] = charityID
        update_inventory.append(item_dict)
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .upsert(update_inventory)
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 400
    
@app.route("/inventory", methods=['DELETE'])
def deleteInventory():
    data = request.get_json()
    ids_to_delete = []
    for item_data in data:
        ids_to_delete.append(item_data.get('ID'))
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .delete()
            .in_("id", ids_to_delete)
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 400
    
@app.route("/inventory/clear", methods=['DELETE'])
def removeQtyZero():
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .delete()
            .eq("quantity",0)
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)