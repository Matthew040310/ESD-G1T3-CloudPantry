# IS213-ESD-G1T3

# Solution Scope
This solution emulates a food donation platform that connects food donors, charities and beneficiaries.
By facilitating resource sharing between food charities and automating resource allocation, we
aim to maximise donations and meet the needs of beneficiaries.

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
- React.js for FrontEnd

## Setup Instructions

To set up and run CloudPantry, follow these steps:

0.  **Create Supabase Database**
    - Head to supabase.com to create a project
    - Create three tables and import the csv files for dummy data population
   '''
    Table Name: Inventory
    inventory.csv

    Table Name: Excess_Inventory
    excess_inventory.csv

    Table Name: Notification
    notification.csv
   '''

2.  **Clone the Repository:**

    ```
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```
    
3.  **Start FrontEnd:**
    Navigate to cloudpantry directory and run the following command in terminal
    ```
    npm run dev
    ```

4. **Set Up Environment Variables**
    - Navigate to backend directory and create `.env` file
    - Under [Project_Name] > Settings > Configuration > Data API, obtain the following variables to be defined within the `.env` file
    ```
    SUPABASE_API_KEY = <SUPABASE_API_KEY>
    SUPABASE_URL = <SUPABASE_URL>
    ```
    
5.  **Start BackEnd:**
    Navigate to backend directory and run the following command in terminal to start all backend microservices
    ```
    docker compose up
    ```
