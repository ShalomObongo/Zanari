/**
 * Integration Scenario: PIN Security and Progressive Delays
 *
 * Implements Quickstart Scenario 8 to ensure PIN verification enforces
 * progressive lockouts, generates secure transaction tokens, and rejects
 * invalid tokens.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: PIN Security (T033)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should enforce progressive delays and secure transaction tokens', async () => {
    const { services, repositories, helpers, user } = env;
    const { authService } = services;

    await helpers.ensurePin('1234');

    const fastForward = async (failedAttempts: number, secondsAgo: number) => {
      const now = Date.now();
      await repositories.userRepository.update(user.id, {
        failedPinAttempts: failedAttempts,
        lastFailedAttemptAt: new Date(now - secondsAgo * 1000),
      });
      await helpers.refreshUser();
    };

    const failAttempt = async (pin: string) => {
      const result = await authService.verifyPin(user.id, pin);
      expect(result.verified).toBe(false);
      expect(result.token).toBeUndefined();
      return result;
    };

    // Progressive failures with simulated wait times between attempts.
    const firstFail = await failAttempt('0000');
    expect(firstFail.attemptsRemaining).toBe(4);
    expect(firstFail.lockedUntil).toBeDefined();
    await fastForward(1, 31);

    const secondFail = await failAttempt('1111');
    expect(secondFail.attemptsRemaining).toBe(3);
    expect(secondFail.lockedUntil).toBeDefined();
    await fastForward(2, 121);

    const thirdFail = await failAttempt('2222');
    expect(thirdFail.attemptsRemaining).toBe(2);
    expect(thirdFail.lockedUntil).toBeDefined();
    await fastForward(3, 301);

    const fourthFail = await failAttempt('3333');
    expect(fourthFail.attemptsRemaining).toBe(1);
    expect(fourthFail.lockedUntil).toBeDefined();
    await fastForward(4, 901);

    const fifthFail = await failAttempt('4444');
    expect(fifthFail.attemptsRemaining).toBe(0);
    expect(fifthFail.lockedUntil).toBeDefined();
    await fastForward(5, 901);

    // Correct PIN after lockout expires should succeed and reset counters.
    const success = await authService.verifyPin(user.id, '1234');
    expect(success.verified).toBe(true);
    expect(success.token).toMatch(/^txn_/);
    expect(success.attemptsRemaining).toBe(5);

    await helpers.refreshUser();
    const refreshedUser = await repositories.userRepository.findById(user.id);
    expect(refreshedUser?.failedPinAttempts).toBe(0);
    expect(refreshedUser?.lastFailedAttemptAt).toBeNull();

    // Token validation behaviors.
    const validToken = success.token!;
    const isValid = await authService.validatePinToken(user.id, validToken);
    expect(isValid).toBe(true);

    await authService.invalidatePinToken(validToken);
    const afterInvalidate = await authService.validatePinToken(user.id, validToken);
    expect(afterInvalidate).toBe(false);

    const bogusToken = await authService.validatePinToken(user.id, 'txn_invalid');
    expect(bogusToken).toBe(false);
  });
});
