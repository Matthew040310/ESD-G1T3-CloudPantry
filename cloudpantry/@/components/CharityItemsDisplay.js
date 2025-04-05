// CharityItemsDisplay.js
"use client"

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * Component that displays charity cards with their available items
 * @param {Object[]} potential_charities - Array of charity objects with items
 * @param {Function} onCharityClick - Optional callback when a charity card is clicked (defaults to navigating to /request)
 */
const CharityItemsDisplay = ({ potential_charities, onCharityClick }) => {
  const [charityNames, setCharityNames] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle charity card click
  const handleCharityClick = (charityId) => {
    if (onCharityClick) {
      onCharityClick(charityId);
    } else {
      // Default behavior - navigate to request page
      window.location.href = '/request';
    }
  };

  useEffect(() => {
    const fetchCharityNames = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('https://personal-d4txim0d.outsystemscloud.com/Charity/rest/CharityAPI/GetAllCharityIDName');
        
        if (!response.ok) {
          throw new Error(`Error fetching charity names: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Create a mapping of ID to CharityName
        const nameMap = {};
        data.forEach(charity => {
          nameMap[charity.ID] = charity.CharityName;
        });
        
        setCharityNames(nameMap);
        setIsLoading(false);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchCharityNames();
  }, []);

  if (isLoading) {
    return <div className="text-center py-6">Loading charity information...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-6">Error: {error}</div>;
  }

  if (!potential_charities || potential_charities.length === 0) {
    return <div className="text-center py-6">No charities available</div>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-6 mt-6">
      {potential_charities.map((charity) => (
        <Card 
          key={charity.charity_id}
          onClick={() => handleCharityClick(charity.charity_id)} 
          className="bg-[#f7f0ea] w-80 border border-black cursor-pointer hover:ring-2 ring-[#f56275]"
        >
          <CardHeader>
            <CardTitle className="text-center font-bold">
              {charityNames[charity.charity_id] || `Charity ID: ${charity.charity_id}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium mb-2">Available Items:</p>
            <div className="max-h-40 overflow-y-auto">
              {charity.items.map((item) => (
                <div key={item.item_id} className="mb-2 p-2 bg-white/50 rounded">
                  <div className="flex justify-between">
                    <span>{item.name}</span>
                    <span className="text-sm">Qty: {item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CharityItemsDisplay;