from datetime import datetime, timedelta
from collections import defaultdict

# For calculating increase in demand with change in household size (dependents)
SCALING_FACTORS = {
    "carb": 0,     # Does not change with household size
    "protein": 1.0,  # Scales fully with household size
    "fat": 0,      # Does not change with household size
    "vegetable": 0.5 # Add 50% per dependent beyond the first person
}

# Define income-based filling score targets (monthly household income)
INCOME_TARGETS = {
    "low": {   # < $20k
        "carb": 30,    # Target filling score for carbs
        "protein": 80,  # Target filling score for protein
        "fat": 10,      # Target filling score for fat
        "vegetable": 60 # Target filling score for vegetables
    },
    "medium": { # $20k-$30k
        "carb": 30,
        "protein": 60,
        "fat": 10,
        "vegetable": 40
    },
    "high": {   # > $30k
        "carb": 30,
        "protein": 40,
        "fat": 10,
        "vegetable": 30
    }
}

def is_compatible(item, restrictions):
    if not restrictions: return True
    restrictions_list = restrictions.split(', ') if restrictions else []
    if "halal" in restrictions_list and item["halal"] != "yes": return False
    if "kosher" in restrictions_list and item["kosher"] != "yes": return False
    if "vegetarian" in restrictions_list and "meat" in item["type"]: return False
    return True

def calculate_filling_shortages(recipients, allocations, targets):
    shortage = []
    
    # Check each allocation against targets
    for allocation in allocations:
        recipient = next(r for r in recipients if r["id"] == allocation["recipient_id"])
        income = recipient["household_avg_income"]
        income_level = "low" if income < 20000 else "high" if income > 30000 else "medium"
        
        # Calculate target scores including dependents
        dependents_count = recipient["dependents"] + 1  # +1 to include the recipient

        target_scores = {}
        for category, base_score in INCOME_TARGETS[income_level].items():
            # Base score for the recipient themselves
            score = base_score
            
            # Add additional amount for each dependent based on scaling factor
            if dependents_count > 0:
                additional_score = base_score * SCALING_FACTORS[category] * dependents_count
                score += additional_score
            
            target_scores[category] = score
        
        # Find shortfalls in filling scores
        for category, target in target_scores.items():
            actual = allocation["filling_scores"][category]
            if actual < target:
                shortage.append({
                    "type": category,
                    "recipient_id": recipient["id"],
                    "target_score": target,
                    "actual_score": actual,
                    "shortfall": target - actual
                })
    
    return shortage

def allocate_resources(recipients, inventory):

    # Categorize inventory with expiry and quantity sorting
    inventory_pool = {
        "carb": sorted([i for i in inventory if i["type"] == "carb"], 
                      key=lambda x: (x["expiry_date"], -x["quantity"])),
        "protein": sorted([i for i in inventory if i["type"] == "protein"], 
                      key=lambda x: (x["expiry_date"], -x["quantity"])),
        "fat": sorted([i for i in inventory if i["type"] == "fat"], 
                      key=lambda x: (x["expiry_date"], -x["quantity"])),
        "vegetable": sorted([i for i in inventory if i["type"] == "vegetable"], 
                      key=lambda x: (x["expiry_date"], -x["quantity"]))
    }

    allocations = []
    for recipient in sorted(recipients, key=lambda x: x["household_avg_income"]):
        # Determine package based on income
        income = recipient["household_avg_income"]
        income_level = "low" if income < 20000 else "high" if income > 30000 else "medium"
        
        # Calculate target filling scores including dependents
        dependents_count = recipient["dependents"] + 1  # +1 to include the recipient

        target_scores = {}
        for category, base_score in INCOME_TARGETS[income_level].items():
            # Base score for the recipient themselves
            score = base_score
            
            # Add additional amount for each dependent based on scaling factor
            if dependents_count > 0:
                additional_score = base_score * SCALING_FACTORS[category] * dependents_count
                score += additional_score
            
            target_scores[category] = score
        
        allocation = {
            "recipient_id": recipient["id"],
            "dependents": recipient["dependents"],
            "items": [],
            "filling_scores": {
                "carb": 0,
                "protein": 0,
                "fat": 0,
                "vegetable": 0
            }
        }
        used_items = set()  # Track items to prevent duplicates
        
        # Allocate items for each category
        for category in ["carb", "protein", "fat", "vegetable"]:
            compatible = [
                i for i in inventory_pool[category]
                if is_compatible(i, recipient["dietary_restriction"]) 
                and i["quantity"] > 0
                and i["name"] not in used_items
            ]
            
            current_score = 0
            target_score = target_scores[category]
            
            # Greedy algorithm: sort by filling_factor to quantity ratio (best value first)
            compatible.sort(key=lambda x: x["filling_factor"] / max(1, x["quantity"]), reverse=True)
            
            for item in compatible:
                if current_score >= target_score:
                    break
                
                # Calculate how many items we need to reach target
                score_needed = target_score - current_score
                items_needed = min(
                    item["quantity"],
                    max(1, int(score_needed / item["filling_factor"]))
                )
                
                if items_needed > 0:
                    allocation["items"].append({
                        "item_id": item["id"],
                        "quantity": items_needed,
                        "name": item["name"],
                        "filling_factor": item["filling_factor"]
                    })
                    
                    current_score += items_needed * item["filling_factor"]
                    item["quantity"] -= items_needed
                    used_items.add(item["name"])
            
            # Record final score achieved
            allocation["filling_scores"][category] = current_score
        
        allocations.append(allocation)
    
    # Calculate excess/shortage
    excess = [i for i in inventory if i["quantity"] > 0]
    shortage = calculate_filling_shortages(recipients, allocations, INCOME_TARGETS)
    
    return allocations, excess, shortage

