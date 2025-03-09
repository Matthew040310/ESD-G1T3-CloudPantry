"use client";
import { Cormorant_Garamond } from "next/font/google";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOutsideClick } from "../../hooks/useOutsideClick"; // Import Hook
import "animate.css";
import "@fortawesome/fontawesome-free/css/all.min.css"; // FontAwesome for icons

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
});

/* Custom Hook to Detect Scroll & Trigger Animation */
function useScrollAnimation() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 } // Trigger when 30% of section is visible
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
}

export default function Homepage() {
  const [heroRef, heroVisible] = useScrollAnimation();
  const [featureRef, featureVisible] = useScrollAnimation();
  const [eventsRef, eventsVisible] = useScrollAnimation();
  const [contactRef, contactVisible] = useScrollAnimation();

  return (
    <div className={`flex flex-col min-h-screen bg-[#f4d1cb] ${cormorant.variable}`}>
      {/* Hero Section */}
      <div red={heroRef} className="relative w-full h-[40vh] flex flex-col items-center justify-center text-white text-center overflow-hidden">
        {/* Video Background */}
        <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
        >
            <source src="/homebg.mov" type="video/mp4" />
            Your browser does not support the video tag.
        </video>

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40"></div>

        {/* Content */}
        <div className="relative z-10 px-6 sm:px-12">
            <h1 className="text-3xl sm:text-7xl font-bold text-white font-[family-name:var(--font-cormorant)]">
            Welcome to CloudPantry
            </h1>
        </div>
        </div>

      {/* Feature Section */}
      <div
        ref={featureRef}
        className={`bg-[#f7f0ea] px-6 sm:px-16 py-24 animate__animated ${
            featureVisible ? "animate__fadeInUp" : "opacity-0"
          } flex flex-col items-center`}
      >
        <h2 className="text-5xl font-bold text-black text-center mb-10 font-[family-name:var(--font-cormorant)] ">
            What would you like to do today
        </h2>
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-3 gap-6">
            <FeatureCard image="/request-food.jpg" title="Request Food" description="Need food for your charity? Browse and request available resources." link="/request"/>
            <FeatureCard image="/track-inventory.jpg" title="Track Inventory" description="Manage and keep track of your food stock easily." link="/inventory"/>
            <FeatureCard image="/share-food.jpg" title="Review Recipients" description="View your recipient list for the next donation run!" link="/recipient"/>
        </div>
      </div>

      {/* Upcoming Events Section */}
      <div ref={eventsRef} className={`animate__animated ${eventsVisible ? "animate__fadeInUp" : "opacity-0"}`}>
        <UpcomingEventsCarousel />
      </div>

      {/* Contact Us Section */}
      <div ref={contactRef} className={`animate__animated ${contactVisible ? "animate__fadeInUp" : "opacity-0"}`}>
        <ContactUs />
      </div>
    </div>
  );
}


/* Feature Card Component */
function FeatureCard({ image, title, description, link }) {
  return (
    <a href={link} className="relative group w-full h-60 overflow-hidden rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 bg-[#f7f0ea] p-6">
      <Image src={image} alt={title} layout="fill" objectFit="cover" className="rounded-lg transition-opacity duration-300"/>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-center p-4 transition-opacity duration-300">
        <h3 className="text-xl sm:text-2xl font-bold">{title}</h3>
        <p className="text-sm sm:text-base">{description}</p>
      </div>
    </a>
  );
}

/* Upcoming Events Section */
function UpcomingEventsCarousel() {
    const [active, setActive] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const id = Math.random().toString(36).substr(2, 9);
    const ref = useRef(null);
    
    useOutsideClick(ref, () => setActive(null));
  
    const prevEvent = () => {
      setCurrentIndex((prevIndex) => (prevIndex === 0 ? eventCards.length - 3 : prevIndex - 1));
    };
  
    const nextEvent = () => {
      setCurrentIndex((prevIndex) => (prevIndex + 3 >= eventCards.length ? 0 : prevIndex + 1));
    };
  
    return (
      <div className="bg-[#f4d1cb] py-16 text-center">
        <h2 className="text-5xl font-bold text-black mb-6 font-[family-name:var(--font-cormorant)]">
          CloudPantry's Upcoming Events!
        </h2>
  
        {/* ✅ Carousel with Navigation */}
        <div className="relative flex items-center justify-center w-full max-w-6xl mx-auto">
          {/* Left Button */}
          <button onClick={prevEvent} className="absolute left-4 bg-black text-white px-4 py-2 rounded-full z-10">
            ◀
          </button>
  
          {/* Visible Event Cards */}
          <div className="flex gap-6 overflow-hidden">
            {eventCards.slice(currentIndex, currentIndex + 3).map((card, index) => (
              <motion.div key={card.title} className="w-[350px] flex-shrink-0 rounded-lg shadow-lg overflow-hidden bg-[#f7f0ea] p-6 cursor-pointer" whileHover={{ scale: 1.05 }} onClick={() => setActive(card)}>
                <Image width={350} height={230} src={card.src} alt={card.title} className="w-full h-64 object-cover"/>
                <div className="text-center mt-4">
                  <h3 className="text-2xl font-bold text-black">{card.title}</h3>
                  <p className="text-gray-600">{card.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
  
          {/* Right Button */}
          <button onClick={nextEvent} className="absolute right-4 bg-black text-white px-4 py-2 rounded-full z-10">
            ▶
          </button>
        </div>
  
        {/* ✅ Expanded Card with Title & Content Only */}
        <AnimatePresence>
          {active && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
              <motion.div ref={ref} layoutId={`card-${active.title}-${id}`} className="w-full max-w-lg bg-white rounded-lg shadow-lg p-8 relative max-h-[90vh] overflow-y-auto" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                {/* Close Button */}
                <button className="absolute top-4 right-4 text-gray-600 text-xl" onClick={() => setActive(null)}>✖</button>
  
                {/* Image */}
                <Image width={500} height={300} src={active.src} alt={active.title} className="rounded-lg"/>
  
                {/* Title */}
                <h3 className="text-3xl font-bold text-black mt-6">{active.title}</h3>
  
                {/* ✅ Scrollable Content Area */}
                <div className="text-gray-700 text-lg mt-4 max-h-[300px] overflow-y-auto px-2">
                  {active.content}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  

/* Contact Us Section */
function ContactUs() {
  return (
    <div className="bg-[#f7f0ea] py-16 px-6 sm:px-16">
      <h2 className="text-5xl font-bold text-black text-center mb-10 font-[family-name:var(--font-cormorant)]">
        CONTACT US
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 text-black text-center sm:text-left">
        <div>
          <h3 className="text-xl font-bold">Donor, Media & General Enquiries</h3>
          <p className="mt-2 text-lg">Email: <a href="mailto:enquiries@cloudpantry.sg" className="text-black underline">enquiries@cloudpantry.sg</a></p>
        </div>
        <div>
          <h3 className="text-xl font-bold">For Food Support</h3>
          <p className="mt-2 text-lg">Visit our Request Directory to find the nearest food support agency.</p>
        </div>
        <div>
            <h3 className="text-xl font-bold">We are located at:</h3>
            <p className="mt-2 text-lg">Singapore Management University<br/>81 Victoria Street<br/>Singapore 188065</p>
        </div>
        <div className="flex flex-col items-center sm:items-start">
          <h3 className="text-xl font-bold">Follow Us</h3>
          <div className="flex space-x-4 mt-2">
            <a href="#" className="text-black text-2xl"><i className="fab fa-instagram"></i></a>
            <a href="#" className="text-black text-2xl"><i className="fab fa-facebook"></i></a>
            <a href="#" className="text-black text-2xl"><i className="fab fa-linkedin"></i></a>
          </div>
        </div>
      </div>
    </div>
  );
}


/* Event Cards Data */
const eventCards = [
  { title: "Food Drive 2025", description: "Join us for a community food drive!", src: "/food_drive.jpg", content: "This May, CloudPantry will be hosting a collaborative food drive with all of our partners. This way, we have all hands on deck to receive donations as a team!" },
  { title: "CloudPantry Shop", description: "CloudPantry is launching a new shop!", src: "/community_shop.jpeg", content: "We all know we need to receive more than just food, we need support in other areas too! So this April, CloudPantry will be opening a shop to sell surplus food for donations." },
  { title: "Labour Day Gala", description: "An exclusive dinner for charities!", src: "/gala_dinner.jpg", content: "CloudPantry will host a gala dinner to honor and show thanks to our hardworking volunteers." },
  { title: "Hari Raya Food Run", description: "Distributing food to those in need!", src: "/hari_raya.jpg", content: "CloudPantry is organizing a food run for the Muslim community during Hari Raya, making sure no brother is left behind." }
];
