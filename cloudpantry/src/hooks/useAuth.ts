import { useState } from 'react';
import { charityApi, CharityData, AuthResponse } from '@/lib/charityApi';

export const useAuth = () => {
  const [user, setUser] = useState<CharityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await charityApi.signIn(email, password);
      if (response.token && response.charity) {
        // Store token in localStorage or secure storage
        localStorage.setItem('charityToken', response.token);
        setUser(response.charity);
        return response;
      }
      throw new Error('Invalid response from server');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (charityData: CharityData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await charityApi.signUp(charityData);
      if (response.token && response.charity) {
        localStorage.setItem('charityToken', response.token);
        setUser(response.charity);
        return response;
      }
      throw new Error('Invalid response from server');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('charityToken');
    setUser(null);
  };

  const updateProfile = async (id: string, data: Partial<CharityData>) => {
    try {
      setLoading(true);
      setError(null);
      const updatedCharity = await charityApi.updateCharity(id, data);
      setUser(updatedCharity);
      return updatedCharity;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };
}; 