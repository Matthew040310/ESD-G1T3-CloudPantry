"use client"; 
import { useRouter } from "next/navigation"; 
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import 'animate.css';
import { useState } from 'react';
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

export default function Signin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    
    const email = event.target.elements.email.value;
    const password = event.target.elements.password.value;
    
    try {
      console.log('Submitting login form with email:', email);
      const response = await charityApi.signIn(email, password);
      console.log('Login response:', response);
      
      if (response.Success && response.Charity) {
        // Store all charity information from login response
        const charity = response.Charity;
        console.log('Storing charity data:', charity);

        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("charityID", charity.Id.toString());
        localStorage.setItem("charityName", charity.CharityName || '');
        localStorage.setItem("username", charity.Username || '');
        localStorage.setItem("email", charity.Email || '');
        localStorage.setItem("address", charity.Address || '');
        localStorage.setItem("postalCode", charity.PostalCode ? charity.PostalCode.toString() : '');
        
        // Log stored data for verification
        console.log('Stored profile data:', {
          charityID: localStorage.getItem("charityID"),
          charityName: localStorage.getItem("charityName"),
          username: localStorage.getItem("username"),
          email: localStorage.getItem("email"),
          address: localStorage.getItem("address"),
          postalCode: localStorage.getItem("postalCode")
        });

        // Trigger storage event so other components update
        window.dispatchEvent(new Event("storage"));
        
        router.push("/home");
      } else {
        setError(response.ErrorMessage || 'Invalid response from server');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex min-h-screen bg-[#f4d1cb] ${dmSans.variable}`}>
      {/* Left Section: Image */}
      <div className="w-1/2 flex items-center justify-center animate__animated animate__fadeInLeft">
        <img src="/signin.png" alt="Charity Illustration" className="max-w-full h-auto" />
      </div>

      {/* Right Section: Sign-In Form */}
      <div className="w-1/2 flex flex-col justify-center px-12 animate__animated animate__fadeInUp">
        <h1 className={`text-7xl text-black mb-8 ${cormorant.variable} font-serif`}>
          Your pantry awaits!
        </h1>

        <form onSubmit={handleSignIn} className="grid grid-cols-1 gap-6">
          {/* Input Fields */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-700">EMAIL</label>
            <input 
              name="email"
              type="email" 
              className="border-b border-black bg-transparent outline-none py-2" 
              required 
            />

            <label className="text-sm text-gray-700 mt-4">PASSWORD</label>
            <input 
              name="password"
              type="password" 
              className="border-b border-black bg-transparent outline-none py-2" 
              required 
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm mt-2">
              {error}
            </div>
          )}

          {/* Sign-In Button */}
          <div className="mt-8">
            <button
              type="submit"
              disabled={loading}
              className={`px-9 py-1 bg-[#f7f0ea] text-black rounded-full shadow-md border border-black hover:bg-[#f56275] hover:text-white transition ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Signing in...' : 'GET STARTED →'}
            </button>

            {/* redirect to signup Link */}
            <p className="text-sm text-black mt-5">
              Don't have an account?{" "}
              <span
                className="text-[#f56275] font-bold cursor-pointer hover:underline"
                onClick={() => router.push("/signup")}
              >
                Sign up
              </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
