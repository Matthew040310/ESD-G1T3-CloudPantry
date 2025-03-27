"use client";
import { useState, useEffect, useRef } from "react";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "animate.css";
import { cn } from "../../lib/utils";

// Font Configurations
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

// Component to Handle Scroll-Based Animations
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
        { threshold: 0.3 } // Trigger animation when 30% of the section is visible
      );
  
      if (ref.current) observer.observe(ref.current);
      
      return () => observer.disconnect();
    }, []);
  
    return [ref, isVisible];
  }

export function CardDemo({ title, description, imageUrl, hoverVideoUrl }) {
    return (
      <div className="w-full max-w-xs">
        <div
          className={cn(
            "group w-full cursor-pointer overflow-hidden relative card h-80 sm:h-96 rounded-md shadow-xl mx-auto flex flex-col justify-end p-4 border border-transparent dark:border-neutral-800",
            "hover:after:content-[''] hover:after:absolute hover:after:inset-0 hover:after:bg-black hover:after:opacity-50",
            "transition-all duration-500"
          )}
          style={{
            backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Hover Video */}
          {hoverVideoUrl && (
            <video
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              autoPlay
              loop
              muted
              playsInline
            >
              <source src={hoverVideoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}
  
          {/* Card Content */}
          <div className="text relative z-50">
            <h1 className="font-bold text-xl md:text-3xl text-black group-hover:text-white relative transition-colors duration-300">
              {title}
            </h1>
            <p className="font-normal text-base text-black group-hover:text-white relative my-4 transition-colors duration-300">
              {description}
            </p>
          </div>
        </div>
      </div>
    );
  }
  

// Stats Counter Component with Scroll Trigger
export function StatsCounter({ target, duration, label }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const counterRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 } // Trigger when 50% of the section is visible
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => {
      if (counterRef.current) {
        observer.unobserve(counterRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return; // Start counting only when visible

    let start = 0;
    const increment = Math.ceil(target / (duration / 10));

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 10);

    return () => clearInterval(timer);
  }, [isVisible, target, duration]);

  return (
    <div className="text-center" ref={counterRef}>
      <h3 className="text-5xl sm:text-6xl font-bold text-black">{count.toLocaleString()}</h3>
      <p className="mt-2 text-lg sm:text-xl font-medium bg-[#f4d1cb] px-6 py-2 rounded-full inline-block border border-black">
        {label}
      </p>
    </div>
  );
}

export default function LandingPage() {
    const [heroRef, heroVisible] = useScrollAnimation();
    const [aboutRef, aboutVisible] = useScrollAnimation();
    const [missionRef, missionVisible] = useScrollAnimation();
    const [proudRef, proudVisible] = useScrollAnimation();
    const [ctaRef, ctaVisible] = useScrollAnimation();
    return (
        <div className={`flex flex-col min-h-screen bg-[#f7f0ea] ${cormorant.variable}`}>
        {/* Hero Section */}
        <div ref={heroRef}
        className={`relative w-full h-[80vh] flex items-center justify-center text-white ${
          heroVisible ? "animate__animated animate__fadeInUp" : "opacity-0"
        }`}>
            <video className="absolute top-0 left-0 w-full h-full object-cover" autoPlay loop muted playsInline>
            <source src="/bgvid.mov" type="video/mp4" />
            Your browser does not support the video tag.
            </video>
            <div className="absolute top-0 left-0 w-full h-full bg-black/50"></div>

            <div className="relative z-10 text-center px-6 sm:px-12">
            <h1 className="text-3xl sm:text-6xl font-bold mb-4 text-[#f4d1cb] font-[family-name:var(--font-cormorant)]">
                Empowering Food Charities to Share & Collaborate
            </h1>
            <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-6">
                Connect with other food charities, share resources, and help those in need!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/signup" className="px-6 py-3 bg-[#f4d1cb] text-black font-semibold rounded-full shadow-md hover:bg-[#f56275] transition">
                Get Started
                </a>
                <a href="/signin" className="px-6 py-3 bg-transparent border border-white text-white font-semibold rounded-full hover:bg-[#f56275] hover:text-black transition">
                Sign in
                </a>
            </div>
            </div>
        </div>

        {/* About Section */}
        <div ref={aboutRef}
        className={`flex flex-col sm:flex-row items-center p-12 sm:p-20 bg-[#f7f0ea] ${
          aboutVisible ? "animate__animated animate__fadeInUp" : "opacity-0"
        }`}>
            <div className="w-full sm:w-1/2">
            <img src="/aboutus_temp.jpg" alt="CloudPantry Team" className="w-full h-auto rounded-lg shadow-md animate__animated animate__fadeInUp" />
            </div>
            <div className="w-full sm:w-1/2 px-6 sm:px-12">
            <h2 className="text-4xl sm:text-7xl font-bold text-black text-center mb-6 font-[family-name:var(--font-cormorant)] animate__animated animate__fadeInUp">
                About CloudPantry
            </h2>
            <div className={`bg-[#f4d1cb] p-6 sm:p-8 rounded-lg shadow-md text-black text-lg sm:text-md animate__animated animate__fadeInUp ${dmSans.variable}`}>
                <p>
                Hey there! CloudPantry was founded in 2025 by a group of students from SMU (that’s us on the right!)
                who combined their tech knowledge and their passion for volunteering to do more for the community!
                </p>
            </div>
            </div>
        </div>

        {/* Mission, Vision, Goals Section */}
        <div  ref={missionRef}
        className={`p-12 sm:p-20 bg-[#f4d1cb] text-center ${
          missionVisible ? "animate__animated animate__fadeInUp" : "opacity-0"
        }`}>
            <h2 className="text-4xl sm:text-6xl font-bold text-black mb-10 font-[family-name:var(--font-cormorant)] animate__animated animate__fadeInUp">
            Our Mission, Vision & Goals
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 justify-center animate__animated animate__fadeInUp">
            <CardDemo title="Mission" description="Our mission is to connect food charities for efficient resource sharing." imageUrl="/logo.jpg" hoverVideoUrl="/mission.mov" />
            <CardDemo title="Vision" description="Our vision is a world where no food charity struggles to find resources." imageUrl="/logo.jpg" hoverVideoUrl="/vision.mov" />
            <CardDemo title="Goals" description="We aim to create a seamless platform that maximizes food distribution efficiency." imageUrl="/logo.jpg" hoverVideoUrl="/goals.mov" />
            </div>
        </div>

        {/* Proud Section */}
        <div ref={proudRef}
        className={`bg-[#f7f0ea] text-center p-12 sm:p-20 ${
          proudVisible ? "animate__animated animate__fadeInUp" : "opacity-0"
        }`}>
            <h2 className="text-4xl sm:text-6xl font-bold text-black mb-10 font-[family-name:var(--font-cormorant)]">
            We are proud to say
            </h2>

            {/* Full-Width Video */}
            <div className="w-full">
            <video className="w-full h-[50vh] object-cover rounded-lg shadow-md" autoPlay loop muted playsInline>
                <source src="/proud_sec.mov" type="video/mp4" />
            </video>
            </div>

            {/* Stats Section */}
            <div className="flex flex-col sm:flex-row justify-center gap-12 mt-12">
            <StatsCounter target={5} duration={1000} label="AFFILIATIONS IN CHARITY" />
            <StatsCounter target={18610} duration={1500} label="VOLUNTEERS JOINED IN HAND" />
            <StatsCounter target={250000} duration={1800} label="INDIVIDUALS IMPACTED" />
            </div>
        </div>

        {/* Call to Action Section */}
        <div ref={ctaRef}
        className={`bg-[#f4d1cb] text-center p-16 ${
          ctaVisible ? "animate__animated animate__fadeInUp" : "opacity-0"
        }`}>
            <h2 className="text-4xl sm:text-6xl font-bold text-black font-[family-name:var(--font-cormorant)] animate__animated animate__fadeInUp">
            Ready To Join The Cloud?
            </h2>
            <div className="flex flex-col sm:flex-row gap-6 justify-center mt-6 ">
            <a href="/signup" className="px-6 py-3 bg-white text-black font-semibold rounded-full shadow-md hover:bg-[#f56275] transition animate__animated animate__fadeInUp">
                Sign Up Now
            </a>
            <a href="/signin" className="px-6 py-3 border border-black text-black font-semibold rounded-full hover:bg-[#f56275] hover:text-white transition animate__animated animate__fadeInUp">
                Sign In
            </a>
            </div>
        </div>
        </div>
    );
}
