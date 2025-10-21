/**
 * Contract Test: POST /auth/verify-pin
 * 
 * This test validates the PIN verification endpoint contract according to the API specification.
 * It tests PIN verification for transaction authorization with progressive delays on failure.
 * 
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /auth/verify-pin Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
    await ctx.integration.helpers.ensurePin('1234');
  });

  it('should verify correct PIN and return transaction token', async () => {
    const response = await ctx.executeAsUser(ctx.routes.auth.verifyPin, {
      body: { pin: '1234' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ verified: true });
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token).toMatch(/^txn_[a-zA-Z0-9]+$/);
  });

  it('should reject incorrect PIN and include attempts remaining', async () => {
    const response = await ctx.executeAsUser(ctx.routes.auth.verifyPin, {
      body: { pin: '9999' },
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'Invalid PIN',
      code: 'INVALID_PIN',
    });
    expect(response.body).toHaveProperty('attempts_remaining');
    expect(response.body.attempts_remaining).toBeLessThan(5);
  });

  it('should progressively lock the account after repeated failures', async () => {
    let lastResponse = null;
    for (let i = 0; i < 5; i += 1) {
      lastResponse = await ctx.executeAsUser(ctx.routes.auth.verifyPin, {
        body: { pin: '0000' },
      });
    }

    expect(lastResponse!.status).toBe(401);
    expect(lastResponse!.body.code).toBe('PIN_LOCKED');
    expect(typeof lastResponse!.body.locked_until).toBe('string');
  });

  it('should validate PIN format', async () => {
    const response = await ctx.executeAsUser(ctx.routes.auth.verifyPin, {
      body: { pin: '12a4' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_PIN_FORMAT',
    });
  });

  it('should require authentication', async () => {
    const response = await ctx.execute(ctx.routes.auth.verifyPin, {
      body: { pin: '1234' },
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});