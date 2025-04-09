// lib/getItemNameById.js

/**
 * Fetches the name of an inventory item based on its ID
 * 
 * @param {string} itemId - The unique identifier of the inventory item
 * @returns {Promise<string|null>} - The name of the item or null if not found
 */
export async function getItemNameById(itemId) {
    try {
      const url = `http://127.0.0.1:5006/inventory/item/${itemId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch item: ${response.status}`);
      }
  
      const data = await response.json();
      
      if (data.code === 200 && 
          data.data && 
          data.data.response && 
          data.data.response.length > 0) {
        
        return data.data.response[0].name;
      } else {
        console.warn('Item not found or invalid response format');
        return null;
      }
    } catch (error) {
      console.error('Error fetching item name:', error);
      throw error;
    }
  }