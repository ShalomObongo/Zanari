/**
 * Integration Scenario: Internal Peer-to-Peer Money Transfer
 *
 * Verifies that internal transfers between Zanari users:
 * 1. Debit the sender's main wallet
 * 2. Credit the recipient's main wallet
 * 3. Apply round-up savings to the sender
 * 4. Create linked transfer_out and transfer_in transactions
 * 5. Complete instantly without Paystack
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';
import { createUser } from '../../api/src/models/User';
import { createWallet } from '../../api/src/models/Wallet';

describe('Integration: Internal Transfer (T036)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should transfer funds internally between users and apply round-up', async () => {
    const { services, repositories, helpers, user } = env;

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

    // Setup: Create recipient's main wallet
    const recipientWallet = createWallet({
      id: randomUUID(),
      userId: recipientId,
      walletType: 'main',
      balance: 0,
      availableBalance: 0,
    });
    await repositories.walletRepository.insert(recipientWallet);

    // Setup: Top up sender
    await helpers.topUpMainWallet(50_000); // KES 500.00

    // Setup: Configure round-up for sender
    await helpers.setRoundUpIncrement('100'); // Round up to nearest 100

    // Execute: Internal transfer
    const transferAmount = 15_000; // KES 150.00
    const transferId = randomUUID();

    const result = await services.paymentService.transferPeerInternal({
      transferId,
      userId: user.id,
      recipientUserId: recipientId,
      amount: transferAmount,
      description: 'Lunch money',
      senderName: 'Sarah',
      recipientName: 'Recipient',
    });

    // Verify: Result structure
    expect(result.status).toBe('completed');
    expect(result.totalCharged).toBe(15_000 + 5_000); // 150 + 50 round up (150 rounded to 200 is 50 diff)
    expect(result.roundUpAmount).toBe(5_000);
    expect(result.fee).toBe(0);

    // Verify: Sender wallet debited
    const senderWallet = await helpers.refreshWallet('main');
    expect(senderWallet.balance).toBe(50_000 - 20_000); // 500 - 200 = 300

    // Verify: Sender savings credited
    const senderSavings = await helpers.refreshWallet('savings');
    expect(senderSavings.balance).toBe(5_000); // 50

    // Verify: Recipient wallet credited
    const updatedRecipientWallet = await repositories.walletRepository.findByUserAndType(recipientId, 'main');
    expect(updatedRecipientWallet?.balance).toBe(15_000); // 150

    // Verify: Transactions
    const senderTx = await repositories.transactionRepository.findById(result.senderTransaction.id);
    expect(senderTx).toBeDefined();
    expect(senderTx?.type).toBe('transfer_out');
    expect(senderTx?.status).toBe('completed');
    expect(senderTx?.paymentMethod).toBe('internal');
    expect(senderTx?.roundUpDetails?.roundUpAmount).toBe(5_000);

    const recipientTx = await repositories.transactionRepository.findById(result.recipientTransaction.id);
    expect(recipientTx).toBeDefined();
    expect(recipientTx?.type).toBe('transfer_in');
    expect(recipientTx?.status).toBe('completed');
    expect(recipientTx?.amount).toBe(15_000);
  });

  it('should fail if sender has insufficient funds', async () => {
    const { services, repositories, helpers, user } = env;

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
    const recipientWallet = createWallet({
      id: randomUUID(),
      userId: recipientId,
      walletType: 'main',
      balance: 0,
      availableBalance: 0,
    });
    await repositories.walletRepository.insert(recipientWallet);

    // Setup: Top up sender with small amount
    await helpers.topUpMainWallet(1_000); // KES 10.00

    // Execute: Internal transfer (more than balance)
    const transferAmount = 5_000; // KES 50.00

    await expect(
      services.paymentService.transferPeerInternal({
        transferId: randomUUID(),
        userId: user.id,
        recipientUserId: recipientId,
        amount: transferAmount,
      })
    ).rejects.toThrow('Insufficient funds');
  });
});
