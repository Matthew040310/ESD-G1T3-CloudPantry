from datetime import datetime, timedelta
import requests
from allocation_logic import get_inventory
import os

# INVENTORY_ENDPOINT = "http://localhost:5006/inventory/" # Charity id to be added in code below, endpoint to be standardised
# EXCESS_INVENTORY_ENDPOINT = "http://localhost:5001/inventory/" # Endpoint to be standardised
INVENTORY_ENDPOINT = os.environ.get("INVENTORY_ENDPOINT", "http://localhost:5006/inventory/")
EXCESS_INVENTORY_ENDPOINT = os.environ.get("EXCESS_INVENTORY_ENDPOINT", "http://localhost:5001/inventory/")
UPDATE_RECIPIENT_ENDPOINT_PART_1 = "https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI/UpdateRecipient?RecipientID=" # To add recipient id
UPDATE_RECIPIENT_ENDPOINT_PART_2 = "&LastDeliveryDate=" # To add date in YYYY-MM-DD

def add_item_to_collated_list(item, item_list):
    # Try to get item ID, ensuring uppercase 'ID'
    item_id = item.get("item_id", item.get("ID", item.get("id")))
    item_id_already_in_list = False

    for existing_item in item_list:
        # Check for ID variations
        existing_item_id = existing_item.get("item_id", existing_item.get("ID", existing_item.get("id")))
        if existing_item_id == item_id:
            item_id_already_in_list = True
            existing_item["quantity"] += item.get("quantity", 0)
            break

    if not item_id_already_in_list:
        # Normalize the item to use uppercase 'ID'
        normalized_item = item.copy()
        
        # Ensure 'ID' is used instead of 'id' or 'item_id'
        if "id" in normalized_item:
            normalized_item["ID"] = normalized_item.pop("id")
        elif "item_id" in normalized_item:
            normalized_item["ID"] = normalized_item.pop("item_id")
        
        # Ensure quantity is set
        if "quantity" not in normalized_item:
            normalized_item["quantity"] = 0
        
        item_list.append(normalized_item)
    
    return item_list


def get_items_to_send_dict(allocation_list):
    collated_items_to_send_dict = []
    for allocation in allocation_list:
        items_sending_to_recipient = allocation.get("items", [])
        for item in items_sending_to_recipient:
            collated_items_to_send_dict = add_item_to_collated_list(item, collated_items_to_send_dict)
    return collated_items_to_send_dict

def transform_excess_items(excess_items_list):
    """
    Transform excess items to match Supabase expected format
    """
    transformed_items = []
    for item in excess_items_list:
        # Create item dictionary matching the endpoint's expected structure
        item_dict = {}
        
        # Map keys exactly as the endpoint expects
        item_dict['ID'] = (item.get('ID') or 
                            item.get('id') or 
                            item.get('item_id'))
        
        item_dict['name'] = (item.get('name') or 
                              item.get('Name') or 
                              f"Item {item_dict['ID']}")
        
        item_dict['category'] = (item.get('category') or 
                                  item.get('Category') or 
                                  'Uncategorized')
        
        item_dict['type'] = (item.get('type') or 
                              item.get('Type') or 
                              'Unknown')
        
        item_dict['expiry_date'] = (item.get('expiry_date') or 
                                     item.get('expiryDate') or 
                                     item.get('expiry'))
        
        item_dict['quantity'] = item.get('quantity', 0)
        
        item_dict['fill_factor'] = item.get('fill_factor', 0)
        
        # Handle restrictions with capitalization
        restrictions = item.get('restrictions') or item.get('Restrictions') or []
        item_dict['restrictions'] = (
            [str(r).capitalize() for r in restrictions] 
            if restrictions is not None 
            else None
        )
        
        # Validate minimum required fields
        if not item_dict['ID']:
            print(f"Skipping item due to missing ID: {item}")
            continue
        
        transformed_items.append(item_dict)
    
    return transformed_items

def update_excess_inventory_database(charity_id, excess_items_list):
    # full_endpoint = f"http://localhost:5001/inventory/{charity_id}"
    full_endpoint = INVENTORY_ENDPOINT + str(charity_id)

    
    # Debug the incoming raw data
    print("Raw excess items:")
    import json
    print(json.dumps(excess_items_list, indent=2))
    
    # Manual transformation with explicit name handling
    normalized_excess_items = []
    for item in excess_items_list:
        normalized_item = {}
        
        # CRITICAL: Explicitly handle ID in the format expected by the API ('ID')
        normalized_item['ID'] = item.get('ID') or item.get('id') or item.get('item_id')
        
        # CRITICAL: Ensure name field is non-null
        normalized_item['name'] = item.get('name')
        if normalized_item['name'] is None:
            # Fallback options for name
            normalized_item['name'] = (item.get('Name') or 
                                       f"Item {normalized_item['ID']}")
        
        # Ensure name is a string
        normalized_item['name'] = str(normalized_item['name'])
        
        # Copy other fields directly
        normalized_item['category'] = item.get('category', 'Uncategorized')
        normalized_item['type'] = item.get('type', 'Unknown')
        normalized_item['expiry_date'] = item.get('expiry_date')
        normalized_item['quantity'] = item.get('quantity', 0)
        normalized_item['fill_factor'] = item.get('fill_factor', 0)
        
        # Handle restrictions
        restrictions = item.get('restrictions')
        if restrictions is not None:
            normalized_item['restrictions'] = [str(r).capitalize() 
                                              for r in restrictions 
                                              if r is not None]
        else:
            normalized_item['restrictions'] = None
        
        # Add to list if we have an ID
        if normalized_item['ID']:
            normalized_excess_items.append(normalized_item)
    
    if not normalized_excess_items:
        print("No valid excess items to update")
        return {
            "code": 200,
            "message": "No excess items to update"
        }
    
    # Debug the exact payload being sent
    print("Normalized excess items (EXACT PAYLOAD):")
    print(json.dumps(normalized_excess_items, indent=2))
    
    try:
        response = requests.put(
            full_endpoint, 
            json=normalized_excess_items
        )
        
        # Debug response
        print(f"Excess inventory update response status: {response.status_code}")
        print(f"Excess inventory update response content: {response.text}")
        
        data = response.json()
        return data
    except requests.exceptions.RequestException as e:
        error_message = f"Error updating excess inventory database: {str(e)}"
        print(error_message)
        return {
            "code": 500,
            "message": error_message
        }
    except Exception as e:
        error_message = f"Unexpected error updating excess inventory: {str(e)}"
        print(error_message)
        return {
            "code": 500,
            "message": error_message
        }

def update_inventory_database(charity_id, allocation_list):
    # full_endpoint = f"http://localhost:5006/inventory/{charity_id}"
    full_endpoint = EXCESS_INVENTORY_ENDPOINT + str(charity_id)

    
    try:
        all_charity_items = get_inventory(charity_id)
        
        # Collect items to send across all allocations
        collated_items_to_send = []
        for allocation in allocation_list:
            items_sending_to_recipient = allocation.get('items', [])
            collated_items_to_send.extend(items_sending_to_recipient)
        
        # Collate items by their ID
        items_to_update = {}
        for item in collated_items_to_send:
            # Get item ID from any format
            item_id = item.get('ID') or item.get('id') or item.get('item_id')
            quantity = item.get('quantity', 0)
            
            if not item_id:
                print(f"Skipping item due to missing ID: {item}")
                continue
            
            if item_id in items_to_update:
                items_to_update[item_id]['quantity'] += quantity
            else:
                items_to_update[item_id] = {
                    'ID': item_id,  # Keep this format as your API expects 'ID'
                    'quantity': quantity,
                    'name': item.get('name') or f"Item {item_id}"
                }
        
        # Prepare items to update in the database
        items_to_update_list = []
        for old_item in all_charity_items:
            # Get item ID from old item in any format
            item_id = old_item.get('ID') or old_item.get('id') or old_item.get('item_id')
            
            if item_id in items_to_update:
                send_item = items_to_update[item_id]
                new_quantity = int(old_item.get('quantity', 0)) - int(send_item.get('quantity', 0))
                updated_item = old_item.copy()
                
                # CRITICAL: Ensure ID is in the correct format expected by the API
                updated_item['ID'] = item_id  # Keep uppercase 'ID' as that's what your endpoint expects
                
                # Ensure name is non-null (critical field)
                updated_item['name'] = old_item.get('name') or send_item.get('name') or f"Item {item_id}"
                
                # Update quantity
                updated_item['quantity'] = max(new_quantity, 0)
                
                items_to_update_list.append(updated_item)
        
        if not items_to_update_list:
            print("No items to update in inventory")
            return {
                "code": 200,
                "message": "No inventory items to update"
            }
        
        # Debug: Print the exact items being sent to the API
        print("Items to update in inventory (EXACT PAYLOAD):")
        import json
        print(json.dumps(items_to_update_list, indent=2))
        
        # Final check to ensure all required fields are present
        for item in items_to_update_list:
            # Ensure 'ID' is present (your API maps this to 'id')
            if 'ID' not in item or item['ID'] is None:
                print(f"Warning: Missing ID in item {item}")
                item['ID'] = item.get('id') or item.get('item_id') or str(hash(str(item)))
            
            # Ensure 'name' field is present and non-null
            if 'name' not in item or item['name'] is None:
                print(f"Warning: Missing name in item {item}")
                item['name'] = f"Item {item.get('ID')}"
        
        response = requests.put(
            full_endpoint, 
            json=items_to_update_list
        )
        
        # Debug: Print response details
        print(f"Inventory update response status: {response.status_code}")
        print(f"Inventory update response content: {response.text}")
        
        data = response.json()
        return data
    
    except requests.exceptions.RequestException as e:
        error_message = f"Error updating inventory database: {str(e)}"
        print(error_message)
        return {
            "code": 500,
            "message": error_message
        }
    except Exception as e:
        error_message = f"Unexpected error updating inventory: {str(e)}"
        print(error_message)
        return {
            "code": 500,
            "message": error_message
        }
    
def update_recipients_last_delivery_date(allocation_list, delivery_date):
    if len(allocation_list) < 1:
        return 
    
    for allocation in allocation_list:
        recipient_id = allocation["recipient_id"]
        full_endpoint = UPDATE_RECIPIENT_ENDPOINT_PART_1 + str(recipient_id) + UPDATE_RECIPIENT_ENDPOINT_PART_2 + delivery_date
        try: 
            response = requests.post(
                full_endpoint
            )
            return {
                "code": 200, 
                "message": "success"
            }

        except requests.exceptions.RequestException as e:
            error_message = f"Error updating recipient database: {str(e)}"
            print(error_message)
            return {
                "code": 500,
                "message": error_message
            }