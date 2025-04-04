import { useState } from 'react';

const API_BASE_URL = "https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI";

export const useRecipient = () => {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRecipients = async (charityId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/GetRecipientByCharityID?CharityID=${charityId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to fetch recipients');
      }
      const data = await response.json();
      setRecipients(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  const createRecipient = async (recipientData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/CreateRecipient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recipientData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to add recipient');
      }

      return true;
    } catch (err) {
      console.error('Error adding recipient:', err);
      throw err;
    }
  };

  const deleteRecipient = async (phoneNumber) => {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    try {
      // Ensure phone number is a string
      const formattedPhoneNumber = phoneNumber.toString().trim();
      
      const response = await fetch(`${API_BASE_URL}/DeleteRecipient`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: formattedPhoneNumber // Send phone number directly as raw text
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete recipient');
      }

      return true;
    } catch (err) {
      console.error('Error deleting recipient:', err);
      throw err;
    }
  };

  return {
    recipients,
    loading,
    error,
    fetchRecipients,
    createRecipient,
    deleteRecipient
  };
}; 