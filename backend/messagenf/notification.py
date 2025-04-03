import pika
import json
from datetime import datetime
from flask import Flask, jsonify, request
import threading
from flask_cors import CORS

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
        self._connect_to_rabbitmq()
        self._setup_infrastructure()
        self._start_consumer_in_thread()
        
    def _connect_to_rabbitmq(self):
        """Establish connection to RabbitMQ"""
        print("[DEBUG] Connecting to RabbitMQ")
        self.connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host='charitymq',  # Updated to use Docker service name
                port=5672,
                credentials=pika.PlainCredentials('guest', 'guest'),
                heartbeat=600,
                blocked_connection_timeout=300
            )
        )
        self.channel = self.connection.channel()
        print("[DEBUG] Connected to RabbitMQ")
        
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
        
    def _start_consumer_in_thread(self):
        """Start consuming in a background thread"""
        def consume_notifications():
            try:
                print("[DEBUG] Starting notification consumer")
                self.channel.basic_consume(
                    queue='notification_queue',
                    on_message_callback=self._process_message,
                    auto_ack=True
                )
                print(" [*] Notification service started. Waiting for messages...")
                self.channel.start_consuming()
            except Exception as e:
                print(f"[ERROR] Notification consumer thread error: {e}")
                # Try to reconnect
                self._reconnect()
        
        # Start notification consumer thread
        notification_thread = threading.Thread(target=consume_notifications)
        notification_thread.daemon = True
        notification_thread.start()
        print("[DEBUG] Notification consumer thread started")
    
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
                break

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