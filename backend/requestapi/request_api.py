# --- request_api.py ---
# Simplified Backend API Service - MINIMAL LOGGING + STATUS FIELD ADDED
# 1. Imports
import os
import json
import pika
# import logging # Removed
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import docker
import requests

# 2. Basic Configuration & Logging (Minimal)
# logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s') # Removed
# logger = logging.getLogger(__name__) # Removed

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
EXCHANGE_TYPE = os.environ.get("EXCHANGE_TYPE", "topic") # Assuming topic, adjust if direct

LISTENER_IMAGE_NAME = os.environ.get("LISTENER_IMAGE_NAME", "brejesh/is213-cloudpantry:message-listener")
DOCKER_NETWORK_NAME = os.environ.get("DOCKER_NETWORK_NAME", "charity_network")

INVENTORY_API_URL = os.environ.get("INVENTORY_ENDPOINT", "http://inventory:5000/inventory/")
EXCESS_INVENTORY_API_URL = os.environ.get("EXCESS_INVENTORY_ENDPOINT", "http://excess-inventory:5000/inventory/")

# 5. Helper Functions (Simplified)

def get_rabbitmq_connection():
    """Creates and returns a RabbitMQ blocking connection."""
    try:
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials, heartbeat=600, blocked_connection_timeout=300)
        )
        return connection
    except Exception as e:
        # print(f"ERROR: RMQ connection error: {e}", file=sys.stderr) # Optional print for critical errors
        return None

def publish_message(routing_key, message_body):
    """Publishes a persistent message."""
    connection = None
    try:
        connection = get_rabbitmq_connection()
        if not connection: return False
        channel = connection.channel()
        # Ensure exchange exists
        channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type=EXCHANGE_TYPE, durable=True)
        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=routing_key,
            body=json.dumps(message_body),
            properties=pika.BasicProperties(delivery_mode=pika.DeliveryMode.Persistent)
        )
        return True
    except Exception as e:
        # print(f"ERROR: Error publishing message (RK: {routing_key}): {e}", file=sys.stderr) # Optional print
        return False
    finally:
        if connection and connection.is_open:
            connection.close()

def trigger_inventory_update(request_data):
    """Attempts inventory updates via API calls with proper payloads."""
    try:
        sender_id = request_data['sender_id']
        recipient_id = request_data['recipient_id']
        resource_type = request_data['resource_type']
        quantity = int(request_data['quantity'])
        item_id = request_data['item_id']

        if quantity <= 0 or not INVENTORY_API_URL: 
            return False

        # Use container names with correct internal port (5000)
        excess_inventory_get_url = f"http://excess-inventory:5000/inventory/{recipient_id}"
        # logger.info(f"Attempting to get excess inventory from: {excess_inventory_get_url}")
        
        excess_inventory_response = requests.get(excess_inventory_get_url, timeout=10)
        
        if excess_inventory_response.status_code != 200:
            # logger.error(f"Failed to get sender's excess inventory: {excess_inventory_response.status_code}")
            # logger.error(f"Response content: {excess_inventory_response.text}")
            return False
            
        # Find the matching item in the excess inventory
        item_object = None
        response_data = excess_inventory_response.json()
        # logger.info(f"Received response: {response_data}")
        
        for item in response_data.get('data', {}).get('response', []):
            if item.get('id') == item_id:
                item_object = item
                break
                
        if not item_object:
            # logger.error(f"Item {item_id} not found in sender's excess inventory")
            return False
            
        # Calculate the new quantity for the sender's inventory
        current_quantity = item_object.get('quantity', 0)
        new_quantity = current_quantity - quantity
        
        if new_quantity < 0:
            # logger.error(f"Not enough quantity in inventory. Current: {current_quantity}, Requested: {quantity}")
            return False
            
        # Create a copy of the item object with updated quantity
        updated_item = item_object.copy()
        updated_item['quantity'] = new_quantity
        updated_item["ID"] = updated_item["id"]
        
        # Update sender's inventory database using container names with correct port
        sender_inventory_url = f"http://inventory:5000/inventory/{recipient_id}"
        sender_inventory_payload = [updated_item]
        sender_inventory_response = requests.put(
            sender_inventory_url, 
            json=sender_inventory_payload, 
            timeout=10
        )
        
        # Update sender's excess inventory database
        sender_excess_inventory_url = f"http://excess-inventory:5000/inventory/{recipient_id}"
        sender_excess_inventory_response = requests.put(
            sender_excess_inventory_url, 
            json=sender_inventory_payload, 
            timeout=10
        )
        
        # Add the item to recipient's inventory
        recipient_item = item_object.copy()
        recipient_item['quantity'] = quantity
        recipient_inventory_url = f"http://inventory:5000/inventory/{sender_id}"
        recipient_inventory_payload = [recipient_item]
        recipient_inventory_response = requests.post(
            recipient_inventory_url, 
            json=recipient_inventory_payload, 
            timeout=10
        )

        # logger.info("Inventory update completed successfully")
        return True

    except Exception as e:
        # logger.error(f"Inventory Update: Unexpected error: {e}")
        import traceback
        # logger.error(traceback.format_exc())
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

        try:
            container = client.containers.get(container_name)
            if container.status != 'running': container.start()
            return jsonify({"code": 200, "status": "success", "message": "Listener running or started"}), 200
        except docker.errors.NotFound: pass # Create new one
        except docker.errors.APIError as api_err:
             return jsonify({"code": 500, "status": "error", "message": f"Docker API error: {api_err}"}), 500


        charity_name_map = {"1": "Willing Hearts", "4": "Food Bank SG"}
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

# Main execution block
if __name__ == '__main__':
    port = int(os.environ.get('FLASK_RUN_PORT', 5199)) # Internal port
    host = os.environ.get('FLASK_RUN_HOST', '0.0.0.0')
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    # print(f"--- Starting Request API Service on {host}:{port} (Debug: {debug}) ---") # Optional print
    app.run(host=host, port=port, debug=debug)