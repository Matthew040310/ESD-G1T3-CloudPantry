# IS213-ESD-G1T3

# Solution Scope
This solution emulates a food donation platform that connects food donors, charities and beneficiaries.
By facilitating resource sharing between food organisations and automating resource allocation, we
aim to maxmise donations and meet the needs of beneficiaries.

# Key Features
- Inventory microservice for charities to track food donations (powered by Supabase)
- Resource allocation microservice to
  - Automate allocations of resources for individual charity beneficaries
  - Determine inventory excess / deficit
- Interplatform communication for reallocation of resources between charities
- Delivery system to provide optimised route for food delivery to beneficaries

# Programming Tools Used
- Python Flask for RESTful APIs
- Python RabbitMQ for AMQP protocol
- Javascript React framework for UI
