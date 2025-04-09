FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create listener module structure
RUN mkdir -p /app/listener

# Copy files into module directory
COPY message_listener.py /app/listener/__main__.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create an __init__.py file to make it a proper Python module
RUN touch /app/listener/__init__.py

ENTRYPOINT ["/entrypoint.sh"]