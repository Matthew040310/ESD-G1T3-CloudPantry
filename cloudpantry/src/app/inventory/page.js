"use client"; // Ensure client-side rendering
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { Bar, BarChart, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { useState } from "react";
import "animate.css"; // For animations
import { useRouter } from "next/navigation"; // Correct import for App Router

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

// Inventory Data
const data = [
  { category: "Canned Goods", Quantity: 350 },
  { category: "Pasta & Grains", Quantity: 220 },
  { category: "Baby Food", Quantity: 180 },
  { category: "Cooking Essentials", Quantity: 270 },
];




export default function Inventory() {
  const [hoveredBar, setHoveredBar] = useState(null);
  const router = useRouter();



  return (
    <div className={`min-h-screen bg-[#f7f0ea] ${dmSans.variable}`}>
      {/* Hero Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-20 bg-[#f4d1cb] gap-3">
        <h1 className={`text-8xl text-black ${cormorant.variable} font-serif w-1/2`}>
          Your inventory overview
        </h1>
        <p className="w-1/2 text-lg">
          This is a summary of your current inventory, split into 4 categories: <b>Canned Goods,
          Pasta, Baby Food, and Cooking Essentials</b>. To find out more details, click on the
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
