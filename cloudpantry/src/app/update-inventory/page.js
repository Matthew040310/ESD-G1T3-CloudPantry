"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import CreatableSelect from 'react-select/creatable';
import callSupabaseAPI from "../../common/callSupabaseAPI.js"
import { INVENTORY_URL } from "../../common/pathVariables.js";


// Font Configurations
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

// API Data
// const CHARITY_ID = sessionStorage.getItem('CHARITY_ID')
const CHARITY_ID = 0

const initialItemState = {
  ID: "",
  charityID: CHARITY_ID,
  category: "",
  name: "",
  type: "",
  restrictions: [],
  expiry_date: "",
  quantity: "",
  fill_factor: 0
};

const TableRow = ({ index, item, onChange, allRestrictions, setAllRestrictions }) => {

  const handleCreateRestriction = (newValue) => {
    // Add to global restrictions only if not already exists
    setAllRestrictions(prev =>
      prev.includes(newValue) ? prev : [...prev, newValue]
    );
    // Add to current item's restrictions
    onChange(index, 'restrictions', [...item.restrictions, newValue]);
  };

  return (
    <tr>
      <td className="border border-black px-4 py-2">{index + 1}</td>

      <td className="border border-black px-4 py-2">
        <input
          type='number'
          value={item.quantity}
          onChange={(e) => onChange(index, 'quantity', e.target.value)}
          className="border p-2 rounded w-full"
        />
      </td>

      <td className="border border-black px-4 py-2">
        <select
          value={item.category}
          onChange={(e) => onChange(index, 'category', e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Select</option>
          <option value="Canned Goods">Canned Goods</option>
          <option value="Pasta & Grains">Pasta & Grains</option>
          <option value="Baby Food">Baby Food</option>
          <option value="Cooking Essentials">Cooking Essentials</option>
        </select>
      </td>

      <td className="border border-black px-4 py-2">
        <select
          value={item.type}
          onChange={(e) => onChange(index, 'type', e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Select</option>
          <option value="Carbs">Carbs</option>
          <option value="Protein">Protein</option>
          <option value="Fats">Fats</option>
          <option value="Vegetables">Vegetables</option>
          <option value="Others">Others</option>
        </select>
      </td>

      <td className="border border-black px-4 py-2">
        <input
          type='text'
          value={item.name}
          placeholder="Enter food description"
          onChange={(e) => onChange(index, 'name', e.target.value)}
          className="border p-2 rounded w-full"
        />
      </td>

      <td className="border border-black px-4 py-2">
        <CreatableSelect
          instanceId="my-select"
          isMulti={true}
          value={item.restrictions.map(r => ({ value: r, label: r }))}
          options={allRestrictions.map(r => ({ value: r, label: r }))}
          onChange={(newValue) => {
            const newRestrictions = newValue.map(v => v.value);
            onChange(index, 'restrictions', newRestrictions);
          }}
          onCreateOption={handleCreateRestriction}
          className="border p-2 rounded w-full"
        />
      </td>

      <td className="border border-black px-4 py-2">
        <input
          type='date'
          value={item.expiry_date}
          onChange={(e) => onChange(index, 'expiry_date', e.target.value)}
          className="border p-2 rounded w-full"
        />
      </td>
    </tr>
  )
};

export default function AddInventory() {
  const [newItems, setNewItems] = useState([initialItemState]);
  const [allRestrictions, setAllRestrictions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const searchParams = useSearchParams(); //  Get query params

  useEffect(() => {
    const id = searchParams.get("id"); // Get category from URL
    if (id) {
      fetchItemData(id).then(itemData => {
        if (itemData) {
          setNewItems([{
            ID: itemData.id,
            charityID: itemData.charityID,
            category: itemData.category,
            name: itemData.name,
            type: itemData.type,
            restrictions: itemData.restrictions,
            expiry_date: itemData.expiry_date,
            quantity: itemData.quantity,
            fill_factor: itemData.fill_factor
          }]);
        }
      });
    }
  }, [searchParams]); //  Runs when URL changes

  useEffect(() => {
    const fetchRestrictions = async () => {
      try {
        const restrictions = await callSupabaseAPI("GET", `${INVENTORY_URL}/restrictions`);
        setAllRestrictions([...new Set(restrictions)]);
      } catch (error) {
        console.error('Error fetching restrictions:', error);
      }
    };

    fetchRestrictions();
  }, []);

  const fetchItemData = async (itemId) => {
    try {
      const response = await callSupabaseAPI("GET", `${INVENTORY_URL}/item/${itemId}`);
      if (response.code === 200 && response.data.response.length > 0) {
        return response.data.response[0];
      }
    } catch (error) {
      console.error('Error fetching item data:', error);
    }
    return null;
  };

  const handleInputChange = (index, field, value) => {
    setNewItems(items => items.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };

        // Recalculate fill_factor when category or type changes
        if (field === 'category' || field === 'type') {
          updatedItem.fill_factor = calculateFillFactor(
            field === 'category' ? value : updatedItem.category,
            field === 'type' ? value : updatedItem.type
          );
        }

        return updatedItem;
      }
      return item;
    }));
  };

  const calculateFillFactor = (category, itemType) => {
    const baseFactor = 1;
    const categoryFactors = { "Canned Goods": 50, "Pasta & Grains": 30, "Baby Food": 20, "Cooking Essentials": 10 };
    const typeFactors = { "Carbs": 4, "Protein": 4, "Fats": 9, "Vegetables": 1, "Others": 1 };

    let fillFactor = baseFactor;
    if (category in categoryFactors) {
      fillFactor *= categoryFactors[category];
    }
    if (itemType in typeFactors) {
      fillFactor *= typeFactors[itemType];
    }
    return Number(fillFactor.toFixed(1));
  };

  const handleSubmit = async () => {
    const incompleteItems = newItems.map((item, index) => {
      const missingFields = [];
      if (!item.quantity) missingFields.push('Quantity');
      if (!item.category) missingFields.push('Category');
      if (!item.type) missingFields.push('Type');
      if (!item.name) missingFields.push('Name');
      if (!item.expiry_date) missingFields.push('Expiry Date');

      return missingFields.length > 0 ? { index, missingFields } : null;
    }).filter(Boolean);

    if (incompleteItems.length > 0) {
      const errorMessage = incompleteItems.map(item =>
        `Row ${item.index + 1} is missing: ${item.missingFields.join(', ')}`
      ).join('\n');

      alert(`Please complete the following rows:\n${errorMessage}`);
      return;
    }

    if (newItems.length === 0) {
      alert("Please fill in at least one complete row");
      return;
    }

    try {
      const response = await callSupabaseAPI("PUT", `${INVENTORY_URL}/${CHARITY_ID}`, newItems);
      if (response.code === 200) {
        alert('Inventory updated successfully!');
        router.push('/manage-inventory');
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
    }
  };

  const router = useRouter();
  const handleReturn = () => {
    router.push('/manage-inventory');
  }

  return (
    <div
      className={`min-h-screen bg-[#f7f0ea] ${dmSans.variable}`}
    >

      {/* Hero Section */}
      <div className="bg-[#f4d1cb] text-center py-12">
        <h1
          className={`text-6xl font-bold text-black ${cormorant.variable} font-[family-name:var(--font-cormorant)]`}
        >
          Update Inventory
        </h1>
      </div>

      {/* Chart Section */}
      <div className="px-12 py-1">
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-[#f46274] text-white text-lg">
                <th className="border border-black px-4 py-2">#</th>
                <th className="border border-black px-4 py-2">Qty</th>
                <th className="border border-black px-4 py-2">Category</th>
                <th className="border border-black px-4 py-2">Type</th>
                <th className="border border-black px-4 py-2">Name</th>
                <th className="border border-black px-4 py-2">Restrictions</th>
                <th className="border border-black px-4 py-2">Expiry Date</th>
              </tr>
            </thead>
            <tbody>
              {newItems.map((item, index) => (
                <TableRow
                  key={index}
                  index={index}
                  item={item}
                  onChange={handleInputChange}
                  allRestrictions={allRestrictions}
                  setAllRestrictions={setAllRestrictions}
                />
              ))}
            </tbody>

          </table>


          {/* Request Resources Section */}
          <div className="relative bg-[#F8D5CD] py-8 px-4 text-center">
            <button
              className="bg-[#F7F0EA] text-black font-medium py-3 px-8 rounded-full
            hover:bg-[#E5DFD7] transition-colors duration-300"
              onClick={handleSubmit}>
              Update Inventory
            </button>
            <button
              className="bg-[#F7F0EA] text-black font-medium py-2 px-4 rounded-full
            hover:bg-[#E5DFD7] transition-colors duration-300 absolute bottom-4 right-4"
              onClick={handleReturn}>
              Back to Manage Inventory
            </button>
          </div>
        </div>
      </div>
    </div>
  )
};