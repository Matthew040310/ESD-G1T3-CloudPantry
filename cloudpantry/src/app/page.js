'use client'
import { useEffect } from "react";
import { redirect } from "next/navigation";
import { useRouter } from "next/navigation";

export default function Root() {
  const router = useRouter();
  
  useEffect(() => {
    // Check if user is logged in using localStorage
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    
    // Redirect based on login status
    if (isLoggedIn) {
      router.push("/home");
    } else {
      router.push("/landing");
    }
  }, [router]);
  
  // Return null or a loading state while the redirect is happening
  return <div className="flex justify-center items-center h-screen">Loading...</div>;
}