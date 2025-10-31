/**
 * Frontend utility for calculating round-up amounts
 * Mirrors the backend RoundUpService logic
 */

export interface RoundUpRule {
  increment_type: '10' | '50' | '100' | 'auto' | 'percentage';
  is_enabled: boolean;
  percentage_value?: number | null;
  auto_settings?: {
    min_increment?: number;
    max_increment?: number;
  } | null;
}

export interface RoundUpCalculation {
  originalAmount: number;
  roundUpAmount: number;
  totalAmount: number;
  incrementType: string;
}

/**
 * Calculate the round-up amount for a given transaction amount
 */
export function calculateRoundUp(
  amount: number,
  rule: RoundUpRule | null
): RoundUpCalculation {
  // Default result when no round-up should be applied
  const noRoundUp: RoundUpCalculation = {
    originalAmount: amount,
    roundUpAmount: 0,
    totalAmount: amount,
    incrementType: 'none',
  };

  // No rule or rule is disabled
  if (!rule || !rule.is_enabled) {
    return noRoundUp;
  }

  let roundUpAmount = 0;

  switch (rule.increment_type) {
    case '10':
      roundUpAmount = calculateFixedRoundUp(amount, 1000); // Round up to nearest KES 10 (1000 cents)
      break;

    case '50':
      roundUpAmount = calculateFixedRoundUp(amount, 5000); // Round up to nearest KES 50 (5000 cents)
      break;

    case '100':
      roundUpAmount = calculateFixedRoundUp(amount, 10000); // Round up to nearest KES 100 (10000 cents)
      break;

    case 'percentage':
      if (rule.percentage_value && rule.percentage_value > 0 && rule.percentage_value <= 100) {
        roundUpAmount = Math.round(amount * (rule.percentage_value / 100));
      }
      break;

    case 'auto':
      // For auto mode, use a smart calculation based on auto_settings
      roundUpAmount = calculateAutoRoundUp(amount, rule.auto_settings);
      break;

    default:
      return noRoundUp;
  }

  // Ensure round-up amount is non-negative
  roundUpAmount = Math.max(0, roundUpAmount);

  return {
    originalAmount: amount,
    roundUpAmount,
    totalAmount: amount + roundUpAmount,
    incrementType: rule.increment_type,
  };
}

/**
 * Calculate round-up to the nearest target increment
 * Example: amount=1250 (KES 12.50), target=1000 (KES 10)
 * Result: 750 cents (rounds up to KES 20.00)
 */
function calculateFixedRoundUp(amount: number, target: number): number {
  const remainder = amount % target;

  // If already at a round number, no round-up needed
  if (remainder === 0) {
    return 0;
  }

  // Calculate how much to add to reach the next round number
  return target - remainder;
}

/**
 * Calculate automatic round-up based on AI/smart settings
 */
function calculateAutoRoundUp(
  amount: number,
  autoSettings: RoundUpRule['auto_settings']
): number {
  if (!autoSettings) {
    // Fallback to 10 cent round-up
    return calculateFixedRoundUp(amount, 1000);
  }

  const { min_increment = 10, max_increment = 5000 } = autoSettings;

  // Simple heuristic: use percentage of transaction amount
  // For small transactions (<KES 100): use min increment
  // For large transactions (>KES 1000): use max increment
  // Scale linearly in between

  const KES_100 = 10000; // 100 KES in cents
  const KES_1000 = 100000; // 1000 KES in cents

  if (amount <= KES_100) {
    return min_increment;
  }

  if (amount >= KES_1000) {
    return Math.min(max_increment, calculateFixedRoundUp(amount, max_increment));
  }

  // Linear interpolation between min and max
  const ratio = (amount - KES_100) / (KES_1000 - KES_100);
  const targetIncrement = Math.round(min_increment + ratio * (max_increment - min_increment));

  return Math.min(targetIncrement, max_increment);
}

/**
 * Get a human-readable description of the round-up rule
 */
export function getRoundUpDescription(rule: RoundUpRule | null): string {
  if (!rule || !rule.is_enabled) {
    return 'Round-up disabled';
  }

  switch (rule.increment_type) {
    case '10':
      return 'Round up to nearest KES 10';
    case '50':
      return 'Round up to nearest KES 50';
    case '100':
      return 'Round up to nearest KES 100';
    case 'percentage':
      return `Save ${rule.percentage_value}% of each transaction`;
    case 'auto':
      return 'Smart auto round-up';
    default:
      return 'Unknown round-up rule';
  }
}

/**
 * Format amount in cents to KES string
 */
export function formatKES(amountInCents: number): string {
  const kes = (amountInCents / 100).toFixed(2);
  return `KES ${kes}`;
}
