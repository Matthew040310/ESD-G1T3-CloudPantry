import schedule
import time
from onemap import get_onemap_token

def refresh_token_job():
    get_onemap_token()

schedule.every(70).hours.do(refresh_token_job)

def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(60)

import threading
threading.Thread(target=run_scheduler, daemon=True).start()
