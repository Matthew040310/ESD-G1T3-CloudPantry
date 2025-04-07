#!/usr/bin/env python3
import pika
import os
from dotenv import load_dotenv
import requests

load_dotenv()

amqp_host = "charitymq"
amqp_port = 5672
exchange_name = "charity_exchange"
exchange_type = "direct"
CHARITY_ENDPOINT: str = os.getenv('CHARITY_ENDPOINT', "https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI/")

def create_connection(hostname, port):
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=hostname,
            port=port,
            heartbeat=300,
            blocked_connection_timeout=300,
        )
    )
    return connection

def create_exchange(connection,exchange_name, exchange_type):
    channel = connection.channel()
    channel.exchange_declare(exchange=exchange_name, exchange_type=exchange_type, durable=True)
    return channel

def create_queue(channel, exchange_name, queue_name, routing_key):
    channel.queue_declare(queue=queue_name, durable=True)
    channel.queue_bind(exchange=exchange_name, queue=queue_name, routing_key=routing_key)

def close_connection(connection):
    connection.close()

def setup():
    # Create Connection
    try:
        connection = create_connection(amqp_host, amqp_port)
    except Exception as e:
        print(f"[ERROR] Initiation of RabbitMQ Connection Fail: {e}")

    # Create Exchange
    try:
        channel = create_exchange(connection,exchange_name,exchange_type)
    except Exception as e:
        print(f"[ERROR] Initiation of Charity Exchange Fail: {e}")

    # Create and Bind Queue for Each Charity in Charity Database
    try:
        response = requests.get(f"{CHARITY_ENDPOINT}/GetAllCharityIDName")
        response.raise_for_status()
        for charity in response.json():
            create_queue(
                channel=channel,
                exchange_name=exchange_name,
                queue_name=charity["CharityName"],
                routing_key=f"charity.{charity['ID']}",
            )
    except Exception as e:
        print(f"[ERROR] Unable to reach Charity API: {e}")