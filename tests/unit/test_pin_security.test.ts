import { describe, expect, it } from '@jest/globals';
import {
  MAX_PIN_ATTEMPTS,
  evaluatePinSecurity,
  generateSalt,
  getProgressiveDelayMs,
  hashPin,
  verifyPinHash,
} from '../../src/utils/pinSecurity';

describe('Unit: PIN security helpers (T094)', () => {
  it('validates secure PIN format', () => {
    const result = evaluatePinSecurity('4829');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects sequential and repeated patterns', () => {
    const sequential = evaluatePinSecurity('1234');
    expect(sequential.isValid).toBe(false);
    expect(sequential.errors).toEqual(expect.arrayContaining(['Avoid sequential numbers (e.g., 1234)']));

    const repeated = evaluatePinSecurity('9999');
    expect(repeated.isValid).toBe(false);
    expect(repeated.errors).toEqual(expect.arrayContaining(['Avoid repeating the same digit']));
  });

  it('hashes and verifies PIN values with random salt', async () => {
    const salt = await generateSalt();
    const { hash, salt: storedSalt, iterations } = await hashPin('5738', { salt });

    expect(hash).toHaveLength(64);
    expect(storedSalt).toBe(salt);
    expect(iterations).toBeGreaterThan(0);

    const isValid = await verifyPinHash('5738', { hash, salt: storedSalt, iterations });
    expect(isValid).toBe(true);

    const isInvalid = await verifyPinHash('5739', { hash, salt: storedSalt, iterations });
    expect(isInvalid).toBe(false);
  });

  it('caps progressive delays after maximum attempts', () => {
    const delays = Array.from({ length: MAX_PIN_ATTEMPTS + 3 }, (_, index) => getProgressiveDelayMs(index));
    const lastDelay = delays[MAX_PIN_ATTEMPTS];
    expect(lastDelay).toBe(delays.at(-1));
  });
});
