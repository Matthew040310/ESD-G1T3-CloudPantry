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
import docker # For listener management
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow all origins for simplicity

# --- Configuration ---
# Database
SUPABASE_URL = os.environ.get("MESSAGENF_DB_URL")
SUPABASE_KEY = os.environ.get("MESSAGENF_DB_KEY")
DB_TABLE = "notifications_log" # Table name for requests/notifications

# RabbitMQ
RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "charitymq") # Docker service name usually
RABBITMQ_PORT = int(os.environ.get("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "guest") # Default guest user
RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS", "guest")
EXCHANGE_NAME = "charity_exchange" # Should match amqp_setup.py
EXCHANGE_TYPE = "direct"           # Ensure this is 'direct'

# Listener Container Management
LISTENER_IMAGE_NAME = os.environ.get("LISTENER_IMAGE_NAME", "matthew160619/is213-cloudpantry:message-listener")
DOCKER_NETWORK_NAME = os.environ.get("DOCKER_NETWORK_NAME", "charity_network") # Docker compose network

# Other services (Optional, for inventory updates if handled directly)
INVENTORY_API_URL = os.environ.get("INVENTORY_API_URL", "http://inventory:5000/inventory") # Example

# --- Initialize Supabase client ---
supabase = None
try:
    if SUPABASE_URL and SUPABASE_KEY:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"Supabase client initialized for URL: {SUPABASE_URL}")
    else:
        logger.warning("SUPABASE_URL or SUPABASE_KEY not set. Database operations will be disabled.")
except ImportError:
    logger.warning("Supabase client library not found (pip install supabase). Database operations disabled.")
except Exception as e:
    logger.error(f"Error initializing Supabase client: {e}", exc_info=True)
    supabase = None # Ensure it's None on error


# --- RabbitMQ Connection Management ---
def get_rabbitmq_connection():
    """Creates and returns a RabbitMQ blocking connection."""
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials,
                heartbeat=600, # Keepalive interval
                blocked_connection_timeout=300 # Timeout for connection blocks
            )
        )
        return connection
    except pika.exceptions.AMQPConnectionError as e:
        logger.error(f"Failed to connect to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error connecting to RabbitMQ: {e}", exc_info=True)
        return None

def publish_message(routing_key, message_body):
    """Publishes a persistent message to the configured direct exchange."""
    connection = None
    try:
        connection = get_rabbitmq_connection()
        if not connection:
            logger.error("Cannot publish message - RabbitMQ connection failed.")
            return False

        channel = connection.channel()

        # Declare the exchange idempotently (ensures it exists)
        channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type=EXCHANGE_TYPE, durable=True)

        # Publish the message
        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=routing_key, # For direct exchange, matches the queue's binding key
            body=json.dumps(message_body),
            properties=pika.BasicProperties(
                delivery_mode=pika.DeliveryMode.Persistent # make message persistent
            )
        )
        logger.info(f"Published message with RK '{routing_key}' to exchange '{EXCHANGE_NAME}'.")
        return True
    except pika.exceptions.AMQPError as e:
        logger.error(f"AMQP error publishing message (RK: {routing_key}): {e}", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Unexpected error publishing message (RK: {routing_key}): {e}", exc_info=True)
        return False
    finally:
        if connection and connection.is_open:
            connection.close()

# --- Inventory Update Logic ---
# Assumes an 'inventory' or 'action' service listens with this specific routing key.
# If not, this publish call will effectively do nothing with a 'direct' exchange.
def trigger_inventory_update(request_details):
    """Sends a message to trigger inventory update (e.g., after request acceptance)."""
    required_fields = ['sender_id', 'recipient_id', 'item_id', 'resource_type', 'quantity']
    if not all(field in request_details for field in required_fields):
        logger.error(f"Missing required fields for inventory update trigger: {request_details}")
        return False

    # This routing key MUST match a binding on the 'charity_exchange' (direct type)
    # for a queue that an inventory service consumes from.
    inventory_routing_key = "action.inventory.update" # Example dedicated routing key
    action_message = {
        "action": "update_inventory_on_acceptance",
        "request_details": request_details # Pass necessary details
    }

    logger.info(f"Triggering inventory update via MQ with RK: {inventory_routing_key}")
    return publish_message(inventory_routing_key, action_message)


# --- API Endpoints ---

@app.route('/requests', methods=['POST'])
def create_request():
    """Creates one or more new resource requests."""
    if not request.is_json:
        return jsonify({"code": 400, "error": "Request must be JSON"}), 400

    data = request.get_json()
    sender_id = data.pop('sender_id', None) # Extract sender_id, remove from items

    if not sender_id:
        return jsonify({"code": 400, "error": "'sender_id' is required in the request body"}), 400
    if not data: # Check if any recipient data remains
         return jsonify({"code": 400, "error": "No recipient request data provided"}), 400
    if not supabase:
         return jsonify({"code": 503, "error": "Database service unavailable"}), 503

    success_count = 0
    error_count = 0
    created_requests = []
    errors = []

    timestamp = datetime.now().isoformat()

    # Process requests for each recipient in the payload
    for recipient_id, items in data.items():
        if not isinstance(items, list):
             logger.warning(f"Invalid format for recipient {recipient_id}, expected list, got {type(items)}")
             errors.append(f"Invalid format for recipient {recipient_id}")
             error_count += len(items) if isinstance(items, list) else 1 # Count potential items
             continue

        for item_data in items:
            resource_type = item_data.get('resource_type')
            quantity = item_data.get('quantity')
            item_id = item_data.get('item_id') # The specific ID of the item in the *donor's* inventory

            if not all([recipient_id, resource_type, quantity, item_id]):
                 logger.warning(f"Skipping item due to missing fields: {item_data} for recipient {recipient_id}")
                 errors.append(f"Missing fields in request for {recipient_id}")
                 error_count += 1
                 continue

            try:
                # Prepare DB record
                db_record = {
                    'message_type': 'request',
                    'sender_id': str(sender_id),
                    'recipient_id': str(recipient_id),
                    'item_id': str(item_id), # Store donor's item ID
                    'resource_type': resource_type,
                    'quantity': int(quantity),
                    'status': 'pending',
                    'timestamp': timestamp
                    # 'created_at' will be set by DB default
                }

                # Insert into Database
                insert_result = supabase.table(DB_TABLE).insert(db_record).execute()

                if not (hasattr(insert_result, 'data') and insert_result.data):
                    logger.error(f"Failed to insert request into DB: {insert_result.error if hasattr(insert_result, 'error') else 'No data returned'}")
                    errors.append(f"Database error for request to {recipient_id}")
                    error_count += 1
                    continue

                record_id = insert_result.data[0].get('id')
                db_record['id'] = record_id # Add ID to the record we return/log
                logger.info(f"Request record {record_id} inserted for {sender_id} -> {recipient_id}")

                # Publish message to recipient's queue
                # Routing key must match the binding for the recipient's queue
                routing_key = f"message.to.{recipient_id}"
                message_payload = {
                    'event': 'new_request',
                    'request_id': record_id,
                    'sender_id': sender_id,
                    'recipient_id': recipient_id,
                    'item_id': item_id,
                    'resource_type': resource_type,
                    'quantity': quantity,
                    'timestamp': timestamp
                }

                if publish_message(routing_key, message_payload):
                    success_count += 1
                    created_requests.append(db_record)
                else:
                    logger.error(f"Failed to publish 'new_request' message for request {record_id} to RK {routing_key}")
                    # Decide on rollback strategy: Delete DB record? Mark as failed?
                    # Simple approach: Log error, count as error.
                    errors.append(f"Messaging error for request to {recipient_id}")
                    error_count += 1
                    # Optional: Rollback DB insert
                    # supabase.table(DB_TABLE).delete().eq('id', record_id).execute()

            except Exception as e:
                logger.error(f"Unexpected error processing item for recipient {recipient_id}: {e}", exc_info=True)
                errors.append(f"Server error processing request for {recipient_id}")
                error_count += 1

    # Determine overall status code and response message
    if error_count == 0 and success_count > 0:
        status_code = 201 # Created
        response = {
            "code": status_code,
            "status": "success",
            "message": f"Successfully created {success_count} requests.",
            "data": {"created_requests": created_requests}
        }
    elif success_count > 0:
        status_code = 207 # Multi-Status
        response = {
            "code": status_code,
            "status": "partial_success",
            "message": f"Created {success_count} requests with {error_count} errors.",
            "data": {"created_requests": created_requests, "errors": errors}
        }
    else:
        status_code = 500 # Internal Server Error (or 400 if all were validation errors)
        response = {
            "code": status_code,
            "status": "error",
            "message": f"Failed to create any requests ({error_count} errors).",
            "data": {"errors": errors}
        }

    return jsonify(response), status_code


@app.route('/requests', methods=['GET'])
def get_requests():
    """Gets requests, filtered by charity ID and optionally direction/status."""
    charity_id = request.args.get('charity_id')
    if not charity_id:
        return jsonify({"code": 400, "error": "Missing required query parameter: 'charity_id'"}), 400
    if not supabase:
         return jsonify({"code": 503, "error": "Database service unavailable"}), 503

    direction = request.args.get('direction') # 'incoming' or 'outgoing'
    status = request.args.get('status')       # 'pending', 'accepted', 'rejected', 'read'
    limit = min(request.args.get('limit', 50, type=int), 1000) # Add max limit
    offset = request.args.get('offset', 0, type=int)

    try:
        query = supabase.table(DB_TABLE).select('*').eq('message_type', 'request')

        # Apply filters
        if direction == 'incoming':
            query = query.eq('recipient_id', str(charity_id))
        elif direction == 'outgoing':
            query = query.eq('sender_id', str(charity_id))
        else: # Get both if direction is not specified or invalid
            query = query.or_(f'recipient_id.eq.{charity_id},sender_id.eq.{charity_id}')

        if status:
            valid_statuses = ['pending', 'accepted', 'rejected', 'read']
            if status in valid_statuses:
                query = query.eq('status', status)
            else:
                logger.warning(f"Invalid status filter received: {status}")

        # Apply ordering and pagination
        query = query.order('timestamp', desc=True).limit(limit).offset(offset)

        # Execute query
        result = query.execute()

        if hasattr(result, 'data'):
             return jsonify({"code": 200, "data": result.data}), 200
        else:
             # Log unexpected Supabase response structure
             logger.error(f"Unexpected response structure from Supabase: {result}")
             return jsonify({"code": 500, "error": "Error fetching data from database"}), 500

    except Exception as e:
        logger.error(f"Error fetching requests for charity {charity_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "error": "Internal server error fetching requests"}), 500


@app.route('/requests/<int:request_id>/status', methods=['PUT'])
def update_request_status(request_id):
    """Updates the status of a specific request (accept, reject, read)."""
    if not request.is_json:
        return jsonify({"code": 400, "error": "Request must be JSON"}), 400
    if not supabase:
         return jsonify({"code": 503, "error": "Database service unavailable"}), 503

    data = request.get_json()
    new_status = data.get('status')
    responder_id = data.get('responder_id') # ID of the charity taking the action

    valid_statuses = ['accepted', 'rejected', 'read']
    if not new_status or new_status not in valid_statuses:
        return jsonify({"code": 400, "error": f"Missing or invalid 'status'. Must be one of: {valid_statuses}"}), 400
    if not responder_id:
        return jsonify({"code": 400, "error": "Missing required field: 'responder_id'"}), 400

    try:
        # 1. Fetch the current request
        fetch_result = supabase.table(DB_TABLE).select('*').eq('id', request_id).maybe_single().execute()

        if not (hasattr(fetch_result, 'data') and fetch_result.data):
            return jsonify({"code": 404, "error": f"Request with ID {request_id} not found"}), 404

        request_data = fetch_result.data
        current_status = request_data.get('status')
        recipient_id = request_data.get('recipient_id')
        sender_id = request_data.get('sender_id') # Original requester

        # 2. Check permissions and state transitions
        if new_status in ['accepted', 'rejected']:
            if str(responder_id) != str(recipient_id):
                return jsonify({"code": 403, "error": "Permission denied. Only the recipient can accept or reject a request."}), 403
            if current_status != 'pending':
                return jsonify({"code": 409, "error": f"Request status cannot be changed. Current status is '{current_status}'."}), 409 # Conflict
        elif new_status == 'read':
            # Allow either sender or recipient to mark as read? Or just recipient?
            # Current logic allows anyone providing a responder_id. Let's restrict to recipient for now.
             if str(responder_id) != str(recipient_id):
                 return jsonify({"code": 403, "error": "Permission denied. Only the recipient can mark the request as read."}), 403
             if current_status == 'read': # No need to update if already read
                  return jsonify({"code": 200, "data": request_data, "message": "Request already marked as read"}), 200

        # 3. Update Database
        update_data = {
            'status': new_status,
            'response_timestamp': datetime.now().isoformat()
        }
        update_result = supabase.table(DB_TABLE).update(update_data).eq('id', request_id).execute()

        if not (hasattr(update_result, 'data') and update_result.data):
             logger.error(f"Failed to update DB status for request {request_id}: {update_result.error if hasattr(update_result, 'error') else 'No data returned'}")
             return jsonify({"code": 500, "error": "Failed to update request status in database."}), 500

        updated_record = update_result.data[0]
        logger.info(f"Request {request_id} status updated to '{new_status}' by {responder_id}")

        # 4. Publish notification message if accepted or rejected
        if new_status in ['accepted', 'rejected']:
            # Notify the original sender
            routing_key = f"message.to.{sender_id}"
            message_payload = {
                'event': 'request_updated',
                'request_id': request_id,
                'responder_id': responder_id, # Who took the action
                'original_sender_id': sender_id, # Who gets notified
                'status': new_status,
                'item_id': request_data.get('item_id'),
                'resource_type': request_data.get('resource_type'),
                'quantity': request_data.get('quantity'),
                'timestamp': update_data['response_timestamp']
            }
            if not publish_message(routing_key, message_payload):
                logger.error(f"Failed to publish 'request_updated' notification for request {request_id} to RK {routing_key}")
                # Continue anyway, DB update was successful

            # 5. Trigger inventory update if accepted
            if new_status == 'accepted':
                 inventory_details = {
                     'request_id': request_id,
                     'sender_id': sender_id,      # Requester (gets items)
                     'recipient_id': responder_id,# Responder/Donor (gives items)
                     'item_id': request_data.get('item_id'),
                     'resource_type': request_data.get('resource_type'),
                     'quantity': request_data.get('quantity')
                 }
                 if not trigger_inventory_update(inventory_details):
                     logger.warning(f"Inventory update trigger failed for accepted request {request_id}")
                     # Proceed, main status update was successful

        return jsonify({"code": 200, "data": updated_record}), 200

    except Exception as e:
        logger.error(f"Error updating status for request {request_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "error": "Internal server error updating request status"}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Basic health check for API, DB, and RabbitMQ connectivity."""
    db_ok = False
    rabbitmq_ok = False

    # Check DB
    if supabase:
        try:
            # Perform a simple, quick query
            supabase.table(DB_TABLE).select('id').limit(1).execute()
            db_ok = True
        except Exception as e:
            logger.warning(f"Database health check failed: {e}")

    # Check RabbitMQ
    conn = None
    try:
        conn = get_rabbitmq_connection()
        if conn:
            rabbitmq_ok = True
    except Exception as e:
         logger.warning(f"RabbitMQ health check failed: {e}")
    finally:
        if conn and conn.is_open:
            conn.close()

    status_code = 200 if db_ok and rabbitmq_ok else 503 # Service Unavailable
    return jsonify({
        "status": "ok" if status_code == 200 else "error",
        "timestamp": datetime.now().isoformat(),
        "dependencies": {
            "database": "ok" if db_ok else "error",
            "rabbitmq": "ok" if rabbitmq_ok else "error"
        }
    }), status_code


# --- Listener Container Management Endpoints ---

@app.route('/listener/start/<charity_id>', methods=['POST'])
def start_listener(charity_id):
    """Starts a message listener container for the specified charity ID."""
    try:
        client = docker.from_env() # Get Docker client from environment
        container_name = f"message-listener-{charity_id}"
        logger.info(f"Request received to start listener container: {container_name}")

        # Check if container exists and is running
        try:
            existing_container = client.containers.get(container_name)
            if existing_container.status == 'running':
                logger.info(f"Listener container '{container_name}' is already running.")
                return jsonify({"code": 200, "status": "success", "message": f"Listener for charity {charity_id} already running."}), 200
            else:
                # If exists but not running, try starting it
                logger.info(f"Found existing container '{container_name}' with status '{existing_container.status}'. Attempting to start...")
                existing_container.start()
                logger.info(f"Successfully started existing container '{container_name}'.")
                return jsonify({"code": 200, "status": "success", "message": f"Started existing listener container for charity {charity_id}."}), 200
        except docker.errors.NotFound:
            logger.info(f"Listener container '{container_name}' not found. Creating new container...")
            # Proceed to create new container

        # Define environment variables for the listener container
        # Ensure these match what message_listener.py expects
        listener_env = {
            "CHARITY_ID": str(charity_id),
            "RABBITMQ_HOST": RABBITMQ_HOST,
            "RABBITMQ_PORT": str(RABBITMQ_PORT),
            "RABBITMQ_USER": RABBITMQ_USER,
            "RABBITMQ_PASS": RABBITMQ_PASS,
            "EXCHANGE_NAME": EXCHANGE_NAME,
            "API_BASE_URL": f"http://{container_name}:{5101}" if os.environ.get('DOCKER_ENV') else f"http://request-api:{os.environ.get('REQUEST_API_PORT', 5101)}", # Internal API URL callback
            "AUTO_MARK_AS_READ": os.environ.get("LISTENER_AUTO_MARK_READ", "false") # Configurable
        }
        logger.debug(f"Listener environment variables: {listener_env}")

        # Run the new container
        container = client.containers.run(
            image=LISTENER_IMAGE_NAME,
            name=container_name,
            detach=True, # Run in background
            environment=listener_env,
            network=DOCKER_NETWORK_NAME, # Connect to the shared network
            restart_policy={"Name": "on-failure", "MaximumRetryCount": 3} # Restart policy
        )
        logger.info(f"Successfully started new listener container '{container_name}' (ID: {container.id}).")
        return jsonify({
            "code": 201,
            "status": "success",
            "message": f"Started new listener container for charity {charity_id}.",
            "container_id": container.id
        }), 201

    except docker.errors.DockerException as e:
        logger.error(f"Docker error managing listener for charity {charity_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "status": "error", "message": f"Docker operation failed: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Unexpected error starting listener for charity {charity_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "status": "error", "message": "Internal server error starting listener."}), 500


@app.route('/listener/stop/<charity_id>', methods=['POST'])
def stop_listener(charity_id):
    """Stops and removes the message listener container for the specified charity ID."""
    try:
        client = docker.from_env()
        container_name = f"message-listener-{charity_id}"
        logger.info(f"Request received to stop listener container: {container_name}")

        try:
            container = client.containers.get(container_name)
            logger.info(f"Found listener container '{container_name}'. Stopping and removing...")
            container.stop(timeout=10) # Give 10 seconds to stop gracefully
            container.remove()
            logger.info(f"Successfully stopped and removed container '{container_name}'.")
            return jsonify({"code": 200, "status": "success", "message": f"Stopped and removed listener for charity {charity_id}."}), 200
        except docker.errors.NotFound:
            logger.info(f"Listener container '{container_name}' not found. Assuming already stopped/removed.")
            return jsonify({"code": 200, "status": "success", "message": f"Listener for charity {charity_id} not found."}), 200 # Not an error

    except docker.errors.DockerException as e:
        logger.error(f"Docker error managing listener for charity {charity_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "status": "error", "message": f"Docker operation failed: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"Unexpected error stopping listener for charity {charity_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "status": "error", "message": "Internal server error stopping listener."}), 500


# --- Main Entry Point ---
if __name__ == "__main__":
    # Use Gunicorn or another WSGI server in production/Docker instead of flask run
    # Example: gunicorn --bind 0.0.0.0:5101 request_api:app
    is_debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    logger.info(f"Starting Request API service on port 5101 (Debug: {is_debug})...")
    # Port 5101 is used by default if not overridden by WSGI server config
    app.run(host="0.0.0.0", port=5101, debug=is_debug)