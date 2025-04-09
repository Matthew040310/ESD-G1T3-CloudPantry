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
# TARGET_TABLE: str = os.getenv('TABLE_NAME', "notifications_log")
TARGET_TABLE: str = os.getenv('TABLE_NAME', "Notification")

# Connect to database
supabase : Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)

# Initialise Flask Application
app = Flask(__name__)
CORS(app)

# To jsonify successful results
def successful_result(response):
    if len(response.data) == 0:
        return jsonify(
           {
            "code": 404,
            "response": response.data,
            "message": "There are no results."
            }
        ), 404
    return jsonify(
            {
                "code": 200,
                "data": {
                    "response": response.data,
                    "total_count": len(response.data)
                    },
            }
        ), 200

@app.route("/notification")
def getAllNotification():
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
                "code": 500,
                "message": "Unexpected error occurred. Please try again."
                }
        ), 500

# Gets notifications where charityID equals sender_id or recipient_ids contains charityID
@app.route("/notification/<int:charityID>")
def getCharityNotification(charityID):
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .select("*")
            .or_(f"sender_id.eq.{charityID},recipient_id.eq.{charityID}")
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 500,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 500
    
# Gets new notifications
@app.route("/notification/new/<int:charityID>")
def getCharityNewNotification(charityID):
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .select("*")
            .or_(f"sender_id.eq.{charityID},recipient_id.eq.{charityID}")
            .eq("status", "pending")
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 500,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 500

@app.route("/notification/<int:charityID>", methods=['POST'])
def addNotification(charityID):
    notification_data = request.get_json()
    notification_dict = {}
    notification_dict['sender_id'] = charityID
    notification_dict['recipient_id'] = notification_data['Recipient']
    notification_dict['notification'] = notification_data['Notification']
    notification_dict['category'] = notification_data['Category']
    notification_dict['quantity'] = notification_data['Quantity']
    notification_dict['item_id'] = notification_data['ItemID']
    notification_dict['status'] = notification_data['Status']
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .insert(notification_dict)
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 500,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 500

@app.route("/notification", methods=['PUT'])
def updateNotification():
    notification_data = request.get_json()
    notification_dict = {}
    id = notification_data['id']
    notification_dict['recipient_id'] = notification_data['Recipient']
    notification_dict['notification'] = notification_data['Notification']
    notification_dict['quantity'] = notification_data['Quantity']
    notification_dict['status'] = notification_data['Status']
    try:
        response = (
            supabase.table(TARGET_TABLE)
            .update(notification_dict)
            .eq("id", id)
            .execute()
        )
        return successful_result(response)
    except Exception as e:
        return jsonify(
            {
                "code": 500,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 500

# NOTE: Data input for DELETE API is the only one that is LIST
@app.route("/notification", methods=['DELETE'])
def deleteNotification():
    data = request.get_json()
    ids_to_delete = []
    for notification_data in data:
        ids_to_delete.append(notification_data.get('id'))
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
                "code": 500,
                "message": f"Error Occurred.\n{e.message}"
                }
        ), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)