from amqp_setup import setup
from dotenv import load_dotenv
import os

load_dotenv()

amqp_host = "charitymq"
amqp_port = 5672
exchange_name = "charity_exchange"
exchange_type = "direct"
CHARITY_ENDPOINT: str = os.getenv('CHARITY_ENDPOINT', "https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI")

if __name__ == '__main__':
    setup(amqp_host,amqp_port,exchange_name,exchange_type,CHARITY_ENDPOINT)