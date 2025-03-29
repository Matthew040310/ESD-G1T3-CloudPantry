from flask import Flask, request, jsonify
from flask_cors import CORS
from onemap import get_optimised_route_multi, get_route_between_points, get_lat_lng_from_address
from beneficiary_api import get_address_by_recipient_id

app = Flask(__name__)
CORS(app)

@app.route("/route_optimiser", methods=["GET"])
def route_optimiser():
    data = request.get_json()
    
    # Check if we have a start and end (simple route)
    start = data.get("start")
    end = data.get("end")
    
    # Check if we have multiple locations
    locations = data.get("locations", [])
    
    # Route type and algorithm
    route_type = data.get("route_type", "drive")
    algorithm = data.get("algorithm", "nearest")
    
    # Handle multi-location case
    if locations:
        print(f"Calling OneMap API with {len(locations)} locations, route_type={route_type}, algorithm={algorithm}")
        
        # Validate locations
        if len(locations) < 2:
            return jsonify({
                "error": "At least 2 locations are required for route optimisation"
            }), 400
            
        # Call the multi-location route optimisation function
        route_data = get_optimised_route_multi(locations, route_type, algorithm)
        
        print(f"Received multi-location route response")
        
        # Error handling
        if "error" in route_data:
            return jsonify(route_data), 400
            
        return jsonify(route_data)
    
    # Handle simple route (start to end)
    elif start and end:
        print(f"Calling OneMap API with start={start}, end={end}, route_type={route_type}")
        
        # Call the direct route function
        route_data = get_route_between_points(start, end, route_type)
        
        print(f"Received direct route response")
        
        # Process response based on route type
        if route_type == "pt" or route_type == "public_transport":
            if "plan" in route_data and "itineraries" in route_data["plan"]:
                # Process public transport itineraries
                itineraries = route_data["plan"]["itineraries"]
                results = []
                
                for idx, itinerary in enumerate(itineraries):
                    results.append({
                        "id": idx,
                        "duration": itinerary.get("duration", 0),
                        "distance": itinerary.get("walkDistance", 0),
                        "start_time": itinerary.get("startTime", 0),
                        "end_time": itinerary.get("endTime", 0),
                        "legs": itinerary.get("legs", [])
                    })
                    
                return jsonify({
                    "success": True,
                    "route_type": "public_transport",
                    "itineraries": results
                })
        
        # For driving routes (fastest, shortest)
        elif "route_geometry" in route_data and "route_summary" in route_data:
            return jsonify({
                "success": True,
                "route_type": route_type,
                "coordinates": route_data["route_geometry"],
                "distance": route_data["route_summary"]["total_distance"],
                "time": route_data["route_summary"]["total_time"]
            })
        
        # Error handling
        if "error" in route_data:
            return jsonify(route_data), 400
        else:
            return jsonify({
                "error": "Invalid or unexpected response from OneMap API",
                "details": route_data
            }), 500
    
    # Missing required parameters
    else:
        return jsonify({
            "error": "Missing required parameters. Either 'locations' array or both 'start' and 'end' must be provided."
        }), 400

# @app.route("/health", methods=["GET"])
# def health_check():
#     return jsonify({"status": "healthy", "service": "route-optimiser"})

@app.route("/route_from_recipients", methods=["GET"])
def route_from_recipients():
    data = request.get_json()
    recipient_ids = data.get("recipient_ids", [])

    if not recipient_ids or not isinstance(recipient_ids, list):
        return jsonify({"error": "Please provide a list of recipient IDs"}), 400
        
    # Check if only one recipient ID is provided
    if len(recipient_ids) == 1:
        return jsonify({"message": "no routes", "details": "At least 2 recipient locations are required for route optimisation"}), 200

    latlng_list = []

    for rid in recipient_ids:
        address = get_address_by_recipient_id(rid)
        print(f"Geocoding recipient {rid}: {address}")
        if not address:
            return jsonify({"error": f"Address not found for recipient ID {rid}"}), 404

        latlng = get_lat_lng_from_address(address)
        if not latlng:
            return jsonify({"error": f"Could not geocode address for recipient ID {rid}"}), 400

        latlng_list.append(f"{latlng['lat']},{latlng['lng']}")

    # Pass it to your existing optimiser
    route_data = get_optimised_route_multi(latlng_list, route_type="drive", algorithm="nearest")

    if "error" in route_data:
        return jsonify(route_data), 400

    return jsonify(route_data)

if __name__ == "__main__":
    print("Multi-Location Route Optimisation Service Starting on port 5003")
    app.run(debug=True, host="0.0.0.0", port=5003)