#!/bin/sh

# Get charity ID from environment or default to 1
CHARITY_ID=${CHARITY_ID:-1}

# Debug output
echo "Starting message listener for charity ID: $CHARITY_ID (Name: '$CHARITY_NAME')"

# Run the module with charity ID as argument
exec python -m listener "$CHARITY_ID"