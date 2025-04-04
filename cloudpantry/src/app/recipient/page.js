"use client";

import { useEffect, useState } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Image from "next/image";
import { useRecipient } from "@/hooks/useRecipient";

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
  const { recipients, loading, error, fetchRecipients, createRecipient, deleteRecipient } = useRecipient();
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [newRecipient, setNewRecipient] = useState({
    name: "",
    address: "",
    phone: "",
    calorie: "",
    income: "",
    restrictions: [],
    dependents: "",
    lastDeliveryDate: new Date().toISOString().split('T')[0],
    hasBaby: "false"
  });

  const rowsPerPage = 10;
  const totalPages = Math.ceil(recipients.length / rowsPerPage);
  const displayedData = recipients.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    fetchRecipients(CHARITY_ID);
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!newRecipient.name) errors.name = "Name is required";
    if (!newRecipient.address) errors.address = "Address is required";
    if (!newRecipient.phone) errors.phone = "Phone number is required";
    if (!newRecipient.calorie) errors.calorie = "Calorie requirement is required";
    if (!newRecipient.income) errors.income = "Average income is required";
    if (!newRecipient.dependents) errors.dependents = "Number of dependents is required";
    if (!newRecipient.lastDeliveryDate) errors.lastDeliveryDate = "Last delivery date is required";
    if (newRecipient.restrictions.length === 0) errors.restrictions = "At least one dietary restriction is required";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddRecipient = async () => {
    if (!validateForm()) {
      alert("Please fill in all required fields");
      return;
    }
    
    try {
      const recipientInput = {
        Name: newRecipient.name,
        Address: newRecipient.address,
        PhoneNumber: newRecipient.phone,
        AvgIncome: parseInt(newRecipient.income),
        CalorieRequirement: parseInt(newRecipient.calorie),
        DietaryRestriction: newRecipient.restrictions.length > 0 ? newRecipient.restrictions : [""],
        Dependents: parseInt(newRecipient.dependents),
        LastDeliveryDate: new Date(newRecipient.lastDeliveryDate).toISOString(),
        CharityID: CHARITY_ID,
        HasBaby: newRecipient.hasBaby
      };

      await createRecipient(recipientInput);
      await fetchRecipients(CHARITY_ID);
      
      setNewRecipient({
        name: "",
        address: "",
        phone: "",
        calorie: "",
        income: "",
        restrictions: [],
        dependents: "",
        lastDeliveryDate: new Date().toISOString().split('T')[0],
        hasBaby: "false"
      });
      setFormErrors({});
      setShowForm(false);
    } catch (error) {
      console.error('Add error:', error);
      alert(error.message || 'Failed to add recipient. Please try again.');
    }
  };

  const handleDelete = async (phoneNumber) => {
    if (!phoneNumber) {
      alert('Phone number is required to delete a recipient');
      return;
    }

    try {
      if (!confirm('Are you sure you want to delete this recipient?')) {
        return;
      }

      await deleteRecipient(phoneNumber);
      await fetchRecipients(CHARITY_ID);
    } catch (error) {
      console.error('Delete error:', error);
      alert(error.message || 'Failed to delete recipient. Please try again.');
    }
  };

  const handleRestrictionChange = (e) => {
    const value = e.target.value;
    if (value && !newRecipient.restrictions.includes(value)) {
      setNewRecipient({
        ...newRecipient,
        restrictions: [...newRecipient.restrictions, value]
      });
    }
  };

  const removeRestriction = (index) => {
    const updatedRestrictions = newRecipient.restrictions.filter((_, i) => i !== index);
    setNewRecipient({
      ...newRecipient,
      restrictions: updatedRestrictions
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">Error: {error}</div>;
  }

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
        <div className="px-12 space-y-2 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input 
                className={`border p-2 rounded w-full ${formErrors.name ? 'border-red-500' : ''}`}
                placeholder="* Recipient Name"
                value={newRecipient.name}
                onChange={(e) => setNewRecipient({ ...newRecipient, name: e.target.value })}
              />
              {formErrors.name && <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <input 
                className={`border p-2 rounded w-full ${formErrors.address ? 'border-red-500' : ''}`}
                placeholder="* Address"
                value={newRecipient.address}
                onChange={(e) => setNewRecipient({ ...newRecipient, address: e.target.value })}
              />
              {formErrors.address && <p className="text-red-500 text-sm mt-1">{formErrors.address}</p>}
            </div>

            <div>
              <input 
                className={`border p-2 rounded w-full ${formErrors.phone ? 'border-red-500' : ''}`}
                placeholder="* Phone Number"
                value={newRecipient.phone}
                onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
              />
              {formErrors.phone && <p className="text-red-500 text-sm mt-1">{formErrors.phone}</p>}
            </div>

            <div>
              <input 
                type="number"
                className={`border p-2 rounded w-full ${formErrors.calorie ? 'border-red-500' : ''}`}
                placeholder="* Calorie Requirement"
                value={newRecipient.calorie}
                onChange={(e) => setNewRecipient({ ...newRecipient, calorie: e.target.value })}
              />
              {formErrors.calorie && <p className="text-red-500 text-sm mt-1">{formErrors.calorie}</p>}
            </div>

            <div>
              <input 
                type="number"
                className={`border p-2 rounded w-full ${formErrors.income ? 'border-red-500' : ''}`}
                placeholder="* Average Income ($)"
                value={newRecipient.income}
                onChange={(e) => setNewRecipient({ ...newRecipient, income: e.target.value })}
              />
              {formErrors.income && <p className="text-red-500 text-sm mt-1">{formErrors.income}</p>}
            </div>

            <div>
              <input 
                type="number"
                className={`border p-2 rounded w-full ${formErrors.dependents ? 'border-red-500' : ''}`}
                placeholder="* Number of Dependents"
                value={newRecipient.dependents}
                onChange={(e) => setNewRecipient({ ...newRecipient, dependents: e.target.value })}
              />
              {formErrors.dependents && <p className="text-red-500 text-sm mt-1">{formErrors.dependents}</p>}
            </div>

            <div>
              <input 
                type="date"
                className={`border p-2 rounded w-full ${formErrors.lastDeliveryDate ? 'border-red-500' : ''}`}
                value={newRecipient.lastDeliveryDate}
                onChange={(e) => setNewRecipient({ ...newRecipient, lastDeliveryDate: e.target.value })}
              />
              {formErrors.lastDeliveryDate && <p className="text-red-500 text-sm mt-1">{formErrors.lastDeliveryDate}</p>}
            </div>

            <div>
              <select
                className="border p-2 rounded w-full"
                value={newRecipient.hasBaby}
                onChange={(e) => setNewRecipient({ ...newRecipient, hasBaby: e.target.value })}
              >
                <option value="false">No Baby</option>
                <option value="true">Has Baby</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="flex gap-2 mb-2">
                <select
                  className={`border p-2 rounded flex-grow ${formErrors.restrictions ? 'border-red-500' : ''}`}
                  onChange={handleRestrictionChange}
                  value=""
                >
                  <option value="">Select Dietary Restriction</option>
                  <option value="Halal">Halal</option>
                  <option value="Kosher">Kosher</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Dairy-free">Dairy-free</option>
                  <option value="Gluten-free">Gluten-free</option>
                  <option value="Nut-free">Nut-free</option>
                  <option value="Low-sodium">Low-sodium</option>
                  <option value="Diabetic">Diabetic</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {newRecipient.restrictions.map((restriction, index) => (
                  <span key={index} className="bg-[#f4d1cb] px-3 py-1 rounded-full flex items-center gap-2">
                    {restriction}
                    <button onClick={() => removeRestriction(index)} className="text-red-500">×</button>
                  </span>
                ))}
              </div>
              {formErrors.restrictions && <p className="text-red-500 text-sm mt-1">{formErrors.restrictions}</p>}
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button onClick={handleAddRecipient} className="bg-[#f56275] text-white px-6 py-2 rounded-full">
              Add Recipient
            </button>
          </div>
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
              {displayedData.map((item) => (
                <tr key={item.ID} className="text-black text-lg">
                  <td className="border border-black px-4 py-2">{item.Name}</td>
                  <td className="border border-black px-4 py-2">{item.Address}</td>
                  <td className="border border-black px-4 py-2">{item.PhoneNumber}</td>
                  <td className="border border-black px-4 py-2">{item.CalorieRequirement}</td>
                  <td className="border border-black px-4 py-2">{item.AvgIncome}</td>
                  <td className="border border-black px-4 py-2">{item.DietaryRestriction?.join(", ")}</td>
                  <td className="border border-[#f7f0ea] text-center">
                    <button onClick={() => handleDelete(item.PhoneNumber)}>
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