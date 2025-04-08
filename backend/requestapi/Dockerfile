# requestapi/Dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5199
CMD ["gunicorn", "--bind", "0.0.0.0:5199", "-u", "root", "request_api:app"]