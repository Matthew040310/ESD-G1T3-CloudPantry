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

1. **Clone the Repository:**
    Clone this repository and navigate to the project directory
    ```
    git clone <your-repo-url>
    cd <your-repo-directory>
    
2.    **Start FrontEnd:**
    Navigate to `cloudpantry` directory and start the frontend
    ```
    npm run dev
    ```

3. **Start BackEnd Services:**
    Navigate to `backend` directory and start all backend microservices using Docker Compose:
    ```
    docker compose up
    ```

4. Upon docker compose up complete, you can navigation to localhost:3000 to interact with our web application!

## Contributors
This project was developed by:
    - Brejesh Bhaskaran
    - Lau Xing Ying
    - Liu Wenqi
    - Matthew Lim Wei Li
    - Mook He Jun
    - Zenia Foo
