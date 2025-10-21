/**
 * Integration Scenario: Savings Wallet Withdrawal with Settlement Delay
 *
 * Implements Quickstart Scenario 6 to ensure users can withdraw from the
 * savings wallet, observe settlement locks, and complete Paystack payouts.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: Savings Withdrawal (T031)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should handle delayed settlement withdrawals successfully', async () => {
    const { services, repositories, helpers, stubs, user } = env;

    // Seed savings wallet with prior round-up savings.
    await helpers.topUpSavingsWallet(130_000); // KES 1,300.00
    const savingsBefore = await helpers.refreshWallet('savings');
    expect(savingsBefore.balance).toBe(130_000);

    await helpers.ensurePin('1234');
    const pinToken = await helpers.issuePinToken('1234');
    expect(pinToken).toBeTruthy();

    const withdrawalAmount = 20_000; // KES 200.00
    const mpesaPhone = '254712345678';

    // Debit savings wallet to lock funds for settlement.
    await services.walletService.debit({ userId: user.id, walletType: 'savings', amount: withdrawalAmount });
    const savingsDuring = await helpers.refreshWallet('savings');
    expect(savingsDuring.balance).toBe(110_000);
    expect(savingsDuring.availableBalance).toBe(110_000);

    // Apply settlement lock for the configured delay window.
    const lockedWallet = await repositories.walletRepository.findByUserAndType(user.id, 'savings');
    if (!lockedWallet?.withdrawalRestrictions) {
      throw new Error('Savings wallet missing withdrawal restrictions');
    }

    const settlementEta = new Date(Date.now() + lockedWallet.withdrawalRestrictions.minSettlementDelayMinutes * 60 * 1000);
    lockedWallet.withdrawalRestrictions = {
      ...lockedWallet.withdrawalRestrictions,
      lockedUntil: settlementEta,
    };
    await repositories.walletRepository.save(lockedWallet);

    const lockedState = await helpers.refreshWallet('savings');
    expect(lockedState.withdrawalRestrictions?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());

    // Record withdrawal transaction and trigger Paystack payout.
    const withdrawalTransaction = await services.transactionService.create({
      id: randomUUID(),
      userId: user.id,
      type: 'withdrawal',
      amount: withdrawalAmount,
      category: 'transfer',
      autoCategorized: false,
      metadata: {
        description: `Withdrawal to M-Pesa ${mpesaPhone}`,
        paymentMethod: 'mpesa',
      },
    });

    const recipient = await stubs.paystackClient.createTransferRecipient({
      type: 'mobile_money',
  name: `${user.firstName} ${user.lastName}`.trim(),
      accountNumber: mpesaPhone,
      bankCode: 'MPSA',
      currency: 'KES',
      metadata: {
        phone: mpesaPhone,
      },
    });

    const paystackResult = await stubs.paystackClient.initiateTransfer({
      amount: withdrawalAmount,
      reference: withdrawalTransaction.id,
      recipient: recipient.recipientCode,
      currency: 'KES',
      reason: `Savings withdrawal to ${mpesaPhone}`,
    });
    expect(paystackResult.status).toBe('success');
    expect(stubs.paystackClient.transfers).toHaveLength(1);

    // Settlement completes; unlock funds and mark transaction completed.
    lockedWallet.withdrawalRestrictions.lockedUntil = null;
    await repositories.walletRepository.save(lockedWallet);

    const completedTransaction = await services.transactionService.markStatus(withdrawalTransaction, 'completed');
    expect(completedTransaction.status).toBe('completed');
    expect(completedTransaction.description).toContain(mpesaPhone);

    const savingsAfter = await helpers.refreshWallet('savings');
    expect(savingsAfter.balance).toBe(110_000);
    expect(savingsAfter.withdrawalRestrictions?.lockedUntil).toBeNull();
  });
});
