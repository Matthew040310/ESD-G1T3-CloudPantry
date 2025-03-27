import requests

def get_address_by_recipient_id(recipient_id):
    url = f"https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI/GetAddressByRecipientID?RecipientID={recipient_id}"  # Adjust port as needed
    print(f"Calling: {url}")
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        return response.text.strip()
    except Exception as e:
        print(f"Error fetching address for recipient {recipient_id}: {e}")
        return None
