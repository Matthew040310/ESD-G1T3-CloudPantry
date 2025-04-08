"use client";
import { useRouter } from "next/navigation";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import 'animate.css';
import { useState } from 'react';
import { charityApi } from '@/lib/charityApi'; // Your actual login API handler

const cormorant = Cormorant_Garamond({
  subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-cormorant",
});
const dmSans = DM_Sans({
  subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-dm-sans",
});

// API Base URL for the request_api service
const REQUEST_API_BASE_URL = "http://localhost:5199"; // Using port 5199

export default function Signin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Simplified function to call the listener start endpoint
  const startMessageListener = async (charityId) => {
    if (!charityId) {
      console.warn("Listener start skipped: Charity ID missing.");
      return;
    }
    console.log(`Attempting to trigger listener start for ID: ${charityId}`);
    try {
      // Fire-and-forget fetch request
      fetch(`${REQUEST_API_BASE_URL}/listener/start/${charityId}`, { method: 'POST' })
        .then(response => {
          if (response.ok) {
            console.log(`Listener start request sent successfully for ID: ${charityId}`);
          } else {
            console.error(`Listener start request failed for ID: ${charityId}, Status: ${response.status}`);
          }
        })
        .catch(networkError => {
          console.error(`Network error sending listener start request for ID: ${charityId}`, networkError);
        });
    } catch (err) {
           console.error(`Error setting up listener start request for ID: ${charityId}`, err);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const email = event.target.elements.email.value;
    const password = event.target.elements.password.value;

    try {
      // 1. Perform actual login using your charityApi
      console.log('Calling charityApi.signIn...');
      const response = await charityApi.signIn(email, password);
      console.log('Login API response:', response);

      // 2. Check if login was successful and charity data exists
      if (response.Success && response.Charity && response.Charity.Id) {
        const charity = response.Charity;
        const charityId = charity.Id.toString(); // Get the ID

        // 3. Store essential data in localStorage
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("charityID", charityId);
        // Store other useful info
        localStorage.setItem("charityName", charity.CharityName || '');
        localStorage.setItem("username", charity.Username || '');
        localStorage.setItem("email", charity.Email || '');
        localStorage.setItem("address", charity.Address || '');
        localStorage.setItem("postalCode", charity.PostalCode ? charity.PostalCode.toString() : '');

        console.log(`Stored charityID: ${charityId} in localStorage.`);

        // --- 4. Call the listener start endpoint ---
        startMessageListener(charityId);
        // -----------------------------------------

        // 5. Trigger storage event for other components/tabs
        window.dispatchEvent(new Event("storage"));

        // 6. Redirect to the home page
        router.push("/home");

      } else {
        // Handle failed login
        setError(response.ErrorMessage || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      // Handle errors during the login API call or processing
      console.error('Sign in process error:', err);
      setError(err.message || 'An error occurred during sign in.');
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
            <label className="text-sm text-gray-700">Email</label>
            <input name="email" type="email" className="border-b border-black bg-transparent outline-none py-2" required />
            <label className="text-sm text-gray-700 mt-4">PASSWORD</label>
            <input name="password" type="password" className="border-b border-black bg-transparent outline-none py-2" required />
          </div>

          {error && (<div className="text-red-500 text-sm mt-2">{error}</div>)}

          {/* Sign-In Button */}
          <div className="mt-8">
            <button type="submit" disabled={loading}
              className={`px-9 py-1 bg-[#f7f0ea] text-black rounded-full shadow-md border border-black hover:bg-[#f56275] hover:text-white transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {loading ? 'Signing in...' : 'GET STARTED →'}
            </button>

            {/* redirect to signup Link */}
            <p className="text-sm text-black mt-5">
              Don't have an account?{" "}
              <span className="text-[#f56275] font-bold cursor-pointer hover:underline" onClick={() => router.push("/signup")}> Sign up </span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}