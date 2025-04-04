// lib/allocationService.js

/**
 * Calls the allocation API to schedule a delivery for a specific charity on a given date
 * 
 * @param {number} charityId - The ID of the charity to schedule the delivery for
 * @param {string} deliveryDate - The delivery date in YYYY-MM-DD format
 * @returns {Promise<Object>} - The API response data containing allocation_result and potential_charities
 */
export async function scheduleDelivery(charityId, deliveryDate) {
    try {
      // Encode the delivery date as a query parameter
      const url = `http://127.0.0.1:8000/allocate/${charityId}?delivery_date=${encodeURIComponent(deliveryDate)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
  
      if (!response.ok) {
        throw new Error(`Failed to schedule delivery: ${response.status}`);
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error scheduling delivery:', error);
      throw error;
    }
  }