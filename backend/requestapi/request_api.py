# --- request_api.py ---
# Simplified Backend API Service - MINIMAL LOGGING + STATUS FIELD ADDED
# 1. Imports
import os
import json
import pika
import logging  # Re-added
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import docker
import requests

# 2. Basic Configuration & Logging (Minimal)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')  # Re-added
logger = logging.getLogger(__name__)  # Re-added

# 3. Flask App Initialization & Extensions
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# 4. Load Configuration from Environment Variables
# Use internal service name and port for Docker communication
NOTIFICATION_API_URL = os.environ.get("NOTIFICATION_API_URL", "http://notification:5000/notification")

RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "charitymq")
RABBITMQ_PORT = int(os.environ.get("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "admin")
RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS", "password")
EXCHANGE_NAME = os.environ.get("EXCHANGE_NAME", "charity_exchange")
EXCHANGE_TYPE = os.environ.get("EXCHANGE_TYPE", "direct") # Changed to direct to match .env

LISTENER_IMAGE_NAME = os.environ.get("LISTENER_IMAGE_NAME", "purplechonk/messagelistener:latest")
DOCKER_NETWORK_NAME = os.environ.get("DOCKER_NETWORK_NAME", "backend_charity_network")

INVENTORY_API_URL = os.environ.get("INVENTORY_ENDPOINT", "http://inventory:5000/inventory/")
EXCESS_INVENTORY_API_URL = os.environ.get("EXCESS_INVENTORY_ENDPOINT", "http://excess-inventory:5000/inventory/")

# 5. Helper Functions (Simplified)

def get_rabbitmq_connection():
    """Creates and returns a RabbitMQ blocking connection."""
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        logger.info(f"Attempting to connect to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials, heartbeat=600, blocked_connection_timeout=300)
        )
        logger.info("Successfully connected to RabbitMQ")
        return connection
    except Exception as e:
        logger.error(f"ERROR: RabbitMQ connection error: {e}")
        return None

def publish_message(routing_key, message_body):
    """Publishes a persistent message."""
    connection = None
    try:
        connection = get_rabbitmq_connection()
        if not connection: 
            logger.error(f"Failed to get RabbitMQ connection for routing key: {routing_key}")
            return False
        channel = connection.channel()
        # Ensure exchange exists
        channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type=EXCHANGE_TYPE, durable=True)
        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=routing_key,
            body=json.dumps(message_body),
            properties=pika.BasicProperties(delivery_mode=pika.DeliveryMode.Persistent)
        )
        logger.info(f"Successfully published message to {EXCHANGE_NAME} with routing key {routing_key}")
        return True
    except Exception as e:
        logger.error(f"ERROR: Error publishing message (RK: {routing_key}): {e}")
        return False
    finally:
        if connection and connection.is_open:
            connection.close()

def trigger_inventory_update(request_data):
    """Attempts inventory updates via API calls. Minimal checks."""
    # NOTE: This function still requires careful validation against inventory API specs.
    try:
        sender_id = request_data['sender_id'] # Requester
        recipient_id = request_data['recipient_id'] # Donor
        resource_type = request_data['resource_type']
        quantity = int(request_data['quantity'])
        item_id = request_data['item_id']

        if quantity <= 0 or not INVENTORY_API_URL or not EXCESS_INVENTORY_API_URL: return False

        # Basic flow - assumes PUT/POST APIs exist and work as expected
        # Decrease Donor Excess
        donor_excess_get_url = f"{EXCESS_INVENTORY_API_URL.rstrip('/')}/{recipient_id}"
        excess_inventory_response = requests.get(donor_excess_get_url, timeout=10)
        if not excess_inventory_response.ok: return False # Basic check
        # ... (Assume logic to find item and check quantity exists and works) ...

        donor_item_excess_updated = { "id": item_id, "quantity": 0 } # Placeholder quantity calculation needed
        donor_excess_put_url = f"{EXCESS_INVENTORY_API_URL.rstrip('/')}/{recipient_id}"
        requests.put(donor_excess_put_url, json=[donor_item_excess_updated], timeout=10) # Fire and forget response

        # Decrease Donor Main
        donor_main_put_url = f"{INVENTORY_API_URL.rstrip('/')}/{recipient_id}"
        requests.put(donor_main_put_url, json=[donor_item_excess_updated], timeout=10) # Fire and forget response

        # Increase Requester Main
        requester_item = { "id": item_id, "name": resource_type, "quantity": quantity } # Simplified payload
        requester_post_url = f"{INVENTORY_API_URL.rstrip('/')}/{sender_id}"
        requests.post(requester_post_url, json=[requester_item], timeout=10) # Fire and forget response

        return True
    except Exception as e:
        # print(f"ERROR: Inventory Update: Unexpected error: {e}", file=sys.stderr) # Optional print
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Basic health check."""
    notification_api_ok = False; rabbitmq_ok = False
    try:
        response = requests.get(f"{NOTIFICATION_API_URL}", timeout=3)
        notification_api_ok = response.status_code < 500
    except Exception: pass
    connection = get_rabbitmq_connection()
    if connection:
        rabbitmq_ok = True
        connection.close()
    status_code = 200 if notification_api_ok and rabbitmq_ok else 503
    return jsonify({"status": "ok" if status_code == 200 else "error"}), status_code

@app.route('/requests', methods=['POST'])
def create_request():
    """Creates requests, calling the notification service.
    Returns 200 if any request succeeded, 400 otherwise.
    """
    data = request.get_json(); sender_id = data.pop('sender_id', None)
    if not sender_id: return jsonify({"code": 400, "error": "'sender_id' required"}), 400

    results = []
    has_errors = False
    attempted_processing = False
    network_error_occurred = False # Flag

    try:
        for recipient_id_str, items in data.items():
             if not isinstance(items, list): continue
             for item_data in items:
                attempted_processing = True
                current_status = 'pending' # Status for new requests
                try:
                    if not all(k in item_data for k in ['notification', 'category', 'quantity', 'item_id']):
                        has_errors = True
                        continue

                    notification_payload = {
                        'Recipient': int(recipient_id_str),
                        'Notification': item_data['notification'],
                        'Category': item_data['category'],
                        'Quantity': int(item_data['quantity']),
                        'ItemID': item_data['item_id'],
                        'Status': current_status
                    }

                    post_url = f"{NOTIFICATION_API_URL}/{sender_id}"
                    response = requests.post(post_url, json=notification_payload, timeout=10)

                    if not response.ok:
                        has_errors = True
                        continue

                    response_data = response.json()
                    if response_data.get("code") != 200:
                        has_errors = True
                        continue

                    # Safely extract ID
                    record_id = None
                    resp_list = response_data.get("data", {}).get("response", [])
                    if resp_list and isinstance(resp_list, list) and len(resp_list) > 0:
                        record_id = resp_list[0].get("id")

                    if not record_id:
                         has_errors = True
                         continue

                    results.append({"id": record_id, "recipient_id": recipient_id_str})

                    # --- Construct and Publish message ---
                    routing_key = f"charity.{recipient_id_str}"
                    message_payload = {
                        'event': 'new_request',
                        'request_id': record_id,
                        'sender_id': sender_id,
                        'recipient_id': int(recipient_id_str),
                        'item_id': item_data['item_id'],
                        'quantity': int(item_data['quantity']),
                        'notification': item_data['notification'],
                        'category': item_data['category'],
                        'status': current_status, # <-- STATUS ADDED HERE
                        'timestamp': datetime.now().isoformat()
                    }
                    publish_message(routing_key, message_payload) # Error handling inside publish_message
                    # Log message publishing attempt
                    logger.info(f"Publishing message to exchange {EXCHANGE_NAME} with routing key {routing_key}")
                    # --------------------------------------

                except (ValueError, TypeError): # Catch specific data errors
                    has_errors = True
                    continue
                except requests.exceptions.RequestException as e_req: 
                    has_errors = True
                    network_error_occurred = True # Set flag
                    break 
                except Exception:
                     has_errors = True
                     continue 
             if network_error_occurred: 
                 break

        if results:
            status_code = 200
            message = f"Processed {len(results)} requests successfully"
            if has_errors: message += ", but some errors occurred."
            response_body = {"code": 200, "status": "success", "message": message, "data": results}
        elif attempted_processing and has_errors:
            status_code = 400
            response_body = {"code": 400, "status": "error", "message": "Failed to create any requests due to processing errors."}
        else: 
            status_code = 400
            response_body = {"code": 400, "status": "error", "message": "No valid request items found or processed."}
        # -----------------------------------------

        return jsonify(response_body), status_code

    except Exception as e_outer:

        return jsonify({"code": 500, "status": "error", "message": "Internal server error during request processing."}), 500


@app.route('/requests', methods=['GET'])
def get_requests():
    """Gets requests by calling the notification service."""
    charity_id = request.args.get('charity_id')
    if not charity_id or not charity_id.isdigit():
        return jsonify({"code": 400, "error": "Valid 'charity_id' required"}), 400

    direction = request.args.get('direction')
    status = request.args.get('status')
    new_only = request.args.get('new_only', 'false').lower() == 'true'

    try:
        api_url = f"{NOTIFICATION_API_URL}/new/{charity_id}" if new_only else f"{NOTIFICATION_API_URL}/{charity_id}"
        response = requests.get(api_url, timeout=10)

        if not response.ok:
            if response.status_code == 404:
                try:
                    error_data = response.json()
                    if error_data.get("code") == 404: return jsonify({"code": 200, "data": []}), 200
                except Exception: pass
            return jsonify({"code": 502, "error": "Error fetching requests from notification service"}), 502

        response_data = response.json()
        if response_data.get("code") == 404: return jsonify({"code": 200, "data": []}), 200
        if response_data.get("code") != 200:
             return jsonify({"code": 502, "error": "Invalid response from notification service"}), 502

        records = response_data.get("data", {}).get("response", [])
        if not isinstance(records, list):
             return jsonify({"code": 500, "error": "Invalid data format received"}), 500

        # --- Filtering logic ---
        filtered_records = records
        if direction == 'incoming':
            filtered_records = [r for r in records if str(r.get('recipient_id')) == str(charity_id)]
        elif direction == 'outgoing':
            filtered_records = [r for r in records if str(r.get('sender_id')) == str(charity_id)]
        if status:
            filtered_records = [r for r in filtered_records if r.get('status') == status]

        filtered_records.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        limit = min(request.args.get('limit', 50, type=int), 1000)
        offset = request.args.get('offset', 0, type=int)
        paginated_records = filtered_records[offset:offset+limit]

        return jsonify({"code": 200, "data": paginated_records}), 200

    except requests.exceptions.RequestException as e:
        return jsonify({"code": 503, "error": "Service unavailable"}), 503
    except Exception as e:
        return jsonify({"code": 500, "error": "Server error fetching requests"}), 500


@app.route('/requests/<request_id_str>/status', methods=['PUT'])
def update_request_status(request_id_str):
    """Updates the status of a request (accept, reject, read) via PUT /notification."""
    data = request.get_json();
    if not data: return jsonify({"code": 400, "error": "Missing JSON body"}), 400

    new_status = data.get('status');
    responder_id = data.get('responder_id')

    if new_status not in ['accepted', 'rejected', 'read']:
        return jsonify({"code": 400, "error": "Invalid status"}), 400
    if not responder_id:
        return jsonify({"code": 400, "error": "Missing responder_id"}), 400
    try:
        responder_id_int = int(responder_id)
    except (ValueError, TypeError):
         return jsonify({"code": 400, "error": "Invalid responder_id format"}), 400

    try:
        # 1. Fetch original request data
        get_url = f"{NOTIFICATION_API_URL}/{responder_id_int}"
        get_response = requests.get(get_url, timeout=10)
        if not get_response.ok: return jsonify({"code": 502, "error": "Could not retrieve request details"}), 502
        get_data = get_response.json()
        if get_data.get("code") != 200 and get_data.get("code") != 404:
             return jsonify({"code": 502, "error": "Invalid response retrieving request details"}), 502

        # 2. Find the specific request
        records = get_data.get("data", {}).get("response", [])
        request_data = next((r for r in records if str(r.get('id')) == str(request_id_str)), None)
        if not request_data: return jsonify({"code": 404, "error": "Request not found or responder not involved"}), 404

        # 3. Verify permissions
        if responder_id_int != request_data.get('recipient_id'): return jsonify({"code": 403, "error": "Forbidden"}), 403

        # 4. Call PUT /notification
        update_payload = {
            'id': request_id_str,
            'Recipient': request_data.get('recipient_id'),
            'Notification': request_data.get('notification'),
            'Quantity': request_data.get('quantity'),
            'Status': new_status
        }
        update_response = requests.put(NOTIFICATION_API_URL, json=update_payload, timeout=10)

        # 5. Check update response
        if not update_response.ok: return jsonify({"code": 502, "error": "Failed to update status via notification service"}), 502
        update_data = update_response.json()
        if update_data.get("code") != 200: return jsonify({"code": 502, "error": "Notification service reported error on update"}), 502

        # Get updated data
        updated_record_data = {}
        resp_list = update_data.get("data", {}).get("response", [])
        if resp_list and isinstance(resp_list, list) and len(resp_list) > 0: updated_record_data = resp_list[0]
        else: updated_record_data = {**request_data, "status": new_status} # Fallback

        # 6. Publish & Trigger Inventory for 'accepted'/'rejected'
        if new_status in ['accepted', 'rejected']:
            sender_id = request_data.get('sender_id')
            if sender_id:
                routing_key = f"charity.{sender_id}"
                message_payload = {
                    'event': 'request_updated',
                    'request_id': request_id_str,
                    'responder_id': responder_id_int,
                    'original_sender_id': sender_id,
                    'status': new_status, # Status included
                    'item_id': request_data.get('item_id'),
                    'notification': request_data.get('notification'),
                    'category': request_data.get('category'),
                    'quantity': request_data.get('quantity'),
                    'timestamp': datetime.now().isoformat()
                }
                publish_message(routing_key, message_payload) # Fire and forget

                if new_status == 'accepted':
                     inventory_details = {
                         'sender_id': sender_id, 'recipient_id': responder_id_int,
                         'item_id': request_data.get('item_id'),
                         'resource_type': request_data.get('notification'),
                         'quantity': request_data.get('quantity')
                     }
                     trigger_inventory_update(inventory_details) # Fire and forget

        return jsonify({"code": 200, "data": updated_record_data}), 200

    except requests.exceptions.RequestException as e_req:
         return jsonify({"code": 503, "error": "Service unavailable"}), 503
    except Exception as e_outer:
        return jsonify({"code": 500, "error": "Server error updating status"}), 500

# --- Listener Management Endpoints (Simplified) ---
@app.route('/listener/start/<charity_id>', methods=['POST'])
def start_listener(charity_id):
    """Starts a message listener container."""
    # NOTE: Requires request_api container to have Docker socket access
    # and appropriate permissions.
    try:
        try: int(charity_id)
        except ValueError: return jsonify({"code": 400, "status": "error", "message": "Invalid charity_id format"}), 400
        
        client = docker.from_env()
        container_name = f"message-listener-{charity_id}"

        logger.info(f"Starting listener for charity_id: {charity_id}")
        logger.info(f"Using image: {LISTENER_IMAGE_NAME}")
        logger.info(f"Using network: {DOCKER_NETWORK_NAME}")

        try:
            container = client.containers.get(container_name)
            if container.status != 'running': container.start()
            return jsonify({"code": 200, "status": "success", "message": "Listener running or started"}), 200
        except docker.errors.NotFound: pass # Create new one
        except docker.errors.APIError as api_err:
             return jsonify({"code": 500, "status": "error", "message": f"Docker API error: {api_err}"}), 500


        charity_name_map = {"1": "Willing Hearts", "4": "Food Bank SG", "2": "Food From The Heart"}
        charity_name = charity_name_map.get(str(charity_id), f"Charity_{charity_id}")
        # ------------------------------------------------------

        listener_env = {
            "CHARITY_ID": str(charity_id), "CHARITY_NAME": charity_name,
            "RABBITMQ_HOST": RABBITMQ_HOST, "RABBITMQ_PORT": str(RABBITMQ_PORT),
            "RABBITMQ_USER": RABBITMQ_USER, "RABBITMQ_PASS": RABBITMQ_PASS,
            "EXCHANGE_NAME": EXCHANGE_NAME,
            "API_BASE_URL": f"http://request-api:5199", # Internal port for request_api
            "AUTO_MARK_AS_READ": os.environ.get("LISTENER_AUTO_MARK_READ", "false")
        }

        container = client.containers.run(
            image=LISTENER_IMAGE_NAME, name=container_name, detach=True,
            environment=listener_env, network=DOCKER_NETWORK_NAME,
            restart_policy={"Name": "on-failure", "MaximumRetryCount": 3}
        )
        return jsonify({"code": 201, "status": "success", "container_id": container.id}), 201

    except docker.errors.ImageNotFound:
        return jsonify({"code": 500, "status": "error", "message": f"Listener image '{LISTENER_IMAGE_NAME}' not found."}), 500
    except docker.errors.APIError as api_err:
        
        if api_err.explanation and isinstance(api_err.explanation, str) and 'network' in api_err.explanation and 'not found' in api_err.explanation:
             return jsonify({"code": 500, "status": "error", "message": f"Docker network '{DOCKER_NETWORK_NAME}' not found."}), 500
        return jsonify({"code": 500, "status": "error", "message": f"Docker API error: {api_err}"}), 500
    except Exception as e:
        
        return jsonify({"code": 500, "status": "error", "message": "Failed to start listener"}), 500

@app.route('/listener/stop/<charity_id>', methods=['POST'])
def stop_listener(charity_id):
    """Stops and removes the message listener container."""
    try:
        try: int(charity_id)
        except ValueError: return jsonify({"code": 400, "status": "error", "message": "Invalid charity_id format"}), 400

        client = docker.from_env()
        container_name = f"message-listener-{charity_id}"
        try:
            container = client.containers.get(container_name)
            container.stop(timeout=5); container.remove()
            return jsonify({"code": 200, "status": "success", "message": "Listener stopped/removed"}), 200
        except docker.errors.NotFound:
            return jsonify({"code": 200, "status": "success", "message": "Listener not found"}), 200
        except docker.errors.APIError as api_err:
            
             return jsonify({"code": 500, "status": "error", "message": f"Docker API error: {api_err}"}), 500

    except Exception as e:

        return jsonify({"code": 500, "status": "error", "message": "Failed to stop listener"}), 500

@app.route('/notify', methods=['POST'])
def notify_request_read():
    """Updates the status of a request to 'Read' when notified by the message listener."""
    data = request.get_json()
    request_id = data.get('request_id')
    if not request_id:
        return jsonify({"code": 400, "error": "Missing request_id"}), 400

    logger.info(f"Received notification for request_id: {request_id}")

    # First, get the notification details to populate required fields
    try:
        # Get the notification details
        logger.info(f"Fetching notification details for request_id {request_id}...")
        
        # We need to find which charity this notification belongs to
        # Try to get all notifications and find the one with matching ID
        response = requests.get(f"{NOTIFICATION_API_URL}", timeout=10)
        if not response.ok:
            logger.error(f"Failed to fetch notifications: {response.status_code}")
            return jsonify({"code": 502, "error": "Failed to fetch notification details"}), 502
            
        response_data = response.json()
        all_notifications = response_data.get("data", {}).get("response", [])
        
        # Find the notification with matching ID
        notification = next((n for n in all_notifications if str(n.get('id')) == str(request_id)), None)
        if not notification:
            logger.error(f"Notification with ID {request_id} not found")
            return jsonify({"code": 404, "error": "Notification not found"}), 404
            
        # Now update the status to 'read'
        logger.info(f"Updating status for request_id {request_id} to 'read'...")
        
        # Format payload according to what notification service expects
        update_payload = {
            'id': request_id,
            'Recipient': notification.get('recipient_id'),
            'Notification': notification.get('notification'),
            'Quantity': notification.get('quantity'),
            'Status': 'read'
        }
        
        # Use the PUT /notification endpoint
        update_response = requests.put(NOTIFICATION_API_URL, json=update_payload, timeout=10)
        
        if not update_response.ok:
            logger.error(f"Failed to update status: {update_response.status_code}")
            return jsonify({"code": 502, "error": "Failed to update notification status"}), 502
            
        logger.info(f"Successfully updated notification {request_id} status to 'read'")
        return jsonify({"code": 200, "message": "Status updated to 'read'"}), 200
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request exception: {str(e)}")
        return jsonify({"code": 503, "error": "Service unavailable"}), 503
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"code": 500, "error": f"Server error updating notification status: {str(e)}"}), 500

# Main execution block
if __name__ == '__main__':
    port = int(os.environ.get('FLASK_RUN_PORT', 5199)) # Internal port
    host = os.environ.get('FLASK_RUN_HOST', '0.0.0.0')
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    # Log configuration settings
    logger.info(f"Starting Request API Service on {host}:{port} (Debug: {debug})")
    logger.info(f"RabbitMQ Configuration: Host={RABBITMQ_HOST}, Port={RABBITMQ_PORT}, Exchange={EXCHANGE_NAME}, Type={EXCHANGE_TYPE}")
    
    app.run(host=host, port=port, debug=debug)