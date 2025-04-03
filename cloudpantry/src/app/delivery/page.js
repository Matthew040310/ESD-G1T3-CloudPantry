"use client"

import { useState, useEffect } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { charityApi } from '@/lib/charityApi';

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

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

const dummyDeliveries = {
  "2025-04-03": [
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
  ],
  "2025-04-04": [
    {
      address: "10 Paya Lebar",
      postal: "530401",
      name: "Random Name",
      phone: "1234 5678",
    },
  ],
};

const CHARITY_ID = typeof window !== "undefined" ? parseInt(localStorage.getItem("charityID")) : 0;

export default function Delivery() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [confirmStart, setConfirmStart] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  const deliveries = dummyDeliveries[selectedDate] || [];

  const handleConfirm = () => {
    setConfirmStart(true);
    setCurrentStopIndex(0);
  };

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
      </div>

      {/* Main Section */}
      <div className="flex gap-6 px-10 pb-12 mt-10 items-start">
        {/* Delivery List */}
        <div className="w-1/2 min-h-[200px] bg-[#f4d1cb] rounded-xl p-4 border border-black">
          {deliveries.length > 0 ? (
            deliveries.map((delivery, index) => (
              <div key={index} className="py-3 border-b border-[#f8bdc1] flex justify-between items-start">
                <div className="flex items-start gap-3">
                  {confirmStart && (
                    <input
                      type="checkbox"
                      checked={index < currentStopIndex}
                      onChange={() => handleCheck(index)}
                      className="accent-[#f56275] w-5 h-5 mt-1"
                    />
                  )}
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
            ))
          ) : (
            <p className="text-center py-20 text-lg">No deliveries for today!</p>
          )}
        </div>

        {/* Filter & Map Section */}
        <div className={`w-1/2 bg-[#f4d1cb] rounded-xl border border-black p-6 flex flex-col items-center ${confirmStart ? "min-h-[500px]" : "min-h-[200px]"}`}>
          <label className="text-lg font-bold mb-2">Filter date here:</label>
          <input
            type="date"
            className="border px-4 py-2 rounded-full text-center mb-4"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setConfirmStart(false);
            }}
          />

          <label className="text-lg font-bold mb-2">Start the delivery?</label>
          <button
            className="bg-[#f56275] text-white font-bold px-6 py-2 rounded-full"
            onClick={handleConfirm}
          >
            CONFIRM
          </button>

          {confirmStart && deliveries.length > 0 && (
            <div className="w-full mt-4">
              <iframe
                className="w-full h-[300px] rounded-xl"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  deliveries[currentStopIndex]?.address || "Singapore"
                )}&output=embed`}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}