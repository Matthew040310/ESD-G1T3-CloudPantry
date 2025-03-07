from dotenv import load_dotenv
import os
from supabase import create_client, Client
from flask import Flask, request, jsonify

# Load environment variables from .env file
load_dotenv()

# Define Supabase Connection Variables
SUPABASE_API_KEY: str = os.getenv('SUPABASE_API_KEY')
SUPABASE_URL: str = os.getenv('SUPABASE_URL')

# To change code later for auto retrieval from docker yaml, so that code can be reused for excess_inventory table
# TARGET_TABLE: str = os.getenv('TABLE_NAME')
# CHARITY_ID: int = os.getenv("CHARITY_ID")
target_table = "Inventory"
charity_id = ""

# Connect to database
supabase : Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)

# Initialise Flask Application
app = Flask(__name__)

@app.route("/inventory")
def getAllInventory():
    try:
        response = (
            supabase.table(target_table)
            .select("*")
            .execute()
        )
        return jsonify(
            {
                "code": 200,
                "data": {
                    "response": response.data,
                    "total_count": len(response.data)
                    },
            }
        ), 200
    except Exception as e:
        return jsonify(
            {
                "code": 400,
                "message": "Unexpected error occurred. Please try again."
                }
        ), 400



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)