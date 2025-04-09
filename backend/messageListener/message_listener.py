# --- message_listener.py ---
# Background listener service for charity resource exchange system

import os
import sys
import json
import pika
import time
import logging
import threading
import argparse
from datetime import datetime
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration from environment variables
RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "charitymq")
RABBITMQ_PORT = int(os.environ.get("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "admin")
RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS", "password")
EXCHANGE_NAME = os.environ.get("EXCHANGE_NAME", "charity_exchange")
API_BASE_URL = os.environ.get("API_BASE_URL", "http://request-api:5199")

CHARITY_NAME = os.environ.get("CHARITY_NAME")
if not CHARITY_NAME:
    logger.critical("CRITICAL: CHARITY_NAME environment variable not set. Exiting.")
    sys.exit(1)

shutdown_flag = threading.Event()  # For graceful shutdown

class MessageListener:
    def __init__(self, charity_id, charity_name):
        if not charity_id: raise ValueError("Charity ID missing")
        if not charity_name: raise ValueError("Charity Name missing")

        self.charity_id = str(charity_id)
        self.connection = None
        self.channel = None
        self.queue_name = charity_name
        self.routing_key = f"charity.{self.charity_id}"
        logger.info(f"Initializing listener for ID {self.charity_id} (Queue: '{self.queue_name}', RK: '{self.routing_key}')")
    
    # docker exec charitymq rabbitmqctl list_queues name durable messages_ready messages_unacknowledged
    def connect(self):
        """Connect to RabbitMQ, declare exchange, queue, and bind."""
        try:
            logger.info(f"Connecting to {RABBITMQ_HOST}:{RABBITMQ_PORT} user '{RABBITMQ_USER}'")
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
            self.connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials,
                    heartbeat=600, blocked_connection_timeout=300
                )
            )
            logger.info("Connected.")
            self.channel = self.connection.channel()
            logger.info("Channel opened.")

            # self.channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type='direct', durable=True)
            # self.channel.queue_declare(queue=self.queue_name, durable=True)
            self.channel.queue_bind(exchange=EXCHANGE_NAME, queue=self.queue_name, routing_key=self.routing_key)
            logger.info("Exchange, Queue, and Binding declared/verified.")
            return True
        except Exception as e:
            logger.error(f"Error during RabbitMQ setup: {e}", exc_info=True)
            if self.connection and self.connection.is_open: self.connection.close()
            self.connection = None
            self.channel = None
            return False

    def start_consuming(self):
        """Start consuming messages from the queue with manual acknowledgment."""
        if not self.channel or not self.connection or not self.connection.is_open:
            logger.error("Cannot start consuming: channel/connection not available.")
            return False
        try:
            self.channel.basic_qos(prefetch_count=1)
            self.consumer_tag = self.channel.basic_consume(
                queue=self.queue_name,
                on_message_callback=self._handle_message,
                auto_ack=False
            )
            logger.info(f"Starting consumption from queue '{self.queue_name}'...")
            self.channel.start_consuming()
            logger.info("Consumption loop finished cleanly.")
            return True
        except pika.exceptions.StreamLostError as e:
            logger.error(f"Connection lost: {e}. Reconnecting...")
            self.connection = None
            self.channel = None
            return False
        except Exception as e:
            logger.error(f"Error during consumption: {e}", exc_info=True)
            return False

    def _handle_message(self, ch, method, properties, body):
        """Process a received message and manually acknowledge."""
        logger.info(f"Received message (tag: {method.delivery_tag})")
        try:
            message = json.loads(body.decode('utf-8'))
            request_id = message.get('request_id')
            event_type = message.get('event')
            logger.info(f"Processing event: '{event_type}' (Req ID: {message.get('request_id')})")

            if event_type == 'new_request':
                self._handle_new_request(message)
            elif event_type == 'request_updated':
                self._handle_request_updated(message)
            else:
                logger.warning(f"Unknown event type '{event_type}'.")

            # Send request_id back to RequestAPI
            notify_url = f"{API_BASE_URL}/notify"
            logger.info(f"Sending request_id {request_id} to RequestAPI at {notify_url}...")
            response = requests.post(
                notify_url,
                json={"request_id": request_id}
            )
            logger.info(f"RequestAPI response status: {response.status_code}")

            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.debug(f"Ack message {method.delivery_tag}")
        except json.JSONDecodeError:
            logger.error(f"JSON decode failed: {body}. Discarding.")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Error handling message (tag: {method.delivery_tag}): {e}", exc_info=True)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def _handle_new_request(self, message):
        """Handle a new request message (Log only)."""
        item_desc = message.get('notification') or message.get('category', 'N/A')
        logger.info(f"New request (ID: {message.get('request_id')}): Qty {message.get('quantity')} {item_desc} from {message.get('sender_id')}")

    def _handle_request_updated(self, message):
        """Handle a request update message (Log only)."""
        logger.info(f"Request update (ID: {message.get('request_id')}): Status '{message.get('status')}' by {message.get('responder_id')}")

    def stop(self):
        """Stop consuming and close connection gracefully."""
        logger.info("Stop requested...")
        shutdown_flag.set()
        try:
            if self.channel and self.channel.is_open and hasattr(self, 'consumer_tag'):
                logger.info("Cancelling consumer...")
                self.channel.basic_cancel(self.consumer_tag)
                logger.info("Consumer cancelled.")
            if self.connection and self.connection.is_open:
                logger.info("Closing connection...")
                self.connection.close()
                logger.info("Connection closed.")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}", exc_info=True)
        finally:
            self.channel = None
            self.connection = None
            logger.info("Shutdown complete.")

def signal_handler(signum, frame):
    logger.info(f"Received signal {signum}. Initiating shutdown...")
    shutdown_flag.set()

def run_listener(charity_id, charity_name):
    import signal
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info(f"Starting listener loop for ID {charity_id}, Name '{charity_name}'")
    listener = MessageListener(charity_id, charity_name)

    retry_count, max_retries, delay = 0, 10, 5

    while not shutdown_flag.is_set():
        if not listener.connect():
            retry_count += 1
            if retry_count > max_retries:
                logger.critical("Max retries exceeded.")
                break
            retry_delay = delay * (2 ** min(retry_count - 1, 6))
            logger.warning(f"Connection failed ({retry_count}/{max_retries}). Retrying in {retry_delay}s...")
            shutdown_flag.wait(timeout=retry_delay)
            if shutdown_flag.is_set():
                break
            continue

        retry_count = 0
        logger.info("Connection established. Starting consumer...")
        consume_ok = listener.start_consuming()

        if shutdown_flag.is_set():
            break
        if not consume_ok:
            logger.warning("Consumer exited unexpectedly. Reconnecting...")
            time.sleep(delay)

    logger.info("Exiting listener loop.")
    listener.stop()
    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Message listener")
    parser.add_argument("charity_id", help="ID of the charity")
    args = parser.parse_args()

    env_charity_name = os.environ.get("CHARITY_NAME")

    if not args.charity_id:
        logger.critical("Error: charity_id missing.")
        sys.exit(1)
    if not env_charity_name:
        logger.critical("Error: CHARITY_NAME environment variable not set.")
        sys.exit(1)

    logger.info(f"Starting listener module with charity ID: {args.charity_id}")
    exit_code = run_listener(args.charity_id, env_charity_name)
    sys.exit(exit_code)
