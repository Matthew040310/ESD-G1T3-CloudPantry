"use client";

import { useState, useEffect, useCallback } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import CharityItemsDisplay from '@/components/CharityItemsDisplay';
import { getItemNameById } from '../../lib/getItemNameById';

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
const API_BASE_URL = "http://localhost:5199";

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
  const [charityNameMap, setCharityNameMap] = useState({}); // New state for charity ID to name mapping

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [outgoingOpen, setOutgoingOpen] = useState(null);

  const [itemNames, setItemNames] = useState({});

  // Fetch incoming/outgoing requests from API
  const fetchRequests = useCallback(async () => {
    if (!currentUserCharityId) return;
    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/requests?charity_id=${currentUserCharityId}&direction=incoming`),
        fetch(`${API_BASE_URL}/requests?charity_id=${currentUserCharityId}&direction=outgoing`)
      ]);

      if (!incomingResponse.ok) throw new Error(`Incoming fetch failed: ${incomingResponse.statusText}`);
      if (!outgoingResponse.ok) throw new Error(`Outgoing fetch failed: ${outgoingResponse.statusText}`);

      const incomingResult = await incomingResponse.json();
      const outgoingResult = await outgoingResponse.json();

      setIncomingRequests(incomingResult.data || []);
      setOutgoingRequests(outgoingResult.data || []);
      setErrorMessage("");

    } catch (error) {
      console.error("Error fetching requests:", error);
      setErrorMessage(`Failed to fetch requests: ${error.message}. Auto-refreshing...`);
    }
  }, [currentUserCharityId]);

  // Initialize data on component mount
  useEffect(() => {
    const userCharityId = localStorage.getItem('charityID');
    if (userCharityId) setCurrentUserCharityId(userCharityId);
    else console.warn("Charity ID not found in localStorage.");

    // Create charity ID to name mapping for IDs 1-4
    const charityData = [
      { id: 1, name: "Willing Hearts" },
      { id: 2, name: "Food From The Heart" },
      { id: 3, name: "Food Bank" },
      { id: 4, name: "Food Bank SG" }
    ];
    
    const nameMap = {};
    charityData.forEach(charity => {
      nameMap[String(charity.id)] = charity.name;
    });
    setCharityNameMap(nameMap);

    const potentialCharitiesStr = localStorage.getItem('potential_charities');
    const allNames = { ...nameMap }; // Start with our static mapping
    
    if (potentialCharitiesStr) {
      try {
        const parsedCharities = JSON.parse(potentialCharitiesStr);
        setPotentialCharities(parsedCharities);
        
        // If any charity in potential_charities doesn't have a name in our map yet, use a generic name
        parsedCharities.forEach(charity => {
          const charityId = String(charity.charity_id);
          if (!allNames[charityId]) {
            allNames[charityId] = `Charity ${charityId}`;
          }
        });
      } catch (error) {
        console.error('Error parsing potential charities:', error);
      }
    } else {
      console.warn("Potential charities not found in localStorage.");
    }

    const currentUserName = localStorage.getItem('charityName');
    if (currentUserName && userCharityId) {
      allNames[userCharityId] = currentUserName;
    }
    
    setCharityNames(allNames);
  }, []);

  // Start polling for requests when charity ID is available
  useEffect(() => {
    if (!currentUserCharityId) return;
    fetchRequests();
    const intervalId = setInterval(fetchRequests, 5000);
    return () => clearInterval(intervalId);
  }, [currentUserCharityId, fetchRequests]);

  useEffect(() => {
    const fetchItemNames = async () => {
      const names = {};
      
      for (const request of incomingRequests) {
        try {
          const name = await getItemNameById(request.item_id || request.id);
          names[request.id] = name;
        } catch (error) {
          console.error(`Failed to fetch name for item ${request.id}:`, error);
          names[request.id] = 'Unknown Item';
        }
      }
      
      setItemNames(names);
    };
    
    if (incomingRequests.length > 0) {
      fetchItemNames();
    }
  }, [incomingRequests]);

  // --- Form Input Handlers ---
  const handleAddInput = () => {
    setRequestFormInputs([...requestFormInputs, { recipientId: "", itemId: "", quantity: 1 }]);
  };
  
  const handleRemoveInput = (index) => {
    const updated = [...requestFormInputs];
    updated.splice(index, 1);
    setRequestFormInputs(updated);
  };
  
  const handleInputChange = (index, field, value) => {
    const updated = [...requestFormInputs];
    updated[index][field] = value;
    if (field === 'recipientId') {
      updated[index].itemId = '';
    }
    setRequestFormInputs(updated);
  };
  
  const isDuplicateRequest = (recipientId, itemId) => {
    return requestFormInputs.some(input =>
      input.recipientId && input.itemId && 
      String(input.recipientId) === String(recipientId) && 
      String(input.itemId) === String(itemId)
    );
  };

  // --- API Interaction Handlers ---
  const handleSubmit = async () => {
    if (!currentUserCharityId) {
      setErrorMessage("User Charity ID missing.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
  
    const validInputs = requestFormInputs.filter(input => 
      input.recipientId && input.itemId && input.quantity > 0
    );
    
    if (validInputs.length === 0) {
      setPopupMessage('Please select valid charity, item, and quantity.');
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 3000);
      setIsLoading(false);
      return;
    }
  
    const requestPayload = { sender_id: currentUserCharityId };
    let dataError = false;
  
    validInputs.forEach(input => {
      const recipientId = String(input.recipientId);
      const selectedCharity = potentialCharities.find(c => 
        String(c.charity_id) === recipientId
      );
      
      if (!selectedCharity) {
        console.error(`Data error: Charity ${recipientId} not found.`);
        dataError = true;
        return;
      }
  
      const selectedItem = selectedCharity.items?.find(i => 
        String(i.item_id) === String(input.itemId)
      );
      
      if (!selectedItem) {
        console.error(`Data error: Item ${input.itemId} not found for charity ${recipientId}.`);
        dataError = true;
        return;
      }
  
      if (!requestPayload[recipientId]) {
        requestPayload[recipientId] = [];
      }
  
      requestPayload[recipientId].push({
        notification: selectedItem.name,
        category: selectedItem.category || "Unknown Category",
        quantity: parseInt(input.quantity),
        item_id: selectedItem.item_id
      });
    });
  
    if (dataError) {
      setErrorMessage("Error preparing request: Data lookup failed. Please refresh.");
      setIsLoading(false);
      return;
    }
  
    try {
      const response = await fetch(`${API_BASE_URL}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
      
      const result = await response.json();
      
      if (response.ok && (response.status === 200 || response.status === 201 || response.status === 207)) {
        setPopupMessage(result.message || `Request processed.`);
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 3000);
        setRequestFormInputs([{ recipientId: "", itemId: "", quantity: 1 }]);
        fetchRequests();
      } else {
        setErrorMessage(`Error ${response.status}: ${result.error || result.message || 'Failed request'}`);
      }
    } catch (error) {
      console.error('Error sending request:', error);
      setErrorMessage(`Network error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle accepting or rejecting an incoming request
  const handleResponse = async (requestId, action) => {
    if (!currentUserCharityId || !requestId) {
      setErrorMessage("Cannot respond: Missing IDs.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    
    try {
      const response = await fetch(`${API_BASE_URL}/requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, responder_id: currentUserCharityId })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setPopupMessage(`Request ${action} successfully!`);
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 2000);
        fetchRequests();
      } else {
        setErrorMessage(`Error ${response.status}: ${result.error || result.message || `Failed ${action}`}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      setErrorMessage(`Network error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Helper Functions ---
  const getCharityName = (id) => charityNameMap[String(id)] || charityNames[String(id)] || `Charity ${id}`;

  // --- Data Processing for Display ---
  const groupedOutgoingRequests = outgoingRequests.reduce((acc, req) => {
    const recipientId = String(req.recipient_id || 'unknown');
    if (!acc[recipientId]) {
      acc[recipientId] = [];
    }
    const isDuplicate = acc[recipientId].some(
      ex => String(ex.item_id) === String(req.item_id) && 
            ex.category === req.category && 
            ex.status === req.status
    );
    if (!isDuplicate) {
      acc[recipientId].push(req);
    }
    return acc;
  }, {});

  // Filter potential charities for the recipient dropdown (exclude self)
  const recipientOptions = potentialCharities.filter(c => 
    String(c.charity_id) !== String(currentUserCharityId)
  );

  // --- JSX Rendering ---
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

        <p className="mt-6 mb-2 font-bold text-left">Request items:</p>

        {/* Form Input Rows */}
        {requestFormInputs.map((input, index) => (
          <div key={index} className="flex justify-center items-start gap-4 mt-4">
            <div className="flex flex-wrap gap-4 md:gap-6 bg-[#f7f0ea] p-4 rounded-2xl border border-black w-full md:w-[85%] justify-center">
              {/* Charity Dropdown with explicit styling */}
              <div className="flex flex-col">
                <label className="text-sm mb-1">Charity</label>
                <select
                  className="border px-2 py-1 rounded-md min-w-[150px] relative z-10 text-black"
                  value={input.recipientId}
                  onChange={(e) => handleInputChange(index, 'recipientId', e.target.value)}
                >
                  <option value="">Select Charity</option>
                  {recipientOptions.map(charity => (
                    <option key={charity.charity_id} value={String(charity.charity_id)}>
                      {getCharityName(charity.charity_id)}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Item Dropdown */}
              <div className="flex flex-col">
                <label className="text-sm mb-1">Item</label>
                <select
                  className="border px-2 py-1 rounded-md min-w-[150px] text-black"
                  value={input.itemId}
                  disabled={!input.recipientId}
                  onChange={(e) => {
                     const newItemId = e.target.value;
                     if (isDuplicateRequest(input.recipientId, newItemId)) {
                         setPopupMessage("Item already selected for this charity.");
                         setShowPopup(true);
                         setTimeout(() => setShowPopup(false), 3000);
                         return;
                     }
                    handleInputChange(index, 'itemId', newItemId);
                  }}
                >
                  <option value="">Select Item</option>
                  {input.recipientId && potentialCharities
                    .find(c => String(c.charity_id) === String(input.recipientId))?.items
                    ?.map(item => (
                      <option key={item.item_id} value={String(item.item_id)}>
                        {item.name} {item.category ? `(${item.category})` : ''} 
                        {/* (Avail: {item.quantity}) */}
                      </option>
                    ))
                  }
                </select>
              </div>
              
              {/* Quantity Input */}
              <div className="flex flex-col">
                <label className="text-sm mb-1">Request Qty</label>
                <input
                  type="number"
                  value={input.quantity}
                  min="1"
                  max={input.recipientId && input.itemId ?
                    potentialCharities.find(c => String(c.charity_id) === String(input.recipientId))?.items
                      ?.find(i => String(i.item_id) === String(input.itemId))?.quantity || 1
                    : 1
                  }
                  onChange={(e) => {
                      const qty = parseInt(e.target.value) || 1;
                      const maxQty = input.recipientId && input.itemId ?
                          potentialCharities.find(c => String(c.charity_id) === String(input.recipientId))?.items
                          ?.find(i => String(i.item_id) === String(input.itemId))?.quantity || 1 : 1;
                      handleInputChange(index, 'quantity', Math.max(1, Math.min(qty, maxQty)));
                  }}
                  className="w-20 px-2 py-1 border rounded-md text-black"
                />
              </div>
            </div>
            
            {/* Add/Remove Buttons */}
            <div className="flex flex-col justify-start gap-2 mt-2">
              <button onClick={handleAddInput} className="text-green-600 hover:text-green-800"><Plus /></button>
              {requestFormInputs.length > 1 && (
                 <button onClick={() => handleRemoveInput(index)} className="text-red-600 hover:text-red-800"><Trash2 /></button>
              )}
            </div>
          </div>
        ))}

        {/* --- AVAILABLE CHARITIES DISPLAY --- */}
        <p className="mt-6 mb-2 font-bold text-left">Available Charities to ask from:</p>
        <CharityItemsDisplay potential_charities={potentialCharities.filter(c => String(c.charity_id) !== String(currentUserCharityId))} />

        {/* Submit Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            className="mt-6 px-6 py-2 rounded-full bg-[#f56275] text-white font-bold disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "SUBMITTING..." : "SUBMIT REQUEST(S)"}
          </button>
        </div>
      </div>

      {/* Popup Message */}
      {showPopup && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 bg-[#f56275] text-white px-6 py-2 rounded-full shadow-lg z-50">
          {popupMessage}
        </div>
      )}

      {/* Outgoing and Incoming Requests Display */}
      <div className="flex flex-col md:flex-row gap-6 mt-10 px-8">
        {/* Outgoing */}
        <div className="w-full md:w-1/2 bg-[#f4d1cb] p-4 rounded-xl border border-black">
          <h3 className={`text-2xl mb-4 ${cormorant.variable} font-serif`}>Outgoing requests</h3>
          {Object.entries(groupedOutgoingRequests).length === 0 ? (
             <p className="text-center italic text-gray-500">No outgoing requests</p>
           ) : (
             Object.entries(groupedOutgoingRequests).map(([recipientId, requests], idx) => (
               <div key={idx} className="bg-[#f7f0ea] rounded-lg mb-3 overflow-hidden border border-gray-300">
                 <button onClick={() => setOutgoingOpen(outgoingOpen === idx ? null : idx)} className="w-full text-left p-3 flex justify-between items-center font-medium">
                   <span>Request to: <span className="font-bold">{getCharityName(recipientId)}</span></span>
                   {outgoingOpen === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                 </button>
                 {outgoingOpen === idx && (
                   <div className="p-3 border-t border-gray-300 bg-white">
                     <p className="text-sm text-gray-500 mb-2">Sent: {new Date(requests[0].created_at || Date.now()).toLocaleDateString()}</p>
                     {requests.map((request) => (
                       <div key={request.id} className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 last:border-b-0 last:mb-0">
                         <p className="text-sm">{request.category || 'N/A'} (Qty: {request.quantity})</p>
                         <span className={`text-xs font-semibold px-3 py-1 rounded-full ${ 
                           request.status === "accepted" ? "bg-green-100 text-green-800" : 
                           request.status === "rejected" ? "bg-red-100 text-red-800" : 
                           request.status === "read" ? "bg-blue-100 text-blue-800" : 
                           "bg-yellow-100 text-yellow-800" 
                         }`}>
                           {request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'Unknown'}
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
             incomingRequests.map((request) => (
               <div key={request.id} className="bg-[#f7f0ea] p-3 rounded-lg mb-3 border border-gray-300">
                 <div className="flex justify-between items-center">
                   <div>
                     <p className="font-bold">{itemNames[request.id] || 'Loading...' || 'N/A'} (Qty: {request.quantity})</p>
                     <p className="text-sm text-gray-700">From: <span className="font-medium">{getCharityName(request.sender_id)}</span></p>
                     <p className="text-sm text-gray-500">Received: {new Date(request.created_at || Date.now()).toLocaleDateString()}</p>
                     {request.status !== "pending" && (
                       <p className={`text-sm font-bold mt-1 ${ 
                         request.status === "accepted" ? "text-green-600" : 
                         request.status === "rejected" ? "text-red-600" : 
                         request.status === "read" ? "text-blue-600" : 
                         "text-gray-600" 
                       }`}>
                         Status: {request.status ? request.status.charAt(0).toUpperCase() + request.status.slice(1) : 'Unknown'}
                       </p>
                     )}
                   </div>
                   {request.status === "pending" && (
                     <div className="flex flex-col gap-2 ml-4 flex-shrink-0">
                       <button 
                         onClick={() => handleResponse(request.id, 'accepted')} 
                         className="bg-[#9fca4b] px-4 py-1 rounded-full text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50" 
                         disabled={isLoading}
                       > 
                         Accept 
                       </button>
                       <button 
                         onClick={() => handleResponse(request.id, 'rejected')} 
                         className="bg-[#bd1f15] px-4 py-1 rounded-full text-white text-sm font-medium hover:bg-red-800 disabled:opacity-50" 
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