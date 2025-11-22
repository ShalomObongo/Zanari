/**
 * Integration Scenario: Peer-to-Peer Money Transfer
 *
 * Executes Quickstart Scenario 4 to verify that peer transfers debit the
 * sender, trigger round-up savings, and record Paystack transfer metadata.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: P2P Transfer (T029)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should send funds to another user and apply round-up savings', async () => {
  const { services, repositories, helpers, stubs, user } = env;

    await helpers.topUpMainWallet(80_000); // KES 800.00 available for transfer

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

  const transferAmount = 48_200; // KES 482.00
    const recipientPhone = '254712345679';

    const transferResult = await services.paymentService.transferPeer({
      transferId: randomUUID(),
      userId: user.id,
      amount: transferAmount,
      recipient: {
        phone: recipientPhone,
        name: 'Brian Otieno',
      },
      description: 'Money for textbooks',
      pinToken,
    });

    expect(transferResult.status).toBe('pending');
    expect(transferResult.roundUpAmount).toBe(5_000); // KES 50.00 saved
    expect(transferResult.totalCharged).toBe(transferAmount + transferResult.roundUpAmount);
    expect(transferResult.roundUpTransaction).not.toBeNull();
    expect(transferResult.paystackTransferReference).toBeTruthy();
    expect(transferResult.paystackRecipientCode).toBeTruthy();

    const mainWallet = await helpers.refreshWallet('main');
    const savingsWallet = await helpers.refreshWallet('savings');
    expect(mainWallet.balance).toBe(80_000 - transferResult.totalCharged);
    expect(mainWallet.availableBalance).toBe(mainWallet.balance);
  expect(savingsWallet.balance).toBe(transferResult.roundUpAmount);
  expect(savingsWallet.availableBalance).toBe(transferResult.roundUpAmount);

    const transactions = await helpers.refreshTransactions();
    const transferTransaction = transactions.find((tx) => tx.type === 'transfer_out');
    const roundUpTransaction = transactions.find((tx) => tx.type === 'round_up');

    expect(transferTransaction).toBeDefined();
  expect(transferTransaction?.status).toBe('pending');
	expect(transferTransaction?.roundUpDetails?.roundUpAmount).toBe(transferResult.roundUpAmount);
  expect(transferTransaction?.description).toBe('Money for textbooks');
    expect(transferTransaction?.roundUpDetails?.relatedTransactionId).toBe(roundUpTransaction?.id);

    expect(roundUpTransaction).toBeDefined();
  expect(roundUpTransaction?.amount).toBe(transferResult.roundUpAmount);
    expect(roundUpTransaction?.category).toBe('savings');

    expect(stubs.paystackClient.transfers).toHaveLength(1);
    const paystackTransfer = stubs.paystackClient.transfers[0]!;
  expect(paystackTransfer.amount).toBe(transferAmount);
    expect(paystackTransfer.recipient.phone).toBe(recipientPhone);
  });
});
