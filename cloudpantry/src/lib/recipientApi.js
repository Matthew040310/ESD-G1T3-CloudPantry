// lib/recipientApi.js

/**
 * Fetch all recipients from the API
 * @returns {Promise<Array>} Promise that resolves to an array of recipients
 */
export const getAllRecipients = async () => {
    try {
      const response = await fetch('https://personal-d4txim0d.outsystemscloud.com/Recipient/rest/RecipientAPI/GetAllRecipient');
      
      if (!response.ok) {
        throw new Error(`Error fetching recipients: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
      throw error;
    }
  };