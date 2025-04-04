// lib/deliveryConfirmationService.js

/**
 * Confirms a scheduled delivery with the backend
 * 
 * @param {number} charity_id - The ID of the charity
 * @param {Array} allocation_list - List of recipients and their allocated items
 * @param {Array} excess_items - List of items that were not allocated
 * @param {string} delivery_date - Date of the delivery in YYYY-MM-DD format
 * @returns {Promise} - Response from the confirmation endpoint
 */
export async function confirmDelivery(charity_id, allocation_list, excess_items, delivery_date) {
    try {
      const response = await fetch('http://127.0.0.1:8000/confirm_delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          charity_id,
          allocation_list,
          excess_items,
          delivery_date
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${response.status} ${response.statusText}`);
      }
  
      return await response.json();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      throw error;
    }
  }