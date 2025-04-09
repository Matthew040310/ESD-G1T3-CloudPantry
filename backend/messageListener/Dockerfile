FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your main script directly
COPY message_listener.py /app/

# Use shell form of CMD for environment variable support
CMD CHARITY_ID=${CHARITY_ID:-1} && echo "Starting message listener for charity ID: $CHARITY_ID (Name from ENV: '$CHARITY_NAME')" && python message_listener.py "$CHARITY_ID"