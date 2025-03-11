# Use a lightweight Python image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Runs tests and ensure all success before launching inventory.py
RUN echo '#!/bin/bash\n\
python addUpdateDeleteTest.py\n\
if [ $? -ne 0 ]; then\n\
    echo "addUpdateDeleteTest.py failed"\n\
    exit 1\n\
fi\n\
python inventoryTest.py\n\
if [ $? -ne 0 ]; then\n\
    echo "inventoryTest.py failed"\n\
    exit 1\n\
fi\n\
exec python inventory.py' > /app/start.sh && chmod +x /app/start.sh

# Expose Flask API port
EXPOSE 5000

# Run the Flask application
CMD ["/app/start.sh"]
