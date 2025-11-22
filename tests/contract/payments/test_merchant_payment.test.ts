/**
 * Contract Test: POST /payments/merchant
 *
 * This test validates the merchant payment endpoint contract according to the API specification.
 * It exercises Paystack integration behaviour, round-up handling, and request validation against
 * the real route handlers by using the shared integration test environment.
 *
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { createTransaction } from '../../../api/src/models/Transaction';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /payments/merchant Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  await ctx.integration.helpers.setRoundUpIncrement('100');
  });

  async function issuePinToken(pin = '1234') {
    return ctx.integration.helpers.issuePinToken(pin);
  }

  async function payMerchant(
    body: Record<string, unknown>,
    { authenticated = true }: { authenticated?: boolean } = {},
  ) {
    const request = { body };
    return authenticated
      ? ctx.executeAsUser(ctx.routes.payments.payMerchant, request)
      : ctx.execute(ctx.routes.payments.payMerchant, request);
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

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  describe('Successful Till Number Payments', () => {
    it('should process payment to merchant with till number and round-up', async () => {
      const startingBalance = 100_000;
      await ctx.integration.helpers.topUpMainWallet(startingBalance);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 23_450,
        pin_token: pinToken,
        merchant_info: {
          name: 'Java House',
          till_number: '123456',
        },
        description: 'Lunch payment',
      });

      expect(response.status).toBe(200);
      expect(response.body.payment_transaction_id).toMatch(UUID_REGEX);
      expect(response.body.round_up_transaction_id).toMatch(UUID_REGEX);
      expect(response.body.total_charged).toBeGreaterThan(23_450);
      expect(response.body.total_charged).toBe(response.body.round_up_amount + 23_450);
      expect(typeof response.body.round_up_amount).toBe('number');
      expect(response.body.paystack_reference).toMatch(UUID_REGEX);
      expect(response.body.paystack_access_code).toBe(`AC_${response.body.paystack_reference}`);
      expect(response.body.paystack_authorization_url).toBe(`https://checkout.paystack.com/${response.body.paystack_reference}`);
      expect(response.body.paystack_status).toBe('success');
      expect(typeof response.body.paystack_checkout_expires_at).toBe('string');
      expect(response.body.round_up_skipped).toBe(false);
      expect(response.body.round_up_skip_reason).toBeNull();

      const wallet = await ctx.integration.helpers.refreshWallet('main');
      expect(wallet.availableBalance).toBe(startingBalance - response.body.total_charged);
      expect(ctx.integration.stubs.paystackClient.charges).toHaveLength(1);
      expect(ctx.integration.stubs.paystackClient.charges[0]).toMatchObject({
        amount: 23_450,
        reference: response.body.payment_transaction_id,
      });
    });

    it('should handle payment with round-up satisfying validation rules', async () => {
      await ctx.integration.helpers.topUpMainWallet(20_000);
      const pinToken = await issuePinToken();

      // Amount must be >= roundUpAmount due to Transaction model validation
      // With increment '100' (10000 cents), target is next 10000.
      // If amount = 5000, target = 10000, roundUp = 5000. 5000 <= 5000. OK.
      const amount = 5000;
      const response = await payMerchant({
        amount,
        pin_token: pinToken,
        merchant_info: {
          name: 'Small Vendor',
          till_number: '654321',
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.total_charged).toBeGreaterThan(amount);
      expect(response.body.round_up_amount).toBeGreaterThan(0);
      expect(response.body.total_charged).toBe(response.body.round_up_amount + amount);
    });

    it('should handle maximum single payment amount without round-up', async () => {
      await ctx.integration.helpers.topUpMainWallet(600_000);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 500_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Big Purchase Store',
          till_number: '999999',
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.total_charged).toBe(500_000);
      expect(response.body.round_up_amount).toBe(0);
      expect(response.body.round_up_transaction_id).toBeNull();
    });
  });

  describe('Successful Paybill Payments', () => {
    it('should process payment to paybill with account number', async () => {
      await ctx.integration.helpers.topUpMainWallet(200_000);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 150_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Kenya Power',
          paybill_number: '400200',
          account_number: 'ACC001',
        },
        description: 'Electricity bill payment',
      });

      expect(response.status).toBe(200);
      expect(response.body.payment_transaction_id).toMatch(UUID_REGEX);
      expect(response.body.total_charged).toBeGreaterThanOrEqual(150_000);
      expect(response.body.round_up_amount).toBeGreaterThanOrEqual(0);
      expect(response.body.paystack_reference).toMatch(UUID_REGEX);
      expect(response.body.paystack_access_code).toBe(`AC_${response.body.paystack_reference}`);
      expect(response.body.paystack_authorization_url).toBe(`https://checkout.paystack.com/${response.body.paystack_reference}`);
      expect(response.body.paystack_status).toBe('success');
      expect(typeof response.body.paystack_checkout_expires_at).toBe('string');
    });
  });

  describe('Amount Validation', () => {
    it('should reject payment below minimum amount', async () => {
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 50,
        pin_token: pinToken,
        merchant_info: {
          name: 'Test Merchant',
          till_number: '123456',
        },
      });

      expectErrorResponse(response, 400, 'AMOUNT_TOO_LOW');
    });

    it('should reject payment above maximum amount', async () => {
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 600_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Expensive Store',
          till_number: '123456',
        },
      });
      expectErrorResponse(response, 400, 'AMOUNT_TOO_HIGH');

    });

    it('should validate amount is a positive integer in cents', async () => {
      const pinToken = await issuePinToken();

      const invalidAmounts: number[] = [0, -1_000];
      for (const amount of invalidAmounts) {
        const response = await payMerchant({
          amount,
          pin_token: pinToken,
          merchant_info: {
            name: 'Test Merchant',
            till_number: '123456',
          },
        });

        expectErrorResponse(response, 400, 'INVALID_AMOUNT_FORMAT');
      }

      const decimalResponse = await payMerchant({
        amount: 123.45,
        pin_token: pinToken,
        merchant_info: {
          name: 'Test Merchant',
          till_number: '123456',
        },
      });

      expectErrorResponse(decimalResponse, 400, 'INVALID_AMOUNT_FORMAT');
    });
  });

  describe('PIN Token Validation', () => {
    it('should require PIN token', async () => {
      const response = await payMerchant({
        amount: 50_000,
        merchant_info: {
          name: 'Test Merchant',
          till_number: '123456',
        },
      });

      expectErrorResponse(response, 400, 'MISSING_PIN_TOKEN');
      expect(response.body.error).toBe('PIN token is required for payment authorization');
    });

    it('should validate PIN token format', async () => {
      const response = await payMerchant({
        amount: 50_000,
        pin_token: 'invalid_token',
        merchant_info: {
          name: 'Test Merchant',
          till_number: '123456',
        },
      });

      expectErrorResponse(response, 400, 'INVALID_PIN_TOKEN_FORMAT');
    });

    it('should reject expired PIN token', async () => {
      await ctx.integration.helpers.topUpMainWallet(60_000);
      const response = await payMerchant({
        amount: 50_000,
        pin_token: 'txn_expiredtoken',
        merchant_info: {
          name: 'Test Merchant',
          till_number: '123456',
        },
      });

      expectErrorResponse(response, 401, 'PIN_TOKEN_EXPIRED');
    });
  });

  describe('Merchant Info Validation', () => {
    it('should reject missing merchant info', async () => {
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 50_000,
        pin_token: pinToken,
      });

      expectErrorResponse(response, 400, 'MISSING_MERCHANT_INFO');
    });

    it('should reject invalid till number format', async () => {
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 50_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Test Merchant',
          till_number: '12',
        },
      });

      expectErrorResponse(response, 400, 'INVALID_TILL_NUMBER');
    });

    it('should reject incomplete paybill information', async () => {
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 50_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Test Merchant',
          paybill_number: '400200',
        },
      });

      expectErrorResponse(response, 400, 'MISSING_ACCOUNT_NUMBER');
    });

    it('should reject merchant info with both till and paybill details', async () => {
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 50_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Test Merchant',
          till_number: '123456',
          paybill_number: '400200',
          account_number: 'ACC001',
        },
      });

      expectErrorResponse(response, 400, 'CONFLICTING_MERCHANT_INFO');
    });
  });

  describe('Daily Limit Enforcement', () => {
    it('should reject payment when daily transaction limit exceeded', async () => {
      const existing = createTransaction({
        id: randomUUID(),
        userId: ctx.userId,
        type: 'payment',
        amount: 1_900_000,
        category: 'groceries',
      });
      await ctx.integration.repositories.transactionRepository.create(existing);

      await ctx.integration.helpers.topUpMainWallet(300_000);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 200_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Daily Limit Store',
          till_number: '112233',
        },
      });

      expectErrorResponse(response, 400, 'DAILY_LIMIT_EXCEEDED');
      expect(response.body.available_today).toBeGreaterThanOrEqual(0);
      expect(response.body.daily_limit).toBe(2_000_000);
      expect(response.body.used_today).toBe(1_900_000);
    });
  });

  describe('Balance Handling', () => {
    it('should reject payments exceeding available balance', async () => {
      await ctx.integration.helpers.topUpMainWallet(10_000);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 20_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Expensive Store',
          till_number: '123456',
        },
      });

      expectErrorResponse(response, 402, 'INSUFFICIENT_FUNDS');
      expect(response.body.available_balance).toBe(10_000);
      expect(response.body.round_up_skipped).toBe(false);
    });

    it('should skip round-up when funds cover only the payment amount', async () => {
      await ctx.integration.helpers.topUpMainWallet(46_500);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 46_500,
        pin_token: pinToken,
        merchant_info: {
          name: 'Transport Hub',
          till_number: '777777',
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.round_up_amount).toBe(0);
      expect(response.body.round_up_transaction_id).toBeNull();
      expect(response.body.round_up_skipped).toBe(true);
      expect(response.body.round_up_skip_reason).toBe('Insufficient funds for round-up');
    });
  });

  describe('Paystack Integration', () => {
    it('should handle Paystack service unavailable', async () => {
      await ctx.integration.helpers.topUpMainWallet(80_000);
      const pinToken = await issuePinToken();

      jest
        .spyOn(ctx.integration.stubs.paystackClient, 'initializeTransaction')
        .mockRejectedValueOnce(new Error('Paystack network error'));

      const response = await payMerchant({
        amount: 50_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Test Merchant',
          till_number: '123456',
        },
      });

      expectErrorResponse(response, 503, 'PAYSTACK_UNAVAILABLE');
      expect(response.body.retry_after).toBeUndefined();

      const wallet = await ctx.integration.helpers.refreshWallet('main');
      expect(wallet.availableBalance).toBe(80_000);
    });

    it('should return Paystack metadata in successful response', async () => {
      await ctx.integration.helpers.topUpMainWallet(60_000);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 30_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Coffee Shop',
          till_number: '789012',
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.paystack_reference).toMatch(UUID_REGEX);
      expect(response.body.paystack_access_code).toBe(`AC_${response.body.paystack_reference}`);
      expect(response.body.paystack_authorization_url).toBe(`https://checkout.paystack.com/${response.body.paystack_reference}`);
      expect(response.body.paystack_status).toBe('success');
      expect(typeof response.body.paystack_checkout_expires_at).toBe('string');
    });
  });

  describe('Authentication', () => {
    it('should require authentication header', async () => {
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 10_000,
        pin_token: pinToken,
        merchant_info: {
          name: 'Public Market',
          till_number: '445566',
        },
      }, { authenticated: false });

      expectErrorResponse(response, 401, 'AUTH_REQUIRED');
    });
  });

  describe('Response Schema Validation', () => {
    it('should return response matching OpenAPI schema expectations', async () => {
      await ctx.integration.helpers.topUpMainWallet(80_000);
      const pinToken = await issuePinToken();

      const response = await payMerchant({
        amount: 23_450,
        pin_token: pinToken,
        merchant_info: {
          name: 'Schema Store',
          till_number: '888888',
        },
        description: 'Schema validation payment',
      });

      expect(response.status).toBe(200);

      const body = response.body;
      expect(typeof body.payment_transaction_id).toBe('string');
      expect(typeof body.round_up_transaction_id === 'string' || body.round_up_transaction_id === null).toBeTruthy();
      expect(typeof body.total_charged).toBe('number');
      expect(typeof body.round_up_amount).toBe('number');
      expect(typeof body.paystack_reference).toBe('string');
      expect(typeof body.paystack_access_code).toBe('string');
      expect(typeof body.paystack_authorization_url).toBe('string');
      expect(typeof body.round_up_skipped).toBe('boolean');
    expect(body.total_charged).toBe(body.round_up_amount + 23_450);
      expect(Number.isInteger(body.total_charged)).toBe(true);
      expect(Number.isInteger(body.round_up_amount)).toBe(true);
    });
  });
});