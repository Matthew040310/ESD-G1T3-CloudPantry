// src/app/profile/page.js
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function Profile() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    charityName: "",
    username: "",
    email: "",
    address: "",
    postalCode: "",
    password: "",
    charityID: 1,
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

      // Load profile data
      setProfileData({
        charityName: localStorage.getItem("charityName") || "Charity Name",
        username: localStorage.getItem("username") || "Username",
        email: localStorage.getItem("email") || "email@example.com",
        address: localStorage.getItem("address") || "Address",
        postalCode: localStorage.getItem("postalCode") || "Postal Code",
        password: localStorage.getItem('password') || "",
        charityID: localStorage.getItem("charityID") || 1,
      });
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("charityID");
    localStorage.removeItem("charityName");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("address");
    localStorage.removeItem("postalCode");
    
    // Trigger storage event so Navbar updates
    window.dispatchEvent(new Event("storage"));
    
    router.push("/landing");
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleSaveProfile = () => {
    // Save updated profile data to localStorage
    localStorage.setItem("charityName", profileData.charityName);
    localStorage.setItem("username", profileData.username);
    localStorage.setItem("email", profileData.email);
    localStorage.setItem("address", profileData.address);
    localStorage.setItem("postalCode", profileData.postalCode);
    localStorage.setItem("password", profileData.password);

    
    // For charity ID, we won't allow direct editing
    // but we could update it based on the charity name if needed
    
    setIsEditing(false);
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
            <div >
              <Image
                src="/profileicon.png"
                alt="Profile"
                width={100}
                height={100}
                className="rounded-full border-1 border-black m-4"
              />
            </div>
            <div>
              <h1 className={`text-5xl  ${cormorant.variable} font-serif`}>
                Hi there, {profileData.charityName}!
              </h1>
              <p className="text-md mt-2">Charity ID: {profileData.charityID}</p>
            </div>
          </div>

          {/* Profile information */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm text-gray-700 mb-2">
                    NAME OF CHARITY
                </label>
                <p className="border-b border-black py-2">{profileData.charityName}</p>
            </div>

              <div>
                <label className="block text-sm text-gray-700  mb-2">
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
                <label className="block text-sm text-gray-700  mb-2">
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
                <label className="block text-sm text-gray-700  mb-2">
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
                    <label className="block text-sm text-gray-700  mb-2">
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
                  className="px-6 py-2 bg-[#f56275] text-white rounded-full shadow-md hover:bg-[#d04a5a] border border-black transition"
                >
                  SAVE PROFILE
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