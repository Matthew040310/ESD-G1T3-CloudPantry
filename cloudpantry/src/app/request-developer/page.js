"use client";
import React, { useState, useEffect } from 'react';

const CharitySimulator = () => {
  // Active charity (simulates logged in user)
  const [activeCharity, setActiveCharity] = useState('food_bank_sg');
  
  // API endpoints
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:5000');
  const [notificationUrl, setNotificationUrl] = useState('http://localhost:5001');
  
  // Form state
  const [selectedCharities, setSelectedCharities] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Data state
  const [notifications, setNotifications] = useState([]);
  const [potentialCharities, setPotentialCharities] = useState([]);
  const [availableCharities, setAvailableCharities] = useState([]);
  const [refreshInterval, setRefreshInterval] = useState(5);

  // Auto-refresh notifications
  useEffect(() => {
    fetchNotifications();
    
    const intervalId = setInterval(() => {
      fetchNotifications();
    }, refreshInterval * 1000);
    
    return () => clearInterval(intervalId);
  }, [activeCharity, refreshInterval, notificationUrl]);
  
  // Load available charities and potential charities on mount
  useEffect(() => {
    fetchAvailableCharities();
    fetchPotentialCharities();
  }, [apiBaseUrl]);
  
  // Register charity on first load and when switching
  useEffect(() => {
    registerCharity(activeCharity);
  }, [activeCharity]);
  
  // Fetch notifications for active charity
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${notificationUrl}/notifications?charity_id=${activeCharity}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setNotifications(data);
      setStatusMessage('');
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setStatusMessage(`Error fetching notifications: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch available charities
  const fetchAvailableCharities = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/charities`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAvailableCharities(data.charities || []);
    } catch (error) {
      console.error('Error fetching available charities:', error);
      setStatusMessage(`Error fetching charities: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch potential charities with items
  const fetchPotentialCharities = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/potential-charities`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPotentialCharities(data.potential_charities || []);
      
      // Initialize selected charities structure
      const initialSelectedCharities = {};
      data.potential_charities.forEach(charity => {
        if (charity.charity_id !== activeCharity) {
          initialSelectedCharities[charity.charity_id] = {
            selected: false,
            items: charity.items.map(item => ({
              ...item,
              selected: false,
              requestQuantity: 0
            }))
          };
        }
      });
      
      setSelectedCharities(initialSelectedCharities);
    } catch (error) {
      console.error('Error fetching potential charities:', error);
      setStatusMessage(`Error fetching charity details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Register new charity
  const registerCharity = async (charityId) => {
    try {
      setLoading(true);
      setStatusMessage(`Registering charity ${charityId}...`);
      
      const response = await fetch(`${apiBaseUrl}/charity/${charityId}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await response.json();
      setStatusMessage(`Charity ${charityId} registered successfully`);
      
      // Fetch notifications after registration
      fetchNotifications();
      fetchAvailableCharities();
    } catch (error) {
      console.error('Error registering charity:', error);
      setStatusMessage(`Error registering charity: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle selection of a charity
  const toggleCharitySelection = (charityId) => {
    setSelectedCharities(prev => ({
      ...prev,
      [charityId]: {
        ...prev[charityId],
        selected: !prev[charityId].selected
      }
    }));
  };
  
  // Toggle selection of an item
  const toggleItemSelection = (charityId, itemIndex) => {
    setSelectedCharities(prev => {
      const charity = prev[charityId];
      const updatedItems = [...charity.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        selected: !updatedItems[itemIndex].selected
      };
      
      return {
        ...prev,
        [charityId]: {
          ...charity,
          items: updatedItems
        }
      };
    });
  };
  
  // Update requested quantity for an item
  const updateRequestQuantity = (charityId, itemIndex, quantity) => {
    const numQuantity = parseInt(quantity) || 0;
    
    setSelectedCharities(prev => {
      const charity = prev[charityId];
      const updatedItems = [...charity.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        requestQuantity: numQuantity
      };
      
      return {
        ...prev,
        [charityId]: {
          ...charity,
          items: updatedItems
        }
      };
    });
  };
  
  // Send resource request
  const sendRequest = async () => {
    try {
      setLoading(true);
      setStatusMessage('Preparing to send requests...');
      
      // Format the request data according to the expected structure
      const requestData = {};
      
      // Build request data from selected charities and items
      Object.entries(selectedCharities).forEach(([charityId, charity]) => {
        if (charity.selected) {
          const selectedItems = charity.items.filter(item => item.selected && item.requestQuantity > 0);
          
          if (selectedItems.length > 0) {
            requestData[charityId] = selectedItems.map(item => ({
              resource_type: item.name,
              quantity: item.requestQuantity,
              item_id: item.item_id
            }));
          }
        }
      });
      
      // Check if there's anything to request
      if (Object.keys(requestData).length === 0) {
        setStatusMessage('No items selected for request. Please select at least one item.');
        setLoading(false);
        return;
      }
      
      setStatusMessage('Sending requests...');
      
      // Send the request
      const response = await fetch(`${apiBaseUrl}/charity/${activeCharity}/request`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setStatusMessage(`Requests sent: ${result.success_count} successful, ${result.error_count} failed`);
      
      // Fetch updated notifications
      fetchNotifications();
      
      // Reset selections
      fetchPotentialCharities();
    } catch (error) {
      console.error('Error sending request:', error);
      setStatusMessage(`Error sending request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Send response to a request
  const sendResponse = async (requestData, action) => {
    try {
      setLoading(true);
      setStatusMessage(`Sending ${action} response...`);
      
      // Add response action to the request data
      const responseData = {
        ...requestData,
        response: action
      };
      
      const response = await fetch(`${apiBaseUrl}/charity/${activeCharity}/respond`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(responseData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await response.json();
      setStatusMessage(`Response "${action}" sent successfully`);
      
      // Fetch updated notifications
      fetchNotifications();
    } catch (error) {
      console.error('Error sending response:', error);
      setStatusMessage(`Error sending response: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Switch active charity
  const handleCharitySwitch = async () => {
    await registerCharity(activeCharity);
    fetchNotifications();
    fetchPotentialCharities();
  };
  
  // Clear all notifications (for testing)
  const clearNotifications = async () => {
    try {
      setLoading(true);
      setStatusMessage('Clearing all notifications...');
      
      const response = await fetch(`${notificationUrl}/clear`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      await response.json();
      setNotifications([]);
      setStatusMessage('Notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      setStatusMessage(`Error clearing notifications: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Filter requests for display
  const incomingRequests = notifications.filter(
    n => n.type === 'request' && n.recipient_id === activeCharity && n.sender_id !== activeCharity
  );
  
  // Filter sent requests for display
  const sentRequests = notifications.filter(
    n => n.type === 'request' && n.sender_id === activeCharity
  );
  
  // Filter responses for received requests
  const receivedResponses = notifications.filter(
    n => n.type === 'response' && n.request_id === activeCharity
  );
  
  // Get requests that are pending responses
  const pendingRequests = incomingRequests.filter(req => {
    // Check if there's a response for this request
    const hasResponse = receivedResponses.some(
      resp => resp.sender_id === req.recipient_id && 
              resp.request_id === req.sender_id && 
              resp.resource_type === req.resource_type &&
              resp.item_id === req.item_id
    );
    return !hasResponse;
  });

  // Group sent requests by recipient
  const groupedSentRequests = sentRequests.reduce((acc, req) => {
    const recipientId = req.recipient_id;
    if (!acc[recipientId]) {
      acc[recipientId] = [];
    }
    acc[recipientId].push(req);
    return acc;
  }, {});

  // Get status of sent requests
  const getRequestStatus = (request) => {
    const matchingResponses = receivedResponses.filter(
      resp => resp.sender_id === request.recipient_id && 
              resp.request_id === request.sender_id && 
              resp.resource_type === request.resource_type &&
              resp.item_id === request.item_id
    );
    
    if (matchingResponses.length === 0) {
      return "pending";
    }
    
    return matchingResponses[0].response;
  };

  // Find charity details by ID
  const getCharityDetails = (charityId) => {
    return potentialCharities.find(charity => charity.charity_id === charityId) || { name: charityId };
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Charity Resource Exchange Simulator</h1>
      
      {/* Status Message */}
      {statusMessage && (
        <div className={`p-3 mb-4 rounded ${statusMessage.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {statusMessage}
        </div>
      )}
      
      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center mb-4">
          <div className="text-blue-500">Loading...</div>
        </div>
      )}
      
      {/* Configuration Section */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Active Charity ID:</label>
            <div className="flex gap-2">
              <select
                value={activeCharity}
                onChange={(e) => setActiveCharity(e.target.value)}
                className="border p-2 rounded w-full"
              >
                {potentialCharities.map(charity => (
                  <option key={charity.charity_id} value={charity.charity_id}>
                    {charity.name} ({charity.charity_id})
                  </option>
                ))}
              </select>
              <button 
                onClick={handleCharitySwitch}
                className="bg-blue-500 text-white px-4 py-2 rounded"
                disabled={loading}
              >
                Switch
              </button>
            </div>
          </div>
          
          <div>
            <label className="block mb-1">Charity API URL:</label>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          
          <div>
            <label className="block mb-1">Notification API URL:</label>
            <input
              type="text"
              value={notificationUrl}
              onChange={(e) => setNotificationUrl(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          
          <div>
            <label className="block mb-1">Refresh Interval (seconds):</label>
            <input
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Math.max(1, Number(e.target.value)))}
              min="1"
              max="60"
              className="border p-2 rounded w-full"
            />
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={fetchNotifications}
            className="bg-blue-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Refresh Now
          </button>
          <button
            onClick={clearNotifications}
            className="bg-red-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Clear All Notifications
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Request Resource Section */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Request Resources from Other Charities</h2>
          
          {potentialCharities.length === 0 ? (
            <p className="text-gray-500 italic">Loading available charities...</p>
          ) : (
            <div>
              <h3 className="font-semibold mb-2">Available Charities:</h3>
              <div className="space-y-6 mb-4">
                {Object.entries(selectedCharities).map(([charityId, charity]) => {
                  const charityDetails = getCharityDetails(charityId);
                  
                  return (
                    <div key={charityId} className="border p-3 rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id={`charity-${charityId}`}
                          checked={charity.selected}
                          onChange={() => toggleCharitySelection(charityId)}
                          className="w-5 h-5"
                        />
                        <label htmlFor={`charity-${charityId}`} className="font-semibold">
                          {charityDetails.name} ({charityId})
                        </label>
                        <span className="text-sm text-gray-500">
                          Contact: {charityDetails.contact}
                        </span>
                      </div>
                      
                      {charity.selected && (
                        <div className="ml-6">
                          <h4 className="font-medium mb-2">Available Items:</h4>
                          <div className="space-y-2">
                            {charity.items.map((item, index) => (
                              <div key={item.item_id} className="flex flex-wrap items-center gap-2 border-b pb-2">
                                <input
                                  type="checkbox"
                                  id={`item-${charityId}-${index}`}
                                  checked={item.selected}
                                  onChange={() => toggleItemSelection(charityId, index)}
                                  className="w-4 h-4"
                                />
                                <label htmlFor={`item-${charityId}-${index}`} className="w-48">
                                  {item.name}
                                </label>
                                <div className="text-sm text-gray-600">
                                  Available: {item.quantity}
                                </div>
                                {item.selected && (
                                  <div className="flex items-center gap-1">
                                    <label htmlFor={`qty-${charityId}-${index}`} className="text-sm">
                                      Request:
                                    </label>
                                    <input
                                      type="number"
                                      id={`qty-${charityId}-${index}`}
                                      value={item.requestQuantity}
                                      onChange={(e) => updateRequestQuantity(charityId, index, e.target.value)}
                                      min="1"
                                      max={item.quantity}
                                      className="border p-1 w-16 text-center"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <button
                onClick={sendRequest}
                className="bg-green-500 text-white px-4 py-2 rounded w-full"
                disabled={loading}
              >
                Send Requests
              </button>
            </div>
          )}
        </div>
        
        {/* Your Requests Status Section */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Your Request Status</h2>
          
          {Object.keys(groupedSentRequests).length === 0 ? (
            <p className="text-gray-500 italic">No outgoing requests</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSentRequests).map(([recipientId, requests]) => {
                const recipientDetails = getCharityDetails(recipientId);
                
                return (
                  <div key={recipientId} className="border p-3 rounded">
                    <h3 className="font-medium">Request to: {recipientDetails.name} ({recipientId})</h3>
                    
                    <div className="mt-2 space-y-2">
                      {requests.map((request, index) => {
                        const status = getRequestStatus(request);
                        const statusColor = 
                          status === "accept" ? "text-green-600" : 
                          status === "reject" ? "text-red-600" : 
                          "text-yellow-600";
                        
                        return (
                          <div key={index} className="flex flex-wrap items-center gap-2 border-b pb-2">
                            <div className="w-48 text-sm">
                              {request.resource_type} (ID: {request.item_id})
                            </div>
                            <div className="text-sm">
                              Quantity: {request.quantity}
                            </div>
                            <div className={`text-sm font-semibold ${statusColor}`}>
                              Status: {status.charAt(0).toUpperCase() + status.slice(1)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Sent: {new Date(request.timestamp).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Incoming Requests Section */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Incoming Requests ({pendingRequests.length})</h2>
          
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 italic">No pending incoming requests</p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request, index) => {
                const senderDetails = getCharityDetails(request.sender_id);
                
                return (
                  <div key={`incoming-${index}`} className="border p-3 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <p><strong>From:</strong> {senderDetails.name} ({request.sender_id})</p>
                        <p><strong>Resource:</strong> {request.resource_type}</p>
                        <p><strong>Item ID:</strong> {request.item_id}</p>
                        <p><strong>Quantity:</strong> {request.quantity}</p>
                        <p className="text-xs text-gray-500">
                          <strong>Received:</strong> {new Date(request.timestamp).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          <strong>Expires:</strong> {new Date(request.expiry).toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => sendResponse(request, 'accept')}
                          className="bg-green-500 text-white px-3 py-1 rounded"
                          disabled={loading}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => sendResponse(request, 'reject')}
                          className="bg-red-500 text-white px-3 py-1 rounded"
                          disabled={loading}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Responses History */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Response History</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Responses You've Received */}
            <div>
              <h3 className="font-medium mb-2">Responses to Your Requests ({receivedResponses.length})</h3>
              
              {receivedResponses.length === 0 ? (
                <p className="text-gray-500 italic">No responses received</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {receivedResponses.map((response, index) => {
                    const responseColor = 
                      response.response === "accept" ? "bg-green-100" : 
                      "bg-red-100";
                      
                    return (
                      <div key={`response-${index}`} className={`p-2 rounded ${responseColor}`}>
                        <p><strong>From:</strong> {getCharityDetails(response.sender_id).name}</p>
                        <p><strong>Resource:</strong> {response.resource_type}</p>
                        <p><strong>Response:</strong> {response.response.toUpperCase()}</p>
                        <p className="text-xs text-gray-500">
                          <strong>Time:</strong> {new Date(response.timestamp).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Your Responses to Others */}
            <div>
              <h3 className="font-medium mb-2">Your Responses to Others</h3>
              
              {notifications.filter(n => n.type === 'response' && n.sender_id === activeCharity).length === 0 ? (
                <p className="text-gray-500 italic">No responses sent</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {notifications
                    .filter(n => n.type === 'response' && n.sender_id === activeCharity)
                    .map((response, index) => {
                      const responseColor = 
                        response.response === "accept" ? "bg-green-100" : 
                        "bg-red-100";
                        
                      return (
                        <div key={`sent-resp-${index}`} className={`p-2 rounded ${responseColor}`}>
                          <p><strong>To:</strong> {getCharityDetails(response.request_id).name}</p>
                          <p><strong>Resource:</strong> {response.resource_type}</p>
                          <p><strong>Response:</strong> {response.response.toUpperCase()}</p>
                          <p className="text-xs text-gray-500">
                            <strong>Time:</strong> {new Date(response.timestamp).toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Debug Information */}
      <div className="mt-6 border p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Debug Information</h2>
        <details>
          <summary className="cursor-pointer text-blue-500">All Notifications ({notifications.length})</summary>
          <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(notifications, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default CharitySimulator;