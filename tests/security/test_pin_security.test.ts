import { describe, expect, it } from '@jest/globals';
import {
  MAX_PIN_ATTEMPTS,
  PinLockError,
  computeLockExpiration,
  getProgressiveDelayMs,
  isPinLocked,
} from '../../src/utils/pinSecurity';

describe('Security: PIN delay system (T099)', () => {
  it('applies progressive delays with fallback saturation', () => {
    const expected = [0, 30_000, 120_000, 300_000, 900_000];

    expected.forEach((delay, attempts) => {
      expect(getProgressiveDelayMs(attempts)).toBe(delay);
    });

    for (let attempts = expected.length; attempts <= expected.length + 3; attempts += 1) {
      expect(getProgressiveDelayMs(attempts)).toBe(expected.at(-1));
    }
  });

  it('computes lock expiration windows accurately', () => {
    const now = new Date('2025-01-01T08:00:00Z');
    const expiration = computeLockExpiration(3, now);

    expect(expiration).not.toBeNull();

    const expectedExpiration = new Date(now.getTime() + 300_000);
    expect(expiration?.toISOString()).toBe(expectedExpiration.toISOString());
    expect(isPinLocked(expiration, new Date(now.getTime() + 299_000))).toBe(true);
    expect(isPinLocked(expiration, new Date(now.getTime() + 300_000))).toBe(false);
  });

  it('guards against brute-force attempts with progressive lock durations', () => {
    const base = new Date('2025-01-01T08:00:00Z');
    let simulatedTime = base;

    for (let attempts = 1; attempts <= MAX_PIN_ATTEMPTS + 2; attempts += 1) {
      const delay = getProgressiveDelayMs(attempts);
      const lock = computeLockExpiration(attempts, simulatedTime);

      if (delay === 0) {
        expect(lock).toBeNull();
        continue;
      }

      expect(lock).not.toBeNull();

      if (lock) {
        expect(isPinLocked(lock, new Date(lock.getTime() - 1))).toBe(true);
        expect(isPinLocked(lock, new Date(lock.getTime()))).toBe(false);
      }

      simulatedTime = new Date(simulatedTime.getTime() + delay);
    }
  });

  it('exposes unlock details via PinLockError', () => {
    const now = new Date('2025-01-01T08:00:00Z');
    const lockUntil = computeLockExpiration(MAX_PIN_ATTEMPTS, now);

    expect(lockUntil).not.toBeNull();

    if (lockUntil) {
      const error = new PinLockError(lockUntil);
      expect(error.unlockAt.toISOString()).toBe(lockUntil.toISOString());
      expect(error.message).toContain(lockUntil.toISOString());
    }
  });
});
