/**
 * Integration Scenario: Deposit to Recipient (External Transfer)
 *
 * Verifies that external transfers (e.g. Card/M-Pesa) to another user:
 * 1. Initialize a Paystack transaction for the sender (amount + fee + round-up)
 * 2. Create a pending transfer_out transaction for the sender
 * 3. Do NOT credit the recipient immediately (waits for webhook)
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';
import { createUser } from '../../api/src/models/User';

describe('Integration: Deposit to Recipient (T037)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should initialize external transfer to recipient', async () => {
    const { services, repositories, helpers, user, stubs } = env;

    // Setup: Create a recipient user
    const recipientId = randomUUID();
    const recipientUser = createUser({
      id: recipientId,
      email: 'recipient@zanari.app',
      phone: '254722222222',
      firstName: 'Recipient',
      lastName: 'User',
    });
    await repositories.userRepository.create(recipientUser);

    // Setup: Configure round-up for sender
    await helpers.setRoundUpIncrement('100'); // Round up to nearest 100

    // Execute: Initialize deposit to recipient
    const transferId = randomUUID();
    const amount = 15_000; // KES 150.00
    const fee = 500; // KES 5.00 fee

    const result = await services.paymentService.initializeDepositToRecipient({
      transferId,
      userId: user.id,
      recipientUserId: recipientId,
      amount,
      fee,
      customerEmail: user.email,
      customerPhone: user.phone,
      description: 'Gift',
      senderName: 'Sarah',
      recipientName: 'Recipient',
    });

    // Verify: Result structure
    expect(result.status).toBe('pending');
    // Total charged = amount (150) + fee (5) + roundUp (45 to reach 200 total? No, round up is on amount+fee)
    // 150 + 5 = 155. Next 100 is 200. Round up = 45.
    // Total = 155 + 45 = 200.
    expect(result.totalCharged).toBe(15_000 + 500 + 4_500); 
    expect(result.roundUpAmount).toBe(4_500);
    expect(result.fee).toBe(500);
    expect(result.checkoutSession).toBeDefined();
    expect(result.checkoutSession.authorizationUrl).toContain('checkout.paystack.com');

    // Verify: Sender transaction created
    const senderTx = await repositories.transactionRepository.findById(transferId);
    expect(senderTx).toBeDefined();
    expect(senderTx?.type).toBe('transfer_out');
    expect(senderTx?.status).toBe('pending');
    expect(senderTx?.amount).toBe(amount); // Transaction amount is what recipient gets
    expect(senderTx?.roundUpDetails?.roundUpAmount).toBe(4_500);
    
    // Verify: Paystack client called
    expect(stubs.paystackClient.charges).toHaveLength(1);
    const charge = stubs.paystackClient.charges[0];
    if (!charge) throw new Error('Charge not found');
    expect(charge.amount).toBe(result.totalCharged);
    expect(charge.metadata.recipientUserId).toBe(recipientId);
    expect(charge.metadata.transferType).toBe('external');
  });
});
