# IS213-ESD-G1T3 : CloudPantry

# Project Description
CloudPantry is a food donation platform designed to connect food charities with beneficiaries.
By enabling resource sharing between food charities and automating resource allocation,
the platform aims to maximise the impact of limited food donations to better meet beneficiaries' needs.

# Key Features
- **Decoupled Architecture:** Built using multiple Dockerized microservices.
- **Inventory Microservice:** Tracks food donations for charities, powered by Supabase.
- **Resource Allocation Microservice:**
  - Automates the allocation of resources for individual charity beneficiaries.
  - Identifies inventory excess or deficits.
- **Asynchronous Communication:** Facilitates inter-service communication using a message broker.
- **Route Optimizer:** Determines the optimal delivery sequence for food distribution to beneficiaries.

# Technologies Used
- **Frontend:** React.js
- **Backend:** Python Flask for RESTful APIs
- **Messaging Protocol:** RabbitMQ (AMQP protocol)
- **Containerization:** Docker

## Setup Instructions

To set up and run CloudPantry, follow these steps:

1.  **Create Supabase Database**
    - Head to [Supabase](https://supabase.com/) to create a new project
    - Set up three tables and populate them with dummy data using the provided CSV files in `database_data`:
      - `Inventory` table: Import `inventory.csv`
      - `Excess_Inventory` table: Import `excess_inventory.csv`
      - `Notification` table: Import `notification.csv`

2.  **Clone the Repository:**
    Clone this repository and navigate to the project directory
    ```
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```
    
3.  **Start FrontEnd:**
    Navigate to `cloudpantry` directory and start the frontend
    ```
    npm run dev
    ```

4. **Set Up Environment Variables**
    - Navigate to the `backend` directory
    - Supbase Variables: Retrieve from [Supabase Project Settings](https://supabase.com/) under `Settings > Configuration > Data API`
    - Onemap Variables: Create account and obtain API keys from [OneMap API Documentation](https://www.onemap.gov.sg/apidocs/)
    
5.  **Start BackEnd Services:**
    Navigate to `backend` directory and start all backend microservices using Docker Compose:
    ```
    docker compose up
    ```

## Usage Guide

     Navigate to localhost:3000 via your browser to interact with our web application!

## Contributors
This project was developed by:
    - Brejesh Bhaskaran
    - Lau Xing Ying
    - Liu Wenqi
    - Matthew Lim Wei Li
    - Mook He Jun
    - Zenia Foo
