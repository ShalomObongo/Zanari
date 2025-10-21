/**
 * Utility functions for formatting data across the application
 * Handles currency formatting, date formatting, and transaction type mapping
 */

/**
 * Format amount in cents to currency string (KES)
 * @param amountInCents - Amount in cents (e.g., 125000 = KES 1,250.00)
 * @returns Formatted currency string (e.g., "KES 1,250.00")
 */
export const formatCurrency = (amountInCents: number): string => {
  const amount = amountInCents / 100; // Convert to major units
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format amount in cents to a short currency string without symbol
 * @param amountInCents - Amount in cents
 * @returns Formatted amount string (e.g., "1,250.00")
 */
export const formatAmount = (amountInCents: number): string => {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format ISO date string to relative time
 * @param isoDate - ISO 8601 date string (e.g., "2024-01-15T14:30:00.000Z")
 * @returns Relative date string (e.g., "Today", "Yesterday", "3 days ago")
 */
export const formatRelativeDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  const now = new Date();
  
  // Set to start of day for accurate day comparison
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffMs = nowDay.getTime() - dateDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
};

/**
 * Format ISO date string to absolute date
 * @param isoDate - ISO 8601 date string
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export const formatAbsoluteDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

/**
 * Format ISO date string with time
 * @param isoDate - ISO 8601 date string
 * @returns Formatted date and time string (e.g., "Jan 15, 2024 at 2:30 PM")
 */
export const formatDateTime = (isoDate: string): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * Map backend transaction type to UI display type
 * @param backendType - Backend transaction type
 * @returns UI transaction type ('credit' or 'debit')
 */
export const mapTransactionType = (backendType: string): 'credit' | 'debit' => {
  const creditTypes = ['deposit', 'transfer_in'];
  const debitTypes = ['payment', 'transfer_out', 'withdrawal', 'bill_payment'];

  if (creditTypes.includes(backendType)) return 'credit';
  if (debitTypes.includes(backendType)) return 'debit';
  
  // Default to debit for unknown types
  return 'debit';
};

/**
 * Get time-based greeting message
 * @param firstName - User's first name (optional)
 * @returns Greeting string (e.g., "Good morning, John" or "Good afternoon")
 */
export const getTimeBasedGreeting = (firstName?: string): string => {
  const hour = new Date().getHours();
  
  let greeting: string;
  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
  } else if (hour >= 17 && hour < 22) {
    greeting = 'Good evening';
  } else {
    greeting = 'Good night';
  }
  
  return firstName ? `${greeting}, ${firstName}` : greeting;
};

/**
 * Parse cents amount from user input
 * @param userInput - User input string or number (e.g., "1250.50")
 * @returns Amount in cents (e.g., 125050)
 */
export const parseCentsFromInput = (userInput: string | number): number => {
  const amount = typeof userInput === 'string' ? parseFloat(userInput) : userInput;
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
};

/**
 * Format progress percentage
 * @param current - Current amount in cents
 * @param target - Target amount in cents
 * @returns Progress percentage (0-100)
 */
export const calculateProgress = (current: number, target: number): number => {
  if (target === 0) return 0;
  const progress = (current / target) * 100;
  return Math.min(Math.max(progress, 0), 100); // Clamp between 0 and 100
};

/**
 * Get transaction category icon name
 * @param category - Transaction category
 * @returns Icon name for the category
 */
export const getTransactionCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    airtime: 'phone',
    groceries: 'shopping-basket',
    school_fees: 'school',
    utilities: 'flash',
    transport: 'car',
    entertainment: 'film',
    savings: 'piggy-bank',
    transfer: 'swap-horizontal',
    other: 'help-circle',
  };
  
  return iconMap[category] || 'help-circle';
};

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
};

/**
 * Format large numbers with abbreviations (K, M, B)
 * @param num - Number to format
 * @returns Formatted string (e.g., "1.5K", "2.3M")
 */
export const formatLargeNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
};
