FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY notification.py .

EXPOSE 5101

# Use environment variable to set the port
ENV PORT=5101

# Run with Gunicorn for production use
CMD gunicorn --bind 0.0.0.0:$PORT --workers 2 notification:app