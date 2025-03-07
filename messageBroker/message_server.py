#!/usr/bin/env python
import pika
import json

# Establish connection to RabbitMQ
connection = pika.BlockingConnection(pika.ConnectionParameters(host='localhost'))
channel = connection.channel()

# Declare exchanges
channel.exchange_declare(exchange='requests', exchange_type='fanout', durable=True)
channel.exchange_declare(exchange='responses', exchange_type='direct', durable=True)

# Declare a queue for receiving requests
request_queue = channel.queue_declare(queue='', exclusive=True).method.queue
channel.queue_bind(exchange='requests', queue=request_queue)

def on_request(ch, method, props, body):
    """Handle incoming resource requests."""
    request = json.loads(body)
    print(f" [x] Received request: {request}")

    # Forward the request to the appropriate service
    channel.basic_publish(
        exchange='responses',
        routing_key=request['service_id'],
        body=body
    )
    print(f" [x] Forwarded request to {request['service_id']}")

# Start consuming requests
channel.basic_consume(queue=request_queue, on_message_callback=on_request, auto_ack=True)

print(" [x] Awaiting requests...")
channel.start_consuming()