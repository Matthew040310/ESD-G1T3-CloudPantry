/**
 * Simplified API Helper functions for charity messaging system
 */

// Default API endpoints
const DEFAULT_API_ENDPOINTS = {
  message: 'http://localhost:5100',
  messagenf: 'http://localhost:5101',
  charityList: 'https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI/GetAllCharityIDName'
};

/**
 * Helper function to handle fetch requests with proper error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
export const fetchWithErrorHandling = async (url, options = {}) => {
  console.log(`🔄 Fetching: ${url}`, options);
  
  try {
    const response = await fetch(url, options);
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.error(`❌ API Error (${response.status}):`, errorData);
        throw new Error(`API Error (${response.status}): ${errorData.message || JSON.stringify(errorData)}`);
      } catch (parseError) {
        console.error(`❌ API Error (${response.status}): ${response.statusText}`);
        throw new Error(`API Error (${response.status}): ${response.statusText}`);
      }
    }
    
    const data = await response.json();
    console.log(`✅ Response data:`, data);
    return data;
  } catch (error) {
    console.error(`❌ Fetch error:`, error);
    throw error;
  }
};

/**
 * Fetch all charities from the outsystems API
 * @param {string} charityAPIUrl - URL for the charity list API
 * @returns {Promise<Array>} - Array of charity objects
 */
export const fetchCharityList = async (charityAPIUrl = DEFAULT_API_ENDPOINTS.charityList) => {
  return fetchWithErrorHandling(charityAPIUrl);
};

/**
 * Initialize message queue for a specific charity
 * @param {string|number} charityId - Charity ID
 * @param {string} apiBaseUrl - Base URL for message API
 * @returns {Promise<Object>} - Response data
 */
export const initializeCharityQueue = async (charityId, apiBaseUrl = DEFAULT_API_ENDPOINTS.message) => {
  return fetchWithErrorHandling(`${apiBaseUrl}/message/${charityId}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

export const fetchRequestStatus = async (charityId, notificationUrl = DEFAULT_API_ENDPOINTS.messagenf) => {
  if (!charityId) throw new Error("charityId is required");

  // Use the fetchWithErrorHandling helper for consistent error handling
  return fetchWithErrorHandling(`${notificationUrl}/requests-status?charity_id=${charityId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

// Add this function to apiHelper.js if not already present
export const fetchNotifications = async (charityId, notificationUrl = DEFAULT_API_ENDPOINTS.messagenf) => {
  if (!charityId) throw new Error("charityId is required");
  
  return fetchWithErrorHandling(`${notificationUrl}/messagenf?charity_id=${charityId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

// export const fetchNotifications = async (charityId, notificationUrl) => {
//   try {
//     const response = await fetch(`${notificationUrl}/notifications?charity_id=${charityId}`);
//     if (!response.ok) throw new Error('Failed to fetch notifications');
//     return await response.json();
//   } catch (error) {
//     console.error('Error fetching notifications:', error);
//     throw error;
//   }
// };
/**
 * Process active notifications
 * @param {string|number} charityId - Charity ID
 * @param {string} notificationUrl - URL for notification API
 * @returns {Promise<Object>} - Response data
 */
export const processActiveNotifications = async (charityId, notificationUrl = DEFAULT_API_ENDPOINTS.messagenf) => {
  return fetchWithErrorHandling(`${notificationUrl}/messagenf/active/${charityId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

/**
 * Fetch completed notifications for a charity
 * @param {string|number} charityId - Charity ID
 * @param {string} notificationUrl - URL for notification API
 * @returns {Promise<Array>} - Array of completed notifications
 */
export const fetchCompletedNotifications = async (charityId, notificationUrl = DEFAULT_API_ENDPOINTS.messagenf) => {
  return fetchWithErrorHandling(`${notificationUrl}/messagenf/completed/${charityId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

/**
 * Clear all notifications (for testing)
 * @param {string} notificationUrl - URL for notification API
 * @returns {Promise<Object>} - Response data
 */
export const clearNotifications = async (notificationUrl = DEFAULT_API_ENDPOINTS.messagenf) => {
  return fetchWithErrorHandling(`${notificationUrl}/messagenf/clear`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

/**
 * Send resource request to other charities
 * @param {string|number} charityId - Charity ID (sender)
 * @param {Object} requestData - Object containing requests for each charity
 * @param {string} apiBaseUrl - Base URL for message API
 * @returns {Promise<Object>} - Response data
 */
export const sendResourceRequest = async (charityId, requestData, apiBaseUrl = DEFAULT_API_ENDPOINTS.message) => {
  console.log(`📤 Sending request from ${charityId}:`, requestData);
  
  return fetchWithErrorHandling(`${apiBaseUrl}/message/${charityId}/request`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });
};

/**
 * Send response to a request
 * @param {string|number} charityId - Charity ID (responder)
 * @param {Object} requestData - Original request data
 * @param {string} action - Response action ('accept' or 'reject')
 * @param {string} apiBaseUrl - Base URL for message API
 * @returns {Promise<Object>} - Response data
 */
export const sendResponse = async (charityId, requestData, action, apiBaseUrl = DEFAULT_API_ENDPOINTS.message) => {
  const responseData = {
    ...requestData,
    response: action
  };
  
  console.log(`📤 Sending response from ${charityId} (${action}):`, responseData);
  
  return fetchWithErrorHandling(`${apiBaseUrl}/message/${charityId}/respond`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(responseData)
  });
};

/**
 * Fetch available charities with their items
 * @param {string} apiBaseUrl - Base URL for message API
 * @returns {Promise<Object>} - Data with potential charities
 */
export const fetchPotentialCharities = async (apiBaseUrl = DEFAULT_API_ENDPOINTS.message) => {
  return fetchWithErrorHandling(`${apiBaseUrl}/potential-charities`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};

/**
 * Check service health
 * @param {string} notificationUrl - URL for notification API
 * @returns {Promise<Object>} - Health status
 */
export const checkServiceHealth = async (notificationUrl = DEFAULT_API_ENDPOINTS.messagenf) => {
  return fetchWithErrorHandling(`${notificationUrl}/messagenf/health`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};



/**
 * Delete completed notifications for a charity
 * @param {string|number} charityId - Charity ID
 * @param {string} notificationUrl - URL for notification API
 * @returns {Promise<Object>} - Response data
 */
export const deleteCompletedNotifications = async (charityId, notificationUrl = DEFAULT_API_ENDPOINTS.messagenf) => {
  return fetchWithErrorHandling(`${notificationUrl}/messagenf/completed/${charityId}/delete`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
};



/**
 * Create mock potential charities based on charity list
 * @param {Array} charityList - List of charities from API
 * @returns {Array} - Array of potential charities with mock items
 */
export const createMockPotentialCharities = (charityList) => {
  return charityList.map(charity => ({
    charity_id: charity.ID.toString(),
    name: charity.CharityName,
    contact: "contact@example.com",
    items: [
      {
        item_id: `${charity.ID}-001`,
        name: "Canned Food",
        nutrition_type: "Protein",
        category: "Non-perishable",
        fill_factor: 0.8,
        quantity: Math.floor(Math.random() * 200) + 50
      },
      {
        item_id: `${charity.ID}-002`,
        name: "Rice",
        nutrition_type: "Carbohydrates",
        category: "Dry goods",
        fill_factor: 0.9,
        quantity: Math.floor(Math.random() * 300) + 100
      }
    ]
  }));
};