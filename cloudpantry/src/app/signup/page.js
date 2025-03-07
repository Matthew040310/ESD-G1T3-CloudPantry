"use client"
import { useRouter } from "next/navigation"; // Import useRouter
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
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
  const router = useRouter(); // Initialize Next.js router

  const handleSubmit = (event) => {
    event.preventDefault(); // Prevents default form submission behavior
    console.log("Form submitted"); // For debugging

    // Redirect user to /home after form submission
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
            <input type="text" className={`border-b border-black bg-transparent outline-none py-2 ${dmSans.variable}`} required />

            <label className="text-sm text-gray-700 mt-4">EMAIL</label>
            <input type="email" className={`border-b border-black bg-transparent outline-none py-2 ${dmSans.variable}`} required />

            <label className="text-sm text-gray-700 mt-4">PASSWORD</label>
            <input type="password" className={`border-b border-black bg-transparent outline-none py-2 ${dmSans.variable}`} required />
          </div>

          {/* Right Column */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-700">FULL ADDRESS</label>
            <input type="text" className={`border-b border-black bg-transparent outline-none py-2 ${dmSans.variable}`} required />

            <label className="text-sm text-gray-700 mt-4">POSTAL CODE</label>
            <input type="text" className={`border-b border-black bg-transparent outline-none py-2 ${dmSans.variable}`} required />

            <label className="text-sm text-gray-700 mt-4">CONFIRM PASSWORD</label>
            <input type="password" className={`border-b border-black bg-transparent outline-none py-2 ${dmSans.variable}`} required />
          </div>
        </form>

        {/* Submit Button */}
        <div className="mt-8">
          <button
            type="submit"
            className={`px-9 py-1 bg-[#f4d1cb] text-black  rounded-full shadow-md border border-black hover:bg-[#f56275] transition ${dmSans.variable}`}
            onClick={handleSubmit} // Call function when clicked
          >
            GET STARTED →
          </button>
        </div>
      </div>
    </div>
  );
}
