FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create listener module structure
RUN mkdir -p /app/listener

# Copy files into module directory
COPY message_listener.py /app/listener/__main__.py

# Create an __init__.py file to make it a proper Python module
RUN touch /app/listener/__init__.py

# Set the shell command directly
SHELL ["/bin/bash", "-c"]
CMD echo "Starting message listener for charity ID: ${CHARITY_ID:-1} (Name: '${CHARITY_NAME}')" && python -m listener ${CHARITY_ID:-1}