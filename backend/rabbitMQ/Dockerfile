# Use a lightweight Python image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy project files
COPY amqp_setup.py .
COPY startAMQP.py .
COPY rabbitMQ_SetUpTest.py .
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Runs tests and ensure all success before launching inventory.py
RUN echo '#!/bin/bash\n\
    python rabbitMQ_SetUpTest.py\n\
    if [ $? -ne 0 ]; then\n\
    echo "rabbitMQ_SetUpTest.py failed"\n\
    exit 1\n\
    fi\n\
    exec python startAMQP.py' > /app/start.sh && chmod +x /app/start.sh

# Run the Flask application
CMD ["/app/start.sh"]
