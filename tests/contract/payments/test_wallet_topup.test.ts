/**
 * Contract Test: POST /payments/topup
 */

import { beforeEach, describe, expect, it } from '@jest/globals';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /payments/topup Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  async function issuePinToken(pin = '1234') {
    return ctx.integration.helpers.issuePinToken(pin);
  }

  async function topUp(
    body: Record<string, unknown>,
    { authenticated = true }: { authenticated?: boolean } = {},
  ) {
    const request = { body };
    return authenticated
      ? ctx.executeAsUser(ctx.routes.payments.topUpWallet, request)
      : ctx.execute(ctx.routes.payments.topUpWallet, request);
  }

  function expectError(
    response: { status: number; body: Record<string, unknown> },
    status: number,
    code: string,
  ) {
    expect(Number(response.status)).toBe(status);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('code', code);
  }

  it('should require a PIN token', async () => {
    const response = await topUp({
      amount: 25_000,
      payment_method: 'mpesa',
      description: 'Wallet top-up',
    });

    expectError(response, 400, 'MISSING_PIN_TOKEN');
  });

  it('should reject invalid or expired PIN tokens', async () => {
    const response = await topUp({
      amount: 25_000,
      payment_method: 'mpesa',
      description: 'Wallet top-up',
      pin_token: 'txn_invalidtoken',
    });

    expectError(response, 401, 'PIN_TOKEN_EXPIRED');
  });

  it('should initialize a top-up when provided a valid PIN token', async () => {
    const token = await issuePinToken();

    const response = await topUp({
      amount: 50_000,
      payment_method: 'mpesa',
      description: 'KES 500 wallet top-up',
      pin_token: token,
    });

    expect(response.status).toBe(200);
    expect(response.body.paystack_reference).toMatch(/^[-_A-Za-z0-9]+$/);
    expect(response.body.paystack_access_code).toBe(`AC_${response.body.paystack_reference}`);
    expect(response.body.paystack_authorization_url).toBe(`https://checkout.paystack.com/${response.body.paystack_reference}`);
    expect(response.body.amount).toBe(50_000);
    expect(response.body).toHaveProperty('deposit_transaction_id');
    expect(typeof response.body.deposit_transaction_id).toBe('string');
  });
});
