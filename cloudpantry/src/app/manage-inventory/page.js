"use client";
import React, { useState, useEffect } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import callSupabaseAPI from "../../common/callSupabaseAPI.js"
import { INVENTORY_URL } from "../../common/pathVariables.js";

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

var charityInventory = await callSupabaseAPI("GET", `${INVENTORY_URL}/${CHARITY_ID}`)
var allRestrictions = await callSupabaseAPI("GET", `${INVENTORY_URL}/restrictions`)

export default function ManageInventory() {
  const [inventory, setInventory] = useState(charityInventory.data.response);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [filterOpen, setFilterOpen] = useState(false);

  const [expiryStartDate, setExpiryStartDate] = useState("");
  const [expiryEndDate, setExpiryEndDate] = useState("");
  const [restrictionsFilter, setRestrictionsFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const searchParams = useSearchParams(); //  Get query params

  useEffect(() => {
    const category = searchParams.get("category"); // Get category from URL
    if (category) {
      setSelectedCategory(category);
    }
  }, [searchParams]); //  Runs when URL changes

  // Filtered data based on category & filters
  const filteredData = inventory
    .filter(
      (item) =>
        (selectedCategory === "ALL" || item.category === selectedCategory) &&
        (!expiryStartDate || new Date(item.expiry_date) >= new Date(expiryStartDate)) &&
        (!expiryEndDate || new Date(item.expiry_date) <= new Date(expiryEndDate)) &&
        (!restrictionsFilter || (item.restrictions && item.restrictions.includes(restrictionsFilter))))
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const displayedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Function to delete an item
  const handleDeleteItem = async (id) => {
    await callSupabaseAPI("DELETE", `${INVENTORY_URL}`, [{ "ID": id }])
    charityInventory = await callSupabaseAPI("GET", `${INVENTORY_URL}/${CHARITY_ID}`)
    setInventory(charityInventory.data.response)
  };

  return (
    <div className={`${dmSans.variable} bg-[#f7f0ea] min-h-screen`}>
      {/* Hero Section */}
      <div className="bg-[#f4d1cb] text-center py-12">
        <h1 className={`text-6xl font-bold text-black ${cormorant.variable} font-[family-name:var(--font-cormorant)]`}>
          Manage Your Inventory
        </h1>
        <p className="text-lg text-black mt-2">
          This is a detailed overview of your inventory, filter it to your liking!
        </p>

        {/* Category Buttons */}
        <div className="flex justify-center mt-6 space-x-4">
          {["ALL", "Canned Goods", "Pasta & Grains", "Baby Food", "Cooking Essentials"].map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-full border border-black text-lg ${selectedCategory === category
                ? "bg-[#f56275] text-white"
                : "bg-[#f7f0ea] text-black"
                }`}
            >
              {category}
            </button>
          ))}

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="px-4 py-2 rounded-full border border-black text-lg bg-[#f7f0ea] flex items-center space-x-2"
            >
              <span>More Filters</span>
              <Image
                src="/filter-icon.png"
                alt="Filter"
                width={16}
                height={16}
              />
            </button>

            {filterOpen && (
              <div className="absolute mt-2 bg-white shadow-lg p-4 rounded-lg border border-gray-300" style={{ zIndex: 999 }}>
                <label className="block text-black font-bold mb-2">
                  Filter by Period:
                </label>

                <b>Start Date</b>
                <input type='date'
                  className="border p-2 rounded w-full"
                  onChange={(e) => setExpiryStartDate(e.target.value)}
                >
                </input>

                <b>End Date</b>
                <input type='date'
                  className="border p-2 rounded w-full"
                  onChange={(e) => setExpiryEndDate(e.target.value)}
                >
                </input>

                <label className="block text-black font-bold mt-4 mb-2">
                  Filter by Restrictions:
                </label>
                <select
                  className="border p-2 rounded w-full"
                  onChange={(e) => { setRestrictionsFilter(e.target.value) }}>
                  <option value="">All</option>
                  {allRestrictions.map((restriction) => (
                    <option value={restriction}>{restriction}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plus Button (Inline with "Total Items") */}
      <div className="flex justify-between px-12 py-4 items-center relative">
        <p className="text-lg font-bold">Total: {filteredData.length} items</p>
        <a href="/add-inventory" className="bg-[#f56275] text-white w-12 h-12 rounded-full shadow-md text-2xl flex items-center justify-center">
          +</a>
      </div>

      {/* Table Section */}
      <div className="px-12 py-1">
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse border-0">
            <thead>
              <tr className="bg-[#f46274] text-white text-lg">
                <th className="border border-black px-4 py-2">Qty</th>
                <th className="border border-black px-4 py-2">Category</th>
                <th className="border border-black px-4 py-2">Name</th>
                <th className="border border-black px-4 py-2">Restrictions</th>
                <th className="border border-black px-4 py-2">Expiry Date</th>
                <th className="bg-[#f7f0ea] border-0 px-4 py-2"></th>
                <th className="bg-[#f7f0ea] border-0 px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((item) => (
                <tr key={item.id} className="text-black text-lg">
                  <td className="border border-black px-4 py-2">{item.quantity}</td>
                  <td className="border border-black px-4 py-2">
                    {item.category}
                  </td>
                  <td className="border border-black px-4 py-2">{item.name}</td>
                  <td className="border border-black px-4 py-2">
                    {item.restrictions && (
                      <ul className="list-style-type: none;">
                        {item.restrictions.map((restriction) => (
                          <li key={`${item.id}+${restriction}`}>{restriction}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="border border-black px-4 py-2">
                    {item.expiry_date}
                  </td>
                  <td className="border border-[#f7f0ea] align-item-center">
                    <a href={`/update-inventory/?id=${item.id}`} className="flex justify-center items-center w-full h-full">
                      <Image
                        src="/file.svg"
                        alt="Edit"
                        width={24}
                        height={24} />
                    </a>
                  </td>
                  <td className="border border-[#f7f0ea] text-center">
                    <button onClick={() => handleDeleteItem(item.id)}>
                      <Image
                        src="/delet-icon.png"
                        alt="Delete"
                        width={24}
                        height={24} />
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
