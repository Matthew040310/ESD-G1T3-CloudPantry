"use client";

import { useEffect, useState } from "react";
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
const CHARITY_ID = typeof window !== "undefined" ? parseInt(localStorage.getItem("charityID")) : 0;



export default function Recipients() {
  const [recipients, setRecipients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [charityId, setCharityId] = useState(CHARITY_ID); // Store charity ID here
  const [newRecipient, setNewRecipient] = useState({
    name: "",
    address: "",
    phone: "",
    calorie: "",
    income: "",
    restrictions: "",
  });

  const rowsPerPage = 10;
  const totalPages = Math.ceil(recipients.length / rowsPerPage);
  const displayedData = recipients.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    const dummyData = Array.from({ length: 30 }, (_, i) => ({
      name: `Recipient ${i + 1}`,
      address: `Address ${i + 1}`,
      phone: `12345678`,
      calorie: 1800 + i * 10,
      income: 1400 + i * 5,
      restrictions: i % 2 === 0 ? "Halal" : "Vegan",
    }));
    setRecipients(dummyData);
  }, []);

  const handleAddRecipient = () => {
    if (!newRecipient.name || !newRecipient.address) return;
    setRecipients((prev) => [...prev, newRecipient]);
    setNewRecipient({ name: "", address: "", phone: "", calorie: "", income: "", restrictions: "" });
    setShowForm(false);
  };

  const handleDelete = (index) => {
    const updated = [...recipients];
    updated.splice((currentPage - 1) * rowsPerPage + index, 1);
    setRecipients(updated);
  };

  return (
    <div className={`${dmSans.variable} bg-[#f7f0ea] min-h-screen`}>
      {/* Hero */}
      <div className="bg-[#f4d1cb] text-center py-12">
        <h1 className={`text-6xl font-bold text-black ${cormorant.variable} font-serif`}>Your Beneficiaries</h1>
        <p className="text-lg text-black mt-2">Here is a list of the beneficiaries you serve</p>
      </div>

      {/* Top row with total and add */}
      <div className="flex justify-between px-12 py-4 items-center">
        <p className="text-lg font-bold">Total: {recipients.length} items</p>
        <button onClick={() => setShowForm(!showForm)} className="bg-[#f56275] text-white w-10 h-10 rounded-full shadow-md text-2xl flex items-center justify-center">
          +
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="px-12 space-y-2">
          <input className="border p-2 rounded w-full" placeholder="Recipient Name" value={newRecipient.name} onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })} />
          <input className="border p-2 rounded w-full" placeholder="Address" value={newRecipient.address} onChange={(e) => setNewRecipient({ ...newRecipient, address: e.target.value })} />
          <input className="border p-2 rounded w-full" placeholder="Phone Number" value={newRecipient.phone} onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })} />
          <input className="border p-2 rounded w-full" placeholder="Calorie Requirement" value={newRecipient.calorie} onChange={(e) => setNewRecipient({ ...newRecipient, calorie: e.target.value })} />
          <input className="border p-2 rounded w-full" placeholder="Average Income" value={newRecipient.income} onChange={(e) => setNewRecipient({ ...newRecipient, income: e.target.value })} />
          <input className="border p-2 rounded w-full" placeholder="Dietary Restrictions (e.g. Halal, Vegan)" value={newRecipient.restrictions} onChange={(e) => setNewRecipient({ ...newRecipient, restrictions: e.target.value })} />
          <button onClick={handleAddRecipient} className="bg-[#f56275] text-white px-6 py-2 rounded-full">Add Recipient</button>
        </div>
      )}

      {/* Table */}
      <div className="px-12 py-1">
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse border-0">
            <thead>
              <tr className="bg-[#f46274] text-white text-md">
                <th className="border border-black px-4 py-2">RECIPIENT NAME</th>
                <th className="border border-black px-4 py-2">ADDRESS</th>
                <th className="border border-black px-4 py-2">PHONE NUMBER</th>
                <th className="border border-black px-4 py-2">CALORIE REQUIREMENT</th>
                <th className="border border-black px-4 py-2">AVERAGE INCOME ($)</th>
                <th className="border border-black px-4 py-2">DIETARY RESTRICTION</th>
                <th className="px-4 py-2 bg-[#f7f0ea]"></th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((item, index) => (
                <tr key={index} className="text-black text-lg">
                  <td className="border border-black px-4 py-2">{item.name}</td>
                  <td className="border border-black px-4 py-2">{item.address}</td>
                  <td className="border border-black px-4 py-2">{item.phone}</td>
                  <td className="border border-black px-4 py-2">{item.calorie}</td>
                  <td className="border border-black px-4 py-2">{item.income}</td>
                  <td className="border border-black px-4 py-2">{item.restrictions}</td>
                  <td className="border border-[#f7f0ea] text-center">
                    <button onClick={() => handleDelete(index)}>
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
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-4 py-2 bg-[#f4d1cb] text-white rounded-full disabled:opacity-90">
            ◀
          </button>
          <p className="text-lg">{currentPage} / {totalPages}</p>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-4 py-2 bg-[#f4d1cb] text-white rounded-full disabled:opacity-90">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}