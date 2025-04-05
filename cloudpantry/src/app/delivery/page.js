"use client"

import { useState, useEffect } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { charityApi } from '@/lib/charityApi';
import { scheduleDelivery } from '@/lib/allocationService';
import { confirmDelivery } from '@/lib/deliveryConfirmationService';
import { getAllRecipients } from '@/lib/recipientApi';
import { ChevronDown, ChevronUp } from "lucide-react";
import CharityItemsDisplay from '@/components/CharityItemsDisplay';

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

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

const CHARITY_ID = typeof window !== "undefined" ? parseInt(localStorage.getItem("charityID")) : 0;

// Component to display recipient allocation with collapsible items list
const RecipientAllocation = ({ recipient, allRecipients }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Find the recipient details from allRecipients based on ID
  const recipientDetails = allRecipients.find(r => r.ID === recipient.recipient_id);
  
  if (!recipientDetails) {
    return <div className="py-3 border-b border-[#f8bdc1]">Recipient data not found</div>;
  }

  return (
    <div className="py-3 border-b border-[#f8bdc1]">
      <div className="flex justify-between items-start">
        <div>
          <p>ADDRESS: {recipientDetails.Address}</p>
          <p>POSTAL CODE: {recipientDetails.Address.match(/\d{6}/) ? recipientDetails.Address.match(/\d{6}/)[0] : "N/A"}</p>
        </div>
        <div className="text-right">
          <p>NAME: {recipientDetails.Name}</p>
          <p>PHONE: {recipientDetails.PhoneNumber}</p>
        </div>
      </div>
      
      <div className="mt-2">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center text-sm text-[#f56275] font-medium"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className="ml-1">{expanded ? "Hide" : "Show"} items ({recipient.items.length})</span>
        </button>
        
        {expanded && (
          <div className="mt-2 pl-4 bg-white/50 rounded p-2">
            {recipient.items.map((item, idx) => (
              <div key={idx} className="mb-1 text-sm">
                <span className="font-medium">{item.name}</span> ({item.quantity}) - {item.type}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Component to display recipients with no allocations
const EmptyAllocationsDisplay = ({ emptyAllocations, allRecipients }) => {
  if (!emptyAllocations || emptyAllocations.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-6 bg-[#f4d1cb] rounded-xl p-4 border border-black">
      <h3 className="text-xl font-bold mb-4 text-center">Recipients Assigned No Items</h3>
      
      <div className="divide-y divide-[#f8bdc1]">
        {emptyAllocations.map((recipient, index) => {
          // Find recipient details
          const recipientDetails = allRecipients.find(r => r.ID === recipient.recipient_id);
          
          if (!recipientDetails) {
            return (
              <div key={index} className="py-3">
                Recipient data not found (ID: {recipient.recipient_id})
              </div>
            );
          }
          
          return (
            <div key={index} className="py-3">
              <div className="flex justify-between items-start">
                <div>
                  <p>ADDRESS: {recipientDetails.Address}</p>
                  <p>POSTAL CODE: {recipientDetails.Address.match(/\d{6}/) ? recipientDetails.Address.match(/\d{6}/)[0] : "N/A"}</p>
                </div>
                <div className="text-right">
                  <p>NAME: {recipientDetails.Name}</p>
                  <p>PHONE: {recipientDetails.PhoneNumber}</p>
                </div>
              </div>
              <div className="mt-2 text-sm italic text-gray-600">
                No items could be allocated to this recipient.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Component to display shortage items
const ShortageItemsDisplay = ({ shortageItems }) => {
  if (!shortageItems || shortageItems.length === 0) {
    return null;
  }
  
  // Group shortage items by charity_category and type
  const groupedShortages = {};
  
  shortageItems.forEach(item => {
    const key = `${item.charity_category}|${item.type}`;
    
    if (!groupedShortages[key]) {
      groupedShortages[key] = {
        charity_category: item.charity_category,
        type: item.type,
        quantity_needed: 0
      };
    }
    
    groupedShortages[key].quantity_needed += item.quantity_needed;
  });
  
  const sortedShortages = Object.values(groupedShortages).sort((a, b) => 
    a.charity_category.localeCompare(b.charity_category) || 
    a.type.localeCompare(b.type)
  );

  return (
    <div className="w-full mt-6 bg-[#f4d1cb] rounded-xl p-4 border border-black">
      <h3 className="text-xl font-bold mb-4 text-center">Shortage Items</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedShortages.map((item, index) => (
          <div key={index} className="bg-white/50 rounded p-3 border border-[#f8bdc1]">
            <p className="font-bold">{item.charity_category}</p>
            <div className="flex justify-between mt-1">
              <span>Type: {item.type}</span>
              <span className="font-medium">Quantity needed: {item.quantity_needed}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Delivery() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [confirmStart, setConfirmStart] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedulingError, setSchedulingError] = useState(null);
  const [allocation_result, setAllocationResult] = useState(null);
  const [potential_charities, setPotentialCharities] = useState([]);
  const [allRecipients, setAllRecipients] = useState([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState(null);
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);
  const [allDeliveriesComplete, setAllDeliveriesComplete] = useState(false);

  useEffect(() => {
    // Check if there's an active delivery
    const savedActiveDelivery = localStorage.getItem('activeDelivery');
    if (savedActiveDelivery === 'true') {
      const savedDeliveryState = JSON.parse(localStorage.getItem('deliveryState') || '{}');
      
      // Check if all deliveries were complete in the saved state
      if (savedDeliveryState.allDeliveriesComplete) {
        // If all deliveries were complete, clear localStorage and don't restore state
        localStorage.removeItem('activeDelivery');
        localStorage.removeItem('deliveryState');
      } else {
        // Restore all relevant state if deliveries were not complete
        setSelectedDate(savedDeliveryState.selectedDate || getTodayDate());
        setConfirmStart(true);
        setCurrentStopIndex(savedDeliveryState.currentStopIndex || 0);
        setAllocationResult(savedDeliveryState.allocation_result || null);
        setPotentialCharities(savedDeliveryState.potential_charities || []);
        setConfirmationSuccess(true);
        setAllDeliveriesComplete(savedDeliveryState.allDeliveriesComplete || false);
      }
    } else {
      // Even if there's no active delivery, try to get potential_charities
      const savedPotentialCharities = localStorage.getItem('potential_charities');
      if (savedPotentialCharities) {
        setPotentialCharities(JSON.parse(savedPotentialCharities));
      }
    }
    
    const fetchRecipients = async () => {
      try {
        const recipients = await getAllRecipients();
        setAllRecipients(recipients);
      } catch (error) {
        console.error('Error fetching recipients:', error);
      }
    };
  
    fetchRecipients();
  }, []);

  // Save state to localStorage whenever important state changes
  useEffect(() => {
    if (allDeliveriesComplete) {
      // Immediately clear saved state when all deliveries are complete
      localStorage.removeItem('activeDelivery');
      localStorage.removeItem('deliveryState');
    } else if (confirmationSuccess) {
      // Only save if delivery is confirmed and started but not complete
      localStorage.setItem('activeDelivery', 'true');
      
      const stateToSave = {
        selectedDate,
        currentStopIndex,
        allocation_result,
        potential_charities,
        allDeliveriesComplete
      };
      
      localStorage.setItem('deliveryState', JSON.stringify(stateToSave));
    }
  }, [confirmationSuccess, currentStopIndex, allocation_result, potential_charities, allDeliveriesComplete, selectedDate]);

  const handleScheduleDelivery = async () => {
    try {
      setIsScheduling(true);
      setSchedulingError(null);
      setConfirmationSuccess(false);
      setAllDeliveriesComplete(false);
      
      // Clear any previously saved delivery state
      localStorage.removeItem('activeDelivery');
      localStorage.removeItem('deliveryState');
      
      // Use the charity ID from localStorage or use a default for testing
      const charityId = CHARITY_ID || 2; // Using default ID 2 if not found in localStorage
      
      const result = await scheduleDelivery(charityId, selectedDate);
      
      setAllocationResult(result);
      
      // Extract potential_charities from the result and save to state
      if (result && result.potential_charities) {
        setPotentialCharities(result.potential_charities);
        
        // Save potential_charities to localStorage immediately after scheduling
        localStorage.setItem('potential_charities', JSON.stringify(result.potential_charities));
      } else {
        setPotentialCharities([]);
        localStorage.setItem('potential_charities', JSON.stringify([]));
      }
      
      setIsScheduling(false);
    } catch (error) {
      setSchedulingError(error.message);
      setIsScheduling(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      setConfirmationError(null);
      
      // Get values from state
      const charityId = CHARITY_ID || 2;
      const { allocation_list, excess_items } = allocation_result;
      const delivery_date = selectedDate;
      
      // Call the confirm delivery endpoint
      await confirmDelivery(charityId, allocation_list, excess_items, delivery_date);
      
      // Handle successful confirmation
      setConfirmationSuccess(true);
      setConfirmStart(true);
      setCurrentStopIndex(0);
      setIsConfirming(false);
      setAllDeliveriesComplete(false);
      
      // Save initial delivery state
      localStorage.setItem('activeDelivery', 'true');
      
      const stateToSave = {
        selectedDate,
        currentStopIndex: 0,
        allocation_result,
        potential_charities,
        allDeliveriesComplete: false
      };
      
      localStorage.setItem('deliveryState', JSON.stringify(stateToSave));
    } catch (error) {
      setConfirmationError(error.message);
      setIsConfirming(false);
    }
  };

  const handleCheck = (index) => {
    const deliveries = allocation_result?.allocation_list || [];
    
    if (index === currentStopIndex) {
      // If this is the last recipient
      if (currentStopIndex === deliveries.length - 1) {
        setAllDeliveriesComplete(true); // Mark all deliveries as complete
        
        // Clear saved state when all deliveries are complete
        localStorage.removeItem('activeDelivery');
        localStorage.removeItem('deliveryState');
      } else {
        // Move to the next recipient
        setCurrentStopIndex(currentStopIndex + 1);
      }
    }
  };

  // Reset the delivery state completely
  const resetDeliveryState = () => {
    setConfirmStart(false);
    setConfirmationSuccess(false);
    setAllDeliveriesComplete(false);
    setCurrentStopIndex(0);
    setAllocationResult(null);
    setPotentialCharities([]);
    
    // Clear local storage
    localStorage.removeItem('activeDelivery');
    localStorage.removeItem('deliveryState');
  };

  // Use allocation_result.allocation_list if available, otherwise fallback to empty array
  const deliveries = allocation_result?.allocation_list || [];
  const shortageItems = allocation_result?.shortage_items || [];
  const emptyAllocations = allocation_result?.empty_allocations || [];

  // Determine whether to show the delivery details
  const showDeliveryDetails = !allDeliveriesComplete && (allocation_result?.allocation_list || []).length > 0;

  return (
    <div className={`min-h-screen bg-[#f7f0ea] ${dmSans.variable}`}>
      {/* Hero Section */}
      <div className="text-center py-10 bg-[#f4d1cb]">
        <h1 className={`text-5xl font-bold ${cormorant.variable} font-serif`}>Upcoming deliveries</h1>
        <p className="text-md mt-2">Check out your upcoming deliveries!</p>
      </div>

      {/* Main Section */}
      <div className="flex flex-col px-10 pb-12 mt-10 items-center">
        {/* Top Section with Delivery List and Map */}
        <div className="flex gap-6 w-full items-start">
          {/* Delivery List */}
          <div className="w-1/2 min-h-[200px] bg-[#f4d1cb] rounded-xl p-4 border border-black">
            <h3 className="text-xl font-bold mb-4 text-center">Optimised Order of Delivery</h3>
            
            {allDeliveriesComplete ? (
              <p className="text-center py-20 text-lg">All deliveries completed! Schedule new deliveries when ready.</p>
            ) : allocation_result?.allocation_list ? (
              // Show allocation list from the API result
              allocation_result.allocation_list.map((recipient, index) => (
                <div key={index} className="flex items-start gap-3">
                  {confirmStart && (
                    <input
                      type="checkbox"
                      checked={index < currentStopIndex || (allDeliveriesComplete && index === deliveries.length - 1)}
                      onChange={() => handleCheck(index)}
                      className="accent-[#f56275] w-5 h-5 mt-3"
                    />
                  )}
                  <div className="w-full">
                    <RecipientAllocation 
                      recipient={recipient} 
                      allRecipients={allRecipients} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-20 text-lg">Click "Schedule Delivery" to see deliveries!</p>
            )}
            
            {allocation_result?.allocation_list && allocation_result.allocation_list.length === 0 && !allDeliveriesComplete && (
              <p className="text-center py-20 text-lg">No deliveries available for this date!</p>
            )}
          </div>

          {/* Filter & Map Section */}
          <div className={`w-1/2 bg-[#f4d1cb] rounded-xl border border-black p-6 flex flex-col items-center ${confirmStart && !allDeliveriesComplete ? "min-h-[500px]" : "min-h-[200px]"}`}>
            {allDeliveriesComplete ? (
              <div className="flex flex-col items-center justify-center h-full w-full">
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4 text-center">
                  <p className="font-bold">All deliveries completed!</p>
                  <p>Great job completing all the deliveries.</p>
                </div>
                <button
                  onClick={resetDeliveryState}
                  className="bg-[#f56275] text-white font-bold px-8 py-3 rounded-full"
                >
                  Schedule New Delivery
                </button>
              </div>
            ) : (
              <>
                <label className="text-lg font-bold mb-2">Filter date here:</label>
                <input
                  type="date"
                  className="border px-4 py-2 rounded-full text-center mb-4"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    resetDeliveryState();
                  }}
                  disabled={confirmationSuccess && !allDeliveriesComplete} // Only disable when delivery is in progress
                />

                {/* Schedule Delivery Button - Show when not confirmed */}
                {!confirmationSuccess && (
                  <button
                    className="bg-[#f56275] text-white font-bold px-6 py-2 rounded-full mb-4"
                    onClick={handleScheduleDelivery}
                    disabled={isScheduling}
                  >
                    {isScheduling ? "Scheduling..." : "Schedule Delivery"}
                  </button>
                )}

                {schedulingError && (
                  <p className="text-red-500 text-sm mb-2">{schedulingError}</p>
                )}

                {/* Only show the Confirm section after scheduling and before confirmation */}
                {allocation_result && allocation_result.allocation_list?.length > 0 && !confirmationSuccess && (
                  <>
                    <label className="text-lg font-bold mb-2">Start the delivery?</label>
                    <button
                      className="bg-[#f56275] text-white font-bold px-6 py-2 rounded-full"
                      onClick={handleConfirm}
                      disabled={isConfirming}
                    >
                      {isConfirming ? "CONFIRMING..." : "CONFIRM"}
                    </button>
                    
                    {confirmationError && (
                      <p className="text-red-500 text-sm mt-2">{confirmationError}</p>
                    )}
                  </>
                )}
                
                {confirmationSuccess && !allDeliveriesComplete && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mt-2">
                    <p className="font-bold">Delivery confirmed!</p>
                    <p>You can now start your delivery.</p>
                  </div>
                )}

                {confirmStart && deliveries.length > 0 && currentStopIndex < deliveries.length && !allDeliveriesComplete && (
                  <div className="w-full mt-4">
                    {/* Find the current recipient details */}
                    {(() => {
                      const currentRecipient = deliveries[currentStopIndex];
                      const recipientDetails = allRecipients.find(r => r.ID === currentRecipient.recipient_id);
                      
                      return (
                        <iframe
                          className="w-full h-[300px] rounded-xl"
                          src={`https://www.google.com/maps?q=${encodeURIComponent(
                            recipientDetails?.Address || "Singapore"
                          )}&output=embed`}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        ></iframe>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Empty Allocations Display (only show before confirmation and not when all deliveries are complete) */}
        {allocation_result && !confirmationSuccess && !allDeliveriesComplete && (
          <EmptyAllocationsDisplay 
            emptyAllocations={emptyAllocations} 
            allRecipients={allRecipients} 
          />
        )}
        
        {/* Shortage Items Display (only show before confirmation and not when all deliveries are complete) */}
        {allocation_result && !confirmationSuccess && !allDeliveriesComplete && (
          <ShortageItemsDisplay shortageItems={shortageItems} />
        )}
      </div>

    {/* Resources Request Section - Only show when NOT all deliveries complete or no deliveries in progress */}
    {!confirmationSuccess || allDeliveriesComplete ? (
    <div className="bg-[#f4d1cb] p-10 mt-10">
        <h2 className={`text-5xl ${cormorant.variable} font-serif text-center`}>Need More Resources?</h2>
        <p className="text-lg text-center mt-2">Here are some potential charities to consider.</p>

        {/* Using the modularized CharityItemsDisplay component */}
        <CharityItemsDisplay potential_charities={potential_charities} />

        {/* Request Button */}
        <div className="flex justify-center mt-6">
        <button
            onClick={() => window.location.href = '/request'} 
            className="bg-[#f56275] text-white font-bold px-6 py-2 rounded-full"
        >
            REQUEST HERE NOW 
        </button>
        </div>
    </div>
    ) : null}
    </div>
  );
}