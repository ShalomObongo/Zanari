/**
 * Integration Scenario: First-Time User Onboarding
 *
 * Validates the happy-path flow described in Quickstart Scenario 1.
 * Ensures OTP delivery, verification, PIN setup, KYC submission, and
 * initial wallet + round-up defaults are ready for the user.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: User Onboarding Flow (T026)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should guide a first-time user through onboarding successfully', async () => {
    const { services, repositories, stubs, helpers, user } = env;

    // Step 1: request OTP via email during signup.
    const otpResponse = await services.authService.requestOtp({ email: user.email });
    expect(otpResponse.deliveryChannel).toBe('email');
    expect(otpResponse.sessionId).toMatch(/^sess_/);
    expect(stubs.otpSender.lastEmailOtp).not.toBeNull();
    expect(stubs.otpSender.lastEmailOtp?.email).toBe(user.email);

    // Step 2: verify OTP and receive auth tokens.
    const otpCode = stubs.otpSender.lastEmailOtp!.otp;
    const verifyResult = await services.authService.verifyOtp({ sessionId: otpResponse.sessionId, otpCode });
    expect(verifyResult.user.id).toBe(user.id);
    expect(verifyResult.requiresPinSetup).toBe(true);
    expect(verifyResult.accessToken).toContain('access-');
    expect(verifyResult.refreshToken).toContain('refresh-');

    // Step 3: set up a 4-digit PIN for secure access.
    await services.authService.setupPin(user.id, '1234');
    const userAfterPin = await helpers.refreshUser();
    expect(userAfterPin.pinHash).toBeDefined();
    expect(userAfterPin.pinSetAt).not.toBeNull();
    expect(userAfterPin.failedPinAttempts).toBe(0);

    // Step 4: upload a primary KYC document (national ID).
    const kycDocument = await services.kycService.uploadDocument({
      userId: user.id,
      documentType: 'national_id',
      filePath: 'kyc/sarah-national-id.png',
      fileName: 'sarah-national-id.png',
      fileSize: 256_000,
      mimeType: 'image/png',
      encrypted: true,
      accessHash: 'hash-kyc-sarah-1234',
    });
    expect(kycDocument.status).toBe('uploaded');

  const allDocuments = await repositories.kycDocumentRepository.listByUser(user.id);
  expect(allDocuments).toHaveLength(1);
  const primaryDocument = allDocuments[0]!;
  expect(primaryDocument.documentType).toBe('national_id');

    // Update user state to reflect pending verification.
    const submittedAt = new Date();
    await repositories.userRepository.update(user.id, {
      kycStatus: 'pending',
      kycSubmittedAt: submittedAt,
    });
    const userAfterKyc = await helpers.refreshUser();
    expect(userAfterKyc.kycStatus).toBe('pending');
    expect(userAfterKyc.kycSubmittedAt?.getTime()).toBeGreaterThanOrEqual(submittedAt.getTime());

    // Step 5: verify initial wallets exist with zero balances.
    const wallets = await services.walletService.listWallets(user.id);
    expect(wallets).toHaveLength(2);
    const mainWallet = wallets.find((wallet) => wallet.walletType === 'main');
    const savingsWallet = wallets.find((wallet) => wallet.walletType === 'savings');
    expect(mainWallet).toBeDefined();
    expect(mainWallet?.balance).toBe(0);
    expect(mainWallet?.availableBalance).toBe(0);
    expect(savingsWallet).toBeDefined();
    expect(savingsWallet?.balance).toBe(0);
    expect(savingsWallet?.availableBalance).toBe(0);

    // Step 6: ensure round-up defaults are enabled for automated savings.
    const roundUpRule = await repositories.roundUpRuleRepository.findByUserId(user.id);
    expect(roundUpRule).not.toBeNull();
    expect(roundUpRule?.isEnabled).toBe(true);
    expect(roundUpRule?.incrementType).toBe('10');
    expect(roundUpRule?.totalAmountSaved).toBe(0);
    expect(roundUpRule?.totalRoundUpsCount).toBe(0);

    // No onboarding notifications should fire yet (uploads are silent until approval).
    expect(stubs.notificationService.notifications).toHaveLength(0);
  });
});
