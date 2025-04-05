"use client";
import React, { useState, useEffect } from 'react';
import * as api from './apiHelper';

const CharitySimulator = () => {
  // Active charity (simulates logged in user)
  const [activeCharity, setActiveCharity] = useState('1');
  
  // API endpoints - Corrected to use Docker ports
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:5100');
  const [notificationUrl, setNotificationUrl] = useState('http://localhost:5101');
  const [charityAPIUrl, setCharityAPIUrl] = useState('https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI/GetAllCharityIDName');
  
  // Status and loading
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializationStatus, setInitializationStatus] = useState({ status: 'unknown', total: 0, initialized: 0 });
  
  // Connection status
  const [apiConnected, setApiConnected] = useState(false);
  const [notificationConnected, setNotificationConnected] = useState(false);
  
  // Debug mode
  const [debugMode, setDebugMode] = useState(false);
  
  // Data state
  const [notifications, setNotifications] = useState([]);
  const [potentialCharities, setPotentialCharities] = useState([]);
  const [availableCharities, setAvailableCharities] = useState([]);
  const [selectedCharities, setSelectedCharities] = useState({});
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [charityList, setCharityList] = useState([]);

  // Debug log helper
  const debugLog = (message, data) => {
    if (debugMode) {
      console.log(`[CharityUI] ${message}`, data);
    }
  };


  
  // Check connectivity
  const checkConnectivity = async () => {
    try {
      // Check message service
      debugLog('Checking message service connectivity');
      await api.getQueuesInitializationStatus(apiBaseUrl);
      setApiConnected(true);
      
      // Check notification service
      debugLog('Checking notification service connectivity');
      await api.fetchNotifications(activeCharity, notificationUrl);
      setNotificationConnected(true);
      
      return true;
    } catch (error) {
      console.error('Connectivity check failed:', error);
      if (error.message.includes(apiBaseUrl)) {
        setApiConnected(false);
      }
      if (error.message.includes(notificationUrl)) {
        setNotificationConnected(false);
      }
      return false;
    }
  };

  // Initialize component on mount
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setLoading(true);
        setStatusMessage('Loading charity list...');
        
        // 1. Fetch the list of charities
        debugLog('Fetching charity list');
        const charities = await api.fetchCharityList(charityAPIUrl);
        setCharityList(charities);
        
        // 2. Check queue initialization status
        debugLog('Checking queue status');
        await checkQueueStatus();
        
        // 3. Create mock potential charities with items
        debugLog('Creating mock potential charities');
        setPotentialCharities(api.createMockPotentialCharities(charities));
        
        // 4. Fetch available charities from message service
        debugLog('Fetching available charities');
        try {
          const available = await api.fetchAvailableCharities(apiBaseUrl);
          setAvailableCharities(available);
        } catch (error) {
          console.error('Error fetching available charities:', error);
          setStatusMessage(`Warning: Could not fetch available charities. ${error.message}`);
        }
        
        // 5. Initialize selected charities structure
        debugLog('Initializing selected charities structure');
        initializeSelectedCharities(api.createMockPotentialCharities(charities));
        
        // 6. Fetch notifications for active charity
        debugLog('Fetching notifications');
        await refreshNotifications();
        
        // 7. Check if the active charity has a queue and create if needed
        debugLog('Ensuring active charity queue exists');
        await ensureActiveCharityQueue();
        
        // 8. Check connectivity
        await checkConnectivity();
        
        setStatusMessage('System initialized successfully');
      } catch (error) {
        console.error('Error initializing system:', error);
        setStatusMessage(`Error during initialization: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    initializeSystem();
    
    // Set up auto-refresh for notifications
    const intervalId = setInterval(() => {
      refreshNotifications();
    }, refreshInterval * 1000);
    
    // Set up periodic check of queue status
    const statusIntervalId = setInterval(() => {
      checkQueueStatus();
    }, 30000); // Check every 30 seconds
    
    // Set up periodic connectivity check
    const connectivityIntervalId = setInterval(() => {
      checkConnectivity();
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(intervalId);
      clearInterval(statusIntervalId);
      clearInterval(connectivityIntervalId);
    };
  }, [apiBaseUrl, notificationUrl, charityAPIUrl, refreshInterval]);
  
  // Switch active charity
  useEffect(() => {
    if (activeCharity && charityList.length > 0) {
      refreshNotifications();
      ensureActiveCharityQueue();
    }
  }, [activeCharity]);
  
  // Initialize selected charities structure
  const initializeSelectedCharities = (potentialCharities) => {
    const initialSelected = {};
    potentialCharities.forEach(charity => {
      if (charity.charity_id !== activeCharity) {
        initialSelected[charity.charity_id] = {
          selected: false,
          items: charity.items.map(item => ({
            ...item,
            selected: false,
            requestQuantity: 0
          }))
        };
      }
    });
    setSelectedCharities(initialSelected);
  };
  
  // Check the status of queue initialization
  const checkQueueStatus = async () => {
    try {
      debugLog('Checking queue initialization status');
      const status = await api.getQueuesInitializationStatus(apiBaseUrl);
      setInitializationStatus({
        status: status.status,
        total: status.total_charities,
        initialized: status.initialized_charities,
        details: status.charity_details
      });
      return status;
    } catch (error) {
      console.error('Error checking queue status:', error);
      // Don't update status message to avoid flickering
      return null;
    }
  };
  
  // Ensure the active charity has a queue
  const ensureActiveCharityQueue = async () => {
    try {
      debugLog(`Ensuring queue exists for charity ${activeCharity}`);
      // Initialize just the active charity
      await api.initializeCharityQueue(activeCharity, apiBaseUrl);
      debugLog(`Queue initialized for charity ${activeCharity}`);
      
      // Refresh status
      await checkQueueStatus();
    } catch (error) {
      console.error('Error ensuring active charity queue:', error);
      setStatusMessage(`Error creating queue for active charity: ${error.message}`);
    }
  };
  
  // Refresh notifications
  const refreshNotifications = async () => {
    try {
      debugLog(`Fetching notifications for charity ${activeCharity}`);
      const data = await api.fetchNotifications(activeCharity, notificationUrl);
      setNotifications(data);
      return true;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Don't update status message during auto-refresh to avoid flickering
      return false;
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
      debugLog('Sending request data', requestData);
      
      // Send the request
      const result = await api.sendResourceRequest(activeCharity, requestData, apiBaseUrl);
      setStatusMessage(`Requests sent: ${result.success_count} successful, ${result.error_count} failed`);
      
      // Fetch updated notifications
      await refreshNotifications();
      
      // Reset selections
      initializeSelectedCharities(potentialCharities);
    } catch (error) {
      console.error('Error sending request:', error);
      setStatusMessage(`Error sending request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Send response to a request
  const handleSendResponse = async (requestData, action) => {
    try {
      setLoading(true);
      setStatusMessage(`Sending ${action} response...`);
      debugLog('Sending response', { requestData, action });
      
      await api.sendResponse(activeCharity, requestData, action, apiBaseUrl);
      setStatusMessage(`Response "${action}" sent successfully`);
      
      // Fetch updated notifications
      await refreshNotifications();
    } catch (error) {
      console.error('Error sending response:', error);
      setStatusMessage(`Error sending response: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle clear notifications
  const handleClearNotifications = async () => {
    try {
      setLoading(true);
      setStatusMessage('Clearing all notifications...');
      
      await api.clearNotifications(notificationUrl);
      setNotifications([]);
      setStatusMessage('Notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      setStatusMessage(`Error clearing notifications: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle process active notifications
  const handleProcessActiveNotifications = async () => {
    try {
      setLoading(true);
      setStatusMessage('Processing active notifications...');
      
      const result = await api.processActiveNotifications(activeCharity, notificationUrl);
      setStatusMessage(`Processed notifications: ${result.completed_count} moved to completed database`);
      
      // Fetch updated notifications
      await refreshNotifications();
    } catch (error) {
      console.error('Error processing notifications:', error);
      setStatusMessage(`Error processing notifications: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Refresh charity list
  const handleRefreshCharityList = async () => {
    try {
      setLoading(true);
      setStatusMessage('Refreshing charity list...');
      
      const charities = await api.fetchCharityList(charityAPIUrl);
      setCharityList(charities);
      
      // Update potential charities
      const newPotentialCharities = api.createMockPotentialCharities(charities);
      setPotentialCharities(newPotentialCharities);
      
      // Re-initialize selected charities
      initializeSelectedCharities(newPotentialCharities);
      
      setStatusMessage('Charity list refreshed successfully');
    } catch (error) {
      console.error('Error refreshing charity list:', error);
      setStatusMessage(`Error refreshing charity list: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Manually trigger initialization of all queues
  const handleTriggerInitialization = async () => {
    try {
      setLoading(true);
      setStatusMessage('Triggering initialization of all charity queues...');
      
      const result = await api.triggerInitializeAllQueues(apiBaseUrl);
      
      setStatusMessage(`Initialization triggered: ${result.initialized} initialized, ${result.failed} failed`);
      
      // Refresh status
      await checkQueueStatus();
      
      // Refresh available charities
      try {
        const available = await api.fetchAvailableCharities(apiBaseUrl);
        setAvailableCharities(available);
      } catch (error) {
        console.error('Error fetching available charities:', error);
      }
      
    } catch (error) {
      console.error('Error triggering initialization:', error);
      setStatusMessage(`Error triggering initialization: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Run diagnostics
  const handleRunDiagnostics = async () => {
    try {
      setLoading(true);
      setStatusMessage('Running system diagnostics...');
      
      // Try both diagnostics
      let messageDiagnostic = null;
      let notificationDiagnostic = null;
      
      try {
        messageDiagnostic = await api.runMessageDiagnostic(apiBaseUrl);
        setStatusMessage('Message service diagnostic complete');
      } catch (error) {
        console.error('Message diagnostic failed:', error);
        setStatusMessage(`Message diagnostic failed: ${error.message}`);
      }
      
      try {
        notificationDiagnostic = await api.runNotificationDiagnostic(notificationUrl);
        setStatusMessage('Notification service diagnostic complete');
      } catch (error) {
        console.error('Notification diagnostic failed:', error);
        setStatusMessage(`Notification diagnostic failed: ${error.message}`);
      }
      
      // Set the results to state if needed, or display in UI
      const results = {
        message: messageDiagnostic,
        notification: notificationDiagnostic
      };
      
      console.log('Diagnostic results:', results);
      setStatusMessage('Diagnostics completed. Check browser console for details.');
      
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setStatusMessage(`Error running diagnostics: ${error.message}`);
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
    const hasResponse = notifications.some(
      n => n.type === 'response' && 
           n.sender_id === activeCharity && 
           n.request_id === req.sender_id && 
           n.resource_type === req.resource_type &&
           n.item_id === req.item_id
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
      
      {/* Initialization Status */}
      <div className="bg-blue-50 p-3 mb-4 rounded">
        <h3 className="font-semibold">System Status:</h3>
        <p>Charity Queues: {initializationStatus.status === 'complete' ? 
          'All Initialized' : 
          `${initializationStatus.initialized}/${initializationStatus.total} Initialized`}
        </p>
        <p>Available Charities: {availableCharities.length}</p>
        <p>Active Charity: {charityList.find(c => c.ID.toString() === activeCharity)?.CharityName || activeCharity}</p>
        <p>Message Service: <span className={`font-bold ${apiConnected ? 'text-green-600' : 'text-red-600'}`}>
          {apiConnected ? 'Connected' : 'Disconnected'}
        </span></p>
        <p>Notification Service: <span className={`font-bold ${notificationConnected ? 'text-green-600' : 'text-red-600'}`}>
          {notificationConnected ? 'Connected' : 'Disconnected'}
        </span></p>
      </div>
      
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
                {charityList.map(charity => (
                  <option key={charity.ID} value={charity.ID.toString()}>
                    {charity.CharityName} (ID: {charity.ID})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block mb-1">Message API URL:</label>
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
            <label className="block mb-1">Charity List API URL:</label>
            <input
              type="text"
              value={charityAPIUrl}
              onChange={(e) => setCharityAPIUrl(e.target.value)}
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
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Debug Mode</span>
            </label>
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={refreshNotifications}
            className="bg-blue-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Refresh Notifications
          </button>
          <button
            onClick={handleRefreshCharityList}
            className="bg-purple-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Refresh Charity List
          </button>
          <button
            onClick={handleTriggerInitialization}
            className="bg-yellow-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Initialize All Queues
          </button>
          <button
            onClick={handleClearNotifications}
            className="bg-red-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Clear All Notifications
          </button>
          <button
            onClick={handleProcessActiveNotifications}
            className="bg-green-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Process Active Notifications
          </button>
          <button
            onClick={handleRunDiagnostics}
            className="bg-indigo-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Run Diagnostics
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
                          onClick={() => handleSendResponse(request, 'accept')}
                          className="bg-green-500 text-white px-3 py-1 rounded"
                          disabled={loading}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleSendResponse(request, 'reject')}
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
      {debugMode && (
        <div className="mt-6 border p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Debug Information</h2>
          <details>
            <summary className="cursor-pointer text-blue-500">All Notifications ({notifications.length})</summary>
            <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(notifications, null, 2)}
            </pre>
          </details>
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-500">Charity List ({charityList.length})</summary>
            <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(charityList, null, 2)}
            </pre>
          </details>
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-500">Queue Initialization Status</summary>
            <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(initializationStatus, null, 2)}
            </pre>
          </details>
          <details className="mt-2">
            <summary className="cursor-pointer text-blue-500">API Endpoints</summary>
            <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify({
                message: apiBaseUrl,
                notification: notificationUrl,
                charityAPI: charityAPIUrl
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};


  export default CharitySimulator;