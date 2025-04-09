from datetime import datetime, timedelta
from collections import defaultdict
import requests
import os
from copy import deepcopy

# [... Keep existing imports and global variables ...]
# Endpoints to call inventory & excess inventory
# INVENTORY_ENDPOINT = "http://0.0.0.0:5006/inventory/" # Charity id to be added in code below, endpoint to be standardised
# EXCESS_INVENTORY_ENDPOINT = "http://0.0.0.0:5001/inventory/" # Endpoint to be standardised
# CHARITY_RECIPIENT_ENDPOINT = "https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI/GetRecipientByCharityID?CharityID="
# ROUTE_ENDPOINT = "http://route-optimizer:5003/route_from_charity"

INVENTORY_ENDPOINT = os.environ.get("INVENTORY_ENDPOINT", "http://0.0.0.0:5006/inventory/")
EXCESS_INVENTORY_ENDPOINT = os.environ.get("EXCESS_INVENTORY_ENDPOINT", "http://0.0.0.0:5001/inventory/")
CHARITY_RECIPIENT_ENDPOINT = os.environ.get("CHARITY_RECIPIENT_ENDPOINT", "https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI/GetRecipientByCharityID?CharityID=")
ROUTE_ENDPOINT = os.environ.get("ROUTE_ENDPOINT", "http://0.0.0.0:5003/route_from_charity")

# For calculating increase in demand with change in household size (dependents)
SCALING_FACTORS = {
    "Carbs": 0,      # Add 20% per dependent beyond the first person
    "Protein": 0.5,    # Add 20% per dependent beyond the first person
    "Fats": 0,       # Add 10% per dependent beyond the first person
    "Vegetables": 0.5, # Add 20% per dependent beyond the first person
    "Seasoning": 0  # Add 10% per dependent beyond the first person
}

# Define quantity-based allocation per category and type for each income level
QUANTITY_TARGETS = {
    "low": {   # < $20k
        ("Pasta & Grains", "Carbs"): 1,
        ("Canned Goods", "Protein"): 4,
        ("Canned Goods", "Vegetables"): 5,
        ("Cooking Essentials", "Fats"): 1,
        ("Cooking Essentials", "Seasoning"): 2,
        ("Baby Food", "Carbs"): 3,
        ("Baby Food", "Protein"): 3
    },
    "medium": { # $20k-$30k
        ("Pasta & Grains", "Carbs"): 1,
        ("Canned Goods", "Protein"): 3,
        ("Canned Goods", "Vegetables"): 4,
        ("Cooking Essentials", "Fats"): 1,
        ("Cooking Essentials", "Seasoning"): 1,
        ("Baby Food", "Carbs"): 2,
        ("Baby Food", "Protein"): 2
    },
    "high": {   # > $30k
        ("Pasta & Grains", "Carbs"): 1,
        ("Canned Goods", "Protein"): 2,
        ("Canned Goods", "Vegetables"): 3,
        ("Cooking Essentials", "Fats"): 1,
        ("Cooking Essentials", "Seasoning"): 1,
        ("Baby Food", "Carbs"): 1,
        ("Baby Food", "Protein"): 1
    }
}

# Define income-based filling score targets (monthly household income)
# We keep these for compatibility with the rest of the code structure
INCOME_TARGETS = {
    "low": {   # < $20k
        "Carbs": 30,    # Target filling score for carbs
        "Protein": 40,  # Target filling score for protein
        "Fats": 10,      # Target filling score for fat
        "Vegetables": 60, # Target filling score for vegetables
        "Seasoning": 5  # Target filling score for seasoning
    },
    "medium": { # $20k-$30k
        "Carbs": 30,
        "Protein": 30,
        "Fats": 10,
        "Vegetables": 40,
        "Seasoning": 5
    },
    "high": {   # > $30k
        "Carbs": 30,
        "Protein": 20,
        "Fats": 10,
        "Vegetables": 30,
        "Seasoning": 5
    }
}

# Define special allocation rules for charity categories
CHARITY_CATEGORY_RULES = {
    "Baby Food": {
        "required": "has_baby",  # Only allocate to recipients with babies
        "max_items": 6           # Maximum number of baby food items per recipient
    }
}

# Mapping from nutrition types to charity categories
NUTRITION_TO_CHARITY_CATEGORY = {
    "Protein": "Canned Goods",
    "Carbs": "Pasta & Grains",
    "Fats": "Cooking Essentials",
    "Vegetables": "Canned Goods",
    "Seasoning": "Cooking Essentials"
}

def days_between(date_str1, date_str2):
    date1 = datetime.strptime(date_str1, "%Y-%m-%d").date()
    date2 = datetime.strptime(date_str2, "%Y-%m-%d").date()
    return (date2 - date1).days  # Returns negative if date1 > date2

def get_route_info(charity_id, recipients_ids):
    try: 
        # Ensure recipients_ids is a list of integers
        if not isinstance(recipients_ids, list):
            recipients_ids = [recipients_ids]
        
        # Convert to list of integers
        recipients_ids = [int(id) for id in recipients_ids]
        
        # Prepare payload exactly as you used in Postman
        payload = {
            'charity_id': charity_id,
            'recipient_ids': recipients_ids
        }
        
        # Use GET method with json payload
        response = requests.get(
            ROUTE_ENDPOINT, 
            json=payload
        )
        
        response.raise_for_status()
        data = response.json()
        return data
    except requests.exceptions.RequestException as e:
        print(f"Error fetching route: {e}")
        print(f"Response content: {e.response.text if hasattr(e, 'response') else 'No response'}")
        return {}  # Return an empty dict instead of None

def get_recipients(charity_id):
    # endpoint to get recipients, to be added
    full_endpoint = CHARITY_RECIPIENT_ENDPOINT + str(charity_id)
    try:
        response = requests.get(full_endpoint)
        response.raise_for_status()
        data = response.json()
        # Extract the inventory items from the nested structure
        # if isinstance(data, dict) and "data" in data and "response" in data["data"]:
        #     return data["data"]["response"]
        return data  # If not, return as is
    except requests.exceptions.RequestException as e:
        print(f"Error fetching recipients: {e}")
        return None

def get_inventory(charity_id):
    full_endpoint = INVENTORY_ENDPOINT + str(charity_id)
    try:
        response = requests.get(full_endpoint)
        response.raise_for_status()
        data = response.json()
        # Extract the inventory items from the nested structure
        if isinstance(data, dict) and "data" in data and "response" in data["data"]:
            return data["data"]["response"]
        return data  # If not, return as is
    except requests.exceptions.RequestException as e:
        print(f"Error fetching inventory: {e}")
        return None
    
def get_excess_inventory():
    full_endpoint = EXCESS_INVENTORY_ENDPOINT[:len(EXCESS_INVENTORY_ENDPOINT)-1]
    try:
        response = requests.get(full_endpoint)
        response.raise_for_status()
        data = response.json()
        # Extract the inventory items from the nested structure
        if isinstance(data, dict) and "data" in data and "response" in data["data"]:
            return data["data"]["response"]
        return data  # If not, return as is
    except requests.exceptions.RequestException as e:
        print(f"Error fetching excess inventory: {e}")
        return None

def normalize_recipient(recipient):
    """
    Normalize the recipient data to match the existing internal format
    """
    normalized = {
        "id": recipient.get("ID", ""),  # Using Name as fallback ID if no specific ID
        "name": recipient.get("Name", ""),
        "address": recipient.get("Address", ""),
        "phone_number": recipient.get("PhoneNumber", ""),
        "household_avg_income": recipient.get("AvgIncome", 0),
        "calorie_requirement": recipient.get("CalorieRequirement", 0),
        "dependents": recipient.get("Dependents", 0),
        "has_baby": recipient.get("HasBaby", "false"),
        "dietary_restriction": recipient.get("DietaryRestriction", []), 
        "last_delivery_date": recipient.get("LastDeliveryDate", "2015-05-05")
    }
    
    return normalized

def is_compatible(item, recipient):
    """Check if an item is compatible with a recipient's dietary restrictions"""
    # First, handle None or empty dietary restrictions
    if not recipient.get("dietary_restriction"):
        return True
    elif recipient.get("dietary_restriction") == [""]:
        return True
        
    # Normalize restrictions to list and lowercase
    restrictions_list = recipient["dietary_restriction"] if isinstance(recipient["dietary_restriction"], list) else []
    restrictions_list = [r.lower() for r in restrictions_list]
    
    # Get item restrictions
    item_restrictions = item.get("restrictions", [])
    if item_restrictions is None:
        item_restrictions = []
    
    # Check dietary restrictions
    if "halal" in restrictions_list and "Halal" not in item_restrictions:
        return False
    if "kosher" in restrictions_list and "Kosher" not in item_restrictions:
        return False
    if "vegetarian" in restrictions_list and item["type"] == "Protein" and "meat" in item["name"].lower():
        # If it's protein and has meat in the name, check if it's marked as vegetarian
        if "Vegetarian" not in item_restrictions:
            return False
    
    # Check special charity category rules
    category = item["category"]
    if category in CHARITY_CATEGORY_RULES:
        required_attribute = CHARITY_CATEGORY_RULES[category].get("required")
        if required_attribute and not recipient.get(required_attribute.replace("has_", "")) == "true":
            return False
            
    return True

def calculate_filling_shortages(recipients, allocations):
    """Calculate shortages in quantity targets for each recipient"""
    quantity_shortages = []
    
    # Check each allocation against targets
    for allocation in allocations:
        recipient = next(r for r in recipients if r["id"] == allocation["recipient_id"])
        income = recipient["household_avg_income"]
        income_level = "low" if income < 1000 else "high" if income > 2000 else "medium"
        
        # Calculate target quantities including dependents
        dependents_count = recipient["dependents"]
        
        # Create a dict to track allocated quantities by category and type
        allocated_quantities = defaultdict(int)
        for item in allocation["items"]:
            key = (item["charity_category"], item["type"])
            allocated_quantities[key] += item["quantity"]
        
        # Calculate shortages for each category-type combination
        for key, base_quantity in QUANTITY_TARGETS[income_level].items():
            category, nutrition_type = key
            
            # Skip Baby Food for recipients without babies
            if category == "Baby Food" and recipient.get("has_baby") != "true":
                continue
                
            # Apply scaling for dependents
            target_quantity = base_quantity
            if dependents_count > 0:
                additional_quantity = base_quantity * SCALING_FACTORS[nutrition_type] * dependents_count
                target_quantity += round(additional_quantity)
            
            # Calculate shortage
            actual_quantity = allocated_quantities[key]
            if actual_quantity < target_quantity:
                quantity_shortages.append({
                    "recipient_id": recipient["id"],
                    "charity_category": category,
                    "type": nutrition_type,
                    "quantity_needed": target_quantity - actual_quantity,
                    # Keep these fields for compatibility with existing code
                    "target_score": target_quantity * 10,  # Convert to fill factor equivalent
                    "actual_score": actual_quantity * 10,  # Convert to fill factor equivalent
                    "shortfall": (target_quantity - actual_quantity) * 10  # Convert to fill factor equivalent
                })
    
    return quantity_shortages

def find_excess_matches(shortage_list, target_charity_id):
    """Find matches for shortages in excess inventory from other charities"""
    # Actual excess_inventory
    excess_inventory = get_excess_inventory()
    
    # If no excess inventory is found, return empty list
    if not excess_inventory:
        return []
    
    # Create a mapping of shortages by recipient, category and type for tracking
    recipient_shortages = defaultdict(lambda: defaultdict(int))
    for shortage in shortage_list:
        recipient_id = shortage["recipient_id"]
        key = (shortage["charity_category"], shortage["type"])
        quantity = shortage["quantity_needed"]
        recipient_shortages[recipient_id][key] += quantity
    
    # Group excess inventory by charity
    charity_excess = defaultdict(list)
    for item in excess_inventory:
        charity_id = item.get("charityID")
        if item["quantity"] > 0 and charity_id != target_charity_id:
            charity_excess[charity_id].append(item)


    # Debug
    # print(charity_excess)
    
    # Find charities that can help with shortages
    charitable_matches = []
    
    for charity_id, items in charity_excess.items():
        matching_items = []
        
        # Create a working copy of shortages for this charity
        current_shortages = deepcopy(recipient_shortages)
        
        # Sort items by expiry date (earliest first)
        sorted_items = sorted(items, key=lambda x: x["expiry_date"])
        
        for item in sorted_items:
            category = item["category"]
            nutrition_type = item["type"]
            item_key = (category, nutrition_type)
            
            # Find recipients who need this category and type
            recipients_needing_this = [
                r_id for r_id, needs in current_shortages.items() 
                if needs[item_key] > 0
            ]
            
            if recipients_needing_this:
                available_quantity = item["quantity"]
                quantity_to_take = 0
                
                # Distribute among recipients needing this item
                for recipient_id in recipients_needing_this:
                    if available_quantity <= 0:
                        break
                        
                    needed_quantity = current_shortages[recipient_id][item_key]
                    
                    if needed_quantity > 0:
                        # Take the minimum of what's needed and what's available
                        take_amount = min(needed_quantity, available_quantity)
                        
                        # Update tracking
                        current_shortages[recipient_id][item_key] -= take_amount
                        available_quantity -= take_amount
                        quantity_to_take += take_amount
                
                if quantity_to_take > 0:
                    # Add to matching items with the appropriate quantity
                    matching_items.append({
                        "item_id": item["id"],
                        "name": item["name"],
                        "category": category,
                        "type": nutrition_type,
                        "quantity": quantity_to_take,
                        "fill_factor": item["fill_factor"],  # Keep for compatibility with existing code
                        "expiry_date": item["expiry_date"],
                        "original_quantity": item["quantity"], 
                        "restrictions": item["restrictions"]
                    })
        
        # Only add charities that have items we need
        if matching_items:
            charitable_matches.append({
                "charity_id": charity_id,
                "items": matching_items
            })
    
    return charitable_matches

def allocate_resources(charity_id, delivery_date):
    """Allocate food items to recipients based on their needs and dietary restrictions"""

    message = ""

    recipients = get_recipients(charity_id)
    # Normalize recipients
    normalized_recipients = [normalize_recipient(r) for r in recipients]

    # Filter out recipients
    normalized_recipients = [r for r in normalized_recipients if days_between(r["last_delivery_date"], delivery_date) >= 7]

    # Actual inventory 
    inventory = get_inventory(charity_id)
    
    # Categorize inventory by category and type with expiry sorting
    inventory_pool = defaultdict(list)
    for item in inventory:
        key = (item["category"], item["type"])
        inventory_pool[key].append(item)
    
    # Sort each category-type combination by expiry date and quantity
    for key in inventory_pool:
        inventory_pool[key] = sorted(
            inventory_pool[key],
            key=lambda x: (x["expiry_date"], -x["quantity"])
        )

    # Track charity category allocations
    charity_category_counts = defaultdict(lambda: defaultdict(int))
    
    allocations = []
    # Sort recipients by income (prioritize lower income)
    for recipient in sorted(normalized_recipients, key=lambda x: x["household_avg_income"]):
        # Determine package based on income
        income = recipient["household_avg_income"]
        income_level = "low" if income < 1000 else "high" if income > 2000 else "medium"
        
        # Calculate target quantities including dependents
        dependents_count = recipient["dependents"]

        # Initialize allocation structure
        allocation = {
            "recipient_id": recipient["id"],
            "dependents": recipient["dependents"],
            "items": [],
            "filling_scores": {nutrition_type: 0 for nutrition_type in INCOME_TARGETS[income_level]}
        }
        used_items = set()  # Track items to prevent duplicates
        
        # For each category-type combination in our targets
        for key, base_quantity in QUANTITY_TARGETS[income_level].items():
            category, nutrition_type = key
            
            # Skip Baby Food for recipients without babies
            if category == "Baby Food" and recipient.get("has_baby") != "true":
                continue
                
            # Apply scaling for dependents
            target_quantity = base_quantity
            if dependents_count > 0:
                additional_quantity = base_quantity * SCALING_FACTORS[nutrition_type] * dependents_count
                target_quantity += round(additional_quantity)
            
            # Get compatible items for this category and type
            compatible_items = [
                i for i in inventory_pool.get((category, nutrition_type), [])
                if is_compatible(i, recipient) 
                and i["quantity"] > 0
                and i["name"] not in used_items
            ]
            
            allocated_quantity = 0
            
            # Allocate items to reach target quantity
            for item in compatible_items:
                # Check if we've reached the target quantity
                if allocated_quantity >= target_quantity:
                    break
                
                # Check charity category rules
                if category in CHARITY_CATEGORY_RULES:
                    max_items = CHARITY_CATEGORY_RULES[category].get("max_items", float('inf'))
                    if charity_category_counts[recipient["id"]][category] >= max_items:
                        continue
                
                # Calculate how many more items we need
                quantity_needed = target_quantity - allocated_quantity
                quantity_to_allocate = min(item["quantity"], quantity_needed)
                
                # Apply charity category limits
                if category in CHARITY_CATEGORY_RULES:
                    max_items = CHARITY_CATEGORY_RULES[category].get("max_items", float('inf'))
                    current_count = charity_category_counts[recipient["id"]][category]
                    quantity_to_allocate = min(quantity_to_allocate, max_items - current_count)
                
                if quantity_to_allocate > 0:
                    allocation["items"].append({
                        "item_id": item["id"],
                        "quantity": quantity_to_allocate,
                        "name": item["name"],
                        "fill_factor": item["fill_factor"],  # Keep for compatibility
                        "type": nutrition_type,
                        "charity_category": category
                    })
                    
                    # Update item quantity and tracking
                    allocated_quantity += quantity_to_allocate
                    item["quantity"] -= quantity_to_allocate
                    used_items.add(item["name"])
                    
                    # Update charity category counts
                    charity_category_counts[recipient["id"]][category] += quantity_to_allocate
                    
                    # Update filling scores (for compatibility with the rest of the code)
                    allocation["filling_scores"][nutrition_type] += quantity_to_allocate * item["fill_factor"]
        
        allocations.append(allocation)
    
    # Calculate excess/shortage
    excess = [i for i in inventory if i["quantity"] > 0]
    shortage = calculate_filling_shortages(normalized_recipients, allocations)
    
    # Find potential charities with excess inventory that matches our shortages
    potential_charities = find_excess_matches(shortage, charity_id)

    # Filter out recipients with no items (if any)
    empty_allocations = [a for a in allocations if (len(a["items"]) == 0)]

    # Filter out allocations with at least one item
    allocations = [a for a in allocations if (len(a["items"]) > 0)]

    recipient_ids = [a['recipient_id'] for a in allocations]
    
    route_info = []
    if len(recipient_ids) > 0:
        route_info = get_route_info(charity_id, recipient_ids)
        message = "success"
    else: 
        route_info = [{"message": "No recipients"}]
        message = "No recipients scheduled to receive items on specified date"
    
    # Sort allocations into optimised order
    sorted_allocations = []
    if "optimised_indices" in route_info:
        indices = route_info["optimised_indices"]
        for i in range(1, len(indices) - 1):
            index = int(indices[i] - 1)
            sorted_allocations.append(allocations[index])
    else: 
        sorted_allocations = allocations

    return sorted_allocations, excess, shortage, potential_charities, route_info, message, empty_allocations