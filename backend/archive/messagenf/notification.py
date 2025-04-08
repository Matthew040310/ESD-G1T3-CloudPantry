import pika
import json
from datetime import datetime
from flask import Flask, jsonify, request
import threading
from flask_cors import CORS

import os
import requests

# Get endpoints from environment variables
INVENTORY_ENDPOINT = os.environ.get("INVENTORY_ENDPOINT", "http://localhost:5006/inventory/")
EXCESS_INVENTORY_ENDPOINT = os.environ.get("EXCESS_INVENTORY_ENDPOINT", "http://localhost:5001/inventory/")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Store notifications in memory
# In production, use a database
notifications = []
# Store completed notifications in a database (simulated as a list here)
completed_notifications = []

class NotificationService:
    def __init__(self):
        print("[DEBUG] Initializing notification service")
        self.connection = None
        self.channel = None
        self._connect_with_retry()
        
    def _connect_with_retry(self, max_retries=5):
        """Connect to RabbitMQ with retry logic"""
        retry_count = 0
        last_error = None
        
        while retry_count < max_retries:
            try:
                print("[DEBUG] Connecting to RabbitMQ (attempt {}/{})".format(retry_count + 1, max_retries))
                
                # Try connecting with hostname 'charitymq' (Docker service name)
                self.connection = pika.BlockingConnection(
                    pika.ConnectionParameters(
                        host='charitymq',
                        port=5672,
                        credentials=pika.PlainCredentials('guest', 'guest'),
                        heartbeat=600,
                        blocked_connection_timeout=300,
                        connection_attempts=3,
                        retry_delay=5
                    )
                )
                
                self.channel = self.connection.channel()
                print("[DEBUG] Connected to RabbitMQ successfully")
                
                # Setup infrastructure after successful connection
                self._setup_infrastructure()
                self._start_consumer_in_thread()
                return True
                
            except Exception as e:
                last_error = e
                retry_count += 1
                print(f"[ERROR] Failed to connect to RabbitMQ (attempt {retry_count}/{max_retries}): {e}")
                
                # If we failed with 'charitymq', try with 'localhost' on last attempt
                if retry_count == max_retries - 1:
                    try:
                        print("[DEBUG] Trying to connect to RabbitMQ on localhost")
                        self.connection = pika.BlockingConnection(
                            pika.ConnectionParameters(
                                host='localhost',
                                port=5672,
                                credentials=pika.PlainCredentials('guest', 'guest'),
                                heartbeat=600,
                                blocked_connection_timeout=300,
                                connection_attempts=3,
                                retry_delay=5
                            )
                        )
                        
                        self.channel = self.connection.channel()
                        print("[DEBUG] Connected to RabbitMQ on localhost successfully")
                        
                        # Setup infrastructure after successful connection
                        self._setup_infrastructure()
                        self._start_consumer_in_thread()
                        return True
                        
                    except Exception as e2:
                        print(f"[ERROR] Failed to connect to RabbitMQ on localhost: {e2}")
                
                time.sleep(2)  # Wait before retrying
        
        print(f"[ERROR] Failed to connect to RabbitMQ after {max_retries} attempts. Last error: {last_error}")
        return False
    
    def _start_consumer_in_thread(self):
        """Start consuming in a background thread"""
        def consume_notifications():
            try:
                print("[DEBUG] Starting notification consumer thread")
                
                # Create a new connection and channel for the consumer thread
                consumer_connection = pika.BlockingConnection(
                    pika.ConnectionParameters(
                        host='charitymq',  # Try Docker service name first
                        port=5672,
                        credentials=pika.PlainCredentials('guest', 'guest'),
                        heartbeat=600,
                        blocked_connection_timeout=300
                    )
                )
                
                consumer_channel = consumer_connection.channel()
                
                # Declare the queue to make sure it exists
                consumer_channel.queue_declare(
                    queue='notification_queue',
                    durable=True
                )
                
                # Bind the queue to make sure it's properly bound
                consumer_channel.queue_bind(
                    exchange='charity_exchange',
                    queue='notification_queue',
                    routing_key='notification'
                )
                
                # Set up the consumer
                consumer_channel.basic_consume(
                    queue='notification_queue',
                    on_message_callback=self._process_message,
                    auto_ack=True
                )
                
                print(" [*] Notification service started. Waiting for messages...")
                consumer_channel.start_consuming()
                
            except Exception as e:
                print(f"[ERROR] Notification consumer thread error: {e}")
                # Try to reconnect
                time.sleep(5)  # Wait a bit before reconnection attempt
                self._reconnect()
        
        # Start notification consumer thread
        notification_thread = threading.Thread(target=consume_notifications)
        notification_thread.daemon = True
        notification_thread.start()
        print("[DEBUG] Notification consumer thread started")
        
    def _setup_infrastructure(self):
        """Declare exchange and notification queue"""
        print("[DEBUG] Setting up infrastructure")
        
        # Declare single direct exchange
        self.channel.exchange_declare(
            exchange='charity_exchange',
            exchange_type='direct',
            durable=True
        )
        print("[DEBUG] Declared charity_exchange (direct type)")
        
        # Notification queue for all messages
        self.channel.queue_declare(
            queue='notification_queue',
            durable=True
        )
        
        # Bind notification queue with 'notification' routing key
        self.channel.queue_bind(
            exchange='charity_exchange',
            queue='notification_queue',
            routing_key='notification'
        )
        print("[DEBUG] Bound notification_queue to charity_exchange with routing key 'notification'")


    def _reconnect(self):
        """Reconnect to RabbitMQ if connection is lost"""
        try:
            print("[DEBUG] Attempting to reconnect to RabbitMQ")
            # Close existing connection if still open
            if self.connection and self.connection.is_open:
                self.connection.close()
            
            # Reconnect
            self._connect_to_rabbitmq()
            self._setup_infrastructure()
            self._start_consumer_in_thread()
        except Exception as e:
            print(f"[ERROR] Reconnection failed: {e}")

    def _process_message(self, ch, method, properties, body):
        """Handle incoming messages (both requests and responses)"""
        try:
            message = json.loads(body)
            message_type = message.get('type', 'unknown')
            
            print(f"\n[Notification Service] Received {message_type}:")
            print(json.dumps(message, indent=2))
            
            # Store notification for API retrieval
            global notifications
            
            # Track request status for grouping
            if message_type == 'response':
                # Find the original request and update its status
                self._update_request_status(message)
            
            # Add the message to our notification list
            notifications.append(message)
            print(f"[DEBUG] Stored {message_type}. Current notifications count: {len(notifications)}")
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] Invalid message format: {e}")
            print(f"[ERROR] Message body: {body}")
        except Exception as e:
            print(f"[ERROR] Unexpected error processing message: {e}")
    
    def _update_request_status(self, response):
        """Update the status of the original request when a response is received"""
        global notifications
        
        # Find the original request
        for notification in notifications:
            if (notification.get('type') == 'request' and
                notification.get('sender_id') == response.get('request_id') and
                notification.get('recipient_id') == response.get('sender_id') and
                notification.get('resource_type') == response.get('resource_type') and
                notification.get('item_id') == response.get('item_id')):
                
                # Found matching request, update its status
                notification['status'] = response.get('response', 'unknown')
                print(f"[DEBUG] Updated request status to {notification['status']}")
                
                # If the response is "accept", trigger inventory updates
                if response.get('response') == 'accept':
                    print(f"[DEBUG] Request accepted - updating inventories")
                    update_inventories_after_acceptance(notification)
                    
                break



def update_inventories_after_acceptance(request_data):
    """Update inventories after a request is accepted"""
    try:
        sender_id = request_data.get('sender_id')
        recipient_id = request_data.get('recipient_id')
        resource_type = request_data.get('resource_type')
        quantity = request_data.get('quantity')
        item_id = request_data.get('item_id')
        
        if not all([sender_id, recipient_id, resource_type, quantity, item_id]):
            print(f"[ERROR] Missing required fields for inventory update: {request_data}")
            return False
            
        # 1. Reduce recipient's inventory and excess inventory
        update_recipient_inventories(recipient_id, item_id, resource_type, quantity)
        
        # 2. Increase sender's inventory
        update_sender_inventory(sender_id, item_id, resource_type, quantity)
        
        return True
    except Exception as e:
        print(f"[ERROR] Failed to update inventories: {e}")
        return False

def update_recipient_inventories(charity_id, item_id, resource_type, quantity):
    """Update recipient's inventory and excess inventory"""
    try:
        # Get current inventory
        inventory_url = f"{INVENTORY_ENDPOINT}{charity_id}"
        response = requests.get(inventory_url)
        if not response.ok:
            print(f"[ERROR] Failed to get inventory for {charity_id}: {response.text}")
            return False
            
        inventory = response.json()
        
        # Find the item
        item_to_update = None
        for item in inventory:
            if item.get('ID') == item_id or item.get('id') == item_id:
                item_to_update = item
                break
                
        if not item_to_update:
            print(f"[ERROR] Item {item_id} not found in inventory for {charity_id}")
            return False
            
        # Update inventory quantity
        new_quantity = max(0, item_to_update.get('quantity', 0) - int(quantity))
        item_to_update['quantity'] = new_quantity
        
        # Update inventory
        response = requests.put(inventory_url, json=[item_to_update])
        if not response.ok:
            print(f"[ERROR] Failed to update inventory for {charity_id}: {response.text}")
            return False
            
        # Get current excess inventory
        excess_url = f"{EXCESS_INVENTORY_ENDPOINT}{charity_id}"
        response = requests.get(excess_url)
        if not response.ok:
            print(f"[ERROR] Failed to get excess inventory for {charity_id}: {response.text}")
            return False
            
        excess_inventory = response.json()
        
        # Find the item in excess inventory
        excess_item = None
        for item in excess_inventory:
            if item.get('ID') == item_id or item.get('id') == item_id:
                excess_item = item
                break
                
        if not excess_item:
            print(f"[ERROR] Item {item_id} not found in excess inventory for {charity_id}")
            return False
            
        # Update excess inventory quantity
        new_excess_quantity = max(0, excess_item.get('quantity', 0) - int(quantity))
        excess_item['quantity'] = new_excess_quantity
        
        # Update excess inventory
        response = requests.put(excess_url, json=[excess_item])
        if not response.ok:
            print(f"[ERROR] Failed to update excess inventory for {charity_id}: {response.text}")
            return False
            
        return True
    except Exception as e:
        print(f"[ERROR] Exception updating recipient inventories: {e}")
        return False

def update_sender_inventory(charity_id, item_id, resource_type, quantity):
    """Update sender's inventory by adding the requested quantity"""
    try:
        # Get current inventory
        inventory_url = f"{INVENTORY_ENDPOINT}{charity_id}"
        response = requests.get(inventory_url)
        if not response.ok:
            print(f"[ERROR] Failed to get inventory for {charity_id}: {response.text}")
            return False
            
        inventory = response.json()
        
        # Find if the item already exists
        item_to_update = None
        for item in inventory:
            if item.get('ID') == item_id or item.get('id') == item_id:
                item_to_update = item
                break
                
        if item_to_update:
            # Update existing item
            new_quantity = item_to_update.get('quantity', 0) + int(quantity)
            item_to_update['quantity'] = new_quantity
            update_items = [item_to_update]
        else:
            # Create new item
            new_item = {
                'ID': item_id,
                'name': resource_type,
                'quantity': int(quantity),
                'category': 'Donated',
                'type': 'Received',
            }
            update_items = [new_item]
            
        # Update inventory
        response = requests.put(inventory_url, json=update_items)
        if not response.ok:
            print(f"[ERROR] Failed to update inventory for {charity_id}: {response.text}")
            return False
            
        return True
    except Exception as e:
        print(f"[ERROR] Exception updating sender inventory: {e}")
        return False
# Initialize service when module loads
notification_service = NotificationService()

@app.route('/messagenf', methods=['GET'])
def get_notifications():
    """API endpoint to get all notifications"""
    charity_id = request.args.get('charity_id')
    print(f"[DEBUG] Getting notifications for charity_id: {charity_id}")
    
    if charity_id:
        # Filter notifications for specific charity:
        # - Include requests FROM this charity
        # - Include requests TO this charity
        # - Include responses FROM this charity
        # - Include responses TO this charity
        filtered = [n for n in notifications 
                   if ((n.get('type') == 'request' and 
                        (n.get('sender_id') == charity_id or n.get('recipient_id') == charity_id)) or
                       (n.get('type') == 'response' and 
                        (n.get('sender_id') == charity_id or n.get('request_id') == charity_id)))]
        
        print(f"[DEBUG] Filtered notifications count: {len(filtered)}")
        return jsonify(filtered), 200
    
    # Return all notifications
    return jsonify(notifications), 200

@app.route('/messagenf/active/<charity_id>', methods=['GET'])
def get_active_notifications(charity_id):
    """Get active notifications for a charity and archive completed ones"""
    global notifications
    global completed_notifications
    
    if not charity_id:
        return jsonify({"error": "charity_id parameter is required"}), 400
    
    # Get all requests from this charity
    outgoing_requests = [n for n in notifications 
                      if n.get('type') == 'request' and n.get('sender_id') == charity_id]
    
    # For each outgoing request, check if it has a response
    completed_requests = []
    active_requests = []
    
    for req in outgoing_requests:
        # Find a matching response
        has_response = any(
            resp.get('type') == 'response' and
            resp.get('request_id') == req.get('sender_id') and
            resp.get('sender_id') == req.get('recipient_id') and
            resp.get('resource_type') == req.get('resource_type') and
            resp.get('item_id') == req.get('item_id')
            for resp in notifications
        )
        
        if has_response:
            completed_requests.append(req)
        else:
            active_requests.append(req)
    
    # Move completed requests to the completed_notifications list
    for req in completed_requests:
        notifications.remove(req)
        completed_notifications.append(req)
        
        # Also find and move the corresponding response
        for resp in list(notifications):
            if (resp.get('type') == 'response' and
                resp.get('request_id') == req.get('sender_id') and
                resp.get('sender_id') == req.get('recipient_id') and
                resp.get('resource_type') == req.get('resource_type') and
                resp.get('item_id') == req.get('item_id')):
                notifications.remove(resp)
                completed_notifications.append(resp)
    
    return jsonify({
        "active_requests": active_requests,
        "completed_count": len(completed_requests)
    }), 200

@app.route('/messagenf/completed/<charity_id>', methods=['GET'])
def get_completed_notifications(charity_id):
    """Get completed (archived) notifications for a charity"""
    if not charity_id:
        return jsonify({"error": "charity_id parameter is required"}), 400
    
    # Filter completed notifications for this charity
    charity_completed = [n for n in completed_notifications 
                        if ((n.get('type') == 'request' and 
                             (n.get('sender_id') == charity_id or n.get('recipient_id') == charity_id)) or
                            (n.get('type') == 'response' and 
                             (n.get('sender_id') == charity_id or n.get('request_id') == charity_id)))]
    
    return jsonify(charity_completed), 200

@app.route('/requests-status', methods=['GET'])
def get_requests_status():
    """Get the status of all requests grouped by charity"""
    charity_id = request.args.get('charity_id')
    
    # Base structure for the response
    result = {
        "outgoing_requests": {},  # Requests sent by this charity
        "incoming_requests": {}   # Requests received by this charity
    }
    
    if charity_id:
        # Get all requests from this charity
        outgoing = [n for n in notifications 
                   if n.get('type') == 'request' and n.get('sender_id') == charity_id]
        
        # Get all requests to this charity
        incoming = [n for n in notifications 
                   if n.get('type') == 'request' and n.get('recipient_id') == charity_id]
        
        # Group outgoing requests by recipient_id
        for req in outgoing:
            recipient = req.get('recipient_id')
            if recipient not in result["outgoing_requests"]:
                result["outgoing_requests"][recipient] = []
            result["outgoing_requests"][recipient].append(req)
        
        # Group incoming requests by sender_id
        for req in incoming:
            sender = req.get('sender_id')
            if sender not in result["incoming_requests"]:
                result["incoming_requests"][sender] = []
            result["incoming_requests"][sender].append(req)
        
        return jsonify(result), 200
    
    return jsonify({"error": "charity_id parameter is required"}), 400

@app.route('/messagenf/clear', methods=['POST'])
def clear_notifications():
    """Clear all notifications - for testing"""
    global notifications
    global completed_notifications
    notifications = []
    completed_notifications = []
    return jsonify({"status": "notifications_cleared"}), 200

@app.route('/messagenf/add-test', methods=['POST'])
def add_test_notification():
    """Add a test notification - for debugging"""
    try:
        data = request.json
        global notifications
        
        # Add timestamp if not present
        if 'timestamp' not in data:
            data['timestamp'] = datetime.now().isoformat()
            
        notifications.append(data)
        return jsonify({"status": "notification_added", "count": len(notifications)}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Add this endpoint to notification.py

@app.route('/messagenf/diagnostic', methods=['GET'])
def run_diagnostic():
    """Run diagnostic tests on the notification service"""
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "service": "notification_service",
        "tests": []
    }
    
    # Test 1: RabbitMQ connection
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host='charitymq',
                port=5672,
                credentials=pika.PlainCredentials('guest', 'guest'),
                heartbeat=600,
                blocked_connection_timeout=300,
                connection_attempts=3,
                retry_delay=2
            )
        )
        
        channel = connection.channel()
        
        # Check if we can declare a test exchange
        channel.exchange_declare(
            exchange='notification_diagnostic_exchange',
            exchange_type='direct',
            durable=True,
            auto_delete=True
        )
        
        # Check if we can declare a test queue
        result = channel.queue_declare(
            queue='notification_diagnostic_queue',
            durable=True,
            auto_delete=True
        )
        test_queue_name = result.method.queue
        
        # Bind queue to exchange
        channel.queue_bind(
            exchange='notification_diagnostic_exchange',
            queue=test_queue_name,
            routing_key='notification_diagnostic'
        )
        
        # Try to publish a message
        test_message = json.dumps({
            "type": "diagnostic",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "notification_service"
        })
        
        channel.basic_publish(
            exchange='notification_diagnostic_exchange',
            routing_key='notification_diagnostic',
            body=test_message,
            properties=pika.BasicProperties(delivery_mode=2)
        )
        
        # Clean up
        channel.queue_delete(queue=test_queue_name)
        channel.exchange_delete(exchange='notification_diagnostic_exchange')
        
        connection.close()
        
        results["tests"].append({
            "name": "rabbitmq_connection",
            "success": True,
            "details": "Successfully connected to RabbitMQ, created exchange, queue, bound them, published message"
        })
    except Exception as e:
        results["tests"].append({
            "name": "rabbitmq_connection",
            "success": False,
            "details": f"Failed to connect to RabbitMQ: {str(e)}"
        })
    
    # Test 2: Check notifications
    try:
        results["tests"].append({
            "name": "notifications_check",
            "success": True,
            "details": f"Found {len(notifications)} active notifications and {len(completed_notifications)} completed notifications"
        })
    except Exception as e:
        results["tests"].append({
            "name": "notifications_check",
            "success": False,
            "details": f"Failed to check notifications: {str(e)}"
        })
    
    # Test 3: Check notification queue binding
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host='charitymq',
                port=5672,
                credentials=pika.PlainCredentials('guest', 'guest'),
                heartbeat=600,
                blocked_connection_timeout=300
            )
        )
        channel = connection.channel()
        
        # Check if the notification queue exists
        try:
            queue = channel.queue_declare(queue='notification_queue', passive=True)
            queue_exists = True
            message_count = queue.method.message_count
        except Exception:
            queue_exists = False
            message_count = 0
        
        connection.close()
        
        if queue_exists:
            results["tests"].append({
                "name": "notification_queue",
                "success": True,
                "details": f"Notification queue exists with {message_count} messages"
            })
        else:
            results["tests"].append({
                "name": "notification_queue",
                "success": False,
                "details": "Notification queue does not exist"
            })
    except Exception as e:
        results["tests"].append({
            "name": "notification_queue",
            "success": False,
            "details": f"Failed to check notification queue: {str(e)}"
        })
    
    # Calculate overall status
    failures = [test for test in results["tests"] if not test["success"]]
    results["overall_status"] = "healthy" if not failures else "degraded"
    results["overall_message"] = "All systems operational" if not failures else f"{len(failures)} test(s) failed"
    
    return jsonify(results), 200

@app.route('/messagenf/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "notifications_count": len(notifications),
        "completed_count": len(completed_notifications),
        "queue": "notification_queue"
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)