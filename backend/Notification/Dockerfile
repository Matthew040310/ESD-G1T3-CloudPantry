# Use a lightweight Python image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy project files
COPY addUpdateDeleteTest.py .
COPY notification.py .
COPY notificationTest.py .
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Runs tests and ensure all success before launching inventory.py
RUN echo '#!/bin/bash\n\
python addUpdateDeleteTest.py\n\
if [ $? -ne 0 ]; then\n\
    echo "addUpdateDeleteTest.py failed"\n\
    exit 1\n\
fi\n\
python notificationTest.py\n\
if [ $? -ne 0 ]; then\n\
    echo "notificationTest.py failed"\n\
    exit 1\n\
fi\n\
exec python notification.py' > /app/start.sh && chmod +x /app/start.sh

# Run the Flask application
CMD ["/app/start.sh"]
