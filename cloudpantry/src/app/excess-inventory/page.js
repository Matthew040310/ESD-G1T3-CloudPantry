"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";

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

// Dummy excess inventory data
const data = [
  {
    category: "Canned Goods",
    "Food Bank": 20,
    "Willing Hearts": 15,
    "Food From the Heart": 5,
    "Lions Home for the Elders": 21,
    "Free Food For All": 9,
  },
  {
    category: "Pasta & Grains",
    "Food Bank": 25,
    "Willing Hearts": 35,
    "Food From the Heart": 10,
    "Lions Home for the Elders": 18,
    "Free Food For All": 12,
  },
  {
    category: "Baby Food",
    "Food Bank": 15,
    "Willing Hearts": 10,
    "Food From the Heart": 25,
    "Lions Home for the Elders": 8,
    "Free Food For All": 5,
  },
  {
    category: "Cooking Essentials",
    "Food Bank": 18,
    "Willing Hearts": 27,
    "Food From the Heart": 10,
    "Lions Home for the Elders": 15,
    "Free Food For All": 4,
  },
];

// Charity colors
const colors = {
  "Food Bank": "#f5627f",
  "Willing Hearts": "#b82546",
  "Food From the Heart": "#f4d1cb",
  "Lions Home for the Elders": "#f76560",
  "Free Food For All": "#febbcd",
};

// Custom Legend with black text
const CustomLegend = (props) => {
  const { payload } = props;
  
  return (
    <ul className="flex justify-center flex-wrap gap-8 mt-4">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="flex items-center">
          <div
            className="w-4 h-4 mr-2 rounded"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-black">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

export default function ExcessInventory() {
  const [tooltipInfo, setTooltipInfo] = useState(null);
  const chartContainerRef = useRef(null);
  const tooltipTimeout = useRef(null);
  
  // Clear any lingering timeout when component unmounts
  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current);
      }
    };
  }, []);

  // Handle showing tooltip with debounce to reduce flickering
  const handleBarMouseEnter = (charity, dataItem) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    
    setTooltipInfo({
      charity,
      category: dataItem.category,
      value: dataItem[charity],
      show: true
    });
  };

  // Handle hiding tooltip with slight delay to prevent flickering
  const handleBarMouseLeave = () => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    
    tooltipTimeout.current = setTimeout(() => {
      setTooltipInfo(null);
    }, 100);
  };
  
  // Custom renderer for each bar - allows us to attach event handlers directly to the SVG element
  const renderBar = (charity) => {
    return (
      <Bar
        key={charity}
        dataKey={charity}
        name={charity}
        fill={colors[charity]}
        barSize={20}
        radius={[5, 5, 0, 0]}
        isAnimationActive={false}
        onMouseOver={(data) => handleBarMouseEnter(charity, data.payload)}
        onMouseOut={handleBarMouseLeave}
      />
    );
  };

  // Custom tooltip component with fixed positioning
  const renderTooltip = () => {
    if (!tooltipInfo || !tooltipInfo.show) return null;
    
    return (
      <div className="fixed bg-black text-white px-4 py-2 rounded shadow-lg text-sm pointer-events-none z-50">
        <strong>{tooltipInfo.category}</strong>
        <br />
        {tooltipInfo.charity}: {tooltipInfo.value}
      </div>
    );
  };

  // Update tooltip position on mouse move
  const handleMouseMove = (e) => {
    if (tooltipInfo) {
      const tooltip = document.querySelector('.fixed.bg-black');
      if (tooltip) {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY - 50}px`;
      }
    }
  };

  return (
    <div 
      className={`min-h-screen bg-[#f7f0ea] ${dmSans.variable}`}
      onMouseMove={handleMouseMove}
    >
      {/* Render tooltip */}
      {renderTooltip()}
      
      {/* Hero Section */}
      <div className="bg-[#f4d1cb] text-center py-12">
        <h1
          className={`text-6xl font-bold text-black ${cormorant.variable} font-[family-name:var(--font-cormorant)]`}
        >
          Our Excess Inventory
        </h1>
        <p className="text-lg text-black mt-2 max-w-3xl mx-auto">
          This is an overview of the excess inventory of all our partnering
          charities. If your charity requires additional resources, don't be
          afraid to reach out to any of the charities below for their excess
          inventory.
        </p>
      </div>

      {/* Chart Section */}
      <div 
        className="p-10 flex justify-center" 
        ref={chartContainerRef}
      >
        <ResponsiveContainer width="75%" height={400}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 30, bottom: 50 }}
            barCategoryGap={50}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" tick={{ fill: "#333" }} />
            <YAxis tick={{ fill: "#333" }} />
            {/* Use an empty tooltip content */}
            <Tooltip 
              content={<div></div>}
              cursor={false}
            />
            <Legend content={<CustomLegend />} />

            {/* Generate bars for each charity */}
            {Object.keys(colors).map(charity => renderBar(charity))}
          </BarChart>
        </ResponsiveContainer>
      </div>


      {/* Request Resources Section */}
      <div className="bg-[#F8D5CD] py-16 px-4 text-center">
        <h2 className={`text-6xl font-bold text-black mb-8 ${cormorant.variable} font-[family-name:var(--font-cormorant)]`}>
          Ready to request for resources?
        </h2>
        <a href="/request">
          <button className="bg-[#F7F0EA] text-black font-medium py-3 px-8 rounded-full hover:bg-[#E5DFD7] transition-colors duration-300">
            REQUEST NOW
          </button>
        </a>
      </div>
    </div>
    
  );
}