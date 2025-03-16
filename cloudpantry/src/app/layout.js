"use client";
import { Geist, Geist_Mono, Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import "@fortawesome/fontawesome-free/css/all.min.css"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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


/*  Navigation Bar */
function Navbar() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false); // Controls dropdown visibility

  // Check localStorage for authentication status on load
  useEffect(() => {
    const storedUser = localStorage.getItem("isLoggedIn");
    setIsLoggedIn(storedUser === "true");

    //  Listen for changes in localStorage to update auth state dynamically
    const handleStorageChange = () => {
      const updatedUser = localStorage.getItem("isLoggedIn");
      setIsLoggedIn(updatedUser === "true");
    };

    window.addEventListener("storage", handleStorageChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  //  Function to handle logout
  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    setIsLoggedIn(false);
    router.push("/landing"); // Redirect to landing page
  };

  // Function to handle navigation
  const handleNavigation = (e, path) => {
    e.preventDefault();

    if (!isLoggedIn) {
      router.push("/signup"); // Redirect to sign-up page if not logged in
    } else {
      router.push(path); // Allow navigation if logged in
    }
  };

  return (
    <nav className={`bg-[#f7f0ea] px-6 sm:px-16 py-4 flex items-center justify-between shadow-md fixed top-0 left-0 w-full z-50 ${dmSans.variable}`}>
      <div className="flex items-center space-x-8">
        {/*  Logo */}
        <a href="/" className="flex items-center">
          <Image src="/logo.png" alt="CloudPantry Logo" width={75} height={75} className="mr-4" />
        </a>

        {/* Navigation Links */}
        <div className="flex space-x-12 text-lg font-bold text-black">
          <a href="/home" onClick={(e) => handleNavigation(e, "/home")} className="hover:underline">Home</a>
           
          {/* Inventory Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setInventoryOpen(true)}
            onMouseLeave={() => setTimeout(() => setInventoryOpen(false), 200)} // Add slight delay to prevent flickering
          >
            <a href="/inventory" className="hover:underline flex items-center">
              Inventory
            </a>

            {/* Dropdown */}
            {inventoryOpen && (
              <div 
                className="absolute left-0 mt-2 w-56 bg-white shadow-md border border-gray-200 rounded-lg"
                onMouseEnter={() => setInventoryOpen(true)} // Keep it open when hovering over dropdown
                onMouseLeave={() => setInventoryOpen(false)} // Close only when leaving the dropdown
              >
                <a href="/inventory" className="block px-4 py-2 hover:bg-gray-100 text-black">
                  Inventory Overview
                </a>
                <a href="/manage-inventory" className="block px-4 py-2 hover:bg-gray-100 text-black">
                  Manage Inventory
                </a>
                <a href="/excess_inventory" className="block px-4 py-2 hover:bg-gray-100 text-black">
                  Excess Inventory
                </a>
              </div>
            )}
          </div>

          <a href="/recipient" onClick={(e) => handleNavigation(e, "/recipient")} className="hover:underline">Delivery</a>
          <a href="/request" onClick={(e) => handleNavigation(e, "/request")} className="hover:underline">Requests</a>
          <a href="/landing" className="hover:underline">About us</a>
        </div>
      </div>

      {/* Profile Icon / Logout Button */}
      <div>
        {isLoggedIn ? (
          <button onClick={(e) => handleNavigation(e, "/profile")}>
            <Image 
              src="/profileicon.png" 
              alt="Profile"
              width={35}
              height={35}
              className="rounded-full border border-black cursor-pointer"
            />
          </button>
        ) : (
          <button onClick={(e) => handleNavigation(e, "/signup")}  className={`bg-[#f4d1cb] text-black font-bold px-4 py-2 rounded-full border border-black hover:bg-[#f56275] transition ${dmSans.variable}`}>
            Sign Up
          </button>
        )}
      </div>
    </nav>
  );
}

/*  Root Layout */
export default function RootLayout({ children }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Show Navbar only if NOT on Sign-In or Sign-Up Pages */}
        {pathname !== "/signin" && pathname !== "/signup" && <Navbar />}
        <main className={`${pathname === "/signin" || pathname === "/signup" ? "" : "pt-[80px]"}`}>
          {children}
        </main>
      </body>
    </html>
  );
}