#!/usr/bin/env python3
import pika
import requests

def create_connection(hostname, port, user, password):
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=hostname,
            port=port,
            heartbeat=300,
            blocked_connection_timeout=300,
            credentials=pika.PlainCredentials(user, password)
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

def close_connection(amqp_host):
    connection = pika.BlockingConnection(pika.ConnectionParameters(amqp_host))
    connection.close()

def setup(amqp_host,amqp_port,exchange_name,exchange_type,CHARITY_ENDPOINT,user,password):
    # Create Connection
    try:
        connection = create_connection(amqp_host, amqp_port,user,password)
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