/**
 * Message Service Integration Helper
 * 
 * This file provides simplified functions for integrating the message service
 * with the main application.
 */

// Default API endpoints with correct Docker ports
const DEFAULT_ENDPOINTS = {
    message: 'http://localhost:5100',
    messagenf: 'http://localhost:5101'
  };
  
  /**
   * Helper function to handle fetch requests with better error handling
   */
  const fetchWithLogging = async (url, options = {}) => {
    console.log(`[MessageIntegration] Making request to: ${url}`, options);
    
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        // Try to extract error message from response
        try {
          const errorData = await response.json();
          const errorMessage = errorData.message || JSON.stringify(errorData);
          console.error(`[MessageIntegration] API error (${response.status}): ${errorMessage}`);
          throw new Error(`API error (${response.status}): ${errorMessage}`);
        } catch (parseError) {
          console.error(`[MessageIntegration] API error (${response.status}): ${response.statusText}`);
          throw new Error(`API error (${response.status}): ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log(`[MessageIntegration] Response from ${url}:`, data);
      return data;
    } catch (error) {
      console.error(`[MessageIntegration] Fetch error:`, error);
      throw error;
    }
  };
  
  /**
   * Initialize the message system for a charity
   * @param {string|number} charityId - Charity ID
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} - Result object
   */
  export const initializeMessageSystem = async (charityId, config = {}) => {
    const messageUrl = config.messageUrl || DEFAULT_ENDPOINTS.message;
    
    return fetchWithLogging(`${messageUrl}/message/${charityId}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  };
  
  /**
   * Get notifications for a charity
   * @param {string|number} charityId - Charity ID
   * @param {Object} config - Configuration options
   * @returns {Promise<Array>} - Array of notifications
   */
  export const getNotifications = async (charityId, config = {}) => {
    const notificationUrl = config.notificationUrl || DEFAULT_ENDPOINTS.messagenf;
    
    return fetchWithLogging(`${notificationUrl}/messagenf?charity_id=${charityId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  };
  
  /**
   * Send a resource request to another charity
   * @param {string|number} senderCharityId - Sender charity ID
   * @param {string|number} recipientCharityId - Recipient charity ID
   * @param {Array} items - Array of items to request
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} - Result object
   */
  export const sendResourceRequest = async (senderCharityId, recipientCharityId, items, config = {}) => {
    const messageUrl = config.messageUrl || DEFAULT_ENDPOINTS.message;
    
    // Format data for the message API
    const requestData = {
      [recipientCharityId]: items.map(item => ({
        resource_type: item.name || item.resource_type,
        quantity: item.quantity,
        item_id: item.item_id || item.id
      }))
    };
    
    console.log(`[MessageIntegration] Sending request from ${senderCharityId} to ${recipientCharityId}:`, requestData);
    
    return fetchWithLogging(`${messageUrl}/message/${senderCharityId}/request`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
  };
  
  /**
   * Respond to a resource request
   * @param {string|number} charityId - Responding charity ID
   * @param {Object} requestData - Original request data
   * @param {string} action - Response action ('accept' or 'reject')
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} - Result object
   */
  export const respondToRequest = async (charityId, requestData, action, config = {}) => {
    const messageUrl = config.messageUrl || DEFAULT_ENDPOINTS.message;
    
    const responseData = {
      ...requestData,
      response: action
    };
    
    console.log(`[MessageIntegration] Sending response from ${charityId} with action ${action}:`, responseData);
    
    return fetchWithLogging(`${messageUrl}/message/${charityId}/respond`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
    });
  };
  
  /**
   * Process active notifications (move completed exchanges to database)
   * @param {string|number} charityId - Charity ID
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} - Result object
   */
  export const processActiveNotifications = async (charityId, config = {}) => {
    const notificationUrl = config.notificationUrl || DEFAULT_ENDPOINTS.messagenf;
    
    return fetchWithLogging(`${notificationUrl}/messagenf/active/${charityId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  };
  
  /**
   * Get completed (archived) notifications
   * @param {string|number} charityId - Charity ID
   * @param {Object} config - Configuration options
   * @returns {Promise<Array>} - Array of completed notifications
   */
  export const getCompletedNotifications = async (charityId, config = {}) => {
    const notificationUrl = config.notificationUrl || DEFAULT_ENDPOINTS.messagenf;
    
    return fetchWithLogging(`${notificationUrl}/messagenf/completed/${charityId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  };
  
  /**
   * Filter incoming (pending) requests
   * @param {Array} notifications - Array of notifications
   * @param {string|number} charityId - Charity ID
   * @returns {Array} - Array of pending requests
   */
  export const filterIncomingRequests = (notifications, charityId) => {
    const incomingRequests = notifications.filter(
      n => n.type === 'request' && n.recipient_id === charityId && n.sender_id !== charityId
    );
    
    const responses = notifications.filter(
      n => n.type === 'response' && n.sender_id === charityId
    );
    
    // Return only requests that don't have a response
    return incomingRequests.filter(req => {
      const hasResponse = responses.some(
        resp => resp.request_id === req.sender_id && 
                resp.resource_type === req.resource_type &&
                resp.item_id === req.item_id
      );
      return !hasResponse;
    });
  };
  
  /**
   * Filter outgoing requests with their statuses
   * @param {Array} notifications - Array of notifications
   * @param {string|number} charityId - Charity ID
   * @returns {Array} - Array of outgoing requests with status
   */
  export const filterOutgoingRequestsWithStatus = (notifications, charityId) => {
    const outgoingRequests = notifications.filter(
      n => n.type === 'request' && n.sender_id === charityId
    );
    
    const responses = notifications.filter(
      n => n.type === 'response' && n.request_id === charityId
    );
    
    // Add status to each request
    return outgoingRequests.map(req => {
      const matchingResponse = responses.find(
        resp => resp.sender_id === req.recipient_id && 
                resp.resource_type === req.resource_type &&
                resp.item_id === req.item_id
      );
      
      return {
        ...req,
        status: matchingResponse ? matchingResponse.response : 'pending'
      };
    });
  };
  
  /**
   * Get system status
   * @param {Object} config - Configuration options
   * @returns {Promise<Object>} - Status information
   */
  export const getSystemStatus = async (config = {}) => {
    const messageUrl = config.messageUrl || DEFAULT_ENDPOINTS.message;
    const notificationUrl = config.notificationUrl || DEFAULT_ENDPOINTS.messagenf;
    
    try {
      // Get message service status
      const messageStatus = await fetchWithLogging(`${messageUrl}/message/status`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      // Get notification service status
      const notificationStatus = await fetchWithLogging(`${notificationUrl}/messagenf/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      return {
        message: messageStatus,
        notification: notificationStatus,
        overall: messageStatus.status === 'complete' && notificationStatus.status === 'healthy' 
          ? 'healthy' 
          : 'degraded'
      };
    } catch (error) {
      console.error('[MessageIntegration] Error getting system status:', error);
      return {
        message: { status: 'error', error: error.message },
        notification: { status: 'error', error: error.message },
        overall: 'error'
      };
    }
  };