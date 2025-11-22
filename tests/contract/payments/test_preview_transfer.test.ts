/**
 * Contract Test: POST /payments/transfer/preview
 *
 * This test validates the transfer preview endpoint contract.
 * It ensures that the API correctly calculates fees, round-ups, and totals
 * for different payment methods before a transfer is initiated.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { createUser } from '../../../api/src/models/User';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /payments/transfer/preview Contract Tests', () => {
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
  });

  async function previewTransfer(
    body: Record<string, unknown>,
    { authenticated = true }: { authenticated?: boolean } = {},
  ) {
    const request = { body };
    return authenticated
      ? ctx.executeAsUser(ctx.routes.payments.previewTransfer, request)
      : ctx.execute(ctx.routes.payments.previewTransfer, request);
  }

  it('should preview internal wallet transfer', async () => {
    const amount = 50_050; // KES 500.50
    const response = await previewTransfer({
      amount,
      recipient_user_id: recipientId,
      payment_method: 'wallet',
    });

    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.amount).toBe(amount);
    expect(body.fee).toBe(0); // Internal transfers are free
    expect(body.payment_method).toBe('wallet');
    
    // Round up: 50050 -> next 10000 (KES 100) is 60000. Diff = 9950.
    // Wait, 50050 % 10000 = 50. 10000 - 50 = 9950.
    // 50050 + 9950 = 60000.
    expect(body.round_up_amount).toBe(9950);
    expect(body.total).toBe(amount + 0 + 9950);
    expect(body.recipient.user_id).toBe(recipientId);
    expect(body.recipient.name).toBe('John Doe');
  });

  it('should preview external transfer (M-Pesa)', async () => {
    const amount = 50_000; // KES 500.00
    const response = await previewTransfer({
      amount,
      recipient_user_id: recipientId,
      payment_method: 'mpesa',
    });

    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.amount).toBe(amount);
    expect(body.fee).toBe(1000); // KES 10.00 fee
    expect(body.payment_method).toBe('mpesa');
    
    // Round up: 50000 + 1000 = 51000.
    // 51000 % 10000 = 1000.
    // Round up = 10000 - 1000 = 9000.
    expect(body.round_up_amount).toBe(9000);
    expect(body.total).toBe(amount + 1000 + 9000);
  });

  it('should preview external transfer with round-up', async () => {
    const amount = 50_050; // KES 500.50
    const response = await previewTransfer({
      amount,
      recipient_user_id: recipientId,
      payment_method: 'mpesa',
    });

    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.amount).toBe(amount);
    expect(body.fee).toBe(1000);
    
    // Amount 50050 + Fee 1000 = 51050.
    // Round up rule '100' (KES 100 = 10000 cents).
    // 51050 % 10000 = 1050.
    // Round up = 10000 - 1050 = 8950.
    expect(body.round_up_amount).toBe(8950);
    expect(body.total).toBe(amount + 1000 + 8950);
  });

  it('should validate payment method', async () => {
    const response = await previewTransfer({
      amount: 50_000,
      recipient_user_id: recipientId,
      payment_method: 'invalid',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_PAYMENT_METHOD');
  });

  it('should validate recipient', async () => {
    const response = await previewTransfer({
      amount: 50_000,
      payment_method: 'wallet',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('MISSING_RECIPIENT_USER_ID');
  });
});
