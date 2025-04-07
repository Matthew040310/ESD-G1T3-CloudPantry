"use client";

import { useState, useEffect } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Plus, Trash2 } from "lucide-react";
import CharityItemsDisplay from '@/components/CharityItemsDisplay';
import * as api from '../request-developer/apiHelper';
import CharitySimulator from "../request-developer/page";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-cormorant",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

export default function RequestPage() {
  // Form inputs - each row represents one item request
  const [foodInputs, setFoodInputs] = useState([
    { charityId: "", itemId: "", quantity: 1 }
  ]);

  // Local state
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [potentialCharities, setPotentialCharities] = useState([]);
  const [charityId, setCharityId] = useState('');
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingOpen, setOutgoingOpen] = useState(null);
  const [allNotifications, setAllNotifications] = useState([]);

  // API endpoints
  const [apiBaseUrl] = useState('http://localhost:5100');
  const [notificationUrl] = useState('http://localhost:5101');

  // Mapping to display charity names
  const [charityNames, setCharityNames] = useState({});

  // Load data on component mount
  useEffect(() => {
    // 1. Get current charity ID from localStorage
    const userCharityId = localStorage.getItem('charityID');
    if (userCharityId) {
      setCharityId(userCharityId);
    }

    // 2. Get charity name from localStorage
    const charityName = localStorage.getItem('charityName');
    if (charityName) {
      setCharityNames(prev => ({
        ...prev,
        [userCharityId]: charityName
      }));
    }

    // 3. Get potential charities from localStorage
    const potentialCharitiesStr = localStorage.getItem('potential_charities');
    if (potentialCharitiesStr) {
      try {
        const parsedCharities = JSON.parse(potentialCharitiesStr);
        setPotentialCharities(parsedCharities);
      } catch (error) {
        console.error('Error parsing potential charities:', error);
      }
    }

    // 4. Fetch charity names from API if not already loaded
    fetchCharityNames();

    // 5. Start refreshing notifications if charityId exists
    if (charityId) {
      refreshNotifications();
    }

    // Set up auto-refresh for notifications
    const intervalId = setInterval(() => {
      refreshNotifications();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [charityId]); // Main effect runs when charityId changes

  // Function to fetch charity names from API
  const fetchCharityNames = async () => {
    try {
      const charities = await api.fetchCharityList();
      const nameMap = {};
      charities.forEach(charity => {
        nameMap[charity.ID] = charity.CharityName;
      });

      setCharityNames(prev => ({
        ...prev,
        ...nameMap
      }));
    } catch (error) {
      console.error('Error fetching charity names:', error);
    }
  };

  // Function to refresh notifications

  const refreshNotifications = async () => {
    if (!charityId) return;
    
    try {
      // Fetch all notifications for this charity
      const notifications = await api.fetchWithErrorHandling(
        `${notificationUrl}/messagenf?charity_id=${charityId}`
      );
      
      // Update the notifications state
      setAllNotifications(notifications);
      
      // Extract outgoing and incoming requests
      const outgoing = notifications.filter(
        n => n.type === 'request' && n.sender_id === charityId
      );
      setOutgoingRequests(outgoing);
      
      const incoming = notifications.filter(
        n => n.type === 'request' && n.recipient_id === charityId
      );
      setIncomingRequests(incoming);
      
      // Get request statuses
      try {
        const statusData = await api.fetchWithErrorHandling(
          `${notificationUrl}/requests-status?charity_id=${charityId}`
        );
        
        console.log("Request status data:", statusData);
        
        // Update outgoing requests with status information
        if (statusData && statusData.outgoing_requests) {
          const updatedOutgoing = [...outgoing];
          Object.values(statusData.outgoing_requests).flat().forEach(reqStatus => {
            // Find matching request and update its status
            const matchingIdx = updatedOutgoing.findIndex(
              r => r.sender_id === reqStatus.sender_id && 
                  r.recipient_id === reqStatus.recipient_id &&
                  r.resource_type === reqStatus.resource_type &&
                  r.item_id === reqStatus.item_id
            );
            
            if (matchingIdx >= 0) {
              updatedOutgoing[matchingIdx].status = reqStatus.status;
            }
          });
          
          setOutgoingRequests(updatedOutgoing);
        }
      } catch (statusError) {
        console.error("Error fetching request status:", statusError);
        // Continue with basic notifications even if status endpoint fails
      }
    } catch (error) {
      console.error("Error refreshing notifications:", error);
    }
  };

  // Add a new useEffect to handle localStorage changes
  useEffect(() => {
    // Function to handle storage changes
    const handleStorageChange = () => {
      const newCharityId = localStorage.getItem('charityID');
      if (newCharityId && newCharityId !== charityId) {
        console.log(`Charity ID changed from ${charityId} to ${newCharityId}`);
        setCharityId(newCharityId);
        // Clear current data
        setOutgoingRequests([]);
        setIncomingRequests([]);
        setAllNotifications([]);
        // Fetch fresh data for the new charity
        refreshNotifications();
      }
    };

    // Listen for storage events (for cross-tab synchronization)
    window.addEventListener('storage', handleStorageChange);

    // Also check periodically in case localStorage is modified within the same tab
    const checkInterval = setInterval(handleStorageChange, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [charityId]);

  // Get status of a request (enhanced version)
  const getRequestStatus = (request) => {
    // Check for responses to this request
    const matchingResponses = allNotifications.filter(
      n => n.type === 'response' &&
        n.sender_id === request.recipient_id &&
        n.request_id === request.sender_id &&
        n.resource_type === request.resource_type &&
        n.item_id === request.item_id
    );

    if (matchingResponses.length === 0) {
      return "pending";
    }

    // Sort responses by timestamp (newest first)
    const sortedResponses = matchingResponses.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    // Return the most recent response
    return sortedResponses[0].response;
  };
  // Deduplicate requests by item_id and resource_type
  const deduplicateRequests = (requests) => {
    const uniqueRequests = {};
    requests.forEach(req => {
      const key = `${req.recipient_id}-${req.item_id}-${req.resource_type}`;
      if (!uniqueRequests[key] || new Date(req.timestamp) > new Date(uniqueRequests[key].timestamp)) {
        uniqueRequests[key] = req;
      }
    });
    return Object.values(uniqueRequests);
  };

  // Handle adding a new food input row
  const handleAddInput = () => {
    setFoodInputs([...foodInputs, { charityId: "", itemId: "", quantity: 1 }]);
  };

  // Handle removing a food input row
  const handleRemoveInput = (index) => {
    const updated = [...foodInputs];
    updated.splice(index, 1);
    setFoodInputs(updated);
  };

  // Handle updating a food input field
  const handleInputChange = (index, field, value) => {
    const updated = [...foodInputs];
    updated[index][field] = value;

    // If charity is changed, reset the item selection
    if (field === 'charityId') {
      updated[index].itemId = '';
    }

    setFoodInputs(updated);
  };

  // Check if a request combination already exists
  const isDuplicateRequest = (charityId, itemId) => {
    // Check if this combo already exists in current form inputs
    return foodInputs.some((input, idx) =>
      input.charityId === charityId &&
      input.itemId === itemId &&
      input.charityId !== "" &&
      input.itemId !== ""
    );
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      console.log(`Sending request as charity ID: ${charityId}`);
      
      // 1. Validate inputs
      const validInputs = foodInputs.filter(input => 
        input.charityId && 
        input.itemId && 
        input.quantity > 0
      );
      
      if (validInputs.length === 0) {
        setPopupMessage('Please select at least one charity and item to request.');
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2000);
        setLoading(false);
        return;
      }
      
      // 2. Format request data for the API
      const requestData = {};
      
      // Log potentialCharities for debugging
      console.log("Potential charities data:", potentialCharities);
      
      // Group by charity ID
      validInputs.forEach(input => {
        // Always work with strings for IDs to ensure consistent comparison
        const charityId = String(input.charityId);
        const itemId = String(input.itemId);
        
        console.log(`Processing request for charity ${charityId}, item ${itemId}`);
        
        // Find the charity in potentialCharities
        const charity = potentialCharities.find(c => String(c.charity_id) === charityId);
        if (!charity) {
          console.error(`Charity ${charityId} not found in potentialCharities`);
          return;
        }
        
        // Find the item
        const item = charity.items.find(i => String(i.item_id) === itemId);
        if (!item) {
          console.error(`Item ${itemId} not found in charity ${charityId}`);
          return;
        }
        
        console.log(`Adding request for ${input.quantity} ${item.name} from charity ${charityId}`);
        console.log("Full item details:", item);
        
        // Initialize array for this charity if needed
        if (!requestData[charityId]) {
          requestData[charityId] = [];
        }
        
        // Add the request with correct details
        // IMPORTANT: Preserve the exact item_id from the original data
        requestData[charityId].push({
          resource_type: item.name,
          quantity: parseInt(input.quantity),
          item_id: item.item_id  // Use the exact item_id from the source data
        });
      });
      
      console.log("Final request data:", requestData);
      
      if (Object.keys(requestData).length === 0) {
        setPopupMessage('No valid items to request.');
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2000);
        setLoading(false);
        return;
      }
      
      // 3. Send the request
      const result = await api.sendResourceRequest(charityId, requestData, apiBaseUrl);
      
      // 4. Show popup with results
      if (result && result.success_count > 0) {
        setPopupMessage(`Request sent successfully! ${result.success_count} items requested.`);
      } else {
        setPopupMessage(`Request sent with issues. ${result.error_count || 0} errors occurred.`);
      }
      
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
      
      // 5. Reset form
      setFoodInputs([{ charityId: "", itemId: "", quantity: 1 }]);
      
      // 6. Refresh notifications
      await refreshNotifications();
      
    } catch (error) {
      console.error('Error sending request:', error);
      setPopupMessage(`Error: ${error.message}`);
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Handle response to a request
  const handleSendResponse = async (request, action) => {
    try {
      setLoading(true);

      await api.sendResponse(charityId, request, action, apiBaseUrl);

      setPopupMessage(`Response "${action}" sent successfully!`);
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);

      // Refresh notifications
      await refreshNotifications();
    } catch (error) {
      console.error('Error sending response:', error);
      setPopupMessage(`Error sending response: ${error.message}`);
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Get charity name from ID
  const getCharityName = (id) => {
    return charityNames[id] || `Charity ${id}`;
  };

  // Group outgoing requests by recipient
  const groupedOutgoingRequests = outgoingRequests.reduce((acc, req) => {
    const recipientId = req.recipient_id;
    if (!acc[recipientId]) {
      acc[recipientId] = [];
    }

    // Check if we already have this exact request (avoid duplicates)
    const isDuplicate = acc[recipientId].some(
      existingReq =>
        existingReq.item_id === req.item_id &&
        existingReq.resource_type === req.resource_type
    );

    if (!isDuplicate) {
      acc[recipientId].push(req);
    }

    return acc;
  }, {});

  // Filter out incoming requests that already have responses
  const allIncomingRequests = incomingRequests.map(req => {
    // Check if there's a response for this request
    const matchingResponse = allNotifications.find(
      n => n.type === 'response' &&
        n.sender_id === charityId &&
        n.request_id === req.sender_id &&
        n.resource_type === req.resource_type &&
        n.item_id === req.item_id
    );

    return {
      ...req,
      responseStatus: matchingResponse ? matchingResponse.response : null
    };
  });

  return (
    <div className={`min-h-screen bg-[#f7f0ea] pt-0 pb-10 ${dmSans.variable}`}>
      {/* Hero section */}
      <div className="bg-[#f4d1cb] py-10 text-center w-full">
        <h1 className={`text-6xl text-center ${cormorant.variable} font-serif`}>Request & Share</h1>
        <p className="text-center mt-2">Request and share resources with your fellow charities here!</p>
      </div>

      {/* Request Form */}
      <div className="bg-[#f4d1cb] rounded-xl mx-8 p-6 mt-10 border border-black">
        <h2 className={`text-4xl text-center ${cormorant.variable} font-serif`}>Submit your requests</h2>

        <p className="mt-6 mb-2 font-bold text-left">Food choice:</p>

        {/* Food inputs based on potential charity items */}
        {foodInputs.map((input, index) => (
          <div key={index} className="flex justify-center items-start gap-4 mt-4">
            <div className="flex gap-6 bg-[#f7f0ea] p-4 rounded-2xl border border-black w-[85%] justify-center">
              <div className="flex flex-col">
                <label className="text-sm mb-1">Charity</label>
                <select
                  className="border px-2 py-1 rounded-md"
                  value={input.charityId}
                  onChange={(e) => {
                    const newCharityId = e.target.value;
                    // Only update if this won't create a duplicate
                    if (input.itemId && isDuplicateRequest(newCharityId, input.itemId)) {
                      setPopupMessage("This charity-item combination is already selected.");
                      setShowPopup(true);
                      setTimeout(() => setShowPopup(false), 2000);
                      return;
                    }
                    handleInputChange(index, 'charityId', newCharityId);
                  }}
                >
                  <option value="">Select Charity</option>
                  {potentialCharities.map(charity => (
                    <option key={charity.charity_id} value={charity.charity_id}>
                      {getCharityName(charity.charity_id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm mb-1">Food Item</label>
                <select
                  className="border px-2 py-1 rounded-md"
                  value={input.itemId}
                  disabled={!input.charityId}
                  onChange={(e) => {
                    const newItemId = e.target.value;
                    // Only update if this won't create a duplicate
                    if (isDuplicateRequest(input.charityId, newItemId)) {
                      setPopupMessage("This charity-item combination is already selected.");
                      setShowPopup(true);
                      setTimeout(() => setShowPopup(false), 2000);
                      return;
                    }
                    handleInputChange(index, 'itemId', newItemId);
                  }}
                >
                  <option value="">Select Item</option>
                  {input.charityId && potentialCharities
                    .find(c => c.charity_id.toString() === input.charityId)?.items
                    .map(item => (
                      <option key={item.item_id} value={item.item_id}>
                        {item.name} (Qty: {item.quantity})
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm mb-1">Request Quantity</label>
                <input
                  type="number"
                  value={input.quantity}
                  min="1"
                  max={input.charityId && input.itemId ?
                    potentialCharities
                      .find(c => c.charity_id.toString() === input.charityId)?.items
                      .find(i => i.item_id === input.itemId)?.quantity || 999
                    : 999
                  }
                  onChange={(e) => handleInputChange(index, 'quantity', e.target.value)}
                  className="w-16 px-2 py-1 border rounded-md"
                />
              </div>
            </div>
            <div className="flex flex-col justify-start gap-2 mt-2">
              <button onClick={handleAddInput}><Plus /></button>
              {index > 0 && <button onClick={() => handleRemoveInput(index)}><Trash2 /></button>}
            </div>
          </div>
        ))}

        {/* Charity Display Component */}
        <p className="mt-6 mb-2 font-bold text-left">Available Charities to ask from:</p>
        <CharityItemsDisplay
          potential_charities={potentialCharities}
        />

        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            className="mt-6 px-6 py-2 rounded-full bg-[#f56275] text-white font-bold"
            disabled={loading}
          >
            SUBMIT
          </button>
        </div>
      </div>

      {showPopup && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 bg-[#f56275] text-white px-6 py-2 rounded-full shadow-lg z-50">
          {popupMessage}
        </div>
      )}

      {/* Outgoing and Incoming Requests */}
      <div className="flex gap-6 mt-10 px-8">
        {/* Outgoing */}
        <div className="w-1/2 bg-[#f4d1cb] p-4 rounded-xl border border-black">
          <h3 className={`text-2xl mb-4 ${cormorant.variable} font-serif`}>Outgoing requests</h3>

          {Object.entries(groupedOutgoingRequests).length === 0 ? (
            <p className="text-center italic text-gray-500">No outgoing requests</p>
          ) : (
            Object.entries(groupedOutgoingRequests).map(([recipientId, requests], idx) => (
              <div key={idx} className="bg-[#f7f0ea] rounded-lg mb-3 overflow-hidden">
                <button
                  onClick={() => setOutgoingOpen(outgoingOpen === idx ? null : idx)}
                  className="w-full text-left p-2 flex justify-between items-center"
                >
                  Request to {getCharityName(recipientId)}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {outgoingOpen === idx && (
                  <div className="p-2 border-t border-gray-300">
                    <p>Date: {new Date(requests[0].timestamp).toLocaleDateString()}</p>
                    {requests.map((request, i) => {
                      const status = getRequestStatus(request);
                      return (
                        <div key={i} className="flex items-center justify-between mb-2">
                          <p>{request.resource_type} (Qty: {request.quantity})</p>
                          <span
                            className={`text-white text-sm px-3 py-1 rounded-full ${status === "accept"
                                ? "bg-[#9fca4b]"
                                : status === "reject"
                                  ? "bg-[#bd1f15]"
                                  : "bg-[#fba387]"
                              }`}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Incoming */}
        <div className="w-1/2 bg-[#f4d1cb] p-4 rounded-xl border border-black">
          <h3 className={`text-2xl mb-4 ${cormorant.variable} font-serif`}>Incoming requests</h3>

          {allIncomingRequests.length === 0 ? (
            <p className="text-center italic text-gray-500">No incoming requests</p>
          ) : (
            allIncomingRequests.map((request, idx) => (
              <div key={idx} className="bg-[#f7f0ea] p-3 rounded-lg mb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold">{request.quantity} {request.resource_type}</p>
                    <p className="text-sm text-[#333]">From: {getCharityName(request.sender_id)}</p>
                    <p className="text-sm text-[#333]">Date: {new Date(request.timestamp).toLocaleDateString()}</p>

                    {request.responseStatus && (
                      <p className={`text-sm font-bold ${request.responseStatus === "accept" ? "text-green-600" : "text-red-600"
                        }`}>
                        Status: {request.responseStatus.charAt(0).toUpperCase() + request.responseStatus.slice(1)}
                      </p>
                    )}
                  </div>

                  {!request.responseStatus && (
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleSendResponse(request, 'accept')}
                        className="bg-[#9fca4b] px-4 py-1 rounded-full text-white"
                        disabled={loading}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleSendResponse(request, 'reject')}
                        className="bg-[#bd1f15] px-4 py-1 rounded-full text-white"
                        disabled={loading}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div>

        {/* <CharitySimulator/> */}
      </div>
    </div>
  );
}