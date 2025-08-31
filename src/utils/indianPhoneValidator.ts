/**
 * Validates and formats Indian phone numbers
 */
export function validateIndianPhone(phone: string): { isValid: boolean; formatted: string; error?: string } {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if it's already in international format
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return {
      isValid: true,
      formatted: `+${cleaned}`
    };
  }
  
  // Check if it's a 10-digit Indian mobile number
  if (cleaned.length === 10) {
    // Indian mobile numbers start with 6, 7, 8, or 9
    if (['6', '7', '8', '9'].includes(cleaned[0])) {
      return {
        isValid: true,
        formatted: `+91${cleaned}`
      };
    } else {
      return {
        isValid: false,
        formatted: phone,
        error: 'Indian mobile numbers must start with 6, 7, 8, or 9'
      };
    }
  }
  
  return {
    isValid: false,
    formatted: phone,
    error: 'Please enter a valid 10-digit Indian mobile number'
  };
}

/**
 * Formats phone number for display
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    // Format as +91 XXXXX XXXXX
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  
  if (cleaned.length === 10) {
    // Format as XXXXX XXXXX
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  
  return phone;
}