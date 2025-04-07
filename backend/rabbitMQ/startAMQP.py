from amqp_setup import setup
from dotenv import load_dotenv
import os

load_dotenv()

RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "charitymq")
RABBITMQ_PORT = int(os.environ.get("RABBITMQ_PORT", 5672))
EXCHANGE_NAME = os.environ.get("EXCHANGE_NAME", "charity_exchange")
EXCHANGE_TYPE = os.environ.get("EXCHANGE_TYPE", "direct")
CHARITY_ENDPOINT: str = os.getenv('CHARITY_ENDPOINT', "https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI")
RABBITMQ_USER = os.environ.get("RABBITMQ_USER")
RABBITMQ_PASS = os.environ.get("RABBITMQ_PASS")


if __name__ == '__main__':
    setup(RABBITMQ_HOST,RABBITMQ_PORT,
          EXCHANGE_NAME,EXCHANGE_TYPE,CHARITY_ENDPOINT,
          RABBITMQ_USER,RABBITMQ_PASS)