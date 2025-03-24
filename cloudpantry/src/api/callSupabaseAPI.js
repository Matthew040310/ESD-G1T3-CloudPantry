import axios from "axios";

function callAPI(method, url, data = null) {
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
        .catch((error) => { throw error });
}

export default callAPI