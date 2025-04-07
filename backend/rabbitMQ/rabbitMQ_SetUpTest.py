import unittest
from unittest.mock import patch, MagicMock
import pika
from amqp_setup import *

class TestRabbitMQSetup(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['CHARITY_ENDPOINT'] = "https://mock.charity.api"

    def setUp(self):
        self.mock_connection = MagicMock(spec=pika.BlockingConnection)
        self.mock_channel = MagicMock()
        self.mock_connection.channel.return_value = self.mock_channel

    def test_create_connection_success(self):
        """Test successful RabbitMQ connection"""
        with patch('pika.BlockingConnection') as mock_connection:
            mock_connection.return_value = self.mock_connection
            connection = create_connection("charitymq", 5672)
            self.assertIsInstance(connection, MagicMock)
            mock_connection.assert_called_once_with(
                pika.ConnectionParameters(
                    host="charitymq",
                    port=5672,
                    heartbeat=300,
                    blocked_connection_timeout=300
                )
            )

    def test_create_connection_failure(self):
        """Test connection failure handling"""
        with patch('pika.BlockingConnection', side_effect=Exception("Connection failed")):
            with self.assertRaises(Exception):
                create_connection("invalid_host", 5672)

    def test_create_exchange(self):
        """Test exchange creation with correct parameters"""
        with patch('pika.BlockingConnection') as mock_connection:
            mock_connection.return_value = self.mock_connection
            connection = create_connection("charitymq", 5672)
            channel = create_exchange(connection, "test_exchange", "direct")
            
            self.mock_channel.exchange_declare.assert_called_once_with(
                exchange="test_exchange",
                exchange_type="direct",
                durable=True
            )

    def test_create_queue(self):
        """Test queue creation and binding"""
        test_params = {
            "exchange_name": "test_exchange",
            "queue_name": "test_queue",
            "routing_key": "test.key"
        }
        
        create_queue(self.mock_channel, **test_params)
        
        self.mock_channel.queue_declare.assert_called_once_with(
            queue="test_queue",
            durable=True
        )
        self.mock_channel.queue_bind.assert_called_once_with(
            exchange="test_exchange",
            queue="test_queue",
            routing_key="test.key"
        )

    @patch('requests.get')
    def test_setup_success(self, mock_get):
        """Test full setup process with mock API response"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"ID": 1, "CharityName": "Charity1"},
            {"ID": 2, "CharityName": "Charity2"}
        ]
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        # Mock RabbitMQ connection
        with patch('pika.BlockingConnection') as mock_connection, \
             patch('amqp_setup.create_exchange') as mock_create_exchange:
            
            mock_connection.return_value = self.mock_connection
            mock_create_exchange.return_value = self.mock_channel
            
            setup()
            
            # Verify API call
            mock_get.assert_called_once_with(
                "https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI/GetAllCharityIDName"
            )
            
            # Verify queue creation for each charity
            expected_calls = [
                unittest.mock.call(
                    exchange_name=exchange_name,
                    queue_name="Charity1",
                    routing_key="charity.1"
                ),
                unittest.mock.call(
                    exchange_name=exchange_name,
                    queue_name="Charity2",
                    routing_key="charity.2"
                )
            ]
            self.mock_channel.queue_declare.assert_any_call(
                queue="Charity1", durable=True
            )
            self.mock_channel.queue_bind.assert_any_call(
                exchange=exchange_name,
                queue="Charity1",
                routing_key="charity.1"
            )

if __name__ == '__main__':
    unittest.main()