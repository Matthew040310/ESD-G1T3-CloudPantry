// Using Next.js API routes to proxy the requests
const BASE_URL = '/api';

export const charityApi = {
  // Authentication
  signIn: async (email, password) => {
    try {
      console.log('Attempting to sign in with:', { email }); // Don't log password
      
      // Validate and format email
      if (!email || !email.includes('@')) {
        throw new Error('Invalid email format');
      }

      // Remove any whitespace and ensure proper case
      const formattedEmail = email.trim().toLowerCase();
      
      // Use GET method with query parameters as specified in the API
      // Note: We're not using encodeURIComponent for Email as it might affect the email format
      const response = await fetch(`${BASE_URL}/Login?Email=${formattedEmail}&Password=${encodeURIComponent(password)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Request URL:', `${BASE_URL}/Login?Email=${formattedEmail}`); // Log URL without password
      
      const text = await response.text();
      console.log('Raw response:', text);

      // Try to parse the response as JSON
      let data;
      try {
        data = text ? JSON.parse(text) : {};
        console.log('Parsed response:', data);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response format from server');
      }

      // Check for error message in the response
      if (data.ErrorMessage) {
        throw new Error(data.ErrorMessage);
      }

      // If no error message but also no charity data, something is wrong
      if (!data.Charity) {
        throw new Error('Invalid response format: missing charity data');
      }

      return data;
    } catch (error) {
      console.error('Error during sign in:', error);
      throw error;
    }
  },

  signUp: async (charityData) => {
    try {
      // Transform the data to match the API's expected format
      const transformedData = {
        Username: charityData.username,
        CharityName: charityData.name,
        Email: charityData.email,
        Password: charityData.password,
        Address: charityData.address,
        PostalCode: charityData.postalCode
      };

      const response = await fetch(`${BASE_URL}/createCharity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transformedData),
      });
      
      const text = await response.text();
      console.log('Registration response:', text);

      if (!response.ok) {
        throw new Error('Registration failed: ' + text);
      }
      
      try {
        return text ? JSON.parse(text) : {};
      } catch (e) {
        console.error('Failed to parse registration response:', e);
        throw new Error('Invalid registration response format');
      }
    } catch (error) {
      console.error('Error during sign up:', error);
      throw error;
    }
  },

  // Charity Management
  getAllCharities: async () => {
    try {
      const response = await fetch(`${BASE_URL}/GetCharities`);
      if (!response.ok) {
        throw new Error('Failed to fetch charities');
      }
      const text = await response.text();
      return text ? JSON.parse(text) : [];
    } catch (error) {
      console.error('Error fetching charities:', error);
      throw error;
    }
  },

  getCharityById: async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/GetCharity/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch charity');
      }
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error('Error fetching charity:', error);
      throw error;
    }
  },

  updateCharity: async (charityId, updateData) => {
    try {
      // Ensure charityId is a number
      const id = parseInt(charityId);
      if (isNaN(id)) {
        throw new Error('Invalid Charity ID');
      }

      console.log('Making update request for charity:', id);
      
      const response = await fetch(`${BASE_URL}/UpdateCharity?CharityID=${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          CharityName: updateData.CharityName,
          Username: updateData.Username,
          Password: updateData.Password || '',
          Email: updateData.Email,
          Address: updateData.Address,
          PostalCode: parseInt(updateData.PostalCode) || 0
        })
      });

      const text = await response.text();
      console.log('Raw update response:', text);

      try {
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
          console.error('Update failed:', data);
          return {
            Success: false,
            ErrorMessage: data.ErrorMessage || `Failed to update charity: ${response.status}`,
            Charity: null
          };
        }
        
        return {
          Success: true,
          ErrorMessage: '',
          Charity: data // The API should return the updated charity data
        };
      } catch (e) {
        console.error('Failed to parse update response:', e);
        return {
          Success: false,
          ErrorMessage: 'Invalid response format from server',
          Charity: null
        };
      }
    } catch (error) {
      console.error('Error updating charity:', error);
      return {
        Success: false,
        ErrorMessage: error.message || 'Failed to update charity',
        Charity: null
      };
    }
  },

  deleteCharity: async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/DeleteCharity/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error('Failed to delete charity: ' + errorData);
      }
    } catch (error) {
      console.error('Error deleting charity:', error);
      throw error;
    }
  },
}; 