/**
 * Contract Test: POST /wallets/{walletId}/withdraw
 * 
 * This test validates the wallet withdrawal endpoint contract according to the API specification.
 * It tests withdrawal from wallets with settlement delays and M-Pesa integration.
 * 
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /wallets/{walletId}/withdraw Contract Tests', () => {
  let ctx: ContractTestEnvironment;
  let mainWalletId: string;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
    mainWalletId = ctx.integration.mainWallet.id;
  });

  async function createPinToken(pin = '1234') {
    return ctx.integration.helpers.issuePinToken(pin);
  }

  it('should process main wallet withdrawal', async () => {
    await ctx.integration.helpers.topUpMainWallet(100_000);
    const pinToken = await createPinToken();

    const response = await ctx.executeAsUser(ctx.routes.wallets.withdraw, {
      params: { walletId: mainWalletId },
      body: { amount: 50_000, pin_token: pinToken, mpesa_phone: '254712345678' },
    });

    expect(response.status).toBe(200);
    expect(response.body.transaction_id).toMatch(/^txn_[a-zA-Z0-9-]+$/);
    expect(typeof response.body.settlement_delay_minutes).toBe('number');
    expect(typeof response.body.estimated_completion).toBe('string');

    const wallet = await ctx.integration.helpers.refreshWallet('main');
    expect(wallet.availableBalance).toBe(50_000);
  });

  it('should reject withdrawal below minimum amount', async () => {
    const pinToken = await createPinToken();

    const response = await ctx.executeAsUser(ctx.routes.wallets.withdraw, {
      params: { walletId: mainWalletId },
      body: { amount: 50, pin_token: pinToken, mpesa_phone: '254712345678' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'AMOUNT_TOO_LOW' });
  });

  it('should reject withdrawals exceeding available balance', async () => {
    await ctx.integration.helpers.topUpMainWallet(10_000);
    const pinToken = await createPinToken();

    const response = await ctx.executeAsUser(ctx.routes.wallets.withdraw, {
      params: { walletId: mainWalletId },
      body: { amount: 20_000, pin_token: pinToken, mpesa_phone: '254712345678' },
    });

    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });

  it('should validate PIN token format', async () => {
    const response = await ctx.executeAsUser(ctx.routes.wallets.withdraw, {
      params: { walletId: mainWalletId },
      body: { amount: 10_000, pin_token: 'invalid_token', mpesa_phone: '254712345678' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_PIN_TOKEN_FORMAT' });
  });

  it('should require M-Pesa phone number', async () => {
    const pinToken = await createPinToken();

    const response = await ctx.executeAsUser(ctx.routes.wallets.withdraw, {
      params: { walletId: mainWalletId },
      body: { amount: 10_000, pin_token: pinToken },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'MISSING_MPESA_PHONE' });
  });

  it('should require authentication', async () => {
    const pinToken = await createPinToken();

    const response = await ctx.execute(ctx.routes.wallets.withdraw, {
      params: { walletId: mainWalletId },
      body: { amount: 10_000, pin_token: pinToken, mpesa_phone: '254712345678' },
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});