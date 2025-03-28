"use client";

import { useState } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

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

const dummyCharities = [
  { name: "Food Bank SG", phone: "9855 4805", logo: "/foodbank.png" },
  { name: "Free Food For All", phone: "8769 3947", logo: "/fffa.jpg" },
  { name: "Lions Home for the Elders", phone: "6252 9900", logo: "/lionshome.jpg" },
  { name: "Food from the Heart", phone: "6280 4483", logo: "/food-heart-logo.png" },
];

export default function RequestPage() {
  const [foodInputs, setFoodInputs] = useState([
    { category: "", quantity: 1, expiry: "", nutrition: "" },
  ]);
  const [selectedCharities, setSelectedCharities] = useState([]);
  const [outgoingOpen, setOutgoingOpen] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([
    {
      item: "100 Cooking essentials",
      from: "Food Bank SG",
      date: "29/03/25"
    },
    {
      item: "50 Cooking essentials",
      from: "Lions Home for the Elders",
      date: "29/03/25"
    },
    {
      item: "100 Baby Food",
      from: "Free Food For All",
      date: "01/04/25"
    }
  ]);
  
  const [showPopup, setShowPopup] = useState(false);
  const [submittedForms, setSubmittedForms] = useState([]);


  const handleAddInput = () => {
    setFoodInputs([...foodInputs, { category: "", quantity: 1, expiry: "", nutrition: "" }]);
  };

  const handleRemoveInput = (index) => {
    const updated = [...foodInputs];
    updated.splice(index, 1);
    setFoodInputs(updated);
  };

  const toggleCharity = (name) => {
    setSelectedCharities(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleRemoveRequest = (indexToRemove) => {
    setIncomingRequests(prev => prev.filter((_, i) => i !== indexToRemove));
  };
  

//   const getStatusStyle = (status) => {
//     if (status === "Accepted") return "bg-[#9fca4b]";
//     if (status === "Rejected") return "bg-[#bd1f15]";
//     if (status === "Pending") return "bg-[#fba387]";
//     return "";
//   };

  return (
    <div className={`min-h-screen bg-[#f7f0ea] pt-0 pb-10 ${dmSans.variable}`}>
    {/* hero section */}
    <div className="bg-[#f4d1cb] py-10  text-center w-full" >
        <h1 className={`text-6xl text-center ${cormorant.variable} font-serif`}>Request & Share</h1>
        <p className="text-center mt-2">Request and share resources with your fellow charities here!</p>
    </div>
     

      {/* Request Form */}
      <div className="bg-[#f4d1cb] rounded-xl mx-8 p-6 mt-10 border border-black">
        <h2 className={`text-4xl text-center ${cormorant.variable} font-serif`}>Submit your requests</h2>

        <p className="mt-6 mb-2 font-bold text-left">Food choice:</p>

        {/* Food inputs */}
        {foodInputs.map((input, index) => (
          <div key={index} className="flex justify-center items-start gap-4 mt-4">
          <div className="flex gap-6 bg-[#f7f0ea] p-4 rounded-2xl border border-black w-[85%] justify-center">
            <div className="flex flex-col">
              <label className="text-sm mb-1">Food category</label>
              <select className="border px-2 py-1 rounded-md" defaultValue="">
                <option disabled value="">Select Food Type</option>
                <option>Canned Food</option>
                <option>Pasta & Grains</option>
                <option>Cooking Essentials</option>
                <option>Baby Food</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">Quantity</label>
              <input type="number" defaultValue={input.quantity} className="w-16 px-2 py-1 border rounded-md" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">Minimum expiry date</label>
              <input type="text" placeholder="DD/MM/YYYY" className="px-2 py-1 border rounded-md" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm mb-1">Nutrition requirement</label>
              <input type="text" placeholder="eg. 1800" className="px-2 py-1 border rounded-md" />
            </div>
          </div>
          <div className="flex flex-col justify-start gap-2 mt-2">
            <button onClick={handleAddInput}><Plus /></button>
            {index > 0 && <button onClick={() => handleRemoveInput(index)}><Trash2 /></button>}
          </div>
        </div>        
        ))}

        {/* Charity Cards */}
        <p className="mt-6 mb-2 font-bold text-left">Available Charities to ask from :</p>
        <div className="flex flex-wrap justify-center gap-6">
          {dummyCharities.map((charity) => (
            <div
                key={charity.name}
                onClick={() => toggleCharity(charity.name)}
                className={`relative bg-[#f7f0ea] p-4 rounded-xl w-60 text-center border border-black cursor-pointer ${
                selectedCharities.includes(charity.name) ? "ring-2 ring-[#f56275]" : ""
                }`}
            >          
              <img src={charity.logo} alt={charity.name} className="mx-auto h-12 mb-2" />
              <p>{charity.name}</p>
              <p className="text-sm mt-1">📞 {charity.phone}</p>
              <input
                type="checkbox"
                checked={selectedCharities.includes(charity.name)}
                onChange={() => toggleCharity(charity.name)}
                className="absolute top-2 right-2"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-center">
        <button
            onClick={() => {
                setSubmittedForms([...submittedForms, foodInputs]);
                setFoodInputs([{ category: "", quantity: 1, expiry: "", nutrition: "" }]);
                setSelectedCharities([]);
                setShowPopup(true);
                setTimeout(() => setShowPopup(false), 2000);
            }}
            className="mt-6 px-6 py-2 rounded-full bg-[#f56275] text-white font-bold"
            >
            SUBMIT
        </button>

        </div>
      </div>

      {showPopup && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 bg-[#f56275] text-white px-6 py-2 rounded-full shadow-lg z-50">
            Form submitted!
        </div>
        )}


      {/* Outgoing and Incoming Requests */}
      <div className="flex gap-6 mt-10 px-8">
        {/* Outgoing */}
        <div className="w-1/2 bg-[#f4d1cb] p-4 rounded-xl border border-black">
          <h3 className={`text-2xl mb-4 ${cormorant.variable} font-serif`} >Outgoing requests</h3>
          {[
            {
                to: "Free Food For All",
                items: [
                  { name: "100 Canned Food", status: "Accepted" },
                  { name: "50 Pasta & Grains", status: "Rejected" },
                ],
              },
              {
                to: "Food from the Heart",
                items: [
                  { name: "100 Canned Food", status: "Pending" },
                ],
              },
          ].map((req, idx) => (
            <div key={idx} className="bg-[#f7f0ea] rounded-lg mb-3 overflow-hidden">
              <button onClick={() => setOutgoingOpen(outgoingOpen === idx ? null : idx)} className="w-full text-left p-2 flex justify-between items-center">
                Request to {req.to}
                <ChevronDown />
              </button>
              {outgoingOpen === idx && (
                <div className="p-2 border-t border-gray-300">
                  <p>Date: 29/03/25</p>
                  {req.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between mb-2">
                        <p>{item.name}</p>
                        <span
                        className={`text-white text-sm px-3 py-1 rounded-full ${
                            item.status === "Accepted"
                            ? "bg-[#9fca4b]"
                            : item.status === "Rejected"
                            ? "bg-[#bd1f15]"
                            : "bg-[#fba387]"
                        }`}
                        >
                        {item.status}
                        </span>
                    </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Incoming */}
        <div className="w-1/2 bg-[#f4d1cb] p-4 rounded-xl border border-black">
          <h3 className={`text-2xl mb-4 ${cormorant.variable} font-serif`}>Incoming requests</h3>
          {incomingRequests.map((req, idx) => (
            <div key={idx} className="bg-[#f7f0ea] p-3 rounded-lg mb-3">
                <div className="flex justify-between items-center">
                <div>
                    <p className="font-bold">{req.item}</p>
                    <p className="text-sm text-[#333]">From: {req.from}</p>
                    <p className="text-sm text-[#333]">Date: {req.date}</p>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                    <button
                    onClick={() => handleRemoveRequest(idx)}
                    className="bg-[#9fca4b] px-4 py-1 rounded-full text-white"
                    >
                    Accept
                    </button>
                    <button
                    onClick={() => handleRemoveRequest(idx)}
                    className="bg-[#bd1f15] px-4 py-1 rounded-full text-white"
                    >
                    Reject
                    </button>
                </div>
                </div>
            </div>
            ))}

        </div>
      </div>
    </div>
  );
}
