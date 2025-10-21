/**
 * Contract Test: POST /auth/setup-pin
 * 
 * This test validates the PIN setup endpoint contract according to the API specification.
 * It tests 4-digit PIN setup with confirmation for new users.
 * 
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /auth/setup-pin Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  it('should accept matching 4-digit PINs and complete setup', async () => {
    const response = await ctx.executeAsUser(ctx.routes.auth.setupPin, {
      body: { pin: '1234', confirm_pin: '1234' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'PIN setup completed successfully' });

    const user = await ctx.integration.helpers.refreshUser();
    expect(user.pinHash).toBeDefined();
    expect(user.pinSetAt).not.toBeNull();
  });

  it('should reject mismatched PIN values', async () => {
    const response = await ctx.executeAsUser(ctx.routes.auth.setupPin, {
      body: { pin: '1234', confirm_pin: '5678' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'PIN_MISMATCH',
    });
  });

  it('should reject non-numeric or invalid length PINs', async () => {
    const response = await ctx.executeAsUser(ctx.routes.auth.setupPin, {
      body: { pin: '12a4', confirm_pin: '12a4' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_PIN_FORMAT',
    });
  });

  it('should require authentication', async () => {
    const response = await ctx.execute(ctx.routes.auth.setupPin, {
      body: { pin: '1234', confirm_pin: '1234' },
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('should require confirm_pin field', async () => {
    const response = await ctx.executeAsUser(ctx.routes.auth.setupPin, {
      body: { pin: '1234' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_PIN_FORMAT',
    });
  });
});