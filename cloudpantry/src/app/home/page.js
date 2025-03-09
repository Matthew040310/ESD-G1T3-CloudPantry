"use client";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import { useState } from "react";
import "animate.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"], // Choose desired weights
  variable: "--font-cormorant",
});

export default function homepage() {
  return (
    <div className={`flex flex-col min-h-screen bg-[#f4d1cb] ${cormorant.variable}`}>
      {/* Hero Section */}
      <h1 className="text-3xl sm:text-7xl font-bold mb-4 text-black text-center mt-16 font-[family-name:var(--font-cormorant)]">
        Welcome to the CloudPantry
      </h1>
      <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-6">
        What would you like to do today?
      </p>

      {/* Feature Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 sm:px-16 py-24 bg-[#ff9b8a] ">
        <FeatureCard
          image="/request-food.jpg"
          title="Request Food"
          description="Need food for your charity? Browse and request available resources."
          link="/request"
        />
        <FeatureCard
          image="/track-inventory.jpg"
          title="Track Inventory"
          description="Manage and keep track of your food stock easily."
          link="/inventory"
        />
        <FeatureCard
          image="/share-food.jpg"
          title="Review Recipients"
          description="View your recipient list for the next donation run!"
          link="/recipient"
        />
      </div>

      {/* ✅ Upcoming Events Section (Fixed Background) */}
      <div className="bg-[#f7f0ea] py-16 text-center">
        <h2 className="text-4xl font-bold text-black">Upcoming Events!</h2>
        <p className="text-lg mt-4">Stay tuned for upcoming events and collaborations.</p>
      </div>

      {/* ✅ Contact Us Section */}
      <div className="bg-[#f4d1cb] py-16 text-center">
        <h2 className="text-4xl font-bold text-black">Contact Us</h2>
        <p className="text-lg mt-4">Need help? Reach out to us via email or phone.</p>
      </div>
    </div>
  );
}

/* Feature Card Component */
function FeatureCard({ image, title, description, link }) {
    const [hover, setHover] = useState(false);
  
    return (
      <a
        href={link}
        className="relative group w-full h-60 overflow-hidden rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 animate__animated animate__fadeInUp"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Image */}
        <Image
          src={image}
          alt={title}
          layout="fill"
          objectFit="cover"
          className="transition-opacity duration-300"
        />
  
        {/* Title (Visible by Default, Hidden on Hover) */}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xl sm:text-2xl font-bold transition-opacity duration-300 ${
            hover ? "opacity-0" : "opacity-100"
          }`}
        >
          {title}
        </div>
  
        {/* Hover Effect: Show Description */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white text-center p-4 transition-opacity duration-300 ${
            hover ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-sm sm:text-base">{description}</p>
        </div>
      </a>
    );
  }
  