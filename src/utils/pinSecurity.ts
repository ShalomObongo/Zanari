import * as Crypto from 'expo-crypto';

const PIN_LENGTH = 4;
const HASH_ITERATIONS = 10_000;
const SALT_BYTE_LENGTH = 16;
const PEPPER = 'zanari::pin::pepper';
const PROGRESSIVE_DELAYS_SECONDS = [0, 30, 120, 300, 900];
const FALLBACK_DELAY_SECONDS = 900;
export const MAX_PIN_ATTEMPTS = PROGRESSIVE_DELAYS_SECONDS.length - 1;

const COMMON_PIN_PATTERNS = new Set([
  '0000',
  '1111',
  '2222',
  '3333',
  '4444',
  '5555',
  '6666',
  '7777',
  '8888',
  '9999',
  '1234',
  '2345',
  '3456',
  '4567',
  '5678',
  '6789',
  '9876',
  '8765',
  '7654',
  '6543',
  '5432',
  '4321',
  '1010',
  '2020',
  '9090',
  '1212',
  '1122',
  '2112',
  '2580',
  '0852',
]);

export interface PinEvaluation {
  isValid: boolean;
  errors: string[];
}

export interface PinHashResult {
  hash: string;
  salt: string;
  iterations: number;
  algorithm: 'SHA-256';
}

export interface PinHashPayload {
  salt: string;
  hash: string;
  iterations?: number;
  algorithm?: 'SHA-256';
}

export interface HashPinOptions {
  salt?: string;
  iterations?: number;
  skipValidation?: boolean;
}

export class PinLockError extends Error {
  constructor(public readonly unlockAt: Date) {
    super(`PIN entry locked until ${unlockAt.toISOString()}`);
    this.name = 'PinLockError';
  }
}

export const evaluatePinSecurity = (pin: string): PinEvaluation => {
  const errors: string[] = [];

  if (!/^\d+$/.test(pin)) {
    errors.push('PIN must contain digits only');
  }

  if (pin.length !== PIN_LENGTH) {
    errors.push(`PIN must be exactly ${PIN_LENGTH} digits`);
  }

  if (errors.length === 0) {
    const digits = pin.split('').map(Number);

    const isAscendingSequence = digits.every((digit, index) => {
      if (index === 0) return true;
      return digit === digits[index - 1]! + 1;
    });

    const isDescendingSequence = digits.every((digit, index) => {
      if (index === 0) return true;
      return digit === digits[index - 1]! - 1;
    });

    if (isAscendingSequence || isDescendingSequence) {
      errors.push('Avoid sequential numbers (e.g., 1234)');
    }

    const allSameDigit = digits.every((digit) => digit === digits[0]);
    if (allSameDigit) {
      errors.push('Avoid repeating the same digit');
    }

    if (COMMON_PIN_PATTERNS.has(pin)) {
      errors.push('This PIN is too common. Choose a more secure one');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const deriveHash = async (pin: string, salt: string, iterations: number): Promise<string> => {
  let value = `${salt}:${pin}:${PEPPER}`;
  for (let i = 0; i < iterations; i += 1) {
    value = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
  }
  return value;
};

export const generateSalt = async (byteLength = SALT_BYTE_LENGTH): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return toHex(bytes);
};

export const hashPin = async (pin: string, options: HashPinOptions = {}): Promise<PinHashResult> => {
  if (!options.skipValidation) {
    const evaluation = evaluatePinSecurity(pin);
    if (!evaluation.isValid) {
      throw new Error(`Invalid PIN: ${evaluation.errors.join('; ')}`);
    }
  }

  const salt = options.salt ?? (await generateSalt());
  const iterations = options.iterations ?? HASH_ITERATIONS;
  const hash = await deriveHash(pin, salt, iterations);

  return {
    hash,
    salt,
    iterations,
    algorithm: 'SHA-256',
  };
};

export const verifyPinHash = async (pin: string, payload: PinHashPayload): Promise<boolean> => {
  const iterations = payload.iterations ?? HASH_ITERATIONS;
  const hash = await deriveHash(pin, payload.salt, iterations);
  return hash === payload.hash;
};

export const getProgressiveDelayMs = (failedAttempts: number): number => {
  if (failedAttempts <= 0) {
    return 0;
  }

  const index = Math.min(failedAttempts, PROGRESSIVE_DELAYS_SECONDS.length - 1);
  const seconds = PROGRESSIVE_DELAYS_SECONDS[index];

  if (typeof seconds !== 'number') {
    return FALLBACK_DELAY_SECONDS * 1000;
  }

  return seconds * 1000;
};

export const computeLockExpiration = (failedAttempts: number, failedAt: Date = new Date()): Date | null => {
  const delay = getProgressiveDelayMs(failedAttempts);
  if (delay <= 0) {
    return null;
  }

  return new Date(failedAt.getTime() + delay);
};

export const isPinLocked = (lockedUntil: Date | null | undefined, now: Date = new Date()): boolean => {
  if (!lockedUntil) {
    return false;
  }

  return lockedUntil.getTime() > now.getTime();
};

export default {
  evaluatePinSecurity,
  hashPin,
  verifyPinHash,
  getProgressiveDelayMs,
  computeLockExpiration,
  isPinLocked,
  generateSalt,
  MAX_PIN_ATTEMPTS,
};
