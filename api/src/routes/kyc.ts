/**
 * KYC document route handlers for retrieval and upload initialization.
 */

import { randomUUID } from 'node:crypto';

import { ValidationError } from '../models/base';
import { KYCDocument, KYCDocumentType } from '../models/KYCDocument';
import { KYCService } from '../services/KYCService';
import { Clock, Logger, NullLogger, SystemClock } from '../services/types';
import { HttpError, badRequest, fromValidationError } from './errors';
import { ensureAuthenticated } from './handler';
import { created, ok } from './responses';
import { HttpRequest } from './types';

interface GetDocumentsQuery extends Record<string, string | undefined> {
  status?: string;
  document_type?: string;
}

interface DeviceMetadata {
  platform?: string;
  app_version?: string;
  device_model?: string;
}

interface GeoLocation {
  latitude?: number;
  longitude?: number;
}

interface UploadDocumentBody {
  document_type?: KYCDocumentType;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  checksum?: string;
  device_metadata?: DeviceMetadata;
  geo_location?: GeoLocation;
}

export interface KYCRouteDependencies {
  kycService: KYCService;
  clock?: Clock;
  logger?: Logger;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_SIZE_BYTES = 10_000_000;
const SIGNED_URL_TTL_SECONDS = 600;
const MAX_ATTEMPTS_PER_TYPE = 3;
const MANUAL_REVIEW_DELAY_HOURS = 48;
const REVIEW_ESTIMATE_MINUTES = 120;
const STATUS_POLL_SECONDS = 300;

const DOC_TYPES: KYCDocumentType[] = ['national_id', 'passport', 'driving_license', 'selfie'];

type AttemptRecord = {
  attempts: number;
  lastAttemptAt: Date | null;
  blockedUntil: Date | null;
};

const attemptStore = new Map<string, Map<KYCDocumentType, AttemptRecord>>();

export function createKYCRoutes({
  kycService,
  clock = new SystemClock(),
  logger = NullLogger,
}: KYCRouteDependencies) {
  return {
    listDocuments: async (
      request: HttpRequest<unknown, Record<string, string>, GetDocumentsQuery>,
    ) => {
      ensureAuthenticated(request);

      const statusFilters = parseStatuses(request.query.status);
      const typeFilter = request.query.document_type?.trim().toLowerCase() ?? null;
      const now = clock.now();

      const documents = await kycService.listDocuments(request.userId);
      const filteredDocuments = documents.filter((doc) => {
        if (statusFilters && !statusFilters.has(doc.status)) {
          return false;
        }
        if (typeFilter && doc.documentType !== typeFilter) {
          return false;
        }
        return true;
      });

      const attemptMap = ensureAttemptTracker(request.userId);
      const serializedDocuments = filteredDocuments.map((doc) =>
        serializeDocument(doc, attemptMap.get(doc.documentType), now),
      );

      const remainingAttempts = buildRemainingAttempts(attemptMap);
      const response = {
        documents: serializedDocuments,
        review_estimate_minutes: REVIEW_ESTIMATE_MINUTES,
        remaining_attempts: remainingAttempts,
        kyc_status: determineKycStatus(documents),
      };

      return ok(response);
    },

    initiateUpload: async (request: HttpRequest<UploadDocumentBody>) => {
      ensureAuthenticated(request);
      const parsed = parseUploadBody(request.body);
      const now = clock.now();

      const tracker = ensureAttemptTracker(request.userId);
      const record = ensureAttemptRecord(tracker, parsed.documentType);

      if (record.blockedUntil && record.blockedUntil > now) {
        throw buildAttemptsExceededError();
      }
      if (record.attempts >= MAX_ATTEMPTS_PER_TYPE) {
        record.blockedUntil = addHours(now, MANUAL_REVIEW_DELAY_HOURS);
        throw buildAttemptsExceededError();
      }

      const existingDocs = await kycService.listDocuments(request.userId);
      const approvedDuplicate = existingDocs.find(
        (doc) => doc.documentType === parsed.documentType && doc.status === 'approved',
      );
      if (approvedDuplicate) {
        throw new HttpError(409, 'Document type already approved', 'DOCUMENT_TYPE_LOCKED', {
          existing_document_id: approvedDuplicate.id,
        });
      }

      const uploadId = `upload_${parsed.documentType}_${randomUUID().slice(0, 8)}`;
      const documentId = `kyc_${parsed.documentType}_${randomUUID()}`;
      const filePath = `kyc/${request.userId}/${documentId}/${parsed.fileName}`;

      try {
        const createdDoc = await kycService.uploadDocument({
          userId: request.userId,
          documentType: parsed.documentType,
          filePath,
          fileName: parsed.fileName,
          fileSize: parsed.fileSize,
          mimeType: parsed.mimeType,
          encrypted: true,
          accessHash: randomUUID().replace(/-/g, ''),
        });

        record.attempts += 1;
        record.lastAttemptAt = now;

        const remainingAttempts = Math.max(0, MAX_ATTEMPTS_PER_TYPE - record.attempts);
        const requiresPairing = parsed.documentType === 'selfie';

        const ipHeader = request.headers['x-forwarded-for'] ?? request.headers['x-real-ip'];
        const auditTrail = buildAuditTrail(ipHeader, parsed.deviceMetadata, parsed.geoLocation);
        const uploadUrl = createSignedUploadUrl(request.userId, documentId, parsed.fileName);

        const shouldQueue = parsed.mimeType === 'application/pdf' || parsed.fileSize > 4_000_000;
        if (shouldQueue) {
          await kycService.updateStatus({ documentId: createdDoc.id, status: 'processing' });
          return {
            status: 202,
            body: {
              upload_id: uploadId,
              document_id: createdDoc.id,
              signed_upload_url: uploadUrl,
              upload_headers: {
                'x-upsert': 'true',
                'Content-Type': parsed.mimeType,
              },
              status: 'processing' as const,
              queued_at: now.toISOString(),
              estimated_completion_minutes: 90,
              next_status_check_after_seconds: STATUS_POLL_SECONDS,
              remaining_attempts: remainingAttempts,
              manual_review_threshold: MAX_ATTEMPTS_PER_TYPE,
              ...(auditTrail ? { audit_trail: auditTrail } : {}),
            },
          };
        }

        const responseBody: Record<string, unknown> = {
          upload_id: uploadId,
          document_id: createdDoc.id,
          signed_upload_url: uploadUrl,
          upload_headers: {
            'x-upsert': 'true',
            'Content-Type': parsed.mimeType,
          },
          max_bytes: MAX_FILE_SIZE_BYTES,
          expires_in_seconds: SIGNED_URL_TTL_SECONDS,
          encryption_required: true,
          status: 'pending_upload',
          remaining_attempts: remainingAttempts,
          manual_review_threshold: MAX_ATTEMPTS_PER_TYPE,
        };

        if (requiresPairing) {
          responseBody.required_pairing = 'national_id';
        }
        if (auditTrail) {
          responseBody.audit_trail = auditTrail;
        }

        logger.info('KYC upload initiated', {
          userId: request.userId,
          documentType: parsed.documentType,
        });

        return created(responseBody);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },
  };
}

function parseStatuses(raw: string | undefined) {
  if (!raw) {
    return null;
  }
  const statuses = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return statuses.length > 0 ? new Set(statuses) : null;
}

function parseUploadBody(body: UploadDocumentBody | undefined) {
  if (!body) {
    throw badRequest('Request body is required', 'VALIDATION_ERROR');
  }

  const { document_type: documentType, file_name: fileName, file_size: fileSize, mime_type: mimeType } = body;

  if (!documentType) {
    throw badRequest('document_type is required', 'VALIDATION_ERROR');
  }
  if (!DOC_TYPES.includes(documentType)) {
    throw badRequest('document_type must be one of national_id, passport, driving_license, selfie', 'INVALID_DOCUMENT_TYPE');
  }
  if (!fileName || fileName.trim().length === 0) {
    throw badRequest('file_name is required', 'VALIDATION_ERROR');
  }
  if (typeof fileSize !== 'number' || !Number.isInteger(fileSize) || fileSize <= 0) {
    throw badRequest('file_size must be a positive integer', 'INVALID_FILE_SIZE');
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw badRequest('File size exceeds 10MB limit', 'FILE_TOO_LARGE', {
      max_bytes: MAX_FILE_SIZE_BYTES,
    });
  }
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw badRequest('Unsupported MIME type', 'UNSUPPORTED_MIME_TYPE', {
      allowed_mime_types: Array.from(ALLOWED_MIME_TYPES),
    });
  }

  return {
    documentType,
    fileName: fileName.trim(),
    fileSize,
    mimeType,
    deviceMetadata: body.device_metadata ?? null,
    geoLocation: body.geo_location ?? null,
  };
}

function ensureAttemptTracker(userId: string) {
  if (!attemptStore.has(userId)) {
    attemptStore.set(userId, new Map());
  }
  return attemptStore.get(userId)!;
}

function ensureAttemptRecord(
  tracker: Map<KYCDocumentType, AttemptRecord>,
  type: KYCDocumentType,
): AttemptRecord {
  if (!tracker.has(type)) {
    tracker.set(type, {
      attempts: 0,
      lastAttemptAt: null,
      blockedUntil: null,
    });
  }
  return tracker.get(type)!;
}

function buildRemainingAttempts(tracker: Map<KYCDocumentType, AttemptRecord>) {
  const remaining: Record<string, number> = {};
  for (const type of DOC_TYPES) {
    const record = tracker.get(type);
    const attempts = record?.attempts ?? 0;
    remaining[type] = Math.max(0, MAX_ATTEMPTS_PER_TYPE - attempts);
  }
  return remaining;
}

function serializeDocument(document: KYCDocument, attempts: AttemptRecord | undefined, now: Date) {
  const remainingRetries = Math.max(0, MAX_ATTEMPTS_PER_TYPE - (attempts?.attempts ?? 0));
  const blockedUntil = attempts?.blockedUntil ?? (document.status === 'rejected' ? addHours(document.processedAt ?? now, MANUAL_REVIEW_DELAY_HOURS) : null);

  return {
    document_id: document.id,
    document_type: document.documentType,
    file_name: document.fileName,
    file_size: document.fileSize,
    status: document.status,
    uploaded_at: document.uploadedAt.toISOString(),
    processed_at: document.processedAt ? document.processedAt.toISOString() : null,
    verification_notes: document.verificationNotes ?? null,
    secure_download_url: createSignedDownloadUrl(document),
    expires_in_seconds: SIGNED_URL_TTL_SECONDS,
    extracted_data: serializeExtractedData(document),
    next_allowed_upload_at: blockedUntil ? blockedUntil.toISOString() : null,
    remaining_retries: remainingRetries,
  };
}

function serializeExtractedData(document: KYCDocument) {
  if (!document.extractedData) {
    return null;
  }
  return {
    full_name: document.extractedData.fullName ?? null,
    id_number: document.extractedData.idNumber ?? null,
    date_of_birth: document.extractedData.dateOfBirth ? formatDate(document.extractedData.dateOfBirth) : null,
    issue_date: document.extractedData.issueDate ? formatDate(document.extractedData.issueDate) : null,
    expiry_date: document.extractedData.expiryDate ? formatDate(document.extractedData.expiryDate) : null,
  };
}

function determineKycStatus(documents: KYCDocument[]) {
  if (documents.length === 0) {
    return 'not_started';
  }
  if (documents.some((doc) => doc.status === 'rejected')) {
    return 'rejected';
  }
  if (documents.every((doc) => doc.status === 'approved')) {
    return 'approved';
  }
  return 'pending';
}

function buildAuditTrail(ip: string | undefined, device: DeviceMetadata | null, geo: GeoLocation | null) {
  if (!device && !geo) {
    return null;
  }

  const audit: Record<string, unknown> = {
    ip_address: ip ?? '127.0.0.1',
  };

  if (device) {
    audit.device_platform = device.platform ?? null;
    audit.device_model = device.device_model ?? null;
    audit.app_version = device.app_version ?? null;
  }

  if (geo) {
    audit.geo_location = {
      latitude: geo.latitude ?? null,
      longitude: geo.longitude ?? null,
    };
  }

  return audit;
}

function createSignedDownloadUrl(document: KYCDocument) {
  const token = randomUUID().replace(/-/g, '');
  return `https://storage.supabase.io/kyc/${document.userId}/${document.id}?token=${token}&signed=true&expires=${SIGNED_URL_TTL_SECONDS}`;
}

function createSignedUploadUrl(userId: string, documentId: string, fileName: string) {
  const token = randomUUID().replace(/-/g, '');
  return `https://storage.supabase.io/kyc/uploads/${userId}/${documentId}/${encodeURIComponent(fileName)}?token=${token}&expires=${SIGNED_URL_TTL_SECONDS}`;
}

function addHours(date: Date, hours: number) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function buildAttemptsExceededError() {
  return new HttpError(429, 'Maximum attempts reached for this document type', 'MAX_ATTEMPTS_REACHED', {
    attempts_allowed: MAX_ATTEMPTS_PER_TYPE,
    manual_review_required: true,
    estimated_manual_review_time_hours: MANUAL_REVIEW_DELAY_HOURS,
    retry_after_seconds: STATUS_POLL_SECONDS,
  });
}
