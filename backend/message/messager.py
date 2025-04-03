import pika
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

class CharityService:
    def __init__(self, charity_id):
        self.charity_id = charity_id
        print(f"[DEBUG] Initializing charity service for {charity_id}")
        self.connection = self._get_rabbitmq_connection()
        self.channel = self.connection.channel()
        self._setup_infrastructure()
        self._start_consuming()
        
    def _get_rabbitmq_connection(self):
        """Establish RabbitMQ connection"""
        print(f"[DEBUG] Connecting to RabbitMQ for {self.charity_id}")
        return pika.BlockingConnection(
            pika.ConnectionParameters(
                host='charitymq',  
                port=5672,
                credentials=pika.PlainCredentials('guest', 'guest'),
                heartbeat=600,
                blocked_connection_timeout=300
            )
        )

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
        """Start consuming messages from charity queue"""
        queue_name = f'charity_{self.charity_id}'
        print(f"[DEBUG] Setting up consumer for {queue_name}")
        
        # Use a non-blocking consumer
        self.channel.basic_consume(
            queue=queue_name,
            on_message_callback=self._handle_message,
            auto_ack=True
        )
        
        print(f"[DEBUG] Consumer setup for {self.charity_id} completed")
        
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
        """Send targeted requests to specific charities
        
        charity_requests format:
        {
            "charity_id": [
                {
                    "resource_type": "food",
                    "quantity": 100,
                    "item_id": "item123"
                },
                ...
            ],
            ...
        }
        """
        success_count = 0
        error_count = 0
        
        for recipient_id, requests in charity_requests.items():
            for req in requests:
                try:
                    resource_type = req.get('resource_type')
                    quantity = req.get('quantity')
                    item_id = req.get('item_id')
                    
                    message = self._create_request(recipient_id, resource_type, quantity, item_id)
                    
                    # Direct exchange - use recipient_id as routing key
                    self.channel.basic_publish(
                        exchange='charity_exchange',
                        routing_key=recipient_id,  # Direct to recipient charity
                        body=message,
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                    
                    # Also send copy to notification service
                    self.channel.basic_publish(
                        exchange='charity_exchange',
                        routing_key='notification',  # Direct to notification service
                        body=message,
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                    
                    # Also send notification to sender (for UI updates)
                    self.channel.basic_publish(
                        exchange='charity_exchange',
                        routing_key='notification.to.' + self.charity_id,
                        body=message,
                        properties=pika.BasicProperties(delivery_mode=2)
                    )
                    
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

# Flask API Endpoints
@app.route('/message/<charity_id>', methods=['POST'])
def create_charity(charity_id):
    """Initialize new charity service"""
    global charity_instances
    
    # Check if charity already exists
    if charity_id in charity_instances:
        print(f"[DEBUG] Charity {charity_id} already exists")
        return jsonify({"status": "already_exists", "charity_id": charity_id}), 200
    
    # Create new charity
    try:
        print(f"[DEBUG] Creating charity {charity_id}")
        charity = CharityService(charity_id)
        charity_instances[charity_id] = charity
        return jsonify({"status": "created", "charity_id": charity_id}), 201
    except Exception as e:
        print(f"[ERROR] Failed to create charity {charity_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/message/<charity_id>/request', methods=['POST'])
def make_request(charity_id):
    """Make resource request to multiple charities with multiple resource types"""
    global charity_instances
    
    try:
        data = request.json
        print(f"[DEBUG] Request from {charity_id}: {data}")
        
        # Get charity instance or create if not exists
        if charity_id not in charity_instances:
            print(f"[DEBUG] Creating charity {charity_id} for request")
            charity_instances[charity_id] = CharityService(charity_id)
        
        charity = charity_instances[charity_id]
        
        # Format expected: { "charity_id": [{ resource_data }], ... }
        success_count, error_count = charity.send_request(data)
        
        return jsonify({
            "status": "requests_sent",
            "success_count": success_count,
            "error_count": error_count
        }), 200
    except Exception as e:
        print(f"[ERROR] Failed to send request for {charity_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/message/<charity_id>/respond', methods=['POST'])
def make_response(charity_id):
    """Respond to a resource request"""
    global charity_instances
    
    try:
        request_data = request.json
        response_action = request_data.pop('response', 'reject')  # Default to reject if not specified
        
        print(f"[DEBUG] Response from {charity_id} to {request_data.get('sender_id')}: {response_action}")
        
        # Get charity instance or create if not exists
        if charity_id not in charity_instances:
            print(f"[DEBUG] Creating charity {charity_id} for response")
            charity_instances[charity_id] = CharityService(charity_id)
        
        charity = charity_instances[charity_id]
        success = charity.send_response(request_data, response_action)
        
        if success:
            return jsonify({"status": "response_sent"}), 200
        else:
            return jsonify({"status": "response_failed"}), 400
            
    except Exception as e:
        print(f"[ERROR] Failed to send response for {charity_id}: {e}")
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

if __name__ == '__main__':
    # Start Flask in the main thread
    app.run(host='0.0.0.0', port=5000)