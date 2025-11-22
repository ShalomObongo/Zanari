/**
 * Integration Scenario: Round-up Configuration and Auto-Analyze
 *
 * Executes Quickstart Scenario 7 to confirm users can adjust round-up
 * increments, observe their impact on savings, and rely on automated
 * analysis to retune settings based on spending behavior.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: Round-up Configuration (T032)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should update round-up settings and adapt to auto-analysis results', async () => {
    const { services, repositories, helpers, user } = env;

    await helpers.topUpMainWallet(600_000); // KES 6,000.00 to cover multiple payments
    await helpers.ensurePin('1234');
    const pinToken = await helpers.issuePinToken('1234');

    const rule = await repositories.roundUpRuleRepository.findByUserId(user.id);
    if (!rule) {
      throw new Error('Round-up rule missing for user');
    }

    // User selects a fixed 50 KES increment via auto settings.
    const manualAutoRule = {
      ...rule,
      incrementType: 'auto' as const,
      autoSettings: {
        minIncrement: 5_000,
        maxIncrement: 5_000,
        analysisPeriodDays: 30,
        lastAnalysisAt: new Date(),
      },
      updatedAt: new Date(),
    };
    await repositories.roundUpRuleRepository.save(manualAutoRule);

    // Process a representative payment to confirm the new increment is used.
    const utilitiesPayment = await services.paymentService.payMerchant({
      paymentId: randomUUID(),
      userId: user.id,
      amount: 43_000, // KES 430.00
      merchantInfo: {
        name: 'City Power',
        tillNumber: null,
        paybillNumber: '888888',
        accountNumber: 'POWER01',
      },
      description: 'Electricity bill',
      pinToken,
      customerEmail: user.email,
      customerPhone: user.phone ?? null,
      channels: ['mobile_money', 'card'],
      currency: 'KES',
    });

    expect(utilitiesPayment.status).toBe('pending');
    expect(utilitiesPayment.roundUpAmount).toBe(5_000); // KES 50.00

    const savingsWalletAfterPayment = await helpers.refreshWallet('savings');
    expect(savingsWalletAfterPayment.balance).toBe(5_000);

    // Additional spending activity to feed auto-analysis with higher averages.
    const largePayments = [60_000, 70_000, 80_000];
    for (const amount of largePayments) {
      const payment = await services.paymentService.payMerchant({
        paymentId: randomUUID(),
        userId: user.id,
        amount,
        merchantInfo: {
          name: 'Everyday Mart',
          tillNumber: '555555',
          paybillNumber: null,
          accountNumber: null,
        },
        description: `Shopping spend ${amount / 100} KES`,
        pinToken,
        customerEmail: user.email,
        customerPhone: user.phone ?? null,
        channels: ['mobile_money', 'card'],
        currency: 'KES',
      });
      expect(payment.status).toBe('pending');
    }

    // Run auto-analysis to adjust increment ranges based on new spending profile.
    const analyzedRule = await services.autoAnalyzeService.analyze(user.id);
    expect(analyzedRule.incrementType).toBe('auto');
    expect(analyzedRule.autoSettings?.maxIncrement).toBeGreaterThanOrEqual(100);
    expect(analyzedRule.autoSettings?.minIncrement).toBeGreaterThanOrEqual(50);
    expect(analyzedRule.autoSettings?.analysisPeriodDays).toBe(30);
    expect(analyzedRule.autoSettings?.lastAnalysisAt).not.toBeNull();

    // Subsequent payment should respect the new auto-analyzed increment bounds.
    const followUpPayment = await services.paymentService.payMerchant({
      paymentId: randomUUID(),
      userId: user.id,
      amount: 18_601, // KES 186.01
      merchantInfo: {
        name: 'Daily Essentials',
        tillNumber: '222222',
        paybillNumber: null,
        accountNumber: null,
      },
      description: 'Top-up groceries',
      pinToken,
      customerEmail: user.email,
      customerPhone: user.phone ?? null,
      channels: ['mobile_money', 'card'],
      currency: 'KES',
    });

    expect(followUpPayment.status).toBe('pending');
    expect(analyzedRule.autoSettings).not.toBeNull();
    expect(followUpPayment.roundUpAmount).toBeGreaterThan(0);
    expect(followUpPayment.roundUpAmount).toBeLessThanOrEqual(analyzedRule.autoSettings!.maxIncrement);
  });
});
