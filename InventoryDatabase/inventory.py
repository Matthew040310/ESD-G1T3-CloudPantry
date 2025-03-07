from dotenv import load_dotenv
import os
from supabase import create_client, Client
from flask import Flask, request, jsonify
from itemClass import item

# Load environment variables from .env file
load_dotenv()

# Define Supabase Connection Variables
SUPABASE_API_KEY: str = os.getenv('SUPABASE_API_KEY')
SUPABASE_URL: str = os.getenv('SUPABASE_URL')

# To change code later for auto retrieval from docker yaml, so that code can be reused for excess_inventory table
# TARGET_TABLE: str = os.getenv('TABLE_NAME')
target_table = "Inventory"

# Connect to database
supabase : Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)

# Initialise Flask Application
app = Flask(__name__)

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
            supabase.table(target_table)
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

@app.route("/inventory/<int:charityID>")
def getCharityInventory(charityID):
    try:
        response = (
            supabase.table(target_table)
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
        item_dict['name'] = item_data.get('Name')
        item_dict['type'] = item_data.get('Type')
        item_dict['expiry_date'] = item_data.get('Expiry Date')
        item_dict['quantity'] = item_data.get('Quantity')
        item_dict['fill_factor'] = item_data.get('Fill Factor')
        item_dict['charityID'] = charityID
        new_inventory.append(item_dict)
    try:
        response = (
            supabase.table(target_table)
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
    new_inventory = []
    for item_data in data:
        item_dict = {}
        item_dict['id'] = item_data.get('ID')
        item_dict['name'] = item_data.get('Name')
        item_dict['type'] = item_data.get('Type')
        item_dict['expiry_date'] = item_data.get('Expiry Date')
        item_dict['quantity'] = item_data.get('Quantity')
        item_dict['fill_factor'] = item_data.get('Fill Factor')
        item_dict['charityID'] = charityID
        new_inventory.append(item_dict)
    try:
        response = (
            supabase.table(target_table)
            .upsert(new_inventory)
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