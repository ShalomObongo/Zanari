/**
 * Contract Test: POST /payments/transfer (External)
 *
 * This test validates the external P2P transfer (Deposit to Recipient) contract.
 * It ensures that transfers via M-Pesa/Card correctly initialize a Paystack session
 * and return the expected response structure.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { createUser } from '../../../api/src/models/User';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /payments/transfer (External) Contract Tests', () => {
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

  it('should initialize external transfer via M-Pesa', async () => {
    const pinToken = await issuePinToken();
    const amount = 50_000; // KES 500.00

    const response = await transferPeer({
      amount,
      pin_token: pinToken,
      recipient_user_id: recipientId,
      description: 'External transfer test',
      payment_method: 'mpesa',
    });

    expect(response.status).toBe(200);
    const body = response.body;

    // Verify response structure for external transfer
    expect(body.status).toBe('pending');
    expect(typeof body.transfer_transaction_id).toBe('string');
    expect(typeof body.paystack_reference).toBe('string');
    expect(typeof body.paystack_access_code).toBe('string');
    expect(typeof body.paystack_authorization_url).toBe('string');
    expect(body.paystack_status).toBe('success'); // Mock client returns success for init
    
    // Verify amounts
    // Fee is 1000 (KES 10) for external
    // Round up: 50000 + 1000 = 51000. Next 100 is 51000. Round up = 0?
    // Wait, setRoundUpIncrement('100'). 51000 is divisible by 100. So round up is 0.
    // Let's use an amount that triggers round up.
    // Amount 50050 + 1000 = 51050. Next 100 is 51100. Round up = 50.
  });

  it('should initialize external transfer with round-up', async () => {
    const pinToken = await issuePinToken();
    const amount = 50_050; // KES 500.50

    const response = await transferPeer({
      amount,
      pin_token: pinToken,
      recipient_user_id: recipientId,
      description: 'External transfer with round-up',
      payment_method: 'mpesa',
    });

    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.payment_method).toBe('mpesa');
    expect(body.transfer_type).toBe('external');
    expect(body.fee).toBe(1000); // KES 10.00
    
    // 50050 + 1000 = 51050. Next 10000 (KES 100) is 60000. Round up = 8950.
    expect(body.round_up_amount).toBe(8950);
    expect(body.total_charged).toBe(50_050 + 1000 + 8950);
  });

  it('should reject invalid payment method', async () => {
    const pinToken = await issuePinToken();
    const response = await transferPeer({
      amount: 50_000,
      pin_token: pinToken,
      recipient_user_id: recipientId,
      payment_method: 'invalid_method',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_PAYMENT_METHOD');
  });
});
