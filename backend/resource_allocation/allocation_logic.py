from datetime import datetime, timedelta
from collections import defaultdict

# For calculating increase in demand with change in household size (dependents)
SCALING_FACTORS = {
    "carb": 0,       # Does not change with household size
    "protein": 1.0,  # Scales fully with household size
    "fat": 0,        # Does not change with household size
    "vegetable": 0.5, # Add 50% per dependent beyond the first person
    "seasoning": 0   # Does not change with household size
}

# Define income-based filling score targets (monthly household income)
INCOME_TARGETS = {
    "low": {   # < $20k
        "carb": 30,    # Target filling score for carbs
        "protein": 80,  # Target filling score for protein
        "fat": 10,      # Target filling score for fat
        "vegetable": 60, # Target filling score for vegetables
        "seasoning": 5  # Target filling score for seasonings
    },
    "medium": { # $20k-$30k
        "carb": 30,
        "protein": 60,
        "fat": 10,
        "vegetable": 40,
        "seasoning": 5
    },
    "high": {   # > $30k
        "carb": 30,
        "protein": 40,
        "fat": 10,
        "vegetable": 30,
        "seasoning": 5
    }
}

# Define special allocation rules for charity categories
CHARITY_CATEGORY_RULES = {
    "Baby Food": {
        "required": "has_baby",  # Only allocate to recipients with babies
        "max_items": 3           # Maximum number of baby food items per recipient
    }
}

def is_compatible(item, recipient):
    """Check if an item is compatible with a recipient's dietary restrictions"""
    if not recipient.get("dietary_restriction"):
        return True
        
    restrictions_list = recipient["dietary_restriction"].split(', ') if recipient["dietary_restriction"] else []
    
    # Check dietary restrictions
    if "halal" in restrictions_list and item["halal"] != "yes":
        return False
    if "kosher" in restrictions_list and item["kosher"] != "yes":
        return False
    if "vegetarian" in restrictions_list and item["nutrition_type"] == "protein" and "meat" in item["name"].lower():
        return False
    
    # Check special charity category rules
    charity_cat = item["charity_category"]
    if charity_cat in CHARITY_CATEGORY_RULES:
        required_attribute = CHARITY_CATEGORY_RULES[charity_cat].get("required")
        if required_attribute and not recipient.get(required_attribute) == "true":
            return False
            
    return True

def calculate_filling_shortages(recipients, allocations, targets):
    """Calculate shortages in filling scores for each recipient"""
    shortage = []
    
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
                shortage.append({
                    "nutrition_type": nutrition_type,
                    "recipient_id": recipient["id"],
                    "target_score": target,
                    "actual_score": actual,
                    "shortfall": target - actual
                })
    
    return shortage

def allocate_resources(recipients, inventory):
    """Allocate food items to recipients based on their needs and dietary restrictions"""

    # Categorize inventory by nutrition type with expiry and quantity sorting
    inventory_pool = defaultdict(list)
    for item in inventory:
        nutrition_type = item["nutrition_type"]
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
    for recipient in sorted(recipients, key=lambda x: x["household_avg_income"]):
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
            compatible.sort(key=lambda x: x["filling_factor"] / max(1, x["quantity"]), reverse=True)
            
            for item in compatible:
                charity_cat = item["charity_category"]
                
                # Check if we've reached the maximum allowed for this charity category
                if charity_cat in CHARITY_CATEGORY_RULES:
                    max_items = CHARITY_CATEGORY_RULES[charity_cat].get("max_items", float('inf'))
                    if charity_category_counts[recipient["id"]][charity_cat] >= max_items:
                        continue
                
                if current_score >= target_score:
                    break
                
                # Calculate how many items we need to reach target
                score_needed = target_score - current_score
                items_needed = min(
                    item["quantity"],
                    max(1, int(score_needed / item["filling_factor"]))
                )
                
                # Apply charity category limits
                if charity_cat in CHARITY_CATEGORY_RULES:
                    max_items = CHARITY_CATEGORY_RULES[charity_cat].get("max_items", float('inf'))
                    current_count = charity_category_counts[recipient["id"]][charity_cat]
                    items_needed = min(items_needed, max_items - current_count)
                
                if items_needed > 0:
                    allocation["items"].append({
                        "item_id": item["id"],
                        "quantity": items_needed,
                        "name": item["name"],
                        "filling_factor": item["filling_factor"],
                        "nutrition_type": nutrition_type,
                        "charity_category": charity_cat
                    })
                    
                    current_score += items_needed * item["filling_factor"]
                    item["quantity"] -= items_needed
                    used_items.add(item["name"])
                    
                    # Update charity category counts
                    charity_category_counts[recipient["id"]][charity_cat] += items_needed
            
            # Record final score achieved
            allocation["filling_scores"][nutrition_type] = current_score
        
        allocations.append(allocation)
    
    # Calculate excess/shortage
    excess = [i for i in inventory if i["quantity"] > 0]
    shortage = calculate_filling_shortages(recipients, allocations, INCOME_TARGETS)
    
    return allocations, excess, shortage