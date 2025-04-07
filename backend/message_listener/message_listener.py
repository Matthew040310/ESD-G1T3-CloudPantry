# --- message_listener.py ---
# Background listener service for charity resource exchange system
# Consumes messages from RabbitMQ for a specific charity

import os
import sys
import json
import pika
import time
import logging
import threading
import requests
import argparse
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Configuration ---
RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.environ.get("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.environ.get("RABBITMQ_USER", "guest")
RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS", "guest")
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:5101") # URL to call back to request_api if needed
EXCHANGE_NAME = "charity_exchange"
AUTO_MARK_AS_READ = os.environ.get("AUTO_MARK_AS_READ", "false").lower() == "true"

# Shutdown flag for graceful exit
shutdown_flag = threading.Event()

class MessageListener:
    def __init__(self, charity_id):
        if not charity_id:
             raise ValueError("Charity ID must be provided")
        self.charity_id = str(charity_id)
        self.connection = None
        self.channel = None
        self.queue_name = f"charity_{self.charity_id}" # <<< Use ID-based name
        self.routing_key = f"message.to.{self.charity_id}" # <<< Use specific routing key
        logger.info(f"Initializing message listener for charity {self.charity_id} (Queue: {self.queue_name}, RK: {self.routing_key})")

    def connect(self):
        """Connect to RabbitMQ and set up the channel and queue."""
        try:
            logger.info(f"Attempting RabbitMQ connection to {RABBITMQ_HOST}:{RABBITMQ_PORT}")
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
            self.connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    port=RABBITMQ_PORT,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
            )
            logger.info("RabbitMQ connection successful.")
            self.channel = self.connection.channel()
            logger.info("Channel opened.")

            # # Declare exchange idempotently
            # logger.info(f"Declaring exchange '{EXCHANGE_NAME}' (type: direct)")
            # # <<< CHANGED exchange_type to direct
            # self.channel.exchange_declare(
            #     exchange=EXCHANGE_NAME,
            #     exchange_type='direct',
            #     durable=True
            # )
            # logger.info("Exchange declared.")

            # # Declare queue idempotently
            # logger.info(f"Declaring queue '{self.queue_name}'")
            # self.channel.queue_declare(
            #     queue=self.queue_name,
            #     durable=True # Ensure queue survives broker restart
            # )
            # logger.info("Queue declared.")

            # Bind queue to exchange (idempotent)
            logger.info(f"Binding queue '{self.queue_name}' to exchange '{EXCHANGE_NAME}' with RK '{self.routing_key}'")
            self.channel.queue_bind(
                exchange=EXCHANGE_NAME,
                queue=self.queue_name,
                routing_key=self.routing_key # Bind with the specific key
            )
            logger.info("Queue bound.")
            return True

        except pika.exceptions.AMQPConnectionError as e:
             logger.error(f"Failed to connect to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}: {e}")
             # Optionally log specific connection parameters that might be wrong
             # logger.debug(f"Connection params: host={RABBITMQ_HOST}, port={RABBITMQ_PORT}, user={RABBITMQ_USER}")
             return False
        except Exception as e:
            logger.error(f"Unexpected error during RabbitMQ setup: {e}", exc_info=True)
            return False

    def start_consuming(self):
        """Start consuming messages from the queue."""
        if not self.channel or not self.connection or not self.connection.is_open:
            logger.error("Cannot start consuming: channel or connection not available.")
            return False

        try:
            # Set prefetch count for potentially better performance/resource usage
            self.channel.basic_qos(prefetch_count=1)

            # Set up consumer with MANUAL acknowledgment
            # <<< CHANGED auto_ack to False
            self.consumer_tag = self.channel.basic_consume(
                queue=self.queue_name,
                on_message_callback=self._handle_message,
                auto_ack=False
            )
            logger.info(f"Consumer set up with tag '{self.consumer_tag}'. Starting consumption from queue '{self.queue_name}'...")

            # Start consuming loop (blocking)
            self.channel.start_consuming() # This blocks until stop() is called or connection drops

            # This part is reached only if start_consuming finishes cleanly (e.g., stop() called)
            logger.info("Consumption loop finished cleanly.")
            return True

        except pika.exceptions.StreamLostError as e:
             logger.error(f"Connection lost during consumption: {e}. Will attempt reconnection.")
             self.connection = None # Signal that reconnection is needed
             self.channel = None
             return False # Indicate failure for the current run
        except pika.exceptions.AMQPChannelError as e:
            logger.error(f"AMQP channel error during consumption setup: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during message consumption: {e}", exc_info=True)
            return False

    def _handle_message(self, ch, method, properties, body):
        """Process a message from the queue."""
        logger.info(f"Received message (delivery tag: {method.delivery_tag})")
        try:
            message = json.loads(body.decode('utf-8'))
            event_type = message.get('event')
            request_id = message.get('request_id')

            logger.info(f"Processing message: event='{event_type}', request_id='{request_id}'")
            logger.debug(f"Message details: {json.dumps(message)}")

            # Process based on event type
            if event_type == 'new_request':
                self._handle_new_request(message)
            elif event_type == 'request_updated':
                self._handle_request_updated(message)
            else:
                logger.warning(f"Unknown event type received: '{event_type}'. Discarding message.")

            # <<< ADDED Explicitly acknowledge message AFTER successful processing
            logger.debug(f"Acknowledging message {method.delivery_tag}")
            ch.basic_ack(delivery_tag=method.delivery_tag)

        except json.JSONDecodeError:
            logger.error(f"Failed to decode JSON message body: {body}. Discarding.")
            # <<< ADDED Reject non-requeueable message
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Error handling message (delivery tag: {method.delivery_tag}): {e}", exc_info=True)
            # <<< ADDED Reject non-requeueable message on error (prevents poison messages)
            # Decide if requeue=True makes sense for certain transient errors, but False is safer.
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

    def _handle_new_request(self, message):
        """Handle a new request message."""
        request_id = message.get('request_id')
        logger.info(f"New request received (ID: {request_id}): {message.get('quantity')} {message.get('resource_type')} from charity {message.get('sender_id')}")
        # Optionally mark as read via API
        if AUTO_MARK_AS_READ and request_id:
            self._mark_as_read(request_id)

    def _handle_request_updated(self, message):
        """Handle a request update message."""
        request_id = message.get('request_id')
        status = message.get('status')
        logger.info(f"Request update received (ID: {request_id}): Status changed to {status} by {message.get('sender_id')}")
        # Optionally mark as read via API
        if AUTO_MARK_AS_READ and request_id:
             self._mark_as_read(request_id) # Might mark own updates as read too

    def _mark_as_read(self, request_id):
        """Mark a request as read via the API."""
        if not API_BASE_URL:
             logger.warning("API_BASE_URL not set. Cannot mark request as read.")
             return
        try:
            url = f"{API_BASE_URL}/requests/{request_id}/status"
            data = {
                "status": "read",
                "responder_id": self.charity_id # Indicate who marked it as read
            }
            logger.debug(f"Calling API to mark request {request_id} as read: PUT {url}")
            response = requests.put(url, json=data, timeout=5)
            if response.status_code == 200:
                logger.info(f"Successfully marked request {request_id} as read via API.")
            # Handle potential 404 if request was deleted, or 403 if already processed
            elif response.status_code in [404, 403]:
                logger.warning(f"Failed to mark request {request_id} as read (status: {response.status_code}): {response.text}. Might be already processed or deleted.")
            else:
                logger.error(f"API error marking request {request_id} as read: {response.status_code} - {response.text}")

        except requests.exceptions.RequestException as e:
            logger.error(f"Network error calling API to mark request {request_id} as read: {e}")
        except Exception as e:
            logger.error(f"Unexpected error marking request {request_id} as read: {e}", exc_info=True)

    def stop(self):
        """Stop consuming and close connection gracefully."""
        logger.info("Stop requested for message listener...")
        shutdown_flag.set() # Signal the run loop to exit
        try:
            if self.channel and self.channel.is_open:
                 if hasattr(self, 'consumer_tag') and self.consumer_tag:
                      logger.info(f"Cancelling consumer {self.consumer_tag}...")
                      self.channel.basic_cancel(self.consumer_tag)
                      logger.info("Consumer cancelled.")
                 # Closing the channel can sometimes help release the blocking start_consuming
                 # self.channel.close()
                 # logger.info("Channel closed.")
            else:
                 logger.info("Channel already closed or not available.")

            if self.connection and self.connection.is_open:
                logger.info("Closing RabbitMQ connection...")
                # Closing connection should implicitly close the channel
                self.connection.close()
                logger.info("RabbitMQ connection closed.")
            else:
                 logger.info("Connection already closed or not available.")

        except pika.exceptions.AMQPError as e:
            logger.error(f"AMQP error during listener shutdown: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during listener shutdown: {e}", exc_info=True)
        finally:
            logger.info("Listener shutdown process complete.")


def signal_handler(signum, frame):
    """Handle termination signals."""
    logger.info(f"Received signal {signum}, initiating shutdown...")
    # listener.stop() # Call stop directly if listener object is accessible globally
    shutdown_flag.set() # Prefer setting flag for the main loop to handle


def run_listener(charity_id):
    """Main function to run the message listener with reconnection."""
    import signal
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    logger.info(f"Starting message listener main loop for charity {charity_id}")
    listener = MessageListener(charity_id)

    retry_count = 0
    max_retries = 10
    initial_retry_delay = 5

    while not shutdown_flag.is_set():
        if not listener.connect():
            retry_count += 1
            if retry_count > max_retries:
                 logger.critical(f"Exceeded maximum connection retries ({max_retries}). Shutting down.")
                 break
            retry_delay = initial_retry_delay * (2 ** min(retry_count - 1, 6))
            logger.warning(f"Connection attempt {retry_count}/{max_retries} failed. Retrying in {retry_delay} seconds...")
            # Wait for delay or shutdown signal
            shutdown_flag.wait(timeout=retry_delay)
            if shutdown_flag.is_set():
                 logger.info("Shutdown signal received during retry wait.")
                 break
            continue # Retry connection

        # Reset retry count on successful connection
        retry_count = 0
        logger.info("Connection established. Starting consumer...")

        # Start consuming (this will block until connection drops or stop is called)
        consume_successful = listener.start_consuming()

        # If start_consuming returns (e.g., due to connection loss, not clean shutdown),
        # the loop will continue and attempt to reconnect after a short delay.
        # If shutdown_flag is set, the loop condition will handle exit.

        if shutdown_flag.is_set():
             logger.info("Shutdown signal received while consuming or after connection loss.")
             break

        if not consume_successful:
             logger.warning("Consumer loop exited unexpectedly (likely connection loss). Waiting before reconnect attempt...")
             # Add a small delay before attempting immediate reconnection after consume fails
             time.sleep(initial_retry_delay)


    # Cleanup after loop exits
    logger.info("Exiting main listener loop.")
    listener.stop() # Ensure resources are cleaned up
    logger.info("Message listener stopped.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Message listener for charity resource exchange system")
    parser.add_argument("charity_id", help="ID of the charity to listen for")
    args = parser.parse_args()

    if not args.charity_id:
        logger.critical("Error: charity_id argument is required.")
        sys.exit(1)

    # Run the listener
    exit_code = run_listener(args.charity_id)
    sys.exit(exit_code)