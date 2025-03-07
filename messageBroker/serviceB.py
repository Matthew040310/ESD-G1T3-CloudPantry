# This would be moved to the root level outside of messageBroker eventually

import pika
import json
import threading
from common.rabbitmq_utils import get_rabbitmq_connection
from common.message_format import create_request_message, create_response_message, is_message_expired

class ServiceB:
    def __init__(self, service_id):
        self.service_id = service_id
        self.connection = get_rabbitmq_connection()
        self.channel = self.connection.channel()


        self.channel.exchange_declare(exchange='requests', exchange_type='fanout', durable=True)
        self.channel.exchange_declare(exchange='responses', exchange_type='direct', durable=True)

        # Declare a durable queue for receiving requests
        self.request_queue = self.channel.queue_declare(queue=f'{self.service_id}_requests', durable=True).method.queue
        self.channel.queue_bind(exchange='requests', queue=self.request_queue)

        # Declare a durable queue for receiving responses
        self.response_queue = self.channel.queue_declare(queue=f'{self.service_id}_responses', durable=True).method.queue
        self.channel.queue_bind(exchange='responses', queue=self.response_queue, routing_key=self.service_id)


        self.channel.basic_consume(queue=self.request_queue, on_message_callback=self.on_request, auto_ack=True)


        self.channel.basic_consume(queue=self.response_queue, on_message_callback=self.on_response, auto_ack=True)

    def broadcast_request(self, resource_type, quantity):
        """Broadcast a resource request."""
        message = create_request_message(self.service_id, resource_type, quantity)
        self.channel.basic_publish(
            exchange='requests',
            routing_key='',
            body=message,
            properties=pika.BasicProperties(delivery_mode=2)
        )
        print(f" [x] Sent request: {message}")

    def on_request(self, ch, method, props, body):
        """Handle incoming resource requests."""
        request = json.loads(body)
        if request['service_id'] == self.service_id:
            # Ignore requests from itself
            return

        if is_message_expired(request['expiry']):
            print(f" [x] Ignoring expired request: {request}")
            return

        print(f" [x] Received request: {request}")
        response = input(f"Do you want to accept the request from {request['service_id']}? (Accept/Reject): ").strip().lower()
        if response in ["accept", "reject"]:
            response_message = create_response_message(self.service_id, request['service_id'], response)
            self.channel.basic_publish(
                exchange='responses',
                routing_key=request['service_id'],
                body=response_message,
                properties=pika.BasicProperties(delivery_mode=2)
            )
            print(f" [x] Sent response: {response_message}")

    def on_response(self, ch, method, props, body):
        """Handle incoming responses."""
        response = json.loads(body)
        if response['type'] == 'response' and response['request_id'] == self.service_id:
            print(f" [x] Received response: {response}")

    def start(self):
        """Start consuming requests and responses."""
        print(" [x] Awaiting requests and responses...")
        self.channel.start_consuming()

if __name__ == "__main__":
    service = ServiceB("service_b")
    service.broadcast_request("B requesting ...", 10)
    service.start()