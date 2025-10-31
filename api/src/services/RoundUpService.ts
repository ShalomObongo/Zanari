/**
 * Service for calculating round-up amounts based on user rules
 */

import { RoundUpRule } from '../models/RoundUpRule';

export interface RoundUpCalculation {
  originalAmount: number;
  roundUpAmount: number;
  totalAmount: number;
  roundUpRule: {
    incrementType: string;
    percentageValue?: number | null;
  };
}

/**
 * Calculate the round-up amount for a given transaction amount based on the user's round-up rule
 */
export function calculateRoundUp(amount: number, rule: RoundUpRule | null): RoundUpCalculation {
  // Default result when no round-up should be applied
  const noRoundUp: RoundUpCalculation = {
    originalAmount: amount,
    roundUpAmount: 0,
    totalAmount: amount,
    roundUpRule: {
      incrementType: 'none',
      percentageValue: null,
    },
  };

  // No rule or rule is disabled
  if (!rule || !rule.isEnabled) {
    return noRoundUp;
  }

  let roundUpAmount = 0;

  switch (rule.incrementType) {
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
      if (rule.percentageValue && rule.percentageValue > 0 && rule.percentageValue <= 100) {
        roundUpAmount = Math.round(amount * (rule.percentageValue / 100));
      }
      break;

    case 'auto':
      // For auto mode, use a smart calculation based on auto_settings
      roundUpAmount = calculateAutoRoundUp(amount, rule.autoSettings);
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
    roundUpRule: {
      incrementType: rule.incrementType,
      percentageValue: rule.percentageValue,
    },
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
 * This uses the user's configured min/max increments
 */
function calculateAutoRoundUp(
  amount: number,
  autoSettings: RoundUpRule['autoSettings']
): number {
  if (!autoSettings) {
    // Fallback to 10 cent round-up
    return calculateFixedRoundUp(amount, 1000);
  }

  const { minIncrement = 10, maxIncrement = 5000 } = autoSettings;

  // Simple heuristic: use percentage of transaction amount
  // For small transactions (<KES 100): use min increment
  // For large transactions (>KES 1000): use max increment
  // Scale linearly in between

  const KES_100 = 10000; // 100 KES in cents
  const KES_1000 = 100000; // 1000 KES in cents

  if (amount <= KES_100) {
    return minIncrement;
  }

  if (amount >= KES_1000) {
    return Math.min(maxIncrement, calculateFixedRoundUp(amount, maxIncrement));
  }

  // Linear interpolation between min and max
  const ratio = (amount - KES_100) / (KES_1000 - KES_100);
  const targetIncrement = Math.round(minIncrement + ratio * (maxIncrement - minIncrement));

  return Math.min(targetIncrement, maxIncrement);
}

/**
 * Validate if a round-up can be applied given the available balance
 */
export function canApplyRoundUp(
  amount: number,
  roundUpAmount: number,
  availableBalance: number
): boolean {
  return availableBalance >= (amount + roundUpAmount);
}

/**
 * Get a human-readable description of the round-up rule
 */
export function getRoundUpDescription(rule: RoundUpRule | null): string {
  if (!rule || !rule.isEnabled) {
    return 'Round-up disabled';
  }

  switch (rule.incrementType) {
    case '10':
      return 'Round up to nearest KES 10';
    case '50':
      return 'Round up to nearest KES 50';
    case '100':
      return 'Round up to nearest KES 100';
    case 'percentage':
      return `Save ${rule.percentageValue}% of each transaction`;
    case 'auto':
      return 'Smart auto round-up based on spending';
    default:
      return 'Unknown round-up rule';
  }
}
