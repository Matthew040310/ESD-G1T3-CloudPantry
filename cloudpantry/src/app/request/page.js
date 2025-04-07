"use client";

import { useState, useEffect, useCallback } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

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

// API Service URLs
const API_BASE_URL = "http://localhost:5101";

export default function RequestPage() {
  // User & form state
  const [currentUserCharityId, setCurrentUserCharityId] = useState("");
  const [requestFormInputs, setRequestFormInputs] = useState([
    { recipientId: "", itemId: "", quantity: 1 }
  ]);
  
  // Data state
  const [potentialCharities, setPotentialCharities] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [charityNames, setCharityNames] = useState({});
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [outgoingOpen, setOutgoingOpen] = useState(null);

  // Fetch requests from API
  const fetchRequests = useCallback(async () => {
    if (!currentUserCharityId) return;
    
    try {
      // Fetch incoming requests
      const incomingResponse = await fetch(
        `${API_BASE_URL}/requests?charity_id=${currentUserCharityId}&direction=incoming`
      );
      
      if (!incomingResponse.ok) {
        throw new Error(`Error fetching incoming requests: ${incomingResponse.statusText}`);
      }
      
      const incomingData = await incomingResponse.json();
      setIncomingRequests(incomingData);
      
      // Fetch outgoing requests
      const outgoingResponse = await fetch(
        `${API_BASE_URL}/requests?charity_id=${currentUserCharityId}&direction=outgoing`
      );
      
      if (!outgoingResponse.ok) {
        throw new Error(`Error fetching outgoing requests: ${outgoingResponse.statusText}`);
      }
      
      const outgoingData = await outgoingResponse.json();
      setOutgoingRequests(outgoingData);
      
    } catch (error) {
      console.error("Error fetching requests:", error);
      setErrorMessage(`Failed to fetch requests: ${error.message}`);
    }
  }, [currentUserCharityId]);

  // Initialize data on component mount
  useEffect(() => {
    // Get current user charity ID from localStorage
    const userCharityId = localStorage.getItem('charityID');
    if (userCharityId) {
      setCurrentUserCharityId(userCharityId);
    }
    
    // Get potential charities from localStorage
    const potentialCharitiesStr = localStorage.getItem('potential_charities');
    if (potentialCharitiesStr) {
      try {
        const parsedCharities = JSON.parse(potentialCharitiesStr);
        setPotentialCharities(parsedCharities);
        
        // Extract charity names into a lookup object
        const names = {};
        parsedCharities.forEach(charity => {
          names[charity.charity_id] = charity.name;
        });
        setCharityNames(prev => ({ ...prev, ...names }));
      } catch (error) {
        console.error('Error parsing potential charities:', error);
      }
    }
    
    // Get charity names from localStorage
    const charityName = localStorage.getItem('charityName');
    if (charityName && userCharityId) {
      setCharityNames(prev => ({
        ...prev,
        [userCharityId]: charityName
      }));
    }
  }, []);
  
  // Start polling for requests when charity ID is available
  useEffect(() => {
    if (!currentUserCharityId) return;
    
    // Fetch requests immediately
    fetchRequests();
    
    // Set up polling interval
    const intervalId = setInterval(fetchRequests, 5000); // Poll every 5 seconds
    
    // Clean up interval on unmount or charity ID change
    return () => clearInterval(intervalId);
  }, [currentUserCharityId, fetchRequests]);

  // Handle adding a new form input row
  const handleAddInput = () => {
    setRequestFormInputs([...requestFormInputs, { recipientId: "", itemId: "", quantity: 1 }]);
  };

  // Handle removing a form input row
  const handleRemoveInput = (index) => {
    const updated = [...requestFormInputs];
    updated.splice(index, 1);
    setRequestFormInputs(updated);
  };

  // Handle updating a form input field
  const handleInputChange = (index, field, value) => {
    const updated = [...requestFormInputs];
    updated[index][field] = value;

    // If recipient is changed, reset the item selection
    if (field === 'recipientId') {
      updated[index].itemId = '';
    }

    setRequestFormInputs(updated);
  };

  // Check if a request combination already exists
  const isDuplicateRequest = (recipientId, itemId) => {
    return requestFormInputs.some(input => 
      input.recipientId === recipientId &&
      input.itemId === itemId &&
      input.recipientId !== "" &&
      input.itemId !== ""
    );
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      
      // Validate form inputs
      const validInputs = requestFormInputs.filter(input => 
        input.recipientId && 
        input.itemId && 
        input.quantity > 0
      );
      
      if (validInputs.length === 0) {
        setPopupMessage('Please select at least one charity and item to request.');
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2000);
        return;
      }
      
      // Format request data for the API
      const requestPayload = {
        sender_id: currentUserCharityId
      };
      
      // Group by recipient ID
      validInputs.forEach(input => {
        const recipientId = input.recipientId;
        const selectedCharity = potentialCharities.find(c => c.charity_id === recipientId);
        
        if (!selectedCharity) {
          console.error(`Charity ${recipientId} not found in potentialCharities`);
          return;
        }
        
        const selectedItem = selectedCharity.items.find(i => i.item_id === input.itemId);
        if (!selectedItem) {
          console.error(`Item ${input.itemId} not found in charity ${recipientId}`);
          return;
        }
        
        if (!requestPayload[recipientId]) {
          requestPayload[recipientId] = [];
        }
        
        requestPayload[recipientId].push({
          resource_type: selectedItem.name,
          quantity: parseInt(input.quantity),
          item_id: selectedItem.item_id
        });
      });
      
      // Send request to API
      const response = await fetch(`${API_BASE_URL}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setPopupMessage(`Request sent successfully! ${result.success_count} items requested.`);
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2000);
        
        // Reset form
        setRequestFormInputs([{ recipientId: "", itemId: "", quantity: 1 }]);
        
        // Refresh requests
        fetchRequests();
      } else {
        setErrorMessage(`Error: ${result.message || 'Failed to send request'}`);
      }
      
    } catch (error) {
      console.error('Error sending request:', error);
      setErrorMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle request response (accept/reject)
  const handleResponse = async (requestId, action) => {
    try {
      setIsLoading(true);
      
      // Send response to API
      const response = await fetch(`${API_BASE_URL}/requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: action,
          responder_id: currentUserCharityId
        })
      });
      
      if (response.ok) {
        setPopupMessage(`Request ${action === 'accepted' ? 'accepted' : 'rejected'} successfully!`);
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2000);
        
        // Refresh requests
        fetchRequests();
      } else {
        const error = await response.json();
        setErrorMessage(`Error: ${error.message || `Failed to ${action} request`}`);
      }
      
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      setErrorMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
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

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4" role="alert">
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        <p className="mt-6 mb-2 font-bold text-left">Food choice:</p>

        {/* Food inputs based on potential charity items */}
        {requestFormInputs.map((input, index) => (
          <div key={index} className="flex justify-center items-start gap-4 mt-4">
            <div className="flex gap-6 bg-[#f7f0ea] p-4 rounded-2xl border border-black w-[85%] justify-center">
              <div className="flex flex-col">
                <label className="text-sm mb-1">Charity</label>
                <select
                  className="border px-2 py-1 rounded-md"
                  value={input.recipientId}
                  onChange={(e) => {
                    const newRecipientId = e.target.value;
                    // Only update if this won't create a duplicate
                    if (input.itemId && isDuplicateRequest(newRecipientId, input.itemId)) {
                      setPopupMessage("This charity-item combination is already selected.");
                      setShowPopup(true);
                      setTimeout(() => setShowPopup(false), 2000);
                      return;
                    }
                    handleInputChange(index, 'recipientId', newRecipientId);
                  }}
                >
                  <option value="">Select Charity</option>
                  {potentialCharities.map(charity => (
                    <option key={charity.charity_id} value={charity.charity_id}>
                      {charity.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm mb-1">Food Item</label>
                <select
                  className="border px-2 py-1 rounded-md"
                  value={input.itemId}
                  disabled={!input.recipientId}
                  onChange={(e) => {
                    const newItemId = e.target.value;
                    // Only update if this won't create a duplicate
                    if (isDuplicateRequest(input.recipientId, newItemId)) {
                      setPopupMessage("This charity-item combination is already selected.");
                      setShowPopup(true);
                      setTimeout(() => setShowPopup(false), 2000);
                      return;
                    }
                    handleInputChange(index, 'itemId', newItemId);
                  }}
                >
                  <option value="">Select Item</option>
                  {input.recipientId && potentialCharities
                    .find(c => c.charity_id === input.recipientId)?.items
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
                  max={input.recipientId && input.itemId ?
                    potentialCharities
                      .find(c => c.charity_id === input.recipientId)?.items
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

        {/* Charity Display Section */}
        <p className="mt-6 mb-2 font-bold text-left">Available Charities to ask from:</p>
        <div className="bg-[#f7f0ea] p-4 rounded-xl border border-black mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {potentialCharities.map(charity => (
              <div key={charity.charity_id} className="bg-white p-3 rounded-lg shadow">
                <h3 className="font-bold text-lg">{charity.name}</h3>
                <p className="text-sm text-gray-600 mb-2">Available Items:</p>
                <ul className="list-disc list-inside text-sm">
                  {charity.items.slice(0, 3).map(item => (
                    <li key={item.item_id}>
                      {item.name} (Qty: {item.quantity})
                    </li>
                  ))}
                  {charity.items.length > 3 && (
                    <li className="text-gray-500">+{charity.items.length - 3} more items</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            className="mt-6 px-6 py-2 rounded-full bg-[#f56275] text-white font-bold"
            disabled={isLoading}
          >
            {isLoading ? "SUBMITTING..." : "SUBMIT"}
          </button>
        </div>
      </div>

      {showPopup && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 bg-[#f56275] text-white px-6 py-2 rounded-full shadow-lg z-50">
          {popupMessage}
        </div>
      )}

      {/* Outgoing and Incoming Requests */}
      <div className="flex flex-col md:flex-row gap-6 mt-10 px-8">
        {/* Outgoing */}
        <div className="w-full md:w-1/2 bg-[#f4d1cb] p-4 rounded-xl border border-black">
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
                  {outgoingOpen === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {outgoingOpen === idx && (
                  <div className="p-2 border-t border-gray-300">
                    <p>Date: {new Date(requests[0].timestamp).toLocaleDateString()}</p>
                    {requests.map((request, i) => (
                      <div key={i} className="flex items-center justify-between mb-2">
                        <p>{request.resource_type} (Qty: {request.quantity})</p>
                        <span
                          className={`text-white text-sm px-3 py-1 rounded-full ${
                            request.status === "accepted"
                              ? "bg-[#9fca4b]"
                              : request.status === "rejected"
                                ? "bg-[#bd1f15]"
                                : "bg-[#fba387]"
                          }`}
                        >
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Incoming */}
        <div className="w-full md:w-1/2 bg-[#f4d1cb] p-4 rounded-xl border border-black">
          <h3 className={`text-2xl mb-4 ${cormorant.variable} font-serif`}>Incoming requests</h3>

          {incomingRequests.length === 0 ? (
            <p className="text-center italic text-gray-500">No incoming requests</p>
          ) : (
            incomingRequests.map((request, idx) => (
              <div key={idx} className="bg-[#f7f0ea] p-3 rounded-lg mb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold">{request.quantity} {request.resource_type}</p>
                    <p className="text-sm text-[#333]">From: {getCharityName(request.sender_id)}</p>
                    <p className="text-sm text-[#333]">Date: {new Date(request.timestamp).toLocaleDateString()}</p>

                    {request.status !== "pending" && (
                      <p className={`text-sm font-bold ${
                        request.status === "accepted" ? "text-green-600" : "text-red-600"
                      }`}>
                        Status: {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </p>
                    )}
                  </div>

                  {request.status === "pending" && (
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleResponse(request.id, 'accepted')}
                        className="bg-[#9fca4b] px-4 py-1 rounded-full text-white"
                        disabled={isLoading}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleResponse(request.id, 'rejected')}
                        className="bg-[#bd1f15] px-4 py-1 rounded-full text-white"
                        disabled={isLoading}
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
    </div>
  );
}