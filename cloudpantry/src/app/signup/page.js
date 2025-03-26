"use client"
import { useRouter } from "next/navigation"; 
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { useEffect } from "react"; 
import 'animate.css';
import { getCharityIdByName } from '../../utils/charityUtils';

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
      event.preventDefault();
      
    // Get form values
    const charityName = event.target.elements.charityName.value;
    const username = event.target.elements.username.value;
    const email = event.target.elements.email.value;
    const address = event.target.elements.address.value;
    const postalCode = event.target.elements.postalCode.value;

      
    // Map charity name to ID
    // let charityID = 1; // Default ID
    
    // const charityMap = {
    //   1: "Food Bank Sg",
    //   2: "Food from the Heart",
    //   3: "Willing Hearts",
    //   4: "Lions Home for the Elders",
    //   5: "Free Food for All"
    // };
    
    // // Case-insensitive search for charity name
    // const normalizedCharityName = charityName.toLowerCase().trim();
    // for (const [name, id] of Object.entries(charityMap)) {
    //   if (name.toLowerCase() === normalizedCharityName) {
    //     charityID = id;
    //     break;
    //   }
    // }

    const charityID = getCharityIdByName(charityName);

    
    // Store user data
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("charityID", charityID);
    localStorage.setItem("charityName", charityName);
    localStorage.setItem("username", event.target.elements.username.value);
    localStorage.setItem("email", event.target.elements.email.value);
    localStorage.setItem("address", event.target.elements.address.value);
    localStorage.setItem("postalCode", event.target.elements.postalCode.value);
    
    // Trigger storage event so Navbar updates
    window.dispatchEvent(new Event("storage"));
    
    // Redirect to home page after signing up
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
            <input name='charityName' type="text" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">EMAIL</label>
            <input name='email' type="email" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">PASSWORD</label>
            <input name='password' type="password" className="border-b border-black bg-transparent outline-none py-2" required />
          </div>

          {/* Right Column */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-700">USERNAME</label>
            <input name='username' type="text" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">FULL ADDRESS</label>
            <input name='address' type="text" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">POSTAL CODE</label>
            <input name='postalCode' type="password" className="border-b border-black bg-transparent outline-none py-2" required />
          </div>

            {/* Submit Button - move this inside the form */}
            <div className="col-span-2 mt-8">
              <button
                type="submit"
                className="px-9 py-1 bg-[#f4d1cb] text-black rounded-full shadow-md border border-black hover:bg-[#f56275] transition"
              >
                GET STARTED →
              </button>
            </div>
        </form>

        
        <div className="mt-8">
          


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
