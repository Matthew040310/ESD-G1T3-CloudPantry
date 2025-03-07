import json
from datetime import datetime, timedelta

def create_request_message(service_id, resource_type, quantity, expiry_seconds=30):
    """Create a resource request message."""
    return json.dumps({
        "type": "request",
        "service_id": service_id,
        "resource_type": resource_type,
        "quantity": quantity,
        "expiry": (datetime.now() + timedelta(seconds=expiry_seconds)).isoformat()
    })

def create_response_message(service_id, request_id, response):
    """Create a response message (Accept/Reject)."""
    return json.dumps({
        "type": "response",
        "service_id": service_id,
        "request_id": request_id,
        "response": response
    })

def is_message_expired(expiry_time):
    """Check if a message has expired."""
    return datetime.now() > datetime.fromisoformat(expiry_time)