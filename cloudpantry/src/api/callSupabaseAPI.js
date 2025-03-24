import axios from "axios";

function callSupabaseAPI(method, url, data = null) {
    const supportedMethods = ["POST", "PUT", "DELETE", "GET"]
    if (!supportedMethods.includes(method.toUpperCase())) {
        throw `ERROR: ${method} not supported`
    }
    const config = {
        method: method,
        url: url
    }
    if (data && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        config.data = data;
    }

    return axios(config)
        .then((response) => response.data)
        .catch((error) => {
            if (error.response) {
                throw error.response.data.message;
            } else {
                throw new Error("Inventory Microservice not running");
            }
        });
}

export default callSupabaseAPI