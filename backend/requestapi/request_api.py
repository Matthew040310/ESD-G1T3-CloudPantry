# --- request_api.py ---
# Backend API Service for charity resource exchange system (Simplified)
# 1. Imports
import os
import json
import pika
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
import docker 
import sys
import uuid # Import uuid library for testing/validation if needed
import requests
try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None
    supabase = None

# 2. Basic Configuration & Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 3. Flask App Initialization & Extensions
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) # Apply CORS globally

# 4. Load Configuration from Environment Variables
SUPABASE_URL = os.environ.get("MESSAGENF_DB_URL")
SUPABASE_KEY = os.environ.get("MESSAGENF_DB_KEY")
DB_TABLE = "notifications_log" # Table name from CREATE statement

RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "charitymq")
RABBITMQ_PORT = int(os.environ.get("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "admin")
RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS", "password")
EXCHANGE_NAME = os.environ.get("EXCHANGE_NAME", "charity_exchange")
EXCHANGE_TYPE = os.environ.get("EXCHANGE_TYPE", "direct")

LISTENER_IMAGE_NAME = os.environ.get("LISTENER_IMAGE_NAME", "brejesh/is213-cloudpantry:message-listener")
DOCKER_NETWORK_NAME = os.environ.get("DOCKER_NETWORK_NAME", "backend_charity_network")

# 5. Helper Functions (RabbitMQ)

def get_rabbitmq_connection():
    """Creates and returns a RabbitMQ blocking connection."""
    if not all([RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASS]):
        logger.error("RabbitMQ connection details missing."); return None
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials, heartbeat=600, blocked_connection_timeout=300)
        )
        return connection
    except Exception as e:
        logger.error(f"RMQ connection error: {e}"); return None

def publish_message(routing_key, message_body):
    """Publishes a persistent message using a retrieved connection."""
    connection = None
    try:
        connection = get_rabbitmq_connection()
        if not connection: raise Exception("RMQ connection failed")
        channel = connection.channel()
        # Assume exchange exists
        channel.basic_publish(
            exchange=EXCHANGE_NAME, routing_key=routing_key, body=json.dumps(message_body),
            properties=pika.BasicProperties(delivery_mode=pika.DeliveryMode.Persistent)
        )
        logger.info(f"Published RK '{routing_key}'.")
        return True
    except Exception as e:
        logger.error(f"Error publishing message (RK: {routing_key}): {e}", exc_info=True)
        return False
    finally:
        if connection and connection.is_open: connection.close()

def trigger_inventory_update(request_data):
    """
    Attempts to update Donor Main/Excess (decrease) and Requester Main (increase) inventories via API calls.
    Minimal error checking. Assumes endpoints exist and payload is correct.
    """
    try:
        sender_id = request_data['sender_id']      # Requester
        recipient_id = request_data['recipient_id']  # Donor
        resource_type = request_data['resource_type'] # Item Name/Description
        quantity = int(request_data['quantity'])
        item_id = request_data['item_id']          # Item UUID

        if quantity <= 0:
            logger.error("Inventory Update: Quantity must be positive.")
            return False

        base_inventory_url = INVENTORY_API_URL.rstrip('/') + '/' if INVENTORY_API_URL else None
        base_excess_url = EXCESS_INVENTORY_API_URL.rstrip('/') + '/' if EXCESS_INVENTORY_API_URL else None

        # 1. Decrease Donor's Main Inventory
        if base_inventory_url:
            donor_url = f"{base_inventory_url}{recipient_id}/{item_id}"
            donor_payload = {"quantity_change": -quantity}
            logger.info(f"Inventory Update: PUT {donor_url} with {donor_payload}")
            requests.put(donor_url, json=donor_payload, timeout=10) # Fire and forget basic errors for simplicity
        else:
            logger.warning("INVENTORY_API_URL not set. Skipping donor main inventory update.")

        # 2. Decrease Donor's Excess Inventory (if URL provided)
        if base_excess_url:
            donor_excess_url = f"{base_excess_url}{recipient_id}/{item_id}"
            donor_excess_payload = {"quantity_change": -quantity}
            logger.info(f"Inventory Update: PUT {donor_excess_url} with {donor_excess_payload}")
            requests.put(donor_excess_url, json=donor_excess_payload, timeout=10) 
        else:
            logger.info("EXCESS_INVENTORY_API_URL not set. Skipping donor excess inventory update.")

        # 3. Increase Requester's Main Inventory
        if base_inventory_url:
            requester_url = f"{base_inventory_url}{sender_id}/{item_id}"
            requester_payload = {
                "name": resource_type,
                "quantity_change": quantity,
                "create_if_missing": True
            }
            logger.info(f"Inventory Update: PUT {requester_url} with {requester_payload}")
            requests.put(requester_url, json=requester_payload, timeout=10) # Fire and forget
        else:
            logger.warning("INVENTORY_API_URL not set. Skipping requester main inventory update.")

        logger.info(f"Inventory update calls attempted for item {item_id}.")
        return True # Indicate calls were made

    except KeyError as e:
        logger.error(f"Inventory Update: Missing key in request_data: {e}", exc_info=True)
        return False
    except (ValueError, TypeError) as e:
         logger.error(f"Inventory Update: Invalid data type (e.g., quantity): {e}", exc_info=True)
         return False
    except Exception as e:
        # Catch potential requests errors or other issues
        logger.error(f"Inventory Update: Unexpected error: {e}", exc_info=True)
        return False



@app.route('/health', methods=['GET'])
def health_check():
    """Basic health check."""
    db_ok = False; rabbitmq_ok = False; connection = None
    try: # Check DB
        if supabase: supabase.table(DB_TABLE).select('id', count='exact').limit(0).execute(); db_ok = True
    except Exception: pass
    try: # Check RMQ
        connection = get_rabbitmq_connection();
        if connection: rabbitmq_ok = True
    except Exception: pass
    finally:
         if connection and connection.is_open: connection.close()
    status_code = 200 if db_ok and rabbitmq_ok else 503
    return jsonify({"status": "ok" if status_code == 200 else "error"}), status_code

@app.route('/requests', methods=['POST'])
def create_request():
    """Creates requests based on input, matching the provided table schema."""
    data = request.get_json(); sender_id = data.pop('sender_id', None)
    if not sender_id: return jsonify({"code": 400, "error": "'sender_id' required"}), 400
    if not supabase: return jsonify({"code": 503, "error": "DB unavailable"}), 503

    created_records_info = []
    errors = [] 

    try:
        for recipient_id_str, items in data.items():
             if not isinstance(items, list): continue
             for item_data in items:

                notification_text = item_data.get('notification')
                category = item_data.get('category')
                quantity = item_data.get('quantity')
                item_id_str = item_data.get('item_id')

                if not all([recipient_id_str, notification_text, category, quantity, item_id_str]):
                     logger.warning(f"Skipping item - missing required fields: {item_data}")
                     errors.append(f"Missing fields for recipient {recipient_id_str}")
                     continue

                try:
                    
                    db_record = {
                        'sender_id': int(sender_id),
                        'recipient_id': int(recipient_id_str),
                        'notification': notification_text,     
                        'category': category,                   
                        'quantity': int(quantity),              
                        'item_id': item_id_str,                 
                        'status': 'pending',                   
                        'read_update': True                     
                        
                    }
                    
                     

                    insert_result = supabase.table(DB_TABLE).insert(db_record).execute()
                    if not (hasattr(insert_result, 'data') and insert_result.data):
                        # Log specific DB error if available
                        db_error = getattr(insert_result, 'error', {'message': 'Unknown DB insert error'})
                        logger.error(f"DB Insert Failed for {recipient_id_str}: {db_error}")
                        errors.append(f"DB error for {recipient_id_str}: {db_error.get('message', 'Unknown')}")
                        continue # Skip to next item on DB error

                    record_id = insert_result.data[0]['id'] # Assuming UUID is returned as string
                    logger.info(f"Request {record_id} inserted")

                    # Publish message using 'charity.ID' routing key
                    routing_key = f"charity.{recipient_id_str}"
                    message_payload = {
                        'event': 'new_request', 'request_id': record_id, 'sender_id': sender_id,
                        'recipient_id': recipient_id_str, 'item_id': item_id_str, 'quantity': quantity,
                        'notification': notification_text, 'category': category,
                        'timestamp': datetime.now().isoformat() # Add timestamp to message
                    }
                    if not publish_message(routing_key, message_payload):
                        logger.error(f"MQ publish fail request {record_id} RK {routing_key}")
                        errors.append(f"MQ error for {recipient_id_str}") # Note MQ error

                    created_records_info.append({"id": record_id, "recipient_id": recipient_id_str})

                except (ValueError, TypeError) as e: # Catch potential int/UUID conversion errors
                     logger.error(f"Data type error processing item for {recipient_id_str}: {e}", exc_info=True)
                     errors.append(f"Data type error for {recipient_id_str}")
                except Exception as e: # Catch other errors during item processing
                     logger.error(f"Unexpected error processing item for {recipient_id_str}: {e}", exc_info=True)
                     errors.append(f"Server error processing item for {recipient_id_str}")


        # Determine overall response after processing all items/recipients
        error_count = len(errors)
        success_count = len(created_records_info)
        if error_count == 0 and success_count > 0 : status_code, response = 201, {"code": 201, "status": "success", "message": f"Created {success_count} requests.", "data": {"created_requests_info": created_records_info}}
        elif success_count > 0: status_code, response = 207, {"code": 207, "status": "partial_success", "message": f"Created {success_count} requests, {error_count} errors.", "data": {"created_requests_info": created_records_info, "errors": errors}}
        else: status_code, response = 400, {"code": 400, "status": "error", "message": f"Failed all requests due to errors.", "data": {"errors": errors}} # Use 400 if all failed validation/processing
        return jsonify(response), status_code

    except Exception as e: # Catch errors before looping starts
        logger.error(f"Error before processing requests: {e}", exc_info=True)
        return jsonify({"code": 500, "status": "error", "message": "Server error before processing requests"}), 500


@app.route('/requests', methods=['GET'])
def get_requests():
    """Gets requests, filtered by charity ID. Simplified."""
    charity_id = request.args.get('charity_id')
    if not charity_id: return jsonify({"code": 400, "error": "Missing 'charity_id'"}), 400
    if not supabase: return jsonify({"code": 503, "error": "Database unavailable"}), 503

    direction = request.args.get('direction')
    status = request.args.get('status')
    limit = min(request.args.get('limit', 50, type=int), 1000)
    offset = request.args.get('offset', 0, type=int)

    try:
        # Select based on schema
        query = supabase.table(DB_TABLE).select('id, created_at, notification, sender_id, recipient_id, item_id, category, quantity, status, read_update')

        # Apply filters
        try:
            charity_id_int = int(charity_id) # Ensure filtering uses integer
            if direction == 'incoming': query = query.eq('recipient_id', charity_id_int)
            elif direction == 'outgoing': query = query.eq('sender_id', charity_id_int)
            else: query = query.or_(f'recipient_id.eq.{charity_id_int},sender_id.eq.{charity_id_int}')
        except ValueError:
             return jsonify({"code": 400, "error": "Invalid charity_id format"}), 400

        if status: query = query.eq('status', status)

        query = query.order('created_at', desc=True).limit(limit).offset(offset) # Order by created_at
        result = query.execute()

        return jsonify({"code": 200, "data": result.data}), 200
    except Exception as e:
        logger.error(f"Error fetching requests: {e}", exc_info=True)
        return jsonify({"code": 500, "error": "Server error fetching requests"}), 500


@app.route('/requests/<request_id_str>/status', methods=['PUT']) # Use string for UUID potentially
def update_request_status(request_id_str):
    """Updates ONLY the status of a request (accept, reject, read)."""
    # Assume valid JSON and fields
    if not supabase: return jsonify({"code": 503, "error": "Database unavailable"}), 503
    data = request.get_json(); new_status = data.get('status'); responder_id = data.get('responder_id')
    if new_status not in ['accepted', 'rejected', 'read']: return jsonify({"code": 400, "error": "Invalid status"}), 400
    if not responder_id: return jsonify({"code": 400, "error": "Missing responder_id"}), 400

    try:
        fetch_result = supabase.table(DB_TABLE).select('*').eq('id', request_id_str).maybe_single().execute()
        if not (hasattr(fetch_result, 'data') and fetch_result.data): return jsonify({"code": 404, "error": "Request not found"}), 404
        request_data = fetch_result.data
        current_status = request_data.get('status')

        try:
            if int(responder_id) != request_data.get('recipient_id'):
                 return jsonify({"code": 403, "error": "Forbidden"}), 403
        except (ValueError, TypeError):
             return jsonify({"code": 400, "error": "Invalid responder_id format"}), 400

        # Update ONLY status in DB
        update_data = {'status': new_status}
        # Optionally update read_update when status changes, e.g., mark as unread for sender
        # if new_status in ['accepted', 'rejected']: update_data['read_update'] = True

        update_result = supabase.table(DB_TABLE).update(update_data).eq('id', request_id_str).execute()
        if not (hasattr(update_result, 'data') and update_result.data):
             raise Exception(f"DB update failed: {getattr(update_result, 'error', 'No data')}")


        updated_record_data = {**request_data, **update_data} 
        logger.info(f"Request {request_id_str} status set to '{new_status}'")

        # Publish & Trigger only if accepted/rejected
        if new_status in ['accepted', 'rejected']:
            sender_id = request_data.get('sender_id')
            routing_key = f"charity.{sender_id}" 
            message_payload = { 
                'event': 'request_updated', 'request_id': request_id_str, 'responder_id': responder_id,
                'original_sender_id': sender_id, 'status': new_status, 'item_id': request_data.get('item_id'),
                'notification': request_data.get('notification'), 'category': request_data.get('category'),
                'quantity': request_data.get('quantity'), 'timestamp': datetime.now().isoformat() # Add notification time
            }
            publish_message(routing_key, message_payload)

            if new_status == 'accepted':
                 inventory_details = {
                     'sender_id': sender_id, 'recipient_id': int(responder_id), # Ensure int
                     'item_id': request_data.get('item_id'),
                     'resource_type': request_data.get('notification'), 
                     'quantity': request_data.get('quantity')
                 }
                 trigger_inventory_update(inventory_details) # Call placeholder

        return jsonify({"code": 200, "data": updated_record_data}), 200

    except Exception as e:
        logger.error(f"Error updating status for {request_id_str}: {e}", exc_info=True)
        return jsonify({"code": 500, "error": "Server error updating status"}), 500

# --- Listener Management Endpoints ---
@app.route('/listener/start/<charity_id>', methods=['POST'])
def start_listener(charity_id):
    """Starts a message listener container."""
    try:
        client = docker.from_env()
        container_name = f"message-listener-{charity_id}"
        logger.info(f"Request to start listener: {container_name}")
        try:
            container = client.containers.get(container_name)
            if container.status != 'running': container.start(); logger.info(f"Started existing listener")
            else: logger.info(f"Listener already running")
            return jsonify({"code": 200, "status": "success", "message": "Listener started/running"}), 200
        except docker.errors.NotFound: logger.info(f"Listener not found. Creating...")

        request_api_hostname = "request-api"; api_port = 5101 # Internal port Gunicorn binds to
        listener_env = {
            "CHARITY_ID": str(charity_id), "RABBITMQ_HOST": RABBITMQ_HOST, "RABBITMQ_PORT": str(RABBITMQ_PORT),
            "RABBITMQ_USER": RABBITMQ_USER, "RABBITMQ_PASS": RABBITMQ_PASS, "EXCHANGE_NAME": EXCHANGE_NAME,
            "API_BASE_URL": f"http://{request_api_hostname}:{api_port}",
            "AUTO_MARK_AS_READ": os.environ.get("LISTENER_AUTO_MARK_READ", "false")
        }
        container = client.containers.run(
            image=LISTENER_IMAGE_NAME, name=container_name, detach=True, environment=listener_env,
            network=DOCKER_NETWORK_NAME, restart_policy={"Name": "on-failure", "MaximumRetryCount": 3}
        )
        logger.info(f"Started new listener '{container_name}' (ID: {container.id}).")
        return jsonify({"code": 201, "status": "success", "message": "Started new listener", "container_id": container.id}), 201
    except Exception as e:
        logger.error(f"Error starting listener {charity_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "status": "error", "message": "Server error starting listener"}), 500

@app.route('/listener/stop/<charity_id>', methods=['POST'])
def stop_listener(charity_id):
    """Stops and removes the message listener container."""
    try:
        client = docker.from_env()
        container_name = f"message-listener-{charity_id}"
        logger.info(f"Request to stop listener: {container_name}")
        try:
            container = client.containers.get(container_name)
            container.stop(timeout=10); container.remove()
            logger.info(f"Stopped/removed listener '{container_name}'.")
            return jsonify({"code": 200, "status": "success", "message": "Listener stopped/removed"}), 200
        except docker.errors.NotFound:
            logger.info(f"Listener '{container_name}' not found.")
            return jsonify({"code": 200, "status": "success", "message": "Listener not found"}), 200
    except Exception as e:
        logger.error(f"Error stopping listener {charity_id}: {e}", exc_info=True)
        return jsonify({"code": 500, "status": "error", "message": "Server error stopping listener"}), 500


# 7. Global Client Initializations (AFTER routes)
supabase = None
try:
    if create_client and SUPABASE_URL and SUPABASE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info(f"Supabase client initialized successfully.")
    else:
        if not create_client: logger.warning("Supabase library not found.")
        else: logger.warning("Supabase URL or Key not set. DB ops disabled.")
except Exception as e:
    logger.error(f"Error initializing Supabase client: {e}", exc_info=True)
    supabase = None

# 8. NO `if __name__ == "__main__":` block needed when using Gunicorn via Docker CMD