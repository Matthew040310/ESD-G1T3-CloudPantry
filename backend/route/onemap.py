import os, requests, re, time, json, itertools
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
ONEMAP_EMAIL = os.getenv("ONEMAP_EMAIL")
ONEMAP_PASSWORD = os.getenv("ONEMAP_PASSWORD")
OPENCAGE_API = os.getenv("OPENCAGE_API")


# Store token globally
ONEMAP_ACCESS_TOKEN = None
TOKEN_EXPIRY = None

def get_onemap_token():
    global ONEMAP_ACCESS_TOKEN, TOKEN_EXPIRY

    if ONEMAP_ACCESS_TOKEN and TOKEN_EXPIRY > datetime.now():
        return ONEMAP_ACCESS_TOKEN  # Return existing token

    # Request a new token
    auth_url = "https://www.onemap.gov.sg/api/auth/post/getToken"
    payload = {"email": ONEMAP_EMAIL, "password": ONEMAP_PASSWORD}
    
    print(f"🔑 Attempting authentication with OneMap API")
    
    try:
        response = requests.post(auth_url, json=payload)
        response.raise_for_status()
        
        data = response.json()
        ONEMAP_ACCESS_TOKEN = data["access_token"]
        TOKEN_EXPIRY = datetime.now() + timedelta(hours=70)
        print(f"✅ OneMap token refreshed successfully!")
        return ONEMAP_ACCESS_TOKEN
    except Exception as e:
        print(f"❌ Failed to get OneMap token: {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"Response: {e.response.text}")
        return None

def get_route_between_points(start, end, route_type="drive"):
    """Get route between two points using OneMap API"""
    token = get_onemap_token()
    if not token:
        return {"error": "Unable to authenticate with OneMap"}

    print(f"📍 Processing route from {start} to {end} (type: {route_type})")
    
    # Set up the API endpoint and parameters according to documentation
    base_url = "https://www.onemap.gov.sg/api/public/routingsvc/route"
    
    # Current date and time for transit routing
    now = datetime.now()
    date_str = now.strftime("%m-%d-%Y")
    time_str = now.strftime("%H:%M:%S")
    
    # Parameter dictionary based on route type
    params = {
        "start": start,
        "end": end
    }
    
    # Set appropriate parameters based on route type
    if route_type == "pt" or route_type == "public_transport":
        # Public transport parameters
        params.update({
            "routeType": "pt",
            "date": date_str,
            "time": time_str,
            "mode": "TRANSIT",
            "maxWalkDistance": 1000,
            "numItineraries": 3
        })
    else:
        # Car routing parameters
        valid_drive_types = {
            "fastest": "drive",
            "shortest": "drive",  # You can still pass "drive" and tweak on your side
            "drive": "drive"
        }

        actual_route_type = valid_drive_types.get(route_type, "drive")

        params.update({
            "routeType": actual_route_type
        })
    
    # Set up headers with token
    headers = {
        "Authorization": token
    }
    
    # Log the request details (masking the token)
    masked_headers = {"Authorization": "**********************"}
    print(f"📡 Request URL: {base_url}")
    print(f"📡 Request Params: {json.dumps(params)}")
    
    try:
        # Make the request to OneMap API
        response = requests.get(base_url, params=params, headers=headers, timeout=30)
        
        # Log response details
        print(f"🔍 OneMap Response Code: {response.status_code}")
        
        # Return appropriate response based on status code
        if response.status_code == 200:
            try:
                return response.json()
            except:
                return {"error": "Failed to parse JSON response", "details": response.text[:500]}
        elif response.status_code == 401:
            # Force token refresh on authentication error
            global ONEMAP_ACCESS_TOKEN, TOKEN_EXPIRY
            ONEMAP_ACCESS_TOKEN = None
            TOKEN_EXPIRY = None
            return {"error": "Authentication failed - Token expired"}
        else:
            return {
                "error": f"OneMap API Error: {response.status_code}",
                "details": response.text[:500] if response.text else "No response details"
            }
    except Exception as e:
        return {"error": f"Request failed: {str(e)}"}

def get_route_distance_time(start, end, route_type="drive"):
    """Get the distance and time between two points"""
    result = get_route_between_points(start, end, route_type)
    
    if "error" in result:
        return None, None
    
    if "route_summary" in result:
        return result["route_summary"]["total_distance"], result["route_summary"]["total_time"]
    
    # For public transport
    if route_type == "pt" and "plan" in result and "itineraries" in result["plan"] and result["plan"]["itineraries"]:
        itinerary = result["plan"]["itineraries"][0]  # Use first itinerary
        return itinerary.get("walkDistance", 0), itinerary.get("duration", 0)
    
    return None, None

def calculate_route_matrix(locations, route_type="drive"):
    """Calculate the distance/time matrix between all location pairs"""
    matrix = {}
    
    # Calculate distances between all pairs
    for start_idx, start_loc in enumerate(locations):
        matrix[start_idx] = {}
        for end_idx, end_loc in enumerate(locations):
            if start_idx == end_idx:
                matrix[start_idx][end_idx] = (0, 0)  # Same location
                continue
                
            # Get distance and time between locations
            distance, time = get_route_distance_time(start_loc, end_loc, route_type)
            
            if distance is not None and time is not None:
                matrix[start_idx][end_idx] = (distance, time)
            else:
                matrix[start_idx][end_idx] = (float('inf'), float('inf'))
    
    return matrix

def nearest_neighbor_tsp(matrix, start_idx=0):
    """Simple nearest neighbor algorithm for TSP"""
    n = len(matrix)
    path = [start_idx]
    unvisited = set(range(n))
    unvisited.remove(start_idx)
    
    total_distance = 0
    total_time = 0
    
    current = start_idx
    while unvisited:
        next_node = min(unvisited, key=lambda x: matrix[current][x][0])  # Use distance as metric
        distance, time = matrix[current][next_node]
        
        total_distance += distance
        total_time += time
        
        path.append(next_node)
        unvisited.remove(next_node)
        current = next_node
    
    # Return to start (optional)
    if n > 2:  # Only add return trip if we have more than 2 locations
        distance, time = matrix[current][start_idx]
        total_distance += distance
        total_time += time
        path.append(start_idx)
    
    return {
        "path": path,
        "total_distance": total_distance,
        "total_time": total_time
    }

def brute_force_tsp(matrix, start_idx=0):
    """Brute force algorithm for TSP (for small number of locations)"""
    n = len(matrix)
    if n > 10:  # Limit to reasonable size
        return nearest_neighbor_tsp(matrix, start_idx)
        
    nodes = list(range(n))
    nodes.remove(start_idx)
    
    best_path = None
    best_distance = float('inf')
    
    for perm in itertools.permutations(nodes):
        # Complete path: start -> perm -> start
        path = [start_idx] + list(perm) + [start_idx]
        
        # Calculate total distance and time
        total_distance = 0
        total_time = 0
        
        for i in range(len(path) - 1):
            distance, time = matrix[path[i]][path[i+1]]
            total_distance += distance
            total_time += time
        
        if total_distance < best_distance:
            best_distance = total_distance
            best_path = {
                "path": path,
                "total_distance": total_distance,
                "total_time": total_time
            }
    
    return best_path

def get_optimised_route_multi(locations, route_type="drive", algorithm="nearest"):
    """
    Optimise a route with multiple stops
    
    Args:
        locations: List of location coordinates as strings "lat,lon"
        route_type: Type of routing ("drive", "shortest", "pt")
        algorithm: Algorithm for route optimisation ("nearest" or "brute_force")
    
    Returns:
        Optimised route information
    """
    if len(locations) <= 1:
        return {"error": "Need at least 2 locations for routing"}
    
    if len(locations) == 2:
        # Simple case: just get route between two points
        return get_route_between_points(locations[0], locations[1], route_type)
    
    print(f"Optimising route for {len(locations)} locations using {algorithm} algorithm")
    
    # Calculate the distance/time matrix
    matrix = calculate_route_matrix(locations, route_type)
    
    # Use specified algorithm
    if algorithm == "brute_force":
        result = brute_force_tsp(matrix)
    else:  # Default to nearest neighbor
        result = nearest_neighbor_tsp(matrix)
    
    # Extract the optimised path
    path_indices = result["path"]
    path_locations = [locations[idx] for idx in path_indices]
    
    # Get detailed routes for each segment
    segments = []
    for i in range(len(path_indices) - 1):
        start_idx = path_indices[i]
        end_idx = path_indices[i + 1]
        
        start_loc = locations[start_idx]
        end_loc = locations[end_idx]
        
        route = get_route_between_points(start_loc, end_loc, route_type)
        segments.append({
            "from_index": start_idx,
            "to_index": end_idx,
            "from_location": start_loc,
            "to_location": end_loc,
            "route_data": route
        })
    
    return {
        "success": True,
        "route_type": route_type,
        "algorithm": algorithm,
        "optimised_indices": path_indices,
        "optimised_locations": path_locations,
        "total_distance": result["total_distance"],
        "total_time": result["total_time"],
        # "segments": segments
    }

def clean_address(address):
    """
    Cleans SG HDB-style addresses for geocoding:
    - Removes unit numbers like '#11-544'
    - Moves 'Blk <num>' to the front if needed
    - Appends 'Singapore' if not already present
    """
    import re

    # Remove unit numbers like #12-345
    address = re.sub(r'#\d{1,3}-\d{1,3}', '', address)

    # Look for 'Blk <number>' and move it to the front
    blk_match = re.search(r'Blk\s*\d+', address, re.IGNORECASE)
    if blk_match:
        blk = blk_match.group()
        # Remove it from current position
        address = re.sub(r'Blk\s*\d+', '', address, flags=re.IGNORECASE).strip()
        # Prepend it
        address = f"{blk} {address}"

    # Clean up multiple spaces and trailing commas
    address = re.sub(r'\s+', ' ', address).strip()
    address = address.rstrip(',')

    # Ensure 'Singapore' is at the end
    if "singapore" not in address.lower():
        address += ", Singapore"

    return address

def get_lat_lng_from_address(address):
    cleaned_address = clean_address(address)

    print(f"[Geocoding] Cleaned address: {cleaned_address}")

    url = f"https://api.opencagedata.com/geocode/v1/json?q={cleaned_address}&key={OPENCAGE_API}"

    try:
        response = requests.get(url)
        response.raise_for_status()  # Catch HTTP errors like 403, 500

        data = response.json()
        if data["results"]:
            coords = data["results"][0]["geometry"]
            print(f"[Geocoding] {cleaned_address} → ({coords['lat']}, {coords['lng']})")
            return {"lat": coords["lat"], "lng": coords["lng"]}
        else:
            print(f"[Geocoding] No results found for: {cleaned_address}")
    except Exception as e:
        print(f"[Geocoding] Error during request: {e}")

    return None