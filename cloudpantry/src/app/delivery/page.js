"use client"

import { useState } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";

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

const getUpcomingDays = () => {
    const labels = [];
    const today = new Date();
  
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
  
      if (i === 0) {
        labels.push("Today");
      } else if (i === 1) {
        labels.push("Tomorrow");
      } else {
        const options = { day: "numeric", month: "long" }; // e.g. 29 March
        labels.push(date.toLocaleDateString("en-GB", options));
      }
    }
  
    return labels;
  };

const days = getUpcomingDays();
 


const dummyDeliveries = {
    [days[0]]: [
        {
            address: "1 Toh Yi Dr",
            postal: "591501",
            name: "Henry Tan Eng Ming",
            phone: "9999 7777",
          },
          {
            address: "2 Toh Yi Dr",
            postal: "590002",
            name: "Theo Tan Eng Ming",
            phone: "9999 7777",
          },
          {
            address: "3 Toh Yi Dr",
            postal: "590003",
            name: "Chao Tan Eng Ming",
            phone: "9999 7777",
          },
          {
            address: "4 Toh Yi Dr",
            postal: "590004",
            name: "Alexi Tan Eng Ming",
            phone: "9999 7771",
          },
          {
              address: "5 Toh Yi Dr",
              postal: "590005",
              name: "Doony Chao Eng Ming",
              phone: "9999 7717",
            },
            {
              address: "6 Toh Yi Dr",
              postal: "590006",
              name: "Ben Chi Eng Ming",
              phone: "9999 7727",
            },
            {
              address: "7 Toh Yi Dr",
              postal: "590007",
              name: "Beth bai Eng Ming",
              phone: "9999 7777",
            },
            {
              address: "8 Toh Yi Dr",
              postal: "590008",
              name: "Xiao Tan Eng Ming",
              phone: "9995 7777",
            }
      // ...more deliveries
    ],
    [days[1]]:
    [
        {
           address: '401 Hougang Ave 10',
           postal: '530401',
           name: 'Turritopsis',
           phone: "87654321", 
        },
        {
            address: '402 Hougang Ave 10',
            postal: '530402',
            name: 'Dohrnii',
            phone: "87654321", 
        },
        {
            address: '403 Hougang Ave 10',
            postal: '530403',
            name: 'Teo',
            phone: "12345678", 
        },
        {
            address: '404 Hougang Ave 10',
            postal: '530404',
            name: 'En',
            phone: "98765432", 
        },
        {
            address: '405 Hougang Ave 10',
            postal: '530405',
            name: 'Ming',
            phone: "98761234", 
        },
        {
            address: '406 Hougang Ave 10',
            postal: '530406',
            name: 'Zhang',
            phone: "12345678", 
        },
        {
            address: '407 Hougang Ave 10',
            postal: '530407',
            name: 'En',
            phone: "23457890", 
        },
        {
            address: '408 Hougang Ave 10',
            postal: '530408',
            name: 'Ming',
            phone: "12345678", 
        },
        {
            address: '409 Hougang Ave 10',
            postal: '530409',
            name: 'Time Traeveller',
            phone: "78954321", 
        },
        
    ]
  };
  



// const days = ["Today", "Tomorrow", "29 March", "30 March", "31 March", "1 April", "2 April"];
  

export default function Delivery() {
  const [selectedDay, setSelectedDay] = useState("Today");
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const deliveries = dummyDeliveries[selectedDay] || [];

  const handleCheck = (index) => {
    if (index === currentStopIndex && currentStopIndex < deliveries.length - 1) {
      setCurrentStopIndex(currentStopIndex + 1);
    }
  };

  return (
    <div className={`min-h-screen bg-[#f7f0ea] ${dmSans.variable}`}>
      {/* Hero Section */}
      <div className="text-center py-10 bg-[#f4d1cb]">
        <h1 className={`text-5xl font-bold ${cormorant.variable} font-serif`}>Upcoming deliveries</h1>
        <p className="text-md mt-2">Check out your upcoming deliveries!</p>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {days.map((day) => (
            <button
              key={day}
              onClick={() => {
                setSelectedDay(day);
                setCurrentStopIndex(0);
              }}
              className={`px-4 py-1 rounded-full border border-black transition ${
                selectedDay === day ? "bg-[#f56275] text-white" : "bg-[#f7f0ea] text-black"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Body Section */}
      <div className="flex gap-6 px-10 pb-12 mt-16">
        {/* Delivery List */}
        <div className="w-1/2 h-[500px] overflow-y-auto bg-[#f4d1cb] rounded-xl p-4 border border-black">
          {deliveries.map((delivery, index) => (
            <div key={index} className="py-3 border-b border-[#f8bdc1] flex justify-between items-start">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={index < currentStopIndex}
                  onChange={() => handleCheck(index)}
                  className="accent-[#f56275] w-5 h-5 mt-1"
                />
                <div>
                  <p>ADDRESS : {delivery.address}</p>
                  <p>POSTAL CODE : {delivery.postal}</p>
                </div>
              </div>
              <div className="text-right">
                <p>NAME : {delivery.name}</p>
                <p>PHONE : {delivery.phone}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Map Section */}
        <div className="w-1/2 h-[500px] bg-[#f4d1cb] rounded-xl border border-black flex items-center justify-center">
          <iframe
            className="w-full h-full rounded-xl"
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              deliveries[currentStopIndex]?.address || "Singapore"
            )}&output=embed`}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </div>
    </div>
  );
}
