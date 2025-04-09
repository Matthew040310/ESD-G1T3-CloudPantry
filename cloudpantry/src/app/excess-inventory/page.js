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
// We'll keep these imports for reference
import { EXCESS_INVENTORY_URL } from "../../common/pathVariables";

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

// Charity colors
const colors = {
  "Food Bank": "#f5627f",
  "Willing Hearts": "#b82546",
  "Food From the Heart": "#f4d1cb",
  "Lions Home for the Elders": "#f76560",
  "Free Food For All": "#febbcd",
};

// Mapping charity IDs to charity names
const charityNames = {
  1: "Willing Hearts",
  2: "Food From the Heart",
  4: "Food Bank"
};

// Custom Legend component
const CustomLegend = (props) => {
  const { payload } = props;
  return (
    <div className="flex justify-center mt-4 flex-wrap">
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center mx-3 mb-2">
          <div
            className="w-4 h-4 rounded-sm mr-2"
            style={{ backgroundColor: entry.color }}
          ></div>
          <span className="text-sm">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const charityIDs = [1, 2, 4];  // Charities to fetch data for (with 3 and 5 hardcoded)

export default function ExcessInventory() {
  const [tooltipInfo, setTooltipInfo] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const chartContainerRef = useRef(null);
  const tooltipTimeout = useRef(null);

  // Fetch data from backend using direct fetch
  const fetchCharityData = async () => {
    try {
      // This will hold our processed data with summed quantities per category
      const processedData = {};
      let anyDataFetched = false;
      
      // Loop through the charity IDs and fetch data from the backend
      for (let charityID of charityIDs) {
        try {
          // Use direct fetch instead of callSupabaseAPI
          const response = await fetch(`http://localhost:5001/inventory/${charityID}`);
          const data = await response.json();
          
          if (data.code === 200 && data.data && data.data.response) {
            const inventoryData = data.data.response;
            anyDataFetched = true;
            const charityName = charityNames[charityID] || `Charity ${charityID}`;
            
            // Process each inventory item and sum up quantities by category
            inventoryData.forEach((item) => {
              const category = item.category;
              const quantity = item.quantity || 0;
              
              // Initialize category if it doesn't exist
              if (!processedData[category]) {
                processedData[category] = {
                  category: category
                };
              }
              
              // Add or update the quantity for this charity
              if (processedData[category][charityName]) {
                processedData[category][charityName] += quantity;
              } else {
                processedData[category][charityName] = quantity;
              }
            });
          }
        } catch (error) {
          console.warn(`Error fetching data for charity ID ${charityID}:`, error);
          // Continue with next charity ID
        }
      }

      if (!anyDataFetched) {
        throw new Error("No data could be fetched from any charity");
      }

      // Convert the processed data object to an array
      const charityData = Object.values(processedData);
      
      // Add hardcoded data for Lions Home for the Elders and Free Food For All
      charityData.forEach(item => {
        item["Lions Home for the Elders"] = Math.floor(Math.random() * 20) + 5;
        item["Free Food For All"] = Math.floor(Math.random() * 15) + 3;
      });
      
      // Add any missing categories from the hardcoded data
      const additionalCategories = ["Canned Goods", "Pasta & Grains", "Baby Food", "Cooking Essentials"];
      additionalCategories.forEach(category => {
        if (!charityData.some(item => item.category === category)) {
          charityData.push({
            category: category,
            "Lions Home for the Elders": Math.floor(Math.random() * 20) + 5,
            "Free Food For All": Math.floor(Math.random() * 15) + 3
          });
        }
      });
      
      setChartData(charityData);
      setIsLoaded(true);
    } catch (error) {
      console.error("Error fetching charity data:", error);
      // Load sample data if API fails
      loadSampleData();
    }
  };

  // Load sample data in case of API failure
  const loadSampleData = () => {
    const sampleData = [
      {
        category: "Canned Goods",
        "Food Bank": 15,
        "Willing Hearts": 30,
        "Food From the Heart": 25,
        "Lions Home for the Elders": 21,
        "Free Food For All": 9,
      },
      {
        category: "Pasta & Grains",
        "Food Bank": 40,
        "Willing Hearts": 50,
        "Food From the Heart": 35,
        "Lions Home for the Elders": 18,
        "Free Food For All": 12,
      },
      {
        category: "Baby Food",
        "Food Bank": 20,
        "Willing Hearts": 25,
        "Food From the Heart": 15,
        "Lions Home for the Elders": 8,
        "Free Food For All": 5,
      },
      {
        category: "Cooking Essentials",
        "Food Bank": 30,
        "Willing Hearts": 20,
        "Food From the Heart": 10,
        "Lions Home for the Elders": 15,
        "Free Food For All": 4,
      }
    ];
    
    setChartData(sampleData);
    setIsLoaded(true);
    console.log("Loaded sample data due to API issues");
  };

  useEffect(() => {
    fetchCharityData();
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
      show: true,
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
        isAnimationActive={true}
        animationDuration={800} // Animation speed
        animationEasing="ease-out"
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
        {tooltipInfo.charity}: {tooltipInfo.value || 0}
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
      <div className="p-10 flex justify-center" ref={chartContainerRef}>
        {isLoaded ? (
          <ResponsiveContainer width="75%" height={400}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 30, bottom: 50 }}
              barCategoryGap={50}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fill: "#333" }} />
              <YAxis tick={{ fill: "#333" }} />
              {/* Use an empty tooltip content */}
              <Tooltip content={() => null} cursor={false} />
              <Legend content={<CustomLegend />} />

              {/* Generate bars for each charity */}
              {Object.keys(colors).map((charity) => renderBar(charity))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f5627f]"></div>
          </div>
        )}
      </div>

      {/* Request Resources Section */}
      <div className="bg-[#F8D5CD] py-16 px-4 text-center">
        <h2
          className={`text-6xl font-bold text-black mb-8 ${cormorant.variable} font-[family-name:var(--font-cormorant)]`}
        >
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