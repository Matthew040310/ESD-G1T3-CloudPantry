// src/app/profile/page.js
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Image from "next/image";
import { charityApi } from '@/lib/charityApi';

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

export default function Profile() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    charityName: "",
    username: "",
    email: "",
    address: "",
    postalCode: "",
    password: "",
    charityID: "",
  });

  // Load profile data from localStorage on component mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check if user is logged in
      const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
      if (!isLoggedIn) {
        router.push("/signin");
        return;
      }

      // Debug log all localStorage values
      console.log('Loading profile data from localStorage:', {
        charityName: localStorage.getItem("charityName"),
        username: localStorage.getItem("username"),
        email: localStorage.getItem("email"),
        address: localStorage.getItem("address"),
        postalCode: localStorage.getItem("postalCode"),
        charityID: localStorage.getItem("charityID")
      });

      // Load profile data
      const newProfileData = {
        charityName: localStorage.getItem("charityName") || "",
        username: localStorage.getItem("username") || "",
        email: localStorage.getItem("email") || "",
        address: localStorage.getItem("address") || "",
        postalCode: localStorage.getItem("postalCode") || "",
        password: localStorage.getItem("password") || "",
        charityID: localStorage.getItem("charityID") || "",
      };
      
      console.log('Setting profile data:', newProfileData);
      setProfileData(newProfileData);
    }
  }, [router]);

  const handleLogout = () => {
    // Clear all localStorage items
    localStorage.clear();
    
    // Trigger storage event so Navbar updates
    window.dispatchEvent(new Event("storage"));
    
    router.push("/landing");
  };

  const handleEditProfile = () => {
    setError('');
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    setError('');
    setLoading(true);
    
    try {
      // Prepare data for API - matching OutSystems API field names and types
      const updateData = {
        CharityID: parseInt(profileData.charityID),
        CharityName: profileData.charityName,
        Username: profileData.username,
        Password: profileData.password || '',
        Email: profileData.email,
        Address: profileData.address,
        PostalCode: parseInt(profileData.postalCode) || 0
      };

      console.log('Sending update request with data:', updateData);

      // Call API to update profile
      const response = await charityApi.updateCharity(updateData.CharityID, updateData);
      console.log('Update profile response:', response);

      if (response.Success && response.Charity) {
        // Get the updated charity data from response
        const updatedCharity = response.Charity;
        
        // Update localStorage with returned data
        localStorage.setItem("charityName", updatedCharity.CharityName || '');
        localStorage.setItem("username", updatedCharity.Username || '');
        localStorage.setItem("email", updatedCharity.Email || '');
        localStorage.setItem("address", updatedCharity.Address || '');
        localStorage.setItem("postalCode", updatedCharity.PostalCode ? updatedCharity.PostalCode.toString() : '');
        
        // Update state with returned data
        setProfileData({
          charityID: profileData.charityID, // Keep existing ID
          charityName: updatedCharity.CharityName || '',
          username: updatedCharity.Username || '',
          email: updatedCharity.Email || '',
          address: updatedCharity.Address || '',
          postalCode: updatedCharity.PostalCode ? updatedCharity.PostalCode.toString() : '',
          password: '' // Clear password field after update
        });
        
        // Trigger storage event so other components update
        window.dispatchEvent(new Event("storage"));
        
        setIsEditing(false);
        setError(''); // Clear any existing errors
        
        // Show success message
        alert('Profile updated successfully!');
      } else {
        console.error('Failed to update profile:', response.ErrorMessage);
        setError(response.ErrorMessage || 'Failed to update charity. Please try again.');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value,
    });
  };

  return (
    <div className={`min-h-screen bg-[#f4d1cb] ${dmSans.variable}`}>
      <div className="flex justify-center items-center py-12 px-4">
        <div className="bg-[#f7f0ea] border border-black rounded-xl p-10 w-full max-w-5xl">
          {/* Header with profile image */}
          <div className="flex items-center mb-4">
            <div>
              <Image
                src="/profileicon.png"
                alt="Profile"
                width={100}
                height={100}
                className="rounded-full border-1 border-black m-4"
              />
            </div>
            <div>
              <h1 className={`text-5xl ${cormorant.variable} font-serif`}>
                Hi there, {profileData.charityName}!
              </h1>
              <p className="text-md mt-2">Charity ID: {profileData.charityID}</p>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm mb-4 px-6">
              {error}
            </div>
          )}

          {/* Profile information */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  NAME OF CHARITY
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="charityName"
                    value={profileData.charityName}
                    onChange={handleInputChange}
                    className="border-b border-black bg-transparent outline-none py-2 w-full"
                  />
                ) : (
                  <p className="border-b border-black py-2">{profileData.charityName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  USERNAME
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="username"
                    value={profileData.username}
                    onChange={handleInputChange}
                    className="border-b border-black bg-transparent outline-none py-2 w-full"
                  />
                ) : (
                  <p className="border-b border-black py-2">{profileData.username}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  EMAIL
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleInputChange}
                    className="border-b border-black bg-transparent outline-none py-2 w-full"
                  />
                ) : (
                  <p className="border-b border-black py-2">{profileData.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  ADDRESS
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="address"
                    value={profileData.address}
                    onChange={handleInputChange}
                    className="border-b border-black bg-transparent outline-none py-2 w-full"
                  />
                ) : (
                  <p className="border-b border-black py-2">{profileData.address}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  PASSWORD
                </label>
                {isEditing ? (
                  <input
                    type="password"
                    name="password"
                    value={profileData.password || ""}
                    onChange={handleInputChange}
                    className="border-b border-black bg-transparent outline-none py-2 w-full"
                  />
                ) : (
                  <p className="border-b border-black py-2">••••••</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  POSTAL CODE
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="postalCode"
                    value={profileData.postalCode}
                    onChange={handleInputChange}
                    className="border-b border-black bg-transparent outline-none py-2 w-full"
                  />
                ) : (
                  <p className="border-b border-black py-2">{profileData.postalCode}</p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex justify-between">
              {isEditing ? (
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className={`px-6 py-2 bg-[#f56275] text-white rounded-full shadow-md hover:bg-[#d04a5a] border border-black transition ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? 'SAVING...' : 'SAVE PROFILE'}
                </button>
              ) : (
                <button
                  onClick={handleEditProfile}
                  className="px-6 py-2 bg-[#f56275] text-white rounded-full shadow-md hover:bg-[#d04a5a] border border-black transition"
                >
                  EDIT PROFILE
                </button>
              )}

              <button
                onClick={handleLogout}
                className="px-6 py-2 bg-[#f4d1cb] text-black rounded-full shadow-md border border-black hover:bg-[#f56275] hover:text-white transition"
              >
                LOG OUT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}