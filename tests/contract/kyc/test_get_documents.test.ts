import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

type DocumentStatus = 'uploaded' | 'processing' | 'approved' | 'rejected';

interface ExtractedDataPayload {
  fullName?: string | null;
  idNumber?: string | null;
  dateOfBirth?: Date | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
}

interface DocumentSummary {
  document_id: string;
  document_type: string;
  status: DocumentStatus;
  uploaded_at: string;
  processed_at: string | null;
  verification_notes: string | null;
  secure_download_url: string;
  expires_in_seconds: number;
  extracted_data: {
    full_name: string | null;
    id_number: string | null;
    date_of_birth: string | null;
    issue_date: string | null;
    expiry_date: string | null;
  } | null;
  next_allowed_upload_at: string | null;
  remaining_retries: number;
}

interface ListDocumentsResponse {
  documents: DocumentSummary[];
  review_estimate_minutes: number;
  remaining_attempts: Record<string, number>;
  kyc_status: string;
}

interface ErrorResponse {
  error: string;
  code: string;
  [key: string]: unknown;
}

const defaultFile = () => `front_${randomUUID()}.jpg`;

describe('GET /kyc/documents Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  const seedDocument = async (options: {
    documentType?: 'national_id' | 'passport' | 'driving_license' | 'selfie';
    status?: DocumentStatus;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    verificationNotes?: string | null;
    extractedData?: ExtractedDataPayload | null;
  }) => {
    const document = await ctx.integration.services.kycService.uploadDocument({
      userId: ctx.userId,
      documentType: options.documentType ?? 'national_id',
      filePath: `kyc/${ctx.userId}/${randomUUID()}/${options.fileName ?? defaultFile()}`,
      fileName: options.fileName ?? defaultFile(),
      fileSize: options.fileSize ?? 1_200_000,
      mimeType: options.mimeType ?? 'image/jpeg',
      encrypted: true,
      accessHash: randomUUID().replace(/-/g, ''),
    });

    if (options.status && options.status !== 'uploaded') {
      await ctx.integration.services.kycService.updateStatus({
        documentId: document.id,
        status: options.status,
        verificationNotes: options.verificationNotes ?? null,
        extractedData: options.extractedData ?? null,
      });
    }

    return ctx.integration.services.kycService.getDocument(document.id);
  };

  const listDocuments = (query: Record<string, string | undefined> = {}) =>
    ctx.executeAsUser(ctx.routes.kyc.listDocuments, { query });

  describe('Successful Retrieval', () => {
    it('returns submitted documents with secure download metadata', async () => {
      const approved = await seedDocument({
        documentType: 'national_id',
        status: 'approved',
        extractedData: {
          fullName: 'Sarah Wambui',
          idNumber: '12345678',
          dateOfBirth: new Date('2002-02-14'),
        },
      });
      const processing = await seedDocument({ documentType: 'selfie', status: 'processing' });

      const response = await listDocuments();

      expect(response.status).toBe(200);
      const body = response.body as ListDocumentsResponse;
      expect(body.review_estimate_minutes).toBe(120);
      expect(body.kyc_status).toBe('pending');
      expect(body.documents).toHaveLength(2);
      expect(body.remaining_attempts).toMatchObject({
        national_id: expect.any(Number),
        selfie: expect.any(Number),
        passport: expect.any(Number),
        driving_license: expect.any(Number),
      });

      const approvedSummary = body.documents.find((doc) => doc.document_id === approved.id)!;
      expect(approvedSummary.status).toBe('approved');
      expect(approvedSummary.secure_download_url).toMatch(/^https:\/\/storage\.supabase\.io\//);
      expect(approvedSummary.secure_download_url).toContain('signed=true');
      expect(approvedSummary.expires_in_seconds).toBe(600);
      expect(approvedSummary.extracted_data).toEqual({
        full_name: 'Sarah Wambui',
        id_number: '12345678',
        date_of_birth: '2002-02-14',
        issue_date: null,
        expiry_date: null,
      });

      const selfieSummary = body.documents.find((doc) => doc.document_id === processing.id)!;
      expect(selfieSummary.status).toBe('processing');
      expect(selfieSummary.extracted_data).toBeNull();
    });

    it('includes rejection feedback and retry window for rejected documents', async () => {
      const rejected = await seedDocument({
        documentType: 'passport',
        status: 'rejected',
        verificationNotes: 'Document image was blurry',
      });

      const response = await listDocuments();

      expect(response.status).toBe(200);
      const body = response.body as ListDocumentsResponse;
      const summary = body.documents.find((doc) => doc.document_id === rejected.id)!;
      expect(summary.status).toBe('rejected');
      expect(summary.verification_notes).toBe('Document image was blurry');
      expect(summary.next_allowed_upload_at).toBeTruthy();
      expect(new Date(summary.next_allowed_upload_at ?? '').getTime()).toBeGreaterThanOrEqual(rejected.uploadedAt.getTime());
      expect(summary.remaining_retries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Filtering', () => {
    it('filters by document status', async () => {
      const approved = await seedDocument({ documentType: 'national_id', status: 'approved' });
      await seedDocument({ documentType: 'selfie', status: 'processing' });

      const response = await listDocuments({ status: 'approved' });

      expect(response.status).toBe(200);
      const body = response.body as ListDocumentsResponse;
      expect(body.documents).toHaveLength(1);
      const [onlyDoc] = body.documents;
      expect(onlyDoc).toBeDefined();
      if (!onlyDoc) {
        throw new Error('Expected filtered document to be present');
      }
      expect(onlyDoc.document_id).toBe(approved.id);
      expect(onlyDoc.status).toBe('approved');
    });

    it('filters by document type', async () => {
      await seedDocument({ documentType: 'national_id', status: 'approved' });
      const selfie = await seedDocument({ documentType: 'selfie', status: 'processing' });

      const response = await listDocuments({ document_type: 'selfie' });

      expect(response.status).toBe(200);
      const body = response.body as ListDocumentsResponse;
      expect(body.documents).toHaveLength(1);
      const [selfieDoc] = body.documents;
      expect(selfieDoc).toBeDefined();
      if (!selfieDoc) {
        throw new Error('Expected selfie document to be present');
      }
      expect(selfieDoc.document_id).toBe(selfie.id);
      expect(selfieDoc.document_type).toBe('selfie');
    });
  });

  describe('Attempt Tracking & Status Aggregation', () => {
    const initiateUpload = (document_type: 'national_id' | 'passport' | 'driving_license' | 'selfie') =>
      ctx.executeAsUser(ctx.routes.kyc.initiateUpload, {
        body: {
          document_type,
          file_name: `${document_type}_${randomUUID()}.jpg`,
          file_size: 1_000_000,
          mime_type: 'image/jpeg',
        },
      });

    it('reflects remaining attempts for each document type', async () => {
      await initiateUpload('selfie');
      await initiateUpload('selfie');

      const response = await listDocuments();

      expect(response.status).toBe(200);
      const body = response.body as ListDocumentsResponse;
      expect(body.remaining_attempts.selfie).toBe(1);
      expect(body.remaining_attempts.national_id).toBe(3);
    });

    it('reports overall KYC status as approved when all documents are approved', async () => {
      const nationalId = await seedDocument({ documentType: 'national_id', status: 'approved' });
      const selfie = await seedDocument({ documentType: 'selfie', status: 'approved' });
      expect(nationalId.status).toBe('approved');
      expect(selfie.status).toBe('approved');

      const response = await listDocuments();

      expect(response.status).toBe(200);
      const body = response.body as ListDocumentsResponse;
      expect(body.kyc_status).toBe('approved');
    });
  });

  describe('Empty and Error States', () => {
    it('returns an empty array when no documents exist', async () => {
      const response = await listDocuments();

      expect(response.status).toBe(200);
      const body = response.body as ListDocumentsResponse;
      expect(body.documents).toHaveLength(0);
      expect(body.kyc_status).toBe('not_started');
    });

    it('requires authentication', async () => {
      const response = await ctx.execute(ctx.routes.kyc.listDocuments);

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponse;
      expect(body.code).toBe('AUTH_REQUIRED');
    });
  });
});
