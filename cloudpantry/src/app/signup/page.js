"use client"
import { useRouter } from "next/navigation"; 
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { useEffect } from "react"; 
import 'animate.css';

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

export default function Signup() {
  const router = useRouter();

  const handleSubmit = (event) => {
    event.preventDefault(); // Prevent default form submission
  
    // ✅ Store login status
    localStorage.setItem("isLoggedIn", "true");
  
    // ✅ Trigger storage event so Navbar updates
    window.dispatchEvent(new Event("storage"));
  
    // ✅ Redirect to home page after signing up
    router.push("/home");
  };
  

  return (
    <div className={`flex min-h-screen bg-[#f7f0ea] ${dmSans.variable}`}>
      {/* Left Section: Image */}
      <div className="w-1/2 flex items-center justify-center animate__animated animate__fadeInLeft">
        <img src="/signup.png" alt="Charity Illustration" className="max-w-full h-auto" />
      </div>

      {/* Right Section: Signup Form */}
      <div className="w-1/2 flex flex-col justify-center px-12 animate__animated animate__fadeInUp">
        <h1 className={`text-7xl text-black mb-8 ${cormorant.variable} font-serif`}>
          Join the Cloud!
        </h1>

        <form className="grid grid-cols-2 gap-6" onSubmit={handleSubmit}>
          {/* Left Column */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-700">NAME OF CHARITY</label>
            <input type="text" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">EMAIL</label>
            <input type="email" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">PASSWORD</label>
            <input type="password" className="border-b border-black bg-transparent outline-none py-2" required />
          </div>

          {/* Right Column */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-700">USERNAME</label>
            <input type="text" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">FULL ADDRESS</label>
            <input type="text" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">CONFIRM PASSWORD</label>
            <input type="password" className="border-b border-black bg-transparent outline-none py-2" required />
          </div>
        </form>

        {/* Submit Button */}
        <div className="mt-8">
          <button
            type="submit"
            className="px-9 py-1 bg-[#f4d1cb] text-black rounded-full shadow-md border border-black hover:bg-[#f56275] transition"
            onClick={handleSubmit}
          >
            GET STARTED →
          </button>


          {/* "Already have an account?" Link */}
          <p className="text-sm text-black mt-5">
            Already have an account?{" "}
            <span
              className="text-[#f56275] font-bold cursor-pointer hover:underline"
              onClick={() => router.push("/signin")}
            >
              Sign in
            </span>
          </p>
        </div>

        
        
      </div>
    </div>
  );
}
