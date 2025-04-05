import pika
import json
import requests
import threading
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
CHARITY_API_URL = "https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI/GetAllCharityIDName"
INITIALIZATION_RETRY_INTERVAL = 30  # seconds

class CharityService:
    def __init__(self, charity_id):
        self.charity_id = charity_id
        print(f"[INIT] Initializing charity service for {charity_id}")
        self.connected = False
        self.consumer_thread = None
        
        try:
            self.connection = self._get_rabbitmq_connection()
            self.channel = self.connection.channel()
            self._setup_infrastructure()
            self._start_consuming()
            self.connected = True
            print(f"[INIT] Charity service for {charity_id} initialized successfully")
        except Exception as e:
            print(f"[ERROR] Failed to initialize charity service for {charity_id}: {e}")
            # Don't re-raise, let the caller handle the failure
            # We'll try to reconnect on next operation
        
    def _get_rabbitmq_connection(self):
        """Establish RabbitMQ connection with retry logic"""
        print(f"[DEBUG] Connecting to RabbitMQ for {self.charity_id}")
        max_retries = 5
        retry_count = 0
        last_error = None
        
        while retry_count < max_retries:
            try:
                # Try connecting with hostname 'charitymq' (Docker service name)
                connection = pika.BlockingConnection(
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
                print(f"[DEBUG] Successfully connected to RabbitMQ for {self.charity_id}")
                return connection
            except Exception as e:
                last_error = e
                retry_count += 1
                print(f"[ERROR] Failed to connect to RabbitMQ (attempt {retry_count}/{max_retries}): {e}")
                
                # If we failed with 'charitymq', try with 'localhost' on last attempt
                if retry_count == max_retries - 1:
                    try:
                        print(f"[DEBUG] Trying to connect to RabbitMQ on localhost for {self.charity_id}")
                        connection = pika.BlockingConnection(
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
                        print(f"[DEBUG] Successfully connected to RabbitMQ on localhost for {self.charity_id}")
                        return connection
                    except Exception as e2:
                        print(f"[ERROR] Failed to connect to RabbitMQ on localhost: {e2}")
                
                time.sleep(2)  
        
        raise last_error  # Re-raise the last error if all retries failed

    def _setup_infrastructure(self):
        """Setup exchange and queue"""
        print(f"[DEBUG] Setting up infrastructure for {self.charity_id}")
        
        # Declare single direct exchange for all messages
        self.channel.exchange_declare(
            exchange='charity_exchange',
            exchange_type='direct',
            durable=True
        )
        print(f"[DEBUG] Declared charity_exchange (direct type)")
        
        # Setup queue for this charity (both for sending and receiving)
        queue_name = f'charity_{self.charity_id}'
        self.channel.queue_declare(
            queue=queue_name,
            durable=True
        )
        
        # Bind queue to exchange with charity_id as routing key
        self.channel.queue_bind(
            exchange='charity_exchange',
            queue=queue_name,
            routing_key=self.charity_id
        )
        print(f"[DEBUG] Bound {queue_name} to charity_exchange with routing key {self.charity_id}")
        
        # Also bind to notification routing key to receive copies of all messages
        self.channel.queue_bind(
            exchange='charity_exchange',
            queue=queue_name,
            routing_key='notification.to.' + self.charity_id
        )
        print(f"[DEBUG] Bound {queue_name} to notification routing key")
    
    def _start_consuming(self):
        """Start consuming messages from charity queue in a separate thread"""
        queue_name = f'charity_{self.charity_id}'
        print(f"[DEBUG] Setting up consumer for {queue_name}")
        
        def consumer_thread():
            try:
                print(f"[DEBUG] Consumer thread starting for {self.charity_id}")
                # Create a new connection and channel for the consumer thread
                # to avoid sharing connections between threads
                consumer_connection = self._get_rabbitmq_connection()
                consumer_channel = consumer_connection.channel()
                
                # Set up the consumer in this thread
                consumer_channel.basic_consume(
                    queue=queue_name,
                    on_message_callback=self._handle_message,
                    auto_ack=True
                )
                
                print(f"[DEBUG] Consumer thread for {self.charity_id} starting to consume")
                try:
                    consumer_channel.start_consuming()
                except Exception as e:
                    print(f"[ERROR] Consumer thread error for {self.charity_id}: {e}")
            except Exception as e:
                print(f"[ERROR] Failed to setup consumer thread for {self.charity_id}: {e}")
        
        # Start consumer in a daemon thread
        self.consumer_thread = threading.Thread(target=consumer_thread)
        self.consumer_thread.daemon = True
        self.consumer_thread.start()
        print(f"[DEBUG] Consumer thread for {self.charity_id} started")
        
    def _create_request(self, recipient_id, resource_type, quantity, item_id=None, expiry_seconds=300):
        """Create request message"""
        expiry_time = (datetime.now() + timedelta(seconds=expiry_seconds)).isoformat()
        timestamp = datetime.now().isoformat()
        
        message = {
            "type": "request",
            "sender_id": self.charity_id,
            "recipient_id": recipient_id,
            "resource_type": resource_type,
            "item_id": item_id,
            "quantity": quantity,
            "expiry": expiry_time,
            "timestamp": timestamp,
            "status": "pending"
        }
        print(f"[DEBUG] Created request message: {message}")
        return json.dumps(message)

    def _create_response(self, request_data, response_action):
        """Create response message"""
        timestamp = datetime.now().isoformat()
        
        # Extract the original request details
        message = {
            "type": "response",
            "sender_id": self.charity_id,
            "request_id": request_data.get("sender_id"),
            "recipient_id": request_data.get("recipient_id", self.charity_id),
            "resource_type": request_data.get("resource_type"),
            "item_id": request_data.get("item_id"),
            "quantity": request_data.get("quantity"),
            "original_timestamp": request_data.get("timestamp"),
            "response": response_action,
            "timestamp": timestamp
        }
        print(f"[DEBUG] Created response message: {message}")
        return json.dumps(message)

    def _handle_message(self, ch, method, properties, body):
        """Process incoming messages"""
        try:
            message = json.loads(body)
            message_type = message.get('type', 'unknown')
            print(f"[DEBUG] Received {message_type} in {self.charity_id}: {message}")
            
            # Only process messages for this charity
            if message.get('recipient_id') != self.charity_id and not method.routing_key.startswith('notification.to.'):
                print(f"[DEBUG] Ignoring message not meant for {self.charity_id}")
                return
            
            # Skip own messages
            if message.get('sender_id') == self.charity_id:
                print(f"[DEBUG] Ignoring own message in {self.charity_id}")
                return
                
            if message_type == 'request':
                print(f"\n[Charity {self.charity_id}] Received request:")
                print(json.dumps(message, indent=2))
                print(f"[IMPORTANT] Charity {self.charity_id} received request from {message.get('sender_id')} for {message.get('quantity')} {message.get('resource_type')}")
            
            elif message_type == 'response':
                print(f"\n[Charity {self.charity_id}] Received response:")
                print(json.dumps(message, indent=2))
                print(f"[IMPORTANT] Charity {self.charity_id} received {message.get('response')} response from {message.get('sender_id')} for {message.get('quantity')} {message.get('resource_type')}")
            
            # Forward to notification service
            self._forward_to_notification(message)
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] Invalid message format: {e}")
            print(f"[ERROR] Message body: {body}")

    def _forward_to_notification(self, message_data):
        """Forward a message to the notification service"""
        try:
            message_json = json.dumps(message_data)
            self.channel.basic_publish(
                exchange='charity_exchange',
                routing_key='notification',
                body=message_json,
                properties=pika.BasicProperties(delivery_mode=2)
            )
            print(f"[DEBUG] Forwarded message to notification service")
        except Exception as e:
            print(f"[ERROR] Failed to forward to notification: {e}")

    def send_request(self, charity_requests):
        """Send targeted requests to specific charities"""
        # Check connection and reconnect if needed
        if not self.connected:
            try:
                print(f"[DEBUG] Reconnecting for send_request for {self.charity_id}")
                self.connection = self._get_rabbitmq_connection()
                self.channel = self.connection.channel()
                self._setup_infrastructure()
                self.connected = True
            except Exception as e:
                print(f"[ERROR] Reconnection failed for {self.charity_id}: {e}")
                return 0, len(charity_requests)  # Return all as errors
        
        # Rest of the method remains the same...
        success_count = 0
        error_count = 0
        
        for recipient_id, requests in charity_requests.items():
            for req in requests:
                try:
                    resource_type = req.get('resource_type')
                    quantity = req.get('quantity')
                    item_id = req.get('item_id')
                    
                    print(f"[DEBUG] Creating request from {self.charity_id} to {recipient_id} for {quantity} {resource_type}")
                    message = self._create_request(recipient_id, resource_type, quantity, item_id)
                    
                    # Direct exchange - use recipient_id as routing key
                    self.channel.basic_publish(
                        exchange='charity_exchange',
                        routing_key=recipient_id,  # Direct to recipient charity
                        body=message,
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                    print(f"[DEBUG] Published to {recipient_id} routing key")
                    
                    # Also send copy to notification service
                    self.channel.basic_publish(
                        exchange='charity_exchange',
                        routing_key='notification',  # Direct to notification service
                        body=message,
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                    print(f"[DEBUG] Published to notification routing key")
                    
                    # Also send notification to sender (for UI updates)
                    self.channel.basic_publish(
                        exchange='charity_exchange',
                        routing_key='notification.to.' + self.charity_id,
                        body=message,
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                    print(f"[DEBUG] Published to notification.to.{self.charity_id} routing key")
                    
                    print(f"[Charity {self.charity_id}] Request sent to {recipient_id}")
                    success_count += 1
                except Exception as e:
                    print(f"[ERROR] Failed to send request to {recipient_id}: {e}")
                    error_count += 1
                    
        return success_count, error_count

    def send_response(self, request_data, response_action):
        """Send response to specific charity"""
        original_sender = request_data.get('sender_id')
        
        if not original_sender:
            print(f"[ERROR] Missing sender_id in request data")
            return False
        
        # Check if the connection is still alive, if not, reconnect
        if not self.connected:
            try:
                print(f"[DEBUG] Reconnecting for send_response for {self.charity_id}")
                self.connection = self._get_rabbitmq_connection()
                self.channel = self.connection.channel()
                self._setup_infrastructure()
                self.connected = True
            except Exception as e:
                print(f"[ERROR] Reconnection failed for {self.charity_id}: {e}")
                return False
        
        try:
            message = self._create_response(request_data, response_action)
            
            # Send response to original sender
            print(f"[DEBUG] Publishing response from {self.charity_id} to {original_sender}")
            self.channel.basic_publish(
                exchange='charity_exchange',
                routing_key=original_sender,
                body=message,
                properties=pika.BasicProperties(delivery_mode=2)
            )
            
            # Send copy to notification service
            self.channel.basic_publish(
                exchange='charity_exchange',
                routing_key='notification',
                body=message,
                properties=pika.BasicProperties(delivery_mode=2)
            )
            
            # Also send notification to responder (for UI updates)
            self.channel.basic_publish(
                exchange='charity_exchange',
                routing_key='notification.to.' + self.charity_id,
                body=message,
                properties=pika.BasicProperties(delivery_mode=2)
            )
            
            print(f"[Charity {self.charity_id}] Response sent to {original_sender}")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to send response: {e}")
            return False

# Charity instances cache to avoid recreating them
charity_instances = {}

def fetch_charities_from_api():
    """Fetch list of all charities from the API"""
    try:
        print(f"[{datetime.utcnow().isoformat()}] [INFO] Fetching charities from API...")
        response = requests.get(CHARITY_API_URL, timeout=10)
        response.raise_for_status()
        charities = response.json()
        print(f"[{datetime.utcnow().isoformat()}] [INFO] Successfully fetched {len(charities)} charities")
        return charities
    except Exception as e:
        print(f"[{datetime.utcnow().isoformat()}] [ERROR] API fetch failed: {e}")
        return []

def initialize_charity_queues():
    """Initialize queues for all charities"""
    global charity_instances
    
    charities = fetch_charities_from_api()
    if not charities:
        print(f"[{datetime.utcnow().isoformat()}] [WARN] No charities fetched")
        return 0, 0
    
    print(f"[{datetime.utcnow().isoformat()}] [INFO] Initializing {len(charities)} charities...")
    
    success_count = 0
    error_count = 0
    
    batch_size = 5
    for i in range(0, len(charities), batch_size):
        batch = charities[i:i+batch_size]
        
        for charity in batch:
            charity_id = str(charity['ID'])
            
            if charity_id in charity_instances:
                print(f"[{datetime.utcnow().isoformat()}] [DEBUG] Charity {charity_id} exists")
                success_count += 1
                continue
                
            try:
                charity_instances[charity_id] = CharityService(charity_id)
                success_count += 1
                print(f"[{datetime.utcnow().isoformat()}] [INFO] Initialized {charity_id}")
            except Exception as e:
                print(f"[{datetime.utcnow().isoformat()}] [ERROR] Failed {charity_id}: {e}")
                error_count += 1
        
        if i + batch_size < len(charities):
            time.sleep(1)
    
    print(f"[{datetime.utcnow().isoformat()}] [INFO] Initialized {success_count}, Failed {error_count}")
    return success_count, error_count

def initialization_background_task():
    """Background task to initialize and refresh queues"""
    print(f"[{datetime.utcnow().isoformat()}] [INIT] Starting initialization")
    time.sleep(5)  # Wait for RabbitMQ
    
    # Initialization phase
    while True:
        try:
            success, failed = initialize_charity_queues()
            
            if failed > 0:
                print(f"[{datetime.utcnow().isoformat()}] [INIT] Retrying in {INITIALIZATION_RETRY_INTERVAL}s")
                time.sleep(INITIALIZATION_RETRY_INTERVAL)
            else:
                print(f"[{datetime.utcnow().isoformat()}] [INIT] All queues initialized")
                break
                
        except Exception as e:
            print(f"[{datetime.utcnow().isoformat()}] [INIT] Error: {e}")
            time.sleep(INITIALIZATION_RETRY_INTERVAL)
    
    # Maintenance phase
    while True:
        time.sleep(3600)  # 1 hour
        try:
            print(f"[{datetime.utcnow().isoformat()}] [MAINT] Refreshing queues")
            success, failed = initialize_charity_queues()
        except Exception as e:
            print(f"[{datetime.utcnow().isoformat()}] [MAINT] Refresh failed: {e}")

# Start initialization immediately when module loads
print(f"[{datetime.utcnow().isoformat()}] [BOOT] Starting message service")
init_thread = threading.Thread(target=initialization_background_task)
init_thread.daemon = True
init_thread.start()

# API Endpoints
@app.route('/message/<charity_id>', methods=['POST'])
def create_charity(charity_id):
    """Initialize new charity service"""
    if charity_id in charity_instances:
        return jsonify({"status": "exists", "charity_id": charity_id}), 200
    
    try:
        charity_instances[charity_id] = CharityService(charity_id)
        return jsonify({"status": "created", "charity_id": charity_id}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Replace these API endpoints in messager.py

@app.route('/message/<charity_id>/request', methods=['POST'])
def make_request(charity_id):
    """Make resource request to multiple charities with multiple resource types"""
    global charity_instances
    
    try:
        data = request.json
        print(f"[API] Request from {charity_id}: {data}")
        
        if not data:
            print(f"[ERROR] Empty request data from {charity_id}")
            return jsonify({"status": "error", "message": "Empty request data"}), 400
        
        # Validate data format
        if not isinstance(data, dict):
            print(f"[ERROR] Invalid request format from {charity_id}: {data}")
            return jsonify({"status": "error", "message": "Expected dictionary with charity IDs as keys"}), 400
        
        # Get charity instance or create if not exists
        if charity_id not in charity_instances:
            print(f"[API] Creating charity {charity_id} for request")
            try:
                charity_instances[charity_id] = CharityService(charity_id)
            except Exception as e:
                print(f"[ERROR] Failed to create charity {charity_id}: {e}")
                return jsonify({"status": "error", "message": f"Failed to create charity queue: {str(e)}"}), 500
        
        charity = charity_instances[charity_id]
        
        # Format expected: { "charity_id": [{ resource_data }], ... }
        try:
            success_count, error_count = charity.send_request(data)
            
            print(f"[API] Request sent from {charity_id}: {success_count} success, {error_count} error")
            
            return jsonify({
                "status": "requests_sent",
                "success_count": success_count,
                "error_count": error_count
            }), 200
        except Exception as e:
            print(f"[ERROR] Error in send_request for {charity_id}: {e}")
            return jsonify({"status": "error", "message": f"Failed to send request: {str(e)}"}), 500
    except Exception as e:
        print(f"[ERROR] Unhandled exception in make_request for {charity_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/message/<charity_id>/respond', methods=['POST'])
def make_response(charity_id):
    """Respond to a resource request"""
    global charity_instances
    
    try:
        request_data = request.json
        print(f"[API] Response from {charity_id}: {request_data}")
        
        if not request_data:
            print(f"[ERROR] Empty response data from {charity_id}")
            return jsonify({"status": "error", "message": "Empty response data"}), 400
        
        response_action = request_data.pop('response', 'reject')  # Default to reject if not specified
        
        print(f"[API] Response from {charity_id} to {request_data.get('sender_id')}: {response_action}")
        
        # Get charity instance or create if not exists
        if charity_id not in charity_instances:
            print(f"[API] Creating charity {charity_id} for response")
            try:
                charity_instances[charity_id] = CharityService(charity_id)
            except Exception as e:
                print(f"[ERROR] Failed to create charity {charity_id}: {e}")
                return jsonify({"status": "error", "message": f"Failed to create charity queue: {str(e)}"}), 500
        
        charity = charity_instances[charity_id]
        success = charity.send_response(request_data, response_action)
        
        if success:
            print(f"[API] Response successfully sent for {charity_id}")
            return jsonify({"status": "response_sent"}), 200
        else:
            print(f"[ERROR] Failed to send response for {charity_id}")
            return jsonify({"status": "response_failed", "message": "Failed to send response"}), 400
            
    except Exception as e:
        print(f"[ERROR] Unhandled exception in make_response for {charity_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/message', methods=['GET'])
def list_charities():
    """List all registered charities message queue"""
    try:
        # Get all charity instances from our cache
        registered_charities = list(charity_instances.keys())
        
        return jsonify({"charities": registered_charities}), 200
    except Exception as e:
        print(f"[ERROR] Failed to list charities: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/message/status', methods=['GET'])
def initialization_status():
    """Get charity queue initialization status"""
    try:
        # Count total charities from API
        charities = fetch_charities_from_api()
        total_charities = len(charities)
        initialized_charities = len(charity_instances)
        
        # Check if all charities are initialized
        all_initialized = total_charities > 0 and initialized_charities >= total_charities
        
        # Get charity details for display
        charity_details = []
        for charity in charities:
            charity_id = str(charity['ID'])
            charity_details.append({
                "id": charity_id,
                "name": charity['CharityName'],
                "initialized": charity_id in charity_instances
            })
        
        return jsonify({
            "status": "complete" if all_initialized else "in_progress", 
            "total_charities": total_charities,
            "initialized_charities": initialized_charities,
            "charity_details": charity_details
        }), 200
    except Exception as e:
        print(f"[ERROR] Failed to get initialization status: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/potential-charities', methods=['GET'])
def get_potential_charities():
    """Get available charities with their items (mock implementation)"""
    mock_data = {
        "potential_charities": [
            {
                "charity_id": "food_bank_sg",
                "name": "Food Bank SG",
                "contact": "9855 4805",
                "items": [
                    {
                        "item_id": "fb001",
                        "name": "Canned Food",
                        "nutrition_type": "Protein",
                        "category": "Non-perishable",
                        "fill_factor": 0.8,
                        "quantity": 200
                    },
                    {
                        "item_id": "fb002",
                        "name": "Cooking Essentials",
                        "nutrition_type": "Mixed",
                        "category": "Pantry items",
                        "fill_factor": 0.6,
                        "quantity": 100
                    }
                ]
            },
            {
                "charity_id": "free_food_for_all",
                "name": "Free Food For All",
                "contact": "8769 3947",
                "items": [
                    {
                        "item_id": "ff001",
                        "name": "Baby Food",
                        "nutrition_type": "Mixed",
                        "category": "Specialty",
                        "fill_factor": 0.9,
                        "quantity": 100
                    },
                    {
                        "item_id": "ff002",
                        "name": "Pasta & Grains",
                        "nutrition_type": "Carbohydrates",
                        "category": "Dry goods",
                        "fill_factor": 0.7,
                        "quantity": 150
                    }
                ]
            },
            {
                "charity_id": "lions_home",
                "name": "Lions Home for the Elders",
                "contact": "6252 9900",
                "items": [
                    {
                        "item_id": "lh001",
                        "name": "Cooking Essentials",
                        "nutrition_type": "Mixed",
                        "category": "Pantry items",
                        "fill_factor": 0.6,
                        "quantity": 50
                    }
                ]
            },
            {
                "charity_id": "food_from_heart",
                "name": "Food from the Heart",
                "contact": "6280 4483",
                "items": [
                    {
                        "item_id": "fh001",
                        "name": "Pasta & Grains",
                        "nutrition_type": "Carbohydrates",
                        "category": "Dry goods",
                        "fill_factor": 0.7,
                        "quantity": 100
                    }
                ]
            }
        ]
    }
    
    return jsonify(mock_data), 200

# Manual trigger for initialization
@app.route('/message/initialize-all', methods=['POST'])
def manually_initialize_all():
    """Manually trigger initialization of all charity queues"""
    try:
        success, failed = initialize_charity_queues()
        return jsonify({
            "status": "success",
            "initialized": success,
            "failed": failed
        }), 200
    except Exception as e:
        print(f"[ERROR] Failed to manually initialize: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/message/diagnostic', methods=['GET'])
def run_diagnostic():
    """Run diagnostic tests on the message service"""
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "service": "message_service",
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
            exchange='diagnostic_test_exchange',
            exchange_type='direct',
            durable=True,
            auto_delete=True
        )
        
        # Check if we can declare a test queue
        result = channel.queue_declare(
            queue='diagnostic_test_queue',
            durable=True,
            auto_delete=True
        )
        test_queue_name = result.method.queue
        
        # Bind queue to exchange
        channel.queue_bind(
            exchange='diagnostic_test_exchange',
            queue=test_queue_name,
            routing_key='diagnostic_test'
        )
        
        # Try to publish a message
        test_message = json.dumps({
            "type": "diagnostic",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "message_service"
        })
        
        channel.basic_publish(
            exchange='diagnostic_test_exchange',
            routing_key='diagnostic_test',
            body=test_message,
            properties=pika.BasicProperties(delivery_mode=2)
        )
        
        # Clean up
        channel.queue_delete(queue=test_queue_name)
        channel.exchange_delete(exchange='diagnostic_test_exchange')
        
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
    
    # Test 2: Charity API connection
    try:
        response = requests.get(CHARITY_API_URL, timeout=10)
        response.raise_for_status()
        charities = response.json()
        
        results["tests"].append({
            "name": "charity_api_connection",
            "success": True,
            "details": f"Successfully connected to Charity API, found {len(charities)} charities"
        })
    except Exception as e:
        results["tests"].append({
            "name": "charity_api_connection",
            "success": False,
            "details": f"Failed to connect to Charity API: {str(e)}"
        })
    
    # Test 3: Check existing charity instances
    try:
        results["tests"].append({
            "name": "charity_instances",
            "success": True,
            "details": f"Found {len(charity_instances)} initialized charity instances"
        })
    except Exception as e:
        results["tests"].append({
            "name": "charity_instances",
            "success": False,
            "details": f"Failed to check charity instances: {str(e)}"
        })
    
    # Calculate overall status
    failures = [test for test in results["tests"] if not test["success"]]
    results["overall_status"] = "healthy" if not failures else "degraded"
    results["overall_message"] = "All systems operational" if not failures else f"{len(failures)} test(s) failed"
    
    return jsonify(results), 200

if __name__ == '__main__':
    # Start Flask in the main thread
    app.run(host='0.0.0.0', port=5000)