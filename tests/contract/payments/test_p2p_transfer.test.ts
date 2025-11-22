/**
 * Contract Test: POST /payments/transfer
 *
 * This test validates the P2P transfer endpoint contract according to the API specification.
 * It exercises Paystack transfer integration, round-up handling, recipient validation, and
 * business rules by executing the real route handlers through the integration environment.
 *
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { createTransaction } from '../../../api/src/models/Transaction';
import { createUser } from '../../../api/src/models/User';
import { createWallet } from '../../../api/src/models/Wallet';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /payments/transfer Contract Tests', () => {
  let ctx: ContractTestEnvironment;
  let recipientId: string;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
    await ctx.integration.helpers.setRoundUpIncrement('100');

    // Create a recipient user for testing
    recipientId = randomUUID();
    const recipientUser = createUser({
      id: recipientId,
      email: 'recipient@zanari.app',
      phone: '254711223344',
      firstName: 'John',
      lastName: 'Doe',
    });
    await ctx.integration.repositories.userRepository.create(recipientUser);
    
    // Create wallet for recipient
    const recipientWallet = createWallet({
      id: randomUUID(),
      userId: recipientId,
      walletType: 'main',
      balance: 0,
      availableBalance: 0,
    });
    await ctx.integration.repositories.walletRepository.insert(recipientWallet);
  });

  async function issuePinToken(pin = '1234') {
    return ctx.integration.helpers.issuePinToken(pin);
  }

  async function transferPeer(
    body: Record<string, unknown>,
    { authenticated = true }: { authenticated?: boolean } = {},
  ) {
    const request = { body };
    return authenticated
      ? ctx.executeAsUser(ctx.routes.payments.transferPeer, request)
      : ctx.execute(ctx.routes.payments.transferPeer, request);
  }

  function expectErrorResponse(
    response: { status: number; body: Record<string, any> },
    status: number,
    code: string,
  ) {
    expect(Number(response.status)).toBe(status);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('code', code);
  }

  describe('Successful transfers', () => {
    it('should process internal transfer to another user with round-up', async () => {
      const startingBalance = 150_000;
      await ctx.integration.helpers.topUpMainWallet(startingBalance);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 50_050,
        pin_token: pinToken,
        recipient_user_id: recipientId,
        description: 'Money for textbooks',
      });

      expect(response.status).toBe(200);
      expect(response.body.transfer_transaction_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.body.round_up_transaction_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.body.round_up_amount).toBeGreaterThan(0);
      expect(response.body.total_charged).toBe(50_050 + response.body.round_up_amount);
      expect(response.body.payment_method).toBe('wallet');
      expect(response.body.transfer_type).toBe('internal');
      expect(response.body.fee).toBe(0);

      const mainWallet = await ctx.integration.helpers.refreshWallet('main');
      expect(mainWallet.availableBalance).toBe(startingBalance - response.body.total_charged);

      const savingsWallet = await ctx.integration.helpers.refreshWallet('savings');
      expect(savingsWallet.balance).toBe(response.body.round_up_amount);
      expect(savingsWallet.availableBalance).toBe(response.body.round_up_amount);
      
      // Verify recipient received funds
      const recipientWallet = await ctx.integration.repositories.walletRepository.findByUserAndType(recipientId, 'main');
      expect(recipientWallet?.availableBalance).toBe(50_050);
    });

    it('should handle transfer with no round-up when amount is already rounded', async () => {
      await ctx.integration.helpers.topUpMainWallet(120_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 100_000,
        pin_token: pinToken,
        recipient_user_id: recipientId,
        description: 'School fees payment',
      });

      expect(response.status).toBe(200);
      expect(response.body.round_up_amount).toBe(0);
      expect(response.body.round_up_transaction_id).toBeNull();
      expect(response.body.total_charged).toBe(100_000);
    });
  });

  describe('Amount validation', () => {
    it('should reject transfer below minimum amount', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 50,
        pin_token: pinToken,
        recipient_user_id: recipientId,
      });

      expectErrorResponse(response, 400, 'AMOUNT_TOO_LOW');
    });

    it('should reject transfer above maximum amount', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 600_000,
        pin_token: pinToken,
        recipient_user_id: recipientId,
      });

      expectErrorResponse(response, 400, 'AMOUNT_TOO_HIGH');
    });

    it('should enforce integer amount format', async () => {
      const pinToken = await issuePinToken();
      const invalidAmounts: number[] = [0, -1_000];
      for (const amount of invalidAmounts) {
        const response = await transferPeer({
          amount,
          pin_token: pinToken,
          recipient_user_id: recipientId,
        });
        expectErrorResponse(response, 400, 'INVALID_AMOUNT_FORMAT');
      }

      const decimalResponse = await transferPeer({
        amount: 123.45,
        pin_token: pinToken,
        recipient_user_id: recipientId,
      });
      expectErrorResponse(decimalResponse, 400, 'INVALID_AMOUNT_FORMAT');
    });

    it('should enforce daily transfer limit', async () => {
      const existing = createTransaction({
        id: randomUUID(),
        userId: ctx.userId,
        type: 'transfer_out',
        amount: 1_900_000,
        category: 'transfer',
      });
      await ctx.integration.repositories.transactionRepository.create(existing);

      await ctx.integration.helpers.topUpMainWallet(400_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 200_000,
        pin_token: pinToken,
        recipient_user_id: recipientId,
      });

      expectErrorResponse(response, 400, 'DAILY_LIMIT_EXCEEDED');
      expect(response.body.daily_limit).toBe(2_000_000);
      expect(response.body.used_today).toBe(1_900_000);
      expect(response.body.available_today).toBe(100_000);
    });
  });

  describe('Recipient validation', () => {
    it('should require recipient user ID', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 50_000,
        pin_token: pinToken,
      });

      expectErrorResponse(response, 400, 'MISSING_RECIPIENT_USER_ID');
    });

    it('should reject non-existent recipient', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 50_000,
        pin_token: pinToken,
        recipient_user_id: randomUUID(),
      });

      expectErrorResponse(response, 400, 'RECIPIENT_NOT_FOUND');
    });

    it('should prevent self-transfer by user ID', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 40_000,
        pin_token: pinToken,
        recipient_user_id: ctx.userId,
      });

      expectErrorResponse(response, 400, 'SELF_TRANSFER_NOT_ALLOWED');
    });
  });

  describe('PIN token validation', () => {
    it('should require PIN token', async () => {
      const response = await transferPeer({
        amount: 50_000,
        recipient_user_id: recipientId,
      });

      expectErrorResponse(response, 400, 'MISSING_PIN_TOKEN');
      expect(response.body.error).toBe('PIN token is required for transfer authorization');
    });

    it('should validate PIN token format', async () => {
      const response = await transferPeer({
        amount: 50_000,
        pin_token: 'bad_token',
        recipient_user_id: recipientId,
      });

      expectErrorResponse(response, 400, 'INVALID_PIN_TOKEN_FORMAT');
    });

    it('should reject expired PIN token', async () => {
      await ctx.integration.helpers.topUpMainWallet(60_000);
      const response = await transferPeer({
        amount: 50_000,
        pin_token: 'txn_expiredtoken',
        recipient_user_id: recipientId,
      });

      expectErrorResponse(response, 401, 'PIN_TOKEN_EXPIRED');
    });
  });

  describe('Balance handling', () => {
    it('should reject transfers exceeding available balance', async () => {
      await ctx.integration.helpers.topUpMainWallet(10_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 20_000,
        pin_token: pinToken,
        recipient_user_id: recipientId,
      });

      expectErrorResponse(response, 402, 'INSUFFICIENT_FUNDS');
      expect(response.body.available_balance).toBe(10_000);
      // round_up_skipped is not returned in transferPeer error
    });

    it('should skip round-up when funds cover only the transfer amount', async () => {
      await ctx.integration.helpers.topUpMainWallet(49_950);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 49_950,
        pin_token: pinToken,
        recipient_user_id: recipientId,
      });

      expect(response.status).toBe(200);
      expect(response.body.round_up_amount).toBe(0);
      expect(response.body.round_up_transaction_id).toBeNull();
      // round_up_skipped is not returned in transferPeer success response
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 20_000,
        pin_token: pinToken,
        recipient_user_id: recipientId,
      }, { authenticated: false });

      expectErrorResponse(response, 401, 'AUTH_REQUIRED');
    });
  });

  describe('Response schema validation', () => {
    it('should return response matching contract expectations', async () => {
      await ctx.integration.helpers.topUpMainWallet(120_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 50_050,
        pin_token: pinToken,
        recipient_user_id: recipientId,
        description: 'Schema validation transfer',
      });

      expect(response.status).toBe(200);
      const body = response.body;
      expect(typeof body.transfer_transaction_id).toBe('string');
      expect(typeof body.round_up_transaction_id === 'string' || body.round_up_transaction_id === null).toBeTruthy();
      expect(typeof body.total_charged).toBe('number');
      expect(typeof body.round_up_amount).toBe('number');
      expect(body.payment_method).toBe('wallet');
      expect(body.transfer_type).toBe('internal');
      expect(body.total_charged).toBe(body.round_up_amount + 50_050);
      expect(Number.isInteger(body.total_charged)).toBe(true);
      expect(Number.isInteger(body.round_up_amount)).toBe(true);
    });
  });
});
