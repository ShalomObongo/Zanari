/**
 * Contract Test: GET /wallets
 * 
 * This test validates the wallet balances endpoint contract according to the API specification.
 * It tests retrieval of user wallet balances including main and savings wallets.
 * 
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('GET /wallets Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  it('should list wallets for the authenticated user', async () => {
    const response = await ctx.executeAsUser(ctx.routes.wallets.listWallets, {});

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.wallets)).toBe(true);
    expect(response.body.wallets).toHaveLength(2);

    const wallet = response.body.wallets[0];
    expect(wallet).toHaveProperty('id');
    expect(wallet).toHaveProperty('wallet_type');
    expect(wallet).toHaveProperty('balance');
    expect(wallet).toHaveProperty('available_balance');
  });

  it('should reflect updated balances after credits', async () => {
    await ctx.integration.helpers.topUpMainWallet(50_000);

    const response = await ctx.executeAsUser(ctx.routes.wallets.listWallets, {});
    const mainWallet = response.body.wallets.find((wallet: any) => wallet.wallet_type === 'main');

    expect(mainWallet).toBeDefined();
    expect(mainWallet.balance).toBe(50_000);
    expect(mainWallet.available_balance).toBe(50_000);
  });

  it('should require authentication', async () => {
    const response = await ctx.execute(ctx.routes.wallets.listWallets, {});

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});