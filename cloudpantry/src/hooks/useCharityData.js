// src/hooks/useCharityData.js
import { useState, useEffect } from 'react';
import callSupabaseAPI from '../api/callSupabaseAPI';

export function useCharityData(endpoint) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Get charity ID from localStorage
        const CHARITY_ID = localStorage.getItem("charityID") || 0;
        
        console.log(`Fetching data from ${endpoint} for charity ID:`, CHARITY_ID);
        setIsLoading(true);
        
        const response = await callSupabaseAPI("GET", `${endpoint}/${CHARITY_ID}`);
        setData(response.data);
      } catch (err) {
        console.error(`Failed to fetch from ${endpoint}:`, err);
        setError(err.message || `Failed to load data from ${endpoint}`);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [endpoint]);

  return { data, isLoading, error };
}