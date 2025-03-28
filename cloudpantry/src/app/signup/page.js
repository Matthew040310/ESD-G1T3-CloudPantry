"use client"
import { useRouter } from "next/navigation"; 
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import { useEffect, useState } from "react"; 
import 'animate.css';
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

export default function Signup() {
    const router = useRouter();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
      event.preventDefault();
      setError('');
      setLoading(true);
      
      try {
        // Get form values and format them according to the API requirements
        const charityData = {
          name: event.target.elements.charityName.value,
          username: event.target.elements.username.value,
          email: event.target.elements.email.value,
          password: event.target.elements.password.value,
          address: event.target.elements.address.value,
          postalCode: event.target.elements.postalCode.value
        };

        const response = await charityApi.signUp(charityData);
        
        if (response) {
          // Store user data
          localStorage.setItem("isLoggedIn", "true");
          localStorage.setItem("charityID", response.Id || '');
          localStorage.setItem("charityName", charityData.name);
          localStorage.setItem("email", charityData.email);
          localStorage.setItem("address", charityData.address);
          localStorage.setItem("postalCode", charityData.postalCode);
          
          // Trigger storage event so Navbar updates
          window.dispatchEvent(new Event("storage"));
          
          // Redirect to home page after signing up
          router.push("/home");
        } else {
          setError('Invalid response from server');
        }
      } catch (err) {
        setError(err.message || 'Failed to sign up');
      } finally {
        setLoading(false);
      }
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
              <input name='postalCode' type="text" className="border-b border-black bg-transparent outline-none py-2" required />
            </div>

            {error && (
              <div className="col-span-2 text-red-500 text-sm mt-2">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="col-span-2 mt-8">
              <button
                type="submit"
                disabled={loading}
                className={`px-9 py-1 bg-[#f4d1cb] text-black rounded-full shadow-md border border-black hover:bg-[#f56275] transition ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Creating Account...' : 'GET STARTED →'}
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
