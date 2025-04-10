"use client";
import { Geist, Geist_Mono, Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { FaBell } from "react-icons/fa"; // Importing the bell icon
import { useRouter, usePathname } from "next/navigation";
import "@fortawesome/fontawesome-free/css/all.min.css";
import callSupabaseAPI from "../common/callSupabaseAPI.js"
import { NOTIFICATION_URL } from "../common/pathVariables.js";

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
function Navbar({ pathname }) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false); // Controls dropdown visibility
  const [deliveryOpen, setDeliveryOpen] = useState(false); // Controls dropdown visibility for Delivery
  const [notificationCount, setNotificationCount] = useState(0);

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

  useEffect(() => {
    const charityId = localStorage.getItem("charityID");

    if (charityId) {
      // Fetch notifications count from your backend
      fetchNotifications(charityId);
    }
  }, []);

  const fetchNotifications = async (charityId) => {
    try {
      // Assuming you have an endpoint for fetching active notifications
      const data = await callSupabaseAPI("GET", `${NOTIFICATION_URL}/new/${charityId}`)
      setNotificationCount(data.data.total_count);
    } catch (error) {
      setNotificationCount(0)
    }
  };


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

  //  To prevent continuous redirection when already on home page or landing
  const [mounted, setMounted] = useState(false);  // Track if mounted

  useEffect(() => {
    setMounted(true);  // Set to true after first render

    if (isLoggedIn && pathname === "/") {
      router.push("/home"); // Redirect to home if logged in and on the root page
    } else if (!isLoggedIn && pathname === "/") {
      router.push("/landing"); // Redirect to landing if not logged in and on the root page
    }
  }, [isLoggedIn, pathname, router]);

  // Don't render anything until mounted to avoid flashing redirection
  if (!mounted) return null;



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
          // onMouseLeave={() => setInventoryOpen(false)} // Add slight delay to prevent flickering (alternatively use:  setTimeout(() => setInventoryOpen(false), 400)})
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
                <a href="/excess-inventory" className="block px-4 py-2 hover:bg-gray-100 text-black">
                  Excess Inventory
                </a>
              </div>
            )}
          </div>

          {/* Delivery Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setDeliveryOpen(true)}
          // onMouseLeave={() => setDeliveryOpen(false)}
          >
            <a href="/delivery" className="hover:underline flex items-center">
              Delivery
            </a>

            {/* Delivery Dropdown */}
            {deliveryOpen && (
              <div
                className="absolute left-0 mt-2 w-56 bg-white shadow-md border border-gray-200 rounded-lg"
                onMouseEnter={() => setDeliveryOpen(true)}
                onMouseLeave={() => setDeliveryOpen(false)}
              >
                <a href="/recipient" className="block px-4 py-2 hover:bg-gray-100 text-black">
                  View Recipients
                </a>
                <a href="/delivery" className="block px-4 py-2 hover:bg-gray-100 text-black">
                  Delivery
                </a>
              </div>
            )}
          </div>
          <a href="/request" onClick={(e) => handleNavigation(e, "/request")} className="hover:underline">Requests</a>
          <a href="/about-us" onClick={(e) => handleNavigation(e, "/about-us")} className="hover:underline">About us</a>
        </div>
      </div>

      {/* Profile Icon / Logout Button */}
      <div className='flex items-center gap-4'>
        {isLoggedIn ? (
          <>
            <button onClick={(e) => handleNavigation(e, "/profile")}>
              <Image
                src="/profileicon.png"
                alt="Profile"
                width={35}
                height={35}
                className="rounded-full border border-black cursor-pointer"
              />
            </button>
            {/* Bell Icon */}
            <div
              className="relative"
              onClick={(e) => handleNavigation(e, "/request")} // Navigate to requests on bell click
            >
              <FaBell size={24} />
              {notificationCount > 0 && (
                <span className="absolute top-0 right-0 bg-[#fcd4e0] rounded-full text-xs text-black w-3.5 h-3.5 flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </div>
          </>
        ) : (
          <button onClick={(e) => handleNavigation(e, "/signup")} className={`bg-[#f4d1cb] text-black font-bold px-4 py-2 rounded-full border border-black hover:bg-[#f56275] transition ${dmSans.variable}`}>
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
        {pathname !== "/signin" && pathname !== "/signup" && <Navbar pathname={pathname} />}
        <main className={`${pathname === "/signin" || pathname === "/signup" ? "" : "pt-[80px]"}`}>
          {children}
        </main>
      </body>
    </html>
  );
}