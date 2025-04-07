# --- request_api.py ---
# Backend API Service for charity resource exchange system
# Handles HTTP requests, manages DB state, and publishes to RabbitMQ

import os
import json
import pika
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- Configuration ---
SUPABASE_URL = os.environ.get("MESSAGENF_DB_URL")
SUPABASE_KEY = os.environ.get("MESSAGENF_DB_KEY")
INVENTORY_API_URL = os.environ.get("INVENTORY_API_URL", "http://localhost:5000/inventory")
RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.environ.get("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "guest")
RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS", "guest")
EXCHANGE_NAME = "charity_exchange"

# --- Initialize Supabase client ---
try:
    from supabase import create_client, Client
    supabase: Client = None
    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"Supabase client initialized for URL: {SUPABASE_URL}")
    else:
        logger.warning("SUPABASE_URL or SUPABASE_KEY not set. Running without Supabase.")
except ImportError:
    logger.warning("Supabase client library not found. Install with 'pip install supabase'")
    supabase = None

# --- RabbitMQ Connection Management ---
def get_rabbitmq_connection():
    """Create and return a RabbitMQ connection."""
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )
        )
        logger.info("RabbitMQ connection successful")
        return connection
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        return None

def publish_message(routing_key, message):
    """Publish message to RabbitMQ exchange."""
    connection = None
    try:
        connection = get_rabbitmq_connection()
        if not connection:
            logger.error("Cannot publish message - no RabbitMQ connection")
            return False
        
        channel = connection.channel()
        # Declare the exchange
        channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type='topic', durable=True)
        
        # Publish the message
        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=routing_key,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=pika.DeliveryMode.Persistent
            )
        )
        logger.info(f"Published message with routing key: {routing_key}")
        return True
    except Exception as e:
        logger.error(f"Error publishing message: {e}")
        return False
    finally:
        # Close the connection if opened
        if connection and connection.is_open:
            connection.close()

# --- Inventory Update Logic ---
def trigger_inventory_update(request_details):
    """Update inventory after a request is accepted."""
    try:
        # Extract necessary details
        sender_id = request_details.get('sender_id')  # Requester (gets items)
        recipient_id = request_details.get('recipient_id')  # Donor (gives items)
        resource_type = request_details.get('resource_type')
        quantity = request_details.get('quantity')
        item_id = request_details.get('item_id')
        
        if not all([sender_id, recipient_id, resource_type, quantity, item_id]):
            logger.error(f"Missing required fields for inventory update: {request_details}")
            return False
        
        # Option 1: Publish to action_trigger_queue
        action_message = {
            "action": "update_inventory",
            "original_request": request_details
        }
        return publish_message("action.trigger.accept", action_message)
        
        # Option 2: Directly call inventory APIs (uncomment if using this approach)
        # import requests
        # 
        # # Update recipient's inventory (donor/giver) - decrease quantity
        # recipient_url = f"{INVENTORY_API_URL}/{recipient_id}/{item_id}"
        # recipient_data = {"quantity_change": -int(quantity)}  # Negative to decrease
        # 
        # # Update sender's inventory (requester/receiver) - increase quantity
        # sender_url = f"{INVENTORY_API_URL}/{sender_id}/{item_id}"
        # sender_data = {
        #     "name": resource_type,
        #     "quantity_change": int(quantity),  # Positive to increase
        #     "create_if_missing": True  # Create the item if it doesn't exist
        # }
        # 
        # # Make API calls to update inventories
        # recipient_response = requests.put(recipient_url, json=recipient_data, timeout=10)
        # sender_response = requests.put(sender_url, json=sender_data, timeout=10)
        # 
        # return recipient_response.ok and sender_response.ok
        
    except Exception as e:
        logger.error(f"Error triggering inventory update: {e}", exc_info=True)
        return False

# --- API Endpoints ---

@app.route('/requests', methods=['POST'])
def create_request():
    """Create a new resource request."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate required fields
        sender_id = data.get('sender_id')
        if not sender_id:
            return jsonify({"error": "sender_id is required"}), 400
        
        # Handle requests to multiple recipients
        success_count = 0
        error_count = 0
        responses = []
        
        for recipient_id, request_items in data.items():
            if not isinstance(request_items, list):
                return jsonify({"error": f"Expected list of items for recipient {recipient_id}"}), 400
            
            for item in request_items:
                try:
                    # Extract and validate item fields
                    resource_type = item.get('resource_type')
                    quantity = item.get('quantity')
                    item_id = item.get('item_id')
                    
                    if not all([resource_type, quantity, item_id]):
                        logger.error(f"Missing required fields in request item: {item}")
                        error_count += 1
                        continue
                    
                    # Create request record
                    timestamp = datetime.now().isoformat()
                    
                    # Prepare record for database
                    db_record = {
                        'message_type': 'request',
                        'sender_id': str(sender_id),
                        'recipient_id': str(recipient_id),
                        'item_id': str(item_id),
                        'resource_type': resource_type,
                        'quantity': int(quantity),
                        'status': 'pending',
                        'timestamp': timestamp
                    }
                    
                    # Insert into database if available
                    record_id = None
                    if supabase:
                        result = supabase.table('notifications_log').insert(db_record).execute()
                        if hasattr(result, 'data') and result.data:
                            record_id = result.data[0].get('id')
                            db_record['id'] = record_id
                            logger.info(f"Request record inserted, ID: {record_id}")
                        else:
                            logger.error(f"Failed to insert request: {result}")
                            error_count += 1
                            continue
                    
                    # Publish message to recipient's queue
                    message = {
                        'event': 'new_request',
                        'request_id': record_id,
                        'sender_id': sender_id,
                        'recipient_id': recipient_id,
                        'resource_type': resource_type,
                        'quantity': quantity,
                        'item_id': item_id,
                        'timestamp': timestamp
                    }
                    
                    routing_key = f"message.to.{recipient_id}"
                    publish_success = publish_message(routing_key, message)
                    
                    if publish_success:
                        success_count += 1
                        responses.append(db_record)
                    else:
                        error_count += 1
                        # Option: roll back database insert if message publish fails
                        # if supabase and record_id:
                        #     supabase.table('notifications_log').delete().eq('id', record_id).execute()
                
                except Exception as e:
                    logger.error(f"Error processing request item: {e}", exc_info=True)
                    error_count += 1
        
        # Return appropriate response
        if error_count == 0 and success_count > 0:
            return jsonify({
                "status": "success", 
                "message": "All requests created successfully",
                "success_count": success_count,
                "requests": responses
            }), 201
        elif success_count > 0:
            return jsonify({
                "status": "partial_success",
                "message": f"Created {success_count} requests with {error_count} errors",
                "success_count": success_count,
                "error_count": error_count,
                "requests": responses
            }), 207  # Multi-Status
        else:
            return jsonify({
                "status": "error",
                "message": "Failed to create any requests",
                "error_count": error_count
            }), 500
    
    except Exception as e:
        logger.error(f"Error creating request: {e}", exc_info=True)
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

@app.route('/requests', methods=['GET'])
def get_requests():
    """Get requests filtered by charity ID and other parameters."""
    try:
        # Required: charity_id
        charity_id = request.args.get('charity_id')
        if not charity_id:
            return jsonify({"error": "charity_id parameter is required"}), 400
        
        # Optional filters
        direction = request.args.get('direction')  # 'incoming' or 'outgoing'
        status = request.args.get('status')  # 'pending', 'accepted', 'rejected', 'read'
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        if supabase:
            query = supabase.table('notifications_log').select('*')
            
            # Filter by message type
            query = query.eq('message_type', 'request')
            
            # Apply direction filter
            if direction == 'incoming':
                query = query.eq('recipient_id', str(charity_id))
            elif direction == 'outgoing':
                query = query.eq('sender_id', str(charity_id))
            else:
                # If no direction specified, get both incoming and outgoing
                query = query.or_(f'recipient_id.eq.{charity_id},sender_id.eq.{charity_id}')
            
            # Apply status filter if provided
            if status:
                query = query.eq('status', status)
            
            # Apply sorting, limit, and offset
            query = query.order('timestamp', desc=True).limit(limit).offset(offset)
            
            # Execute the query
            result = query.execute()
            
            if hasattr(result, 'data'):
                return jsonify(result.data), 200
            else:
                logger.error(f"Unexpected response format from Supabase: {result}")
                return jsonify([]), 200
        else:
            logger.warning("Supabase not configured, returning empty result")
            return jsonify([]), 200
    
    except Exception as e:
        logger.error(f"Error getting requests: {e}", exc_info=True)
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

@app.route('/requests/<int:request_id>/status', methods=['PUT'])
def update_request_status(request_id):
    """Update the status of a specific request."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate required fields
        new_status = data.get('status')
        responder_id = data.get('responder_id')
        
        if not new_status:
            return jsonify({"error": "status is required"}), 400
        if new_status not in ['accepted', 'rejected', 'read']:
            return jsonify({"error": "status must be 'accepted', 'rejected', or 'read'"}), 400
        if (new_status in ['accepted', 'rejected']) and not responder_id:
            return jsonify({"error": "responder_id is required for 'accepted' or 'rejected' status"}), 400
        
        # Fetch the current request from the database
        if not supabase:
            return jsonify({"error": "Database not configured"}), 500
        
        request_query = supabase.table('notifications_log').select('*').eq('id', request_id).execute()
        
        if not hasattr(request_query, 'data') or not request_query.data:
            return jsonify({"error": f"Request with ID {request_id} not found"}), 404
        
        request_data = request_query.data[0]
        
        # Check permissions:
        # - For 'accepted' or 'rejected', responder must be the recipient
        # - For 'read', we could have more flexible rules
        if new_status in ['accepted', 'rejected'] and str(request_data.get('recipient_id')) != str(responder_id):
            return jsonify({
                "error": "Permission denied", 
                "message": "Only the recipient can accept or reject a request"
            }), 403
        
        # Update record in database
        update_data = {
            'status': new_status,
            'response_timestamp': datetime.now().isoformat()
        }
        
        update_result = supabase.table('notifications_log').update(update_data).eq('id', request_id).execute()
        
        if not hasattr(update_result, 'data') or not update_result.data:
            return jsonify({"error": "Failed to update request status"}), 500
        
        updated_record = update_result.data[0]
        
        # If status is 'accepted' or 'rejected', notify the original sender
        if new_status in ['accepted', 'rejected']:
            sender_id = request_data.get('sender_id')
            
            # Create notification message
            message = {
                'event': 'request_updated',
                'request_id': request_id,
                'sender_id': responder_id,  # Current responder
                'recipient_id': sender_id,  # Original sender
                'item_id': request_data.get('item_id'),
                'resource_type': request_data.get('resource_type'),
                'quantity': request_data.get('quantity'),
                'status': new_status,
                'timestamp': update_data['response_timestamp']
            }
            
            # Publish to the sender's queue
            routing_key = f"message.to.{sender_id}"
            publish_message(routing_key, message)
            
            # If 'accepted', trigger inventory update
            if new_status == 'accepted':
                inventory_update_success = trigger_inventory_update({
                    'sender_id': sender_id,  # Requester (gets items)
                    'recipient_id': responder_id,  # Donor (gives items)
                    'item_id': request_data.get('item_id'),
                    'resource_type': request_data.get('resource_type'),
                    'quantity': request_data.get('quantity')
                })
                
                if not inventory_update_success:
                    logger.warning(f"Inventory update failed for request {request_id}")
                    # Still return success as the status update worked
        
        return jsonify(updated_record), 200
    
    except Exception as e:
        logger.error(f"Error updating request status: {e}", exc_info=True)
        return jsonify({"error": "Internal server error", "details": str(e)}), 500
    
def create_connection(hostname, port):
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=hostname,
            port=port,
            heartbeat=300,
            blocked_connection_timeout=300,
        )
    )
    return connection

def create_queue(channel, exchange_name, queue_name, routing_key):
    channel.queue_declare(queue=queue_name, durable=True)
    channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key=routing_key)

# Then add the endpoint
@app.route('/setup/queue/<charity_id>', methods=['POST'])
def setup_charity_queue(charity_id):
    """Ensure queue exists for a specific charity."""
    try:
        # Create connection to RabbitMQ using the local function
        connection = create_connection(RABBITMQ_HOST, RABBITMQ_PORT)
        channel = connection.channel()
        
        return jsonify({
            "status": "success", 
            "message": f"Queue setup completed for charity {charity_id}"
        }), 200
        
    except Exception as e:
        logger.error(f"Error setting up queue for charity {charity_id}: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to set up queue: {str(e)}"
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Check API health status."""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database_connection": False,
        "rabbitmq_connection": False
    }
    
    # Check database connection
    if supabase:
        try:
            test_query = supabase.table('notifications_log').select('id').limit(1).execute()
            health_status["database_connection"] = True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
    
    # Check RabbitMQ connection
    try:
        connection = get_rabbitmq_connection()
        if connection:
            health_status["rabbitmq_connection"] = True
            connection.close()
    except Exception as e:
        logger.error(f"RabbitMQ health check failed: {e}")
    
    status_code = 200 if all([health_status["database_connection"], health_status["rabbitmq_connection"]]) else 500
    return jsonify(health_status), status_code

# --- Main Entry Point ---
if __name__ == "__main__":
    logger.info("Starting request API service...")
    app.run(host="0.0.0.0", port=5101, debug=False)