"use client"; 
import { useRouter } from "next/navigation"; 
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

export default function Signin() {
  const router = useRouter();

  const handleSignIn = () => {
    // ✅ Store login status
    localStorage.setItem("isLoggedIn", "true");

    // ✅ Trigger storage event so Navbar updates
    window.dispatchEvent(new Event("storage"));

    // ✅ Redirect to home page after signing in
    router.push("/home");
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

        <form className="grid grid-cols-1 gap-6">
          {/* Input Fields */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-700">USERNAME</label>
            <input type="email" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700">EMAIL</label>
            <input type="email" className="border-b border-black bg-transparent outline-none py-2" required />

            <label className="text-sm text-gray-700 mt-4">PASSWORD</label>
            <input type="password" className="border-b border-black bg-transparent outline-none py-2" required />
          </div>
        </form>

        {/* Sign-In Button */}
        <div className="mt-8">
          <button
            type="button"
            className="px-9 py-1 bg-[#f7f0ea] text-black rounded-full shadow-md border border-black hover:bg-[#f56275] hover:text-white transition"
            onClick={handleSignIn}
          >
            GET STARTED →
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
      </div>
    </div>
  );
}
