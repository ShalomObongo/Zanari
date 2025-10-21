import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

interface UploadRequest {
  document_type: 'national_id' | 'passport' | 'driving_license' | 'selfie';
  file_name: string;
  file_size: number;
  mime_type: string;
  checksum?: string;
  device_metadata?: {
    platform?: string;
    app_version?: string;
    device_model?: string;
  };
  geo_location?: {
    latitude?: number;
    longitude?: number;
  };
}

interface UploadInitiatedResponse {
  upload_id: string;
  document_id: string;
  signed_upload_url: string;
  upload_headers: Record<string, string>;
  max_bytes: number;
  expires_in_seconds: number;
  encryption_required: boolean;
  status: 'pending_upload';
  remaining_attempts: number;
  manual_review_threshold: number;
  required_pairing?: string;
  audit_trail?: {
    ip_address: string;
    device_platform?: string | null;
    device_model?: string | null;
    app_version?: string | null;
    geo_location?: {
      latitude: number | null;
      longitude: number | null;
    } | null;
  };
}

interface UploadQueuedResponse {
  upload_id: string;
  document_id: string;
  status: 'processing';
  queued_at: string;
  estimated_completion_minutes: number;
  next_status_check_after_seconds: number;
  remaining_attempts: number;
  manual_review_threshold: number;
}

interface ErrorResponse {
  error: string;
  code: string;
  [key: string]: unknown;
}

type UploadResponseBody = UploadInitiatedResponse | UploadQueuedResponse | ErrorResponse;

const MAX_BYTES = 10_000_000;

const uniqueName = (() => {
  let counter = 0;
  return (prefix: string) => `${prefix}_${++counter}_${Date.now()}`;
})();

describe('POST /kyc/documents Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const buildRequest = (overrides: Partial<UploadRequest> = {}): UploadRequest => ({
    document_type: 'national_id',
    file_name: `${uniqueName('national_id')}.jpg`,
    file_size: 2_500_000,
    mime_type: 'image/jpeg',
    checksum: `sha256:${randomUUID().replace(/-/g, '')}`,
    device_metadata: {
      platform: 'iOS',
      app_version: '1.2.3',
      device_model: 'iPhone 15',
    },
    ...overrides,
  });

  const initiateUpload = (
    request: UploadRequest,
    options: { authenticated?: boolean } = {},
  ) => {
    const payload = { body: request } as const;
    return options.authenticated === false
      ? ctx.execute(ctx.routes.kyc.initiateUpload, payload)
      : ctx.executeAsUser(ctx.routes.kyc.initiateUpload, payload);
  };

  describe('Successful Upload Initialisation', () => {
    it('returns signed upload metadata for standard JPEG documents', async () => {
      const response = await initiateUpload(buildRequest());

      expect(response.status).toBe(201);
      const body = response.body as UploadInitiatedResponse;
      expect(body.status).toBe('pending_upload');
  expect(body.upload_id).toMatch(/^upload_national_id_/);
  expect(body.document_id).toMatch(/^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/);
      expect(body.signed_upload_url).toMatch(/^https:\/\/storage\.supabase\.io\//);
      expect(body.signed_upload_url).toContain('token=');
      expect(body.signed_upload_url).toContain('expires=600');
      expect(body.upload_headers).toMatchObject({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true' });
      expect(body.encryption_required).toBe(true);
      expect(body.max_bytes).toBe(MAX_BYTES);
  expect(body.remaining_attempts).toBe(2);
      expect(body.manual_review_threshold).toBe(3);

      const documents = await ctx.integration.services.kycService.listDocuments(ctx.userId);
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        id: body.document_id,
        documentType: 'national_id',
        status: 'uploaded',
        encrypted: true,
      });
    });

    it('marks selfie uploads as requiring national ID pairing', async () => {
      const response = await initiateUpload(
        buildRequest({ document_type: 'selfie', file_name: `${uniqueName('selfie')}.png`, mime_type: 'image/png' }),
      );

      expect(response.status).toBe(201);
      const body = response.body as UploadInitiatedResponse;
      expect(body.required_pairing).toBe('national_id');
      expect(body.remaining_attempts).toBe(2);
    });
  });

  describe('Validation Rules', () => {
    it('rejects files that exceed the 10MB limit', async () => {
      const response = await initiateUpload(buildRequest({ file_size: MAX_BYTES + 1 }));

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('FILE_TOO_LARGE');
      expect(body.max_bytes).toBe(MAX_BYTES);
    });

    it('rejects unsupported MIME types', async () => {
      const response = await initiateUpload(buildRequest({ mime_type: 'image/bmp' }));

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('UNSUPPORTED_MIME_TYPE');
      expect(Array.isArray(body.allowed_mime_types)).toBe(true);
      expect(body.allowed_mime_types).toContain('image/png');
    });

    it('rejects uploads when an approved document already exists', async () => {
      const first = await initiateUpload(buildRequest());
      const docId = (first.body as UploadInitiatedResponse).document_id;
      await ctx.integration.helpers.approveKyc(docId, 'Approved for contract test');

      const duplicate = await initiateUpload(buildRequest());

      expect(duplicate.status).toBe(409);
      const body = duplicate.body as ErrorResponse;
      expect(body.code).toBe('DOCUMENT_TYPE_LOCKED');
      expect(body.existing_document_id).toBe(docId);
    });
  });

  describe('Attempt Limits & Manual Review', () => {
    it('reduces remaining attempts after each upload', async () => {
      const first = await initiateUpload(buildRequest());
      expect((first.body as UploadInitiatedResponse).remaining_attempts).toBe(2);

      const second = await initiateUpload(buildRequest({ file_name: `${uniqueName('retry')}.jpg` }));
      expect((second.body as UploadInitiatedResponse).remaining_attempts).toBe(1);

      const third = await initiateUpload(buildRequest({ file_name: `${uniqueName('retry')}.jpg` }));
      expect((third.body as UploadInitiatedResponse).remaining_attempts).toBe(0);
    });

    it('blocks uploads after the third attempt for the same document type', async () => {
      await initiateUpload(buildRequest());
      await initiateUpload(buildRequest({ file_name: `${uniqueName('retry')}.jpg` }));
      await initiateUpload(buildRequest({ file_name: `${uniqueName('retry')}.jpg` }));

      const fourth = await initiateUpload(buildRequest({ file_name: `${uniqueName('retry')}.jpg` }));

      expect(fourth.status).toBe(429);
      const body = fourth.body as ErrorResponse;
      expect(body.code).toBe('MAX_ATTEMPTS_REACHED');
      expect(body.attempts_allowed).toBe(3);
      expect(body.manual_review_required).toBe(true);
      expect(body.estimated_manual_review_time_hours).toBe(48);
      expect(body.retry_after_seconds).toBe(300);
    });
  });

  describe('Processing Lifecycle', () => {
    it('queues large or PDF uploads for async processing', async () => {
      const response = await initiateUpload(
        buildRequest({
          document_type: 'passport',
          file_name: `${uniqueName('passport')}.pdf`,
          file_size: 5_200_000,
          mime_type: 'application/pdf',
        }),
      );

      expect(response.status).toBe(202);
      const body = response.body as UploadQueuedResponse;
      expect(body.status).toBe('processing');
      expect(body.estimated_completion_minutes).toBe(90);
      expect(body.next_status_check_after_seconds).toBe(300);
      expect(body.remaining_attempts).toBe(2);

      const stored = await ctx.integration.services.kycService.getDocument(body.document_id);
      expect(stored.status).toBe('processing');
    });

    it('captures audit trail metadata when provided', async () => {
      const response = await initiateUpload(
        buildRequest({
          document_type: 'driving_license',
          file_name: `${uniqueName('dl')}.jpg`,
          device_metadata: {
            platform: 'Android',
            device_model: 'Pixel 8',
            app_version: '2.0.1',
          },
          geo_location: {
            latitude: -1.286389,
            longitude: 36.817223,
          },
        }),
      );

      expect(response.status).toBe(201);
      const body = response.body as UploadInitiatedResponse;
      expect(body.audit_trail).toBeDefined();
      expect(body.audit_trail?.ip_address).toBeTruthy();
      expect(body.audit_trail?.device_platform).toBe('Android');
      expect(body.audit_trail?.geo_location).toMatchObject({
        latitude: -1.286389,
        longitude: 36.817223,
      });
    });
  });

  describe('Error Handling', () => {
    it('requires authentication', async () => {
      const response = await initiateUpload(buildRequest(), { authenticated: false });

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    it('returns validation errors when required fields are missing', async () => {
      const response = await ctx.executeAsUser(ctx.routes.kyc.initiateUpload, { body: {} });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toContain('document_type is required');
    });
  });
});
