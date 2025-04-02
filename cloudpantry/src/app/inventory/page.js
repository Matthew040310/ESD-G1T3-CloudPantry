"use client"; // Ensure client-side rendering
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Bar, BarChart, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useState, useEffect } from "react";
import "animate.css"; // For animations
import { useRouter } from "next/navigation"; // Correct import for App Router
import callSupabaseAPI from "../../common/callSupabaseAPI.js"
import { INVENTORY_URL } from "../../common/pathVariables.js";
import { useCharityData } from '../../hooks/useCharityData';

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
const CHARITY_ID = typeof window !== "undefined" ? parseInt(localStorage.getItem("charityID")) : 0;


// Default data
const defaultData = [
  { category: "Canned Goods", Quantity: 0 },
  { category: "Pasta & Grains", Quantity: 0 },
  { category: "Baby Food", Quantity: 0 },
  { category: "Cooking Essentials", Quantity: 0 },
];

// Category index for data processing
const categoryIndex = {
  "Canned Goods": 0,
  "Pasta & Grains": 1,
  "Baby Food": 2,
  "Cooking Essentials": 3
};

export default function Inventory() {
  const [data, setData] = useState(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const router = useRouter();


  // Fetch data on component mount
  useEffect(() => {
    async function fetchInventoryData() {
      try {
        // For client-side, use 0 as default or retrieve from localStorage
        const CHARITY_ID = typeof window !== "undefined" ? parseInt(localStorage.getItem("charityID")) : 0; // You can change this later to use localStorage or state

        console.log("Fetching inventory data for charity ID:", CHARITY_ID);
        setIsLoading(true);

        const response = await callSupabaseAPI("GET", `${INVENTORY_URL}/${CHARITY_ID}`);
        console.log("API Response:", response);

        if (response && response.data && response.data.response) {
          // Create a new array to avoid mutating the default data
          const newData = [...defaultData];

          // Reset quantities to zero
          newData.forEach(item => item.Quantity = 0);

          // Update quantities based on API response
          for (let item of response.data.response) {
            if (item.category && categoryIndex.hasOwnProperty(item.category)) {
              const dataIndex = categoryIndex[item.category];
              newData[dataIndex].Quantity += item.quantity || 0;
            }
          }

          setData(newData);
        }
      } catch (err) {
        console.error("Failed to fetch inventory:", err);
        setError(err.message || "Failed to load inventory data");
        // Keep using the default data
      } finally {
        setIsLoading(false);
      }
    }

    fetchInventoryData();
  }, []);

  return (
    <div className={`min-h-screen bg-[#f7f0ea] ${dmSans.variable}`}>
      {/* Hero Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-20 bg-[#f4d1cb] gap-3">
        <h1 className={`text-8xl text-black ${cormorant.variable} font-serif w-1/2`}>
          Your inventory overview
        </h1>
        <p className="w-1/2 text-lg">
          This is a summary of your current inventory, split into 4 categories: <b>Canned Goods,
            Pasta & Grains, Baby Food, and Cooking Essentials</b>. To find out more details, click on the
          respective category!
        </p>
      </div>

      {/* Chart Section - Centered */}
      <div className="p-10 flex justify-center"> {/* Ensures center alignment */}
        <ResponsiveContainer width="75%" height={400}> {/* Adjusted width to 75% for centering */}
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 50, bottom: 50 }} // More space for legend
          >
            <CartesianGrid strokeDasharray="3 3" /> {/* Grid lines */}
            <XAxis type="number" tick={{ fill: "#333" }} />
            <YAxis dataKey="category" type="category" tick={{ fill: "#333" }} />
            <Tooltip
              cursor={{ fill: "transparent" }}
              content={({ active, payload }) =>
                active && payload && payload.length ? (
                  <div className="bg-black text-white text-sm px-3 py-2 rounded shadow-md">
                    <strong>{payload[0].payload.category}</strong>
                    <br />
                    Quantity: {payload[0].value}
                  </div>
                ) : null
              }
            />
            <Legend wrapperStyle={{ textAlign: "center", marginTop: "10px" }} /> {/* Centered Legend */}
            <Bar
              dataKey="Quantity"
              fill="#f56275"
              barSize={50}
              animationBegin={200}
              animationDuration={1500}
              radius={[5, 5, 0, 0]} // Rounded bar edges
              onMouseEnter={(e) => setHoveredBar(e.category)}
              onMouseLeave={() => setHoveredBar(null)}
              opacity={({ category }) => (hoveredBar && hoveredBar !== category ? 0.3 : 1)}
              onClick={(e) => router.push(`/manage-inventory?category=${encodeURIComponent(e.category)}`)} // Redirect on click
              cursor="pointer" // Makes bars clickable
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* New section */}
      <div className="p-20 bg-[#f4d1cb] text-center">
        <h2 className={`text-4xl text-black ${cormorant.variable} font-serif mb-6`}>
          Need More Details?
        </h2>
        <p className="text-lg max-w-3xl mx-auto">
          Click on a category in the inventory chart above to view more details about the items in stock.
          You can also manage and update your inventory in the admin panel.
        </p>

        {/* Optional Button */}
        <div className="mt-6">
          <a href="/manage-inventory" className="px-6 py-3 bg-[#f56275] text-white font-semibold rounded-full shadow-md hover:bg-[#d04a5a] transition">
            Manage Inventory →
          </a>
        </div>
      </div>
    </div>
  );
}
