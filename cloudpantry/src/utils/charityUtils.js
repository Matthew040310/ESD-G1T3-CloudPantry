 // src/utils/charityUtils.js
export const charityMap = {
    "Food Bank Sg": 1,
    "food from the heart": 2,
    "Willing hearts": 3,
    "Lions home for the elders": 4,
    "Free Food for all": 5
  };
  
  export function getCharityIdByName(name) {
    if (!name) return 1; // Default ID
    
    const normalizedName = name.toLowerCase().trim();
    for (const [charityName, id] of Object.entries(charityMap)) {
      if (charityName.toLowerCase() === normalizedName) {
        return id;
      }
    }
    
    return 1; // Default ID if no match found
  }
  
  export function getCharityNameById(id) {
    const charityNames = {
      1: "Food Bank Sg",
      2: "Food from the Heart",
      3: "Willing Hearts",
      4: "Lions Home for the Elders",
      5: "Free Food for All"
    };
    
    return charityNames[id] || "Unknown Charity";
  }