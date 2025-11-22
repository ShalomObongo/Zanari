/**
 * Integration Scenario: Merchant Payment with Round-up Savings
 *
 * Executes Quickstart Scenario 2 to confirm that a successful merchant
 * payment also saves the round-up difference, updates wallets, and produces
 * transaction history tied to Paystack references.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: Payment with Round-up (T027)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should process merchant payment and save the round-up difference', async () => {
    const { services, repositories, stubs, helpers, user } = env;

    // Begin with a funded main wallet and configure an auto round-up of KES 20.
    await helpers.topUpMainWallet(100_000); // KES 1,000.00

    const existingRule = await repositories.roundUpRuleRepository.findByUserId(user.id);
    if (!existingRule) {
      throw new Error('Round-up rule missing for test user');
    }

    const autoRule = {
      ...existingRule,
      incrementType: 'auto' as const,
      autoSettings: {
        minIncrement: 5_000,
        maxIncrement: 5_000,
        analysisPeriodDays: 30,
        lastAnalysisAt: new Date(),
      },
      updatedAt: new Date(),
    };
    await repositories.roundUpRuleRepository.save(autoRule);

    // Authenticate the transaction with a valid PIN token.
    await helpers.ensurePin('1234');
    const pinToken = await helpers.issuePinToken('1234');

    // Execute a merchant payment of KES 230.00 (23,000 cents).
    const paymentAmount = 23_000;
    const paymentResult = await services.paymentService.payMerchant({
      paymentId: randomUUID(),
      userId: user.id,
      amount: paymentAmount,
      merchantInfo: {
        name: 'Java House',
        tillNumber: '123456',
        paybillNumber: null,
        accountNumber: null,
      },
      description: 'Lunch payment',
      pinToken,
      customerEmail: user.email,
      customerPhone: user.phone ?? null,
      channels: ['mobile_money', 'card'],
      currency: 'KES',
    });

    expect(paymentResult.status).toBe('pending');
    expect(paymentResult.roundUpAmount).toBe(5_000); // KES 50.00 saved (minIncrement)
    expect(paymentResult.totalCharged).toBe(paymentAmount + paymentResult.roundUpAmount);
    expect(paymentResult.roundUpTransaction).not.toBeNull();

    // Wallet balances should reflect the deduction and savings transfer.
    const mainWallet = await helpers.refreshWallet('main');
    const savingsWallet = await helpers.refreshWallet('savings');
    expect(mainWallet.balance).toBe(100_000 - paymentResult.totalCharged);
    expect(mainWallet.availableBalance).toBe(mainWallet.balance);
    expect(savingsWallet.balance).toBe(paymentResult.roundUpAmount);
    expect(savingsWallet.availableBalance).toBe(paymentResult.roundUpAmount);

    // Two transactions should exist: payment + associated round-up.
    const transactions = await helpers.refreshTransactions();
    const paymentTransaction = transactions.find((tx) => tx.type === 'payment');
    const roundUpTransaction = transactions.find((tx) => tx.type === 'round_up');

    expect(paymentTransaction).toBeDefined();
    expect(paymentTransaction?.status).toBe('pending');
    expect(paymentTransaction?.roundUpDetails?.roundUpAmount).toBe(5_000);
    expect(paymentTransaction?.merchantInfo?.name).toBe('Java House');
    expect(paymentTransaction?.roundUpDetails?.relatedTransactionId).toBe(roundUpTransaction?.id);

    expect(roundUpTransaction).toBeDefined();
    expect(roundUpTransaction?.amount).toBe(5_000);
    expect(roundUpTransaction?.category).toBe('savings');

    // Verify Paystack received the correct payload.
    expect(stubs.paystackClient.charges).toHaveLength(1);
    const paystackCharge = stubs.paystackClient.charges[0]!;
    expect(paystackCharge.amount).toBe(paymentAmount);
    expect(paystackCharge.metadata.roundUpAmount).toBe(5_000);
    expect(paystackCharge.metadata.merchant).toMatchObject({ name: 'Java House', tillNumber: '123456' });    // Round-up rule persists the auto configuration for subsequent payments.
    const updatedRule = await repositories.roundUpRuleRepository.findByUserId(user.id);
    expect(updatedRule?.incrementType).toBe('auto');
    expect(updatedRule?.autoSettings?.maxIncrement).toBe(5_000);
  });
});
