from datetime import datetime, timedelta
from collections import defaultdict
import requests
import os

# [... Keep existing imports and global variables ...]
# Endpoints to call inventory & excess inventory
# INVENTORY_ENDPOINT = "http://0.0.0.0:5006/inventory/" # Charity id to be added in code below, endpoint to be standardised
# EXCESS_INVENTORY_ENDPOINT = "http://0.0.0.0:5001/inventory/" # Endpoint to be standardised
# CHARITY_RECIPIENT_ENDPOINT = "https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI/GetRecipientByCharityID?CharityID="
# ROUTE_ENDPOINT = "http://0.0.0.0:5003/route_from_recipients"
INVENTORY_ENDPOINT = os.environ.get("INVENTORY_ENDPOINT", "http://0.0.0.0:5006/inventory/")
EXCESS_INVENTORY_ENDPOINT = os.environ.get("EXCESS_INVENTORY_ENDPOINT", "http://0.0.0.0:5001/inventory/")
CHARITY_RECIPIENT_ENDPOINT = os.environ.get("CHARITY_RECIPIENT_ENDPOINT", "https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI/GetRecipientByCharityID?CharityID=")
ROUTE_ENDPOINT = os.environ.get("ROUTE_ENDPOINT", "http://0.0.0.0:5003/route_from_recipients")

# from fake_data3 import current_inventory_list, recipient_list # Just for testing


# For calculating increase in demand with change in household size (dependents)
SCALING_FACTORS = {
    "Carbs": 0,       # Does not change with household size
    "Protein": 1.0,  # Scales fully with household size
    "Fats": 0,        # Does not change with household size
    "Vegetables": 0.5, # Add 50% per dependent beyond the first person
    "Seasonings": 0   # Does not change with household size
}

# Define income-based filling score targets (monthly household income)
INCOME_TARGETS = {
    "low": {   # < $20k
        "Carbs": 30,    # Target filling score for carbs
        "Protein": 80,  # Target filling score for protein
        "Fats": 10,      # Target filling score for fat
        "Vegetables": 60, # Target filling score for vegetables
        "Seasonings": 5  # Target filling score for seasonings
    },
    "medium": { # $20k-$30k
        "Carbs": 30,
        "Protein": 60,
        "Fats": 10,
        "Vegetables": 40,
        "Seasonings": 5
    },
    "high": {   # > $30k
        "Carbs": 30,
        "Protein": 40,
        "Fats": 10,
        "Vegetables": 30,
        "Seasonings": 5
    }
}

# Define special allocation rules for charity categories
CHARITY_CATEGORY_RULES = {
    "Baby Food": {
        "required": "has_baby",  # Only allocate to recipients with babies
        "max_items": 3           # Maximum number of baby food items per recipient
    }
}

# Mapping from nutrition types to charity categories
NUTRITION_TO_CHARITY_CATEGORY = {
    "Protein": "Canned Goods",
    "Carbs": "Pasta & Grains",
    "Fats": "Cooking Essentials",
    "Vegetables": "Canned Goods",
    "Seasonings": "Cooking Essentials"
}

def days_between(date_str1, date_str2):
    date1 = datetime.strptime(date_str1, "%Y-%m-%d").date()
    date2 = datetime.strptime(date_str2, "%Y-%m-%d").date()
    return (date2 - date1).days  # Returns negative if date1 > date2

def get_route_info(recipients_ids):
    try: 
        # Ensure recipients_ids is a list of integers
        if not isinstance(recipients_ids, list):
            recipients_ids = [recipients_ids]
        
        # Convert to list of integers
        recipients_ids = [int(id) for id in recipients_ids]
        
        # Prepare payload exactly as you used in Postman
        payload = {
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
    
def get_excess_inventory(charity_id):
    full_endpoint = EXCESS_INVENTORY_ENDPOINT + str(charity_id)
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
        "last_delivery_date": recipient.get("LastDeliveryDate", "2025-05-05")
    }
    
    return normalized

def is_compatible(item, recipient):
    """Check if an item is compatible with a recipient's dietary restrictions"""
    # First, handle None or empty dietary restrictions
    if not recipient.get("dietary_restriction"):
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
        False
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

def calculate_filling_shortages(recipients, allocations, targets):
    """Calculate shortages in filling scores for each recipient"""
    nutrition_shortages = []
    
    # Check each allocation against targets
    for allocation in allocations:
        recipient = next(r for r in recipients if r["id"] == allocation["recipient_id"])
        income = recipient["household_avg_income"]
        income_level = "low" if income < 20000 else "high" if income > 30000 else "medium"
        
        # Calculate target scores including dependents
        dependents_count = recipient["dependents"] + 1  # +1 to include the recipient

        target_scores = {}
        for nutrition_type, base_score in INCOME_TARGETS[income_level].items():
            # Base score for the recipient themselves
            score = base_score
            
            # Add additional amount for each dependent based on scaling factor
            if dependents_count > 0:
                additional_score = base_score * SCALING_FACTORS[nutrition_type] * dependents_count
                score += additional_score
            
            target_scores[nutrition_type] = score
        
        # Find shortfalls in filling scores
        for nutrition_type, target in target_scores.items():
            actual = allocation["filling_scores"].get(nutrition_type, 0)
            if actual < target:
                nutrition_shortages.append({
                    "type": nutrition_type,
                    "recipient_id": recipient["id"],
                    "target_score": target,
                    "actual_score": actual,
                    "shortfall": target - actual
                })
    
    # Convert nutrition shortages to charity category shortages
    charity_shortages = []
    
    for shortage in nutrition_shortages:
        nutrition_type = shortage["type"]
        recipient_id = shortage["recipient_id"]
        shortfall = shortage["shortfall"]
        
        # Convert to charity category
        charity_category = NUTRITION_TO_CHARITY_CATEGORY.get(nutrition_type)
        
        # Calculate quantity needed (floor division by 5)
        quantity_needed = shortfall // 5
        
        # Only add if quantity needed is greater than 0
        if quantity_needed > 0:
            charity_shortages.append({
                "recipient_id": recipient_id,
                "charity_category": charity_category,
                "type": nutrition_type,
                "quantity_needed": quantity_needed
            })
    
    return charity_shortages

def find_excess_matches(shortage_list, target_charity_id):
    """Find matches for shortages in excess inventory from other charities"""
    # Actual excess_inventory
    excess_inventory = get_excess_inventory(target_charity_id)

    # Just for testing
    # excess_inventory = current_inventory_list
    
    # Group excess inventory by charity
    charity_excess = defaultdict(list)
    for item in excess_inventory:
        charity_id = item.get("charityID")
        if item["quantity"] > 0 and charity_id != target_charity_id:
            charity_excess[charity_id].append(item)
    
    # Create a summary of what we need by category and nutrition type
    needed_categories = defaultdict(int)
    needed_nutrition = defaultdict(int)
    
    for shortage in shortage_list:
        needed_categories[shortage["charity_category"]] += shortage["quantity_needed"]
        needed_nutrition[shortage["type"]] += shortage["quantity_needed"]
    
    # Find charities that can help with shortages
    charitable_matches = []
    
    for charity_id, items in charity_excess.items():
        matching_items = []
        # Create a copy of needs for each charity to track independently
        charity_needs_category = needed_categories.copy()
        charity_needs_nutrition = needed_nutrition.copy()
        
        # Sort items by fill_factor (most efficient first)
        sorted_items = sorted(items, key=lambda x: x["fill_factor"], reverse=True)
        
        for item in sorted_items:
            category = item["category"]
            nutrition_type = item["type"]
            
            # Determine how many items this charity can provide for this category/nutrition type
            category_needed = charity_needs_category.get(category, 0)
            nutrition_needed = charity_needs_nutrition.get(nutrition_type, 0)
            
            # If we need this item (either by category or nutrition type)
            if category_needed > 0 or nutrition_needed > 0:
                # Calculate the maximum quantity we should take
                max_needed = max(category_needed, nutrition_needed)
                quantity_to_take = min(item["quantity"], max_needed)
                
                if quantity_to_take > 0:
                    # Add to matching items with the appropriate quantity
                    matching_items.append({
                        "item_id": item["id"],
                        "name": item["name"],
                        "category": category,
                        "type": nutrition_type,
                        "quantity": quantity_to_take,  # Only take what we need
                        "fill_factor": item["fill_factor"]
                    })
                    
                    # Update this charity's remaining needs tracker
                    if category in charity_needs_category:
                        charity_needs_category[category] = max(0, charity_needs_category[category] - quantity_to_take)
                    
                    if nutrition_type in charity_needs_nutrition:
                        charity_needs_nutrition[nutrition_type] = max(0, charity_needs_nutrition[nutrition_type] - quantity_to_take)
        
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

    # For testing 
    # inventory = current_inventory_list[:4]
    
    # Categorize inventory by nutrition type with expiry and quantity sorting
    inventory_pool = defaultdict(list)
    for item in inventory:
        nutrition_type = item["type"]
        inventory_pool[nutrition_type].append(item)
    
    # Sort each category by expiry date and quantity
    for nutrition_type in inventory_pool:
        inventory_pool[nutrition_type] = sorted(
            inventory_pool[nutrition_type],
            key=lambda x: (x["expiry_date"], -x["quantity"])
        )

    # Track charity category allocations
    charity_category_counts = defaultdict(lambda: defaultdict(int))
    
    allocations = []
    # Sort recipients by income (prioritize lower income)
    for recipient in sorted(normalized_recipients, key=lambda x: x["household_avg_income"]):
        # Determine package based on income
        income = recipient["household_avg_income"]
        income_level = "low" if income < 20000 else "high" if income > 30000 else "medium"
        
        # Calculate target filling scores including dependents
        dependents_count = recipient["dependents"] + 1  # +1 to include the recipient

        target_scores = {}
        for nutrition_type, base_score in INCOME_TARGETS[income_level].items():
            # Base score for the recipient themselves
            score = base_score
            
            # Add additional amount for each dependent based on scaling factor
            if dependents_count > 0:
                additional_score = base_score * SCALING_FACTORS[nutrition_type] * dependents_count
                score += additional_score
            
            target_scores[nutrition_type] = score
        
        allocation = {
            "recipient_id": recipient["id"],
            "dependents": recipient["dependents"],
            "items": [],
            "filling_scores": {nutrition_type: 0 for nutrition_type in INCOME_TARGETS[income_level]}
        }
        used_items = set()  # Track items to prevent duplicates
        
        # Allocate items for each nutrition type
        for nutrition_type in INCOME_TARGETS[income_level]:
            compatible = [
                i for i in inventory_pool[nutrition_type]
                if is_compatible(i, recipient) 
                and i["quantity"] > 0
                and i["name"] not in used_items
            ]
            
            current_score = 0
            target_score = target_scores[nutrition_type]
            
            # Greedy algorithm: sort by filling_factor to quantity ratio (best value first)
            compatible.sort(key=lambda x: x["fill_factor"] / max(1, x["quantity"]), reverse=True)
            
            for item in compatible:
                category = item["category"]
                
                # Check if we've reached the maximum allowed for this charity category
                if category in CHARITY_CATEGORY_RULES:
                    max_items = CHARITY_CATEGORY_RULES[category].get("max_items", float('inf'))
                    if charity_category_counts[recipient["id"]][category] >= max_items:
                        continue
                
                if current_score >= target_score:
                    break
                
                # Calculate how many items we need to reach target
                score_needed = target_score - current_score
                items_needed = min(
                    item["quantity"],
                    max(1, int(score_needed / item["fill_factor"]))
                )
                
                # Apply charity category limits
                if category in CHARITY_CATEGORY_RULES:
                    max_items = CHARITY_CATEGORY_RULES[category].get("max_items", float('inf'))
                    current_count = charity_category_counts[recipient["id"]][category]
                    items_needed = min(items_needed, max_items - current_count)
                
                if items_needed > 0:
                    allocation["items"].append({
                        "item_id": item["id"],
                        "quantity": items_needed,
                        "name": item["name"],
                        "fill_factor": item["fill_factor"],
                        "type": nutrition_type,
                        "charity_category": category
                    })
                    
                    current_score += items_needed * item["fill_factor"]
                    item["quantity"] -= items_needed
                    used_items.add(item["name"])
                    
                    # Update charity category counts
                    charity_category_counts[recipient["id"]][category] += items_needed
            
            # Record final score achieved
            allocation["filling_scores"][nutrition_type] = current_score
        
        allocations.append(allocation)
    
    # Calculate excess/shortage
    excess = [i for i in inventory if i["quantity"] > 0]
    shortage = calculate_filling_shortages(normalized_recipients, allocations, INCOME_TARGETS)
    
    # Find potential charities with excess inventory that matches our shortages
    potential_charities = find_excess_matches(shortage, charity_id)

    # Filter out allocations with at least one item
    allocations = [a for a in allocations if (len(a["items"]) > 0)]
    # print(allocations[0]) # debug

    recipient_ids = [a['recipient_id'] for a in allocations]
    # Get route 
    # for a in allocations:
    #     print(a["recipient_id"]) # debug
    #     if (len(a["items"]) > 0):
    #         recipient_ids.append(a["recipient_id"])
    # print(recipient_ids) # debug
    route_info = []
    if len(recipient_ids) > 0:
        route_info = get_route_info(recipient_ids)
        message = "success"
    else: 
        route_info = [{"message": "No recipients"}]
        message = "No recipients scheduled to receive items on specified date"
    
    # Sort allocations into optimised order
    sorted_allocations = []
    if "optimized_indices" in route_info:
        indices = route_info["optimized_indices"]
        for i in range(len(indices) - 1):
            index = int(indices[i])
            print(index)
            sorted_allocations.append(allocations[index])
            print(allocations[index])
    else: 
        sorted_allocations = allocations
    # print(sorted_allocations) # debug

    return sorted_allocations, excess, shortage, potential_charities, route_info, message
