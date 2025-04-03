FROM python:3.9-slim

WORKDIR /app

# Copy the requirements first (for better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY allocate_resources.py .
COPY allocation_logic.py .
COPY sending_logic.py .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["python", "allocate_resources.py"]