import axios from "axios";

/**
 * Makes API calls to backend services with better error handling
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} url - Full URL to call
 * @param {object} data - Data to send (for POST/PUT)
 * @returns {Promise} - Promise with response data
 */

function callSupabaseAPI(method, url, data = null) {
    const supportedMethods = ["POST", "PUT", "DELETE", "GET"]
    if (!supportedMethods.includes(method.toUpperCase())) {
        throw `ERROR: ${method} not supported`
    }

    console.log(`Making ${method} request to: ${url}`);

    const config = {
        method: method,
        url: url
    }
    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        config.data = data;
    }

    // return axios(config)
    //     .then((response) => response.data)
    //     .catch((error) => {
    //         if (error.response) {
    //             throw error.response.data.message;
    //         } else {
    //             throw new Error("Inventory Microservice not running");
    //         }
    //     });

    return axios(config)
        .then((response) => {
            console.log(`Received successful response from ${url}`);
            return response.data;
        })
        .catch((error) => {
            console.error(`API Error (${url}):`, error);
            
            if (error.response) {
                // The request was made and the server responded with an error status code
                console.error('Error response status:', error.response.status);
                throw error.response.data.message || `Service error (${error.response.status})`;
            } else if (error.request) {
                // The request was made but no response was received
                console.error('No response received');
                throw new Error(`Cannot connect to service at ${url}. Is the backend running?`);
            } else {
                // Something happened in setting up the request
                throw new Error(`Request error: ${error.message}`);
            }
        });
}

export default callSupabaseAPI