/**
 * Integration Scenario: Utility Bill Payment via Paybill
 *
 * Executes Quickstart Scenario 5 to ensure utility bill payments succeed,
 * store Paystack references, trigger round-up savings, and receive proper
 * categorization.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: Bill Payment (T030)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should process paybill transactions and capture audit details', async () => {
    const { services, repositories, helpers, stubs, user } = env;

    await helpers.topUpMainWallet(250_000); // KES 2,500.00 top-up

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

    await helpers.ensurePin('1234');
    const pinToken = await helpers.issuePinToken('1234');

    const billAmount = 149_000; // KES 1,490.00
    const paymentResult = await services.paymentService.payMerchant({
      paymentId: randomUUID(),
      userId: user.id,
      amount: billAmount,
      merchantInfo: {
        name: 'Nairobi Water Utility',
        tillNumber: null,
        paybillNumber: '400200',
        accountNumber: 'ACC001',
      },
      description: 'Water bill payment',
      pinToken,
      customerEmail: user.email,
      customerPhone: user.phone ?? null,
      channels: ['mobile_money', 'card'],
      currency: 'KES',
    });

    expect(paymentResult.status).toBe('pending');
    expect(paymentResult.roundUpAmount).toBe(1_000); // KES 10.00 saved
    expect(paymentResult.totalCharged).toBe(billAmount + 1_000);
    expect(paymentResult.roundUpTransaction).not.toBeNull();

    const mainWallet = await helpers.refreshWallet('main');
    const savingsWallet = await helpers.refreshWallet('savings');
    expect(mainWallet.balance).toBe(250_000 - paymentResult.totalCharged);
    expect(savingsWallet.balance).toBe(1_000);

    const transactions = await helpers.refreshTransactions();
    const billTransaction = transactions.find((tx) => tx.type === 'payment');
    const roundUpTransaction = transactions.find((tx) => tx.type === 'round_up');

    expect(billTransaction).toBeDefined();
    expect(billTransaction?.roundUpDetails?.roundUpAmount).toBe(1_000);
    expect(billTransaction?.merchantInfo?.paybillNumber).toBe('400200');
    expect(billTransaction?.merchantInfo?.accountNumber).toBe('ACC001');
    expect(billTransaction?.description).toBe('Water bill payment');
    expect(billTransaction?.roundUpDetails?.relatedTransactionId).toBe(roundUpTransaction?.id);

    expect(roundUpTransaction).toBeDefined();
    expect(roundUpTransaction?.amount).toBe(1_000);
    expect(roundUpTransaction?.category).toBe('savings');

    expect(stubs.paystackClient.charges).toHaveLength(1);
    const paystackCharge = stubs.paystackClient.charges[0]!;
    expect(paystackCharge.amount).toBe(billAmount);
    expect(paystackCharge.metadata.merchant).toMatchObject({ paybillNumber: '400200', accountNumber: 'ACC001' });

    // Allow auto-categorization by enabling the autoCategorized flag.
    await repositories.transactionRepository.update({
      ...billTransaction!,
      autoCategorized: true,
      updatedAt: new Date(),
    });

    const categorized = await services.categorizationService.autoCategorizeTransaction({
      transactionId: billTransaction!.id,
    });
    expect(categorized.category).toBe('utilities');
  });
});
