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
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /payments/transfer Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
    await ctx.integration.helpers.setRoundUpIncrement('100');
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
    it('should process transfer to phone number with round-up', async () => {
      const startingBalance = 150_000;
      await ctx.integration.helpers.topUpMainWallet(startingBalance);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 50_050,
        pin_token: pinToken,
        recipient: { phone: '254712345679' },
        description: 'Money for textbooks',
      });

      expect(response.status).toBe(200);
  expect(response.body.transfer_transaction_id).toMatch(/^transfer_[a-zA-Z0-9]+$/);
      expect(response.body.round_up_transaction_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.body.round_up_amount).toBeGreaterThan(0);
      expect(response.body.total_charged).toBe(50_050 + response.body.round_up_amount);
  expect(response.body.paystack_transfer_reference).toMatch(/^TRF_[a-zA-Z0-9_-]+$/);
  expect(response.body.paystack_recipient_code).toMatch(/^RCP_[a-zA-Z0-9_-]+$/);
      expect(
    response.body.estimated_completion === null || typeof response.body.estimated_completion === 'string',
      ).toBe(true);
      expect(response.body.round_up_skipped).toBe(false);
      expect(response.body.round_up_skip_reason).toBeNull();
      expect(response.body.recipient_created).toBe(false);

      const mainWallet = await ctx.integration.helpers.refreshWallet('main');
      expect(mainWallet.availableBalance).toBe(startingBalance - response.body.total_charged);

      const savingsWallet = await ctx.integration.helpers.refreshWallet('savings');
      expect(savingsWallet.balance).toBe(response.body.round_up_amount);
      expect(savingsWallet.availableBalance).toBe(response.body.round_up_amount);

      expect(ctx.integration.stubs.paystackClient.transfers).toHaveLength(1);
      expect(ctx.integration.stubs.paystackClient.transfers[0]).toMatchObject({
        amount: 50_050,
        reference: response.body.transfer_transaction_id,
      });
    });

    it('should handle transfer with no round-up when amount is already rounded', async () => {
      await ctx.integration.helpers.topUpMainWallet(120_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 100_000,
        pin_token: pinToken,
        recipient: { phone: '254722345678' },
        description: 'School fees payment',
      });

      expect(response.status).toBe(200);
      expect(response.body.round_up_amount).toBe(0);
      expect(response.body.round_up_transaction_id).toBeNull();
      expect(response.body.round_up_skipped).toBe(false);
      expect(response.body.round_up_skip_reason).toBeNull();
      expect(response.body.total_charged).toBe(100_000);
    });

    it('should process transfer to email address', async () => {
      await ctx.integration.helpers.topUpMainWallet(120_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 75_050,
        pin_token: pinToken,
        recipient: { email: 'friend@example.com' },
        description: 'Birthday gift',
      });

      expect(response.status).toBe(200);
  expect(response.body.transfer_transaction_id).toMatch(/^transfer_[a-zA-Z0-9]+$/);
  expect(response.body.paystack_recipient_code).toMatch(/^RCP_[a-zA-Z0-9_-]+$/);
      expect(response.body.total_charged).toBe(75_050 + response.body.round_up_amount);
      expect(response.body.recipient_created).toBe(false);
    });

    it('should flag new recipient when phone number is unseen', async () => {
      await ctx.integration.helpers.topUpMainWallet(120_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 60_050,
        pin_token: pinToken,
        recipient: { phone: '254799999999' },
        description: 'First transfer to this number',
      });

      expect(response.status).toBe(200);
  expect(response.body.recipient_created).toBe(true);
  expect(response.body.paystack_recipient_code).toMatch(/^RCP_[a-zA-Z0-9_-]+$/);
    });
  });

  describe('Amount validation', () => {
    it('should reject transfer below minimum amount', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 50,
        pin_token: pinToken,
        recipient: { phone: '254712345678' },
      });

      expectErrorResponse(response, 400, 'AMOUNT_TOO_LOW');
    });

    it('should reject transfer above maximum amount', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 600_000,
        pin_token: pinToken,
        recipient: { phone: '254712345678' },
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
          recipient: { phone: '254712345678' },
        });
        expectErrorResponse(response, 400, 'INVALID_AMOUNT_FORMAT');
      }

      const decimalResponse = await transferPeer({
        amount: 123.45,
        pin_token: pinToken,
        recipient: { phone: '254712345678' },
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
        recipient: { phone: '254733444555' },
      });

      expectErrorResponse(response, 400, 'DAILY_LIMIT_EXCEEDED');
      expect(response.body.daily_limit).toBe(2_000_000);
      expect(response.body.used_today).toBe(1_900_000);
      expect(response.body.available_today).toBe(100_000);
    });
  });

  describe('Recipient validation', () => {
    it('should require recipient information', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 50_000,
        pin_token: pinToken,
      });

      expectErrorResponse(response, 400, 'MISSING_RECIPIENT');
    });

    it('should reject recipient with both phone and email', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 50_000,
        pin_token: pinToken,
        recipient: { phone: '254712345678', email: 'friend@example.com' },
      });

      expectErrorResponse(response, 400, 'CONFLICTING_RECIPIENT_INFO');
    });

    it('should validate Kenyan phone number format', async () => {
      const pinToken = await issuePinToken();
      const invalidPhones = ['712345678', '0712345678', '255712345678', '25471234567'];
      for (const phone of invalidPhones) {
        const response = await transferPeer({
          amount: 50_000,
          pin_token: pinToken,
          recipient: { phone },
        });
        expectErrorResponse(response, 400, 'INVALID_PHONE');
      }
    });

    it('should validate email format', async () => {
      const pinToken = await issuePinToken();
      const invalidEmails = ['notanemail', 'invalid@', '@example.com'];
      for (const email of invalidEmails) {
        const response = await transferPeer({
          amount: 50_000,
          pin_token: pinToken,
          recipient: { email },
        });
        expectErrorResponse(response, 400, 'INVALID_EMAIL');
      }
    });

    it('should prevent self-transfer by phone', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 40_000,
        pin_token: pinToken,
        recipient: { phone: ctx.integration.user.phone },
      });

      expectErrorResponse(response, 400, 'SELF_TRANSFER_NOT_ALLOWED');
    });
  });

  describe('PIN token validation', () => {
    it('should require PIN token', async () => {
      const response = await transferPeer({
        amount: 50_000,
        recipient: { phone: '254712345679' },
      });

      expectErrorResponse(response, 400, 'MISSING_PIN_TOKEN');
      expect(response.body.error).toBe('PIN token is required for transfer authorization');
    });

    it('should validate PIN token format', async () => {
      const response = await transferPeer({
        amount: 50_000,
        pin_token: 'bad_token',
        recipient: { phone: '254712345679' },
      });

      expectErrorResponse(response, 400, 'INVALID_PIN_TOKEN_FORMAT');
    });

    it('should reject expired PIN token', async () => {
      await ctx.integration.helpers.topUpMainWallet(60_000);
      const response = await transferPeer({
        amount: 50_000,
        pin_token: 'txn_expiredtoken',
        recipient: { phone: '254712345679' },
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
        recipient: { phone: '254712345679' },
      });

      expectErrorResponse(response, 402, 'INSUFFICIENT_FUNDS');
      expect(response.body.available_balance).toBe(10_000);
      expect(response.body.round_up_skipped).toBe(false);
    });

    it('should skip round-up when funds cover only the transfer amount', async () => {
      await ctx.integration.helpers.topUpMainWallet(49_950);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 49_950,
        pin_token: pinToken,
        recipient: { phone: '254712345679' },
      });

      expect(response.status).toBe(200);
      expect(response.body.round_up_amount).toBe(0);
      expect(response.body.round_up_transaction_id).toBeNull();
      expect(response.body.round_up_skipped).toBe(true);
      expect(response.body.round_up_skip_reason).toBe('Insufficient funds for round-up');
    });
  });

  describe('Paystack integration', () => {
    it('should handle Paystack transfer service failure', async () => {
      await ctx.integration.helpers.topUpMainWallet(80_000);
      const pinToken = await issuePinToken();

      jest
        .spyOn(ctx.integration.stubs.paystackClient, 'initiateTransfer')
        .mockResolvedValueOnce({
          status: 'failed',
          transferCode: 'TRF_failure_123',
          reference: 'transfer_failure_ref',
          raw: {},
        });

      const response = await transferPeer({
        amount: 50_000,
        pin_token: pinToken,
        recipient: { phone: '254712345679' },
      });

      expectErrorResponse(response, 503, 'PAYSTACK_TRANSFER_UNAVAILABLE');
      expect(response.body.retry_after).toBeGreaterThan(0);

      const wallet = await ctx.integration.helpers.refreshWallet('main');
      expect(wallet.availableBalance).toBe(80_000);
    });

    it('should include Paystack metadata on success', async () => {
      await ctx.integration.helpers.topUpMainWallet(80_000);
      const pinToken = await issuePinToken();

      const response = await transferPeer({
        amount: 30_050,
        pin_token: pinToken,
        recipient: { phone: '254701234567' },
      });

  expect(response.status).toBe(200);
  expect(response.body.paystack_transfer_reference).toMatch(/^TRF_/);
  expect(response.body.paystack_recipient_code).toMatch(/^RCP_/);
  expect(
	response.body.estimated_completion === null || typeof response.body.estimated_completion === 'string',
  ).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const pinToken = await issuePinToken();
      const response = await transferPeer({
        amount: 20_000,
        pin_token: pinToken,
        recipient: { phone: '254733444555' },
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
        recipient: { phone: '254711000111' },
        description: 'Schema validation transfer',
      });

      expect(response.status).toBe(200);
      const body = response.body;
      expect(typeof body.transfer_transaction_id).toBe('string');
      expect(typeof body.round_up_transaction_id === 'string' || body.round_up_transaction_id === null).toBeTruthy();
      expect(typeof body.total_charged).toBe('number');
      expect(typeof body.round_up_amount).toBe('number');
    expect(typeof body.paystack_transfer_reference === 'string' || body.paystack_transfer_reference === null).toBeTruthy();
    expect(typeof body.paystack_recipient_code === 'string' || body.paystack_recipient_code === null).toBeTruthy();
      expect(typeof body.estimated_completion === 'string' || body.estimated_completion === null).toBeTruthy();
      expect(typeof body.round_up_skipped).toBe('boolean');
      expect(typeof body.recipient_created).toBe('boolean');
      expect(body.total_charged).toBe(body.round_up_amount + 50_050);
      expect(Number.isInteger(body.total_charged)).toBe(true);
      expect(Number.isInteger(body.round_up_amount)).toBe(true);
    });
  });
});