"use client";
import React, { useState } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Image from "next/image";

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
const dummyData = Array.from({ length: 30 }, (_, i) => ({
  id: (i + 1).toString().padStart(2, "0"),
  category: ["CANNED GOODS", "PASTA & GRAINS", "BABY FOOD", "COOKING E"][
    i % 4
  ],
  type: ["CANNED PINEAPPLES", "BAKED BEANS", "RICE", "MILK POWDER", "FLOUR"][
    i % 5
  ],
  halal: i % 3 === 0 ? "Y" : "N",
  expiry: `2025-08-${(i % 10) + 1}`,
}));

export default function ManageInventory() {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState("");
  const [halalFilter, setHalalFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Filtered data based on category & filters
  const filteredData = dummyData
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
          {["ALL", "CANNED GOODS", "PASTA & GRAINS", "BABY FOOD", "COOKING E"].map(
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

      {/* Table Section */}
      <div className="px-12 py-8">
        <p className="text-lg font-bold">Total: {filteredData.length} items</p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-[#f46274] text-white text-lg">
                <th className="border border-black px-4 py-2">FOOD ID</th>
                <th className="border border-black px-4 py-2">FOOD CATEGORY</th>
                <th className="border border-black px-4 py-2">FOOD TYPE</th>
                <th className="border border-black px-4 py-2">HALAL SAFE</th>
                <th className="border border-black px-4 py-2">EXPIRY DATE</th>
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
            className="px-4 py-2 bg-black text-white rounded-full disabled:opacity-50"
          >
            ◀
          </button>
          <p className="text-lg">
            {currentPage} / {totalPages}
          </p>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-4 py-2 bg-black text-white rounded-full disabled:opacity-50"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
