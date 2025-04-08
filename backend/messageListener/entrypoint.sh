#!/bin/sh


CHARITY_ID=${CHARITY_ID:-1}

echo "Starting message listener for charity ID: $CHARITY_ID (Name from ENV: '$CHARITY_NAME')"

# Execute python script passing ONLY the ID argument
python message_listener.py "$CHARITY_ID"