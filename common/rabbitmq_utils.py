import pika
import json
import os

def load_rabbitmq_config():
    """Load RabbitMQ configuration from the json file."""
    config_path = os.path.join(os.path.dirname(__file__), 'rabbitmq_config.json')
    with open(config_path, 'r') as file:
        config = json.load(file)
    return config['rabbitmq']

# Server version
# def load_rabbitmq_config():
#     """Load RabbitMQ configuration from environment variables."""
#     return {
#         "host": os.getenv("RABBITMQ_HOST", "localhost"),
#         "port": int(os.getenv("RABBITMQ_PORT", 5672)),
#         "username": os.getenv("RABBITMQ_USERNAME", "guest"),
#         "password": os.getenv("RABBITMQ_PASSWORD", "guest"),
#         "vhost": os.getenv("RABBITMQ_VHOST", "/"),
#     }

def get_rabbitmq_connection():
    """Establish RabbitMQ connection using loaded config."""
    config = load_rabbitmq_config()
    connection_params = pika.ConnectionParameters(
        host=config['host'],
        port=config['port'],
        virtual_host=config['vhost'],
        credentials=pika.PlainCredentials(config['username'], config['password']),
        connection_attempts=3,
        retry_delay=5
    )
    return pika.BlockingConnection(connection_params)