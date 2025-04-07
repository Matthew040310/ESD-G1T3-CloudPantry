#!/bin/sh

# Use charity_id from environment variable, or default to 1
CHARITY_ID=${CHARITY_ID:-1}

echo "Starting message listener for charity ID: $CHARITY_ID"
python message_listener.py $CHARITY_ID