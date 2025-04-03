# IS213-ESD-G1T3 : CloudPantry

# Project Description
This solution emulates a food donation platform that connects food charities and beneficiaries.
By facilitating resource sharing between food charities and automating resource allocation, we
aim to maximise limited food donations to meet the needs of beneficiaries.

# Key Features
- Decoupled architecture consisting of multiple Dockerised microservices
- Inventory microservice for charities to track food donations (powered by Supabase)
- Resource allocation microservice to
  - Automate allocations of resources for individual charity beneficaries
  - Determine inventory excess / deficit
- Asynchronous, inter-services communication for using message broker
- Route optimiser to determine food delivery sequence to beneficaries

# Technologies Used
- React.js for FrontEnd
- Python Flask for RESTful APIs
- Python RabbitMQ for AMQP protocol
- Docker for containerisation

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
    - Navigate to backend directory and populate `.env` file with required variables
    - Supbase Variables: https://supabase.com/ > [Project_Name] > Settings > Configuration > Data API
    - Onemap Variables: https://www.onemap.gov.sg/apidocs/
    
5.  **Start BackEnd:**
    Navigate to backend directory and run the following command in terminal to start all backend microservices
    ```
    docker compose up
    ```

     ...WIP...

## Usage Guide

     ...WIP...

## Contributors

    - Brejesh Bhaskaran
    - Lau Xing Ying
    - Liu Wenqi
    - Matthew Lim Wei Li
    - Mook He Jun
    - Zenia Foo
