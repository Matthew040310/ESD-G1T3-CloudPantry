import { Cormorant_Garamond } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"], // Choose the desired weights
  variable: "--font-cormorant",
});

export default function LandingPage() {
    return (
        <div className={`flex flex-col min-h-screen bg-[#f7f0ea] ${cormorant.variable}`}>
            <div className="relative w-full h-[80vh] flex items-center justify-center text-white">
            {/* Background Video */}
            <video
            className="absolute top-0 left-0 w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            >
            <source src="/bgvid.mov" type="video/mp4" />
            Your browser does not support the video tag.
            </video>
    
            {/* Dark Overlay for Readability */}
            <div className="absolute top-0 left-0 w-full h-full bg-black/50"></div>
    
            {/* Hero Content */}
            <div className="relative z-10 text-center px-6 sm:px-12">
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 text-[#f4d1cb] font-[family-name:var(--font-cormorant)]">
                Empowering Food Charities to Share & Collaborate
            </h1>
            <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-6">
                Connect with other food charities, share resources, and help those in need!
            </p>
    
            {/* Call-to-Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <a
                    href="/signup"
                    className="px-6 py-3 bg-[#f4d1cb] text-black font-semibold rounded-full shadow-md hover:bg-[#f56275]  transition"
                    >
                    Get Started
                    </a>
                    <a
                    href="/sigin"
                    className="px-6 py-3 bg-transparent border border-white text-white font-semibold rounded-full hover:bg-[#f56275] hover:text-black transition"
                    >
                    Sign in
                    </a>
                </div>
            </div>
            </div>
            i will figure out the rest of the content later
        </div>
    );
  }
  