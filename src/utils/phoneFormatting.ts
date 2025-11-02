/**
 * Phone number formatting utilities for Kenyan mobile numbers
 */

/**
 * Formats a phone number to the canonical format (254XXXXXXXXX)
 * @param text - Raw phone number input
 * @returns Formatted phone number starting with 254
 */
export const formatPhoneNumber = (text: string): string => {
  const cleaned = text.replace(/\D/g, '');

  if (cleaned.startsWith('254')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    return `254${cleaned.substring(1)}`;
  }
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    return `254${cleaned}`;
  }
  return cleaned;
};

/**
 * Formats a phone number for display with spaces (0712 345 678)
 * @param text - Raw phone number input
 * @returns Formatted display string with spaces
 */
export const formatPhoneForDisplay = (text: string): string => {
  const cleaned = text.replace(/\D/g, '');

  // Format as: 0712 345 678
  if (cleaned.startsWith('254')) {
    const local = '0' + cleaned.substring(3);
    if (local.length <= 4) return local;
    if (local.length <= 7) return `${local.slice(0, 4)} ${local.slice(4)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7, 10)}`;
  } else if (cleaned.startsWith('0')) {
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)}`;
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    const withZero = '0' + cleaned;
    if (withZero.length <= 4) return withZero;
    if (withZero.length <= 7) return `${withZero.slice(0, 4)} ${withZero.slice(4)}`;
    return `${withZero.slice(0, 4)} ${withZero.slice(4, 7)} ${withZero.slice(7, 10)}`;
  }

  // For any other format, just remove non-digits and return cleaned version
  return cleaned || text;
};

/**
 * Validates if a phone number is a valid Kenyan mobile number
 * @param number - Phone number in 254XXXXXXXXX format
 * @returns true if valid Kenyan number
 */
export const isValidKenyanNumber = (number: string): boolean => {
  const kenyanRegex = /^254(7[0-9]{8}|1[0-9]{8})$/;
  return kenyanRegex.test(number);
};
