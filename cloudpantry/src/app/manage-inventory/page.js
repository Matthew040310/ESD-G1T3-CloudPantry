"use client";
import React, { useState, useEffect } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Image from "next/image";
import { useSearchParams } from "next/navigation";



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



// Dummy database with 30 rows
const initialData = Array.from({ length: 30 }, (_, i) => ({
    id: (i + 1).toString().padStart(2, "0"),
    category: ["CANNED GOODS", "PASTA & GRAINS", "BABY FOOD", "COOKING ESSENTIALS"][i % 4],
    type: ["CANNED PINEAPPLES", "BAKED BEANS", "RICE", "MILK POWDER", "FLOUR"][i % 5],
    halal: i % 3 === 0 ? "Y" : "N",
    expiry: `2025-08-${(i % 10) + 1}`,
  }));
  

export default function ManageInventory() {
    const [inventory, setInventory] = useState(initialData);
    const [selectedCategory, setSelectedCategory] = useState("ALL");
    const [filterOpen, setFilterOpen] = useState(false);
    const [addItemOpen, setAddItemOpen] = useState(false);
    const [expiryFilter, setExpiryFilter] = useState("");
    const [halalFilter, setHalalFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    const searchParams = useSearchParams(); //  Get query params

    useEffect(() => {
      const category = searchParams.get("category"); // Get category from URL
      if (category) {
        setSelectedCategory(category.toUpperCase());
      }
    }, [searchParams]); //  Runs when URL changes
    


      // New Item State
    const [newItem, setNewItem] = useState({
        category: "",
        type: "",
        halal: "Y",
        expiry: "",
    });


    // Filtered data based on category & filters
    const filteredData = inventory
        .filter(
        (item) =>
            (selectedCategory === "ALL" || item.category === selectedCategory) &&
            (!expiryFilter || item.expiry.includes(expiryFilter)) &&
            (!halalFilter || item.halal === halalFilter)
        )
        .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

    // Pagination logic
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const displayedData = filteredData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );
    
    // Function to add new item
    const handleAddItem = () => {
        if (!newItem.category || !newItem.type || !newItem.expiry) {
        alert("Please fill in all fields.");
        return;
        }
        const newItemEntry = {
        id: (inventory.length + 1).toString().padStart(2, "0"),
        ...newItem,
        };
        setInventory([...inventory, newItemEntry]);
        setAddItemOpen(false);
        setNewItem({ category: "", type: "", halal: "Y", expiry: "" });
    };

    // Function to delete an item
    const handleDeleteItem = (id) => {
        setInventory(inventory.filter((item) => item.id !== id));
    };

  return (
    <div className={`${dmSans.variable} bg-[#f7f0ea] min-h-screen`}>
      {/* Hero Section */}
      <div className="bg-[#f4d1cb] text-center py-12">
      <h1 className={`text-6xl font-bold text-black ${cormorant.variable} font-[family-name:var(--font-cormorant)]`}>
          Manage Your Inventory
        </h1>
        <p className="text-lg text-black mt-2">
          This is a detailed overview of your inventory, filter it to your
          liking!
        </p>

        {/* Category Buttons */}
        <div className="flex justify-center mt-6 space-x-4">
          {["ALL", "CANNED GOODS", "PASTA & GRAINS", "BABY FOOD", "COOKING ESSENTIALS"].map(
            (category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-full border border-black text-lg ${
                  selectedCategory === category
                    ? "bg-[#f56275] text-white"
                    : "bg-[#f7f0ea] text-black"
                }`}
              >
                {category}
              </button>
            )
          )}

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="px-4 py-2 rounded-full border border-black text-lg bg-[#f7f0ea] flex items-center space-x-2"
            >
              <span>FILTER HERE</span>
              <Image src="/filter-icon.png" alt="Filter" width={16} height={16} />
            </button>

            {filterOpen && (
              <div className="absolute mt-2 bg-white shadow-lg p-4 rounded-lg border border-gray-300">
                <label className="block text-black font-bold mb-2">
                  Filter by Expiry Month:
                </label>
                <select
                  className="border p-2 rounded w-full"
                  onChange={(e) => setExpiryFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                </select>

                <label className="block text-black font-bold mt-4 mb-2">
                  Filter by Halal Status:
                </label>
                <select
                  className="border p-2 rounded w-full"
                  onChange={(e) => setHalalFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="Y">Halal</option>
                  <option value="N">Non-Halal</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Plus Button (Inline with "Total Items") */}
        <div className="flex justify-between px-12 py-4 items-center relative">
            <p className="text-lg font-bold">Total: {filteredData.length} items</p>
            <button
            onClick={() => setAddItemOpen(!addItemOpen)}
            className="bg-[#f56275] text-white w-12 h-12 rounded-full shadow-md text-2xl flex items-center justify-center"
            >
            +
            </button>

            {addItemOpen && (
            <div className="absolute top-12 right-12 bg-white shadow-lg p-4 rounded-lg border border-gray-300">
                <label className="block text-black font-bold mb-2">Food Category:</label>
                <select
                className="border p-2 rounded w-full"
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                >
                <option value="">Select</option>
                <option value="CANNED GOODS">Canned Goods</option>
                <option value="PASTA & GRAINS">Pasta & Grains</option>
                <option value="BABY FOOD">Baby Food</option>
                <option value="COOKING ESSENTIALS">Cooking Essentials</option>
                </select>

                <label className="block text-black font-bold mt-4 mb-2">Food Type:</label>
                <input
                type="text"
                className="border p-2 rounded w-full"
                placeholder="Enter food type"
                value={newItem.type}
                onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                />

                <label className="block text-black font-bold mt-4 mb-2">Halal Safe:</label>
                <select
                className="border p-2 rounded w-full"
                value={newItem.halal}
                onChange={(e) => setNewItem({ ...newItem, halal: e.target.value })}
                >
                <option value="Y">Yes</option>
                <option value="N">No</option>
                </select>

                <label className="block text-black font-bold mt-4 mb-2">Expiry Date:</label>
                <input
                type="text"
                className="border p-2 rounded w-full"
                placeholder="YYYY-MM-DD"
                value={newItem.expiry}
                onChange={(e) => setNewItem({ ...newItem, expiry: e.target.value })}
                />

                <button
                onClick={handleAddItem}
                className="bg-[#f56275] text-white px-4 py-2 rounded-full mt-4 w-full"
                >
                Add Item
                </button>
            </div>
            )}
        </div>


      {/* Table Section */}
      <div className="px-12 py-1">
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-[#f46274] text-white text-lg">
                <th className="border border-black px-4 py-2">FOOD ID</th>
                <th className="border border-black px-4 py-2">FOOD CATEGORY</th>
                <th className="border border-black px-4 py-2">FOOD TYPE</th>
                <th className="border border-black px-4 py-2">HALAL SAFE</th>
                <th className="border border-black px-4 py-2">EXPIRY DATE</th>
                <th className="bg-[#f7f0ea] border border-[#f7f0ea] px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((item) => (
                <tr key={item.id} className="text-black text-lg">
                    <td className="border border-black px-4 py-2">{item.id}</td>
                    <td className="border border-black px-4 py-2">{item.category}</td>
                    <td className="border border-black px-4 py-2">{item.type}</td>
                    <td className="border border-black px-4 py-2">{item.halal}</td>
                    <td className="border border-black px-4 py-2">{item.expiry}</td>
                    <td className="border border-[#f7f0ea]">
                        <button onClick={() => handleDeleteItem(item.id)}>
                        <Image src="/delet-icon.png" alt="Delete" width={24} height={24} />
                        </button>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center mt-6 space-x-4">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-4 py-2 bg-[#f4d1cb] text-white rounded-full disabled:opacity-50"
          >
            ◀
          </button>
          <p className="text-lg">
            {currentPage} / {totalPages}
          </p>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 bg-[#f4d1cb] text-white rounded-full disabled:opacity-50"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
