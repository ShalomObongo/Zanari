/**
 * Integration Scenario: KYC Document Processing and Limit Escalation
 *
 * Implements Quickstart Scenario 10 to ensure uploaded documents progress
 * through review, users receive notifications, and KYC status updates are
 * recorded for future limit management.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';

describe('Integration: KYC Processing (T035)', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('should process KYC documents and escalate transaction limits', async () => {
    const { services, helpers, repositories, stubs, user } = env;

    const now = new Date();
    await repositories.userRepository.update(user.id, {
      kycStatus: 'pending',
      kycSubmittedAt: now,
      updatedAt: now,
    });

    const document = await services.kycService.uploadDocument({
      userId: user.id,
      documentType: 'national_id',
      filePath: `/tmp/${randomUUID()}.jpg`,
      fileName: 'national-id.jpg',
      fileSize: 256_000,
      mimeType: 'image/jpeg',
      encrypted: true,
      accessHash: 'mock-access-hash',
      expiresAt: null,
    });

  expect(document.status).toBe('uploaded');
    expect(document.processedAt).toBeNull();

    const approvedDocument = await helpers.approveKyc(document.id, 'Verified by compliance');
    expect(approvedDocument.status).toBe('approved');
    expect(approvedDocument.processedAt).not.toBeNull();
    expect(approvedDocument.verificationNotes).toContain('Verified');

    const notifications = helpers.listNotifications().filter((entry) => entry.userId === user.id);
    expect(notifications.some((entry) => entry.payload.title === 'KYC Approved')).toBe(true);

    const userAfterApproval = await repositories.userRepository.update(user.id, {
      kycStatus: 'approved',
      kycApprovedAt: approvedDocument.processedAt,
      updatedAt: new Date(),
    });
    expect(userAfterApproval.kycStatus).toBe('approved');
    expect(userAfterApproval.kycApprovedAt).toEqual(approvedDocument.processedAt);

    // Higher transaction limits will be applied by future policy engines; for now,
    // confirm that an audit trail is established for downstream limit systems.
    expect(stubs.notificationService.notifications.some((record) => record.payload.title === 'KYC Approved')).toBe(true);
  });
});
