/**
 * KYC document domain model for identity verification artifacts.
 */

import { UUID, TimestampedEntity, assert } from './base';

export type KYCDocumentType = 'national_id' | 'passport' | 'driving_license' | 'selfie';
export type KYCDocumentStatus = 'uploaded' | 'processing' | 'approved' | 'rejected';

export interface ExtractedData {
  fullName?: string | null;
  idNumber?: string | null;
  dateOfBirth?: Date | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
}

export interface KYCDocument extends TimestampedEntity {
  id: UUID;
  userId: UUID;
  documentType: KYCDocumentType;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: KYCDocumentStatus;
  verificationNotes?: string | null;
  encrypted: boolean;
  accessHash: string;
  uploadedAt: Date;
  processedAt?: Date | null;
  expiresAt?: Date | null;
  extractedData?: ExtractedData | null;
}

export interface KYCDocumentRow {
  id: string;
  user_id: string;
  document_type: KYCDocumentType;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: KYCDocumentStatus;
  verification_notes?: string | null;
  encrypted: boolean;
  access_hash: string;
  uploaded_at: string;
  processed_at?: string | null;
  expires_at?: string | null;
  extracted_data?: {
    full_name?: string | null;
    id_number?: string | null;
    date_of_birth?: string | null;
    issue_date?: string | null;
    expiry_date?: string | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface CreateKYCDocumentInput {
  id: UUID;
  userId: UUID;
  documentType: KYCDocumentType;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  encrypted: boolean;
  accessHash: string;
  expiresAt?: Date | null;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

function validateExtractedData(data: ExtractedData | null | undefined): void {
  if (!data) return;
  // No-op: date validations handled at ingestion time
}

export function validateKYCDocument(document: KYCDocument): void {
  assert(document.filePath.length > 0, 'File path required');
  assert(document.fileName.length > 0, 'File name required');
  assert(document.fileSize > 0 && document.fileSize <= MAX_FILE_SIZE_BYTES, 'File size must be between 0 and 10MB', 'INVALID_FILE_SIZE');
  assert(ALLOWED_MIME_TYPES.has(document.mimeType), `Unsupported MIME type: ${document.mimeType}`, 'INVALID_MIME_TYPE');
  assert(document.accessHash.length >= 16, 'accessHash must be secure');
  validateExtractedData(document.extractedData ?? null);
}

export function createKYCDocument(input: CreateKYCDocumentInput): KYCDocument {
  const now = new Date();
  const document: KYCDocument = {
    id: input.id,
    userId: input.userId,
    documentType: input.documentType,
    filePath: input.filePath,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    status: 'uploaded',
    verificationNotes: null,
    encrypted: input.encrypted,
    accessHash: input.accessHash,
    uploadedAt: now,
    processedAt: null,
    expiresAt: input.expiresAt ?? null,
    extractedData: null,
    createdAt: now,
    updatedAt: now,
  };

  validateKYCDocument(document);
  return document;
}

export function fromRow(row: KYCDocumentRow): KYCDocument {
  const document: KYCDocument = {
    id: row.id,
    userId: row.user_id,
    documentType: row.document_type,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    status: row.status,
    verificationNotes: row.verification_notes ?? null,
    encrypted: row.encrypted,
    accessHash: row.access_hash,
    uploadedAt: new Date(row.uploaded_at),
    processedAt: row.processed_at ? new Date(row.processed_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    extractedData: row.extracted_data
      ? {
          fullName: row.extracted_data.full_name ?? null,
          idNumber: row.extracted_data.id_number ?? null,
          dateOfBirth: row.extracted_data.date_of_birth ? new Date(row.extracted_data.date_of_birth) : null,
          issueDate: row.extracted_data.issue_date ? new Date(row.extracted_data.issue_date) : null,
          expiryDate: row.extracted_data.expiry_date ? new Date(row.extracted_data.expiry_date) : null,
        }
      : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  validateKYCDocument(document);
  return document;
}

export function toRow(document: KYCDocument): KYCDocumentRow {
  validateKYCDocument(document);

  return {
    id: document.id,
    user_id: document.userId,
    document_type: document.documentType,
    file_path: document.filePath,
    file_name: document.fileName,
    file_size: document.fileSize,
    mime_type: document.mimeType,
    status: document.status,
    verification_notes: document.verificationNotes ?? null,
    encrypted: document.encrypted,
    access_hash: document.accessHash,
    uploaded_at: document.uploadedAt.toISOString(),
    processed_at: document.processedAt ? document.processedAt.toISOString() : null,
    expires_at: document.expiresAt ? document.expiresAt.toISOString() : null,
    extracted_data: document.extractedData
      ? {
          full_name: document.extractedData.fullName ?? null,
          id_number: document.extractedData.idNumber ?? null,
          date_of_birth: document.extractedData.dateOfBirth
            ? document.extractedData.dateOfBirth.toISOString().split('T')[0]
            : null,
          issue_date: document.extractedData.issueDate ? document.extractedData.issueDate.toISOString().split('T')[0] : null,
          expiry_date: document.extractedData.expiryDate ? document.extractedData.expiryDate.toISOString().split('T')[0] : null,
        }
      : null,
    created_at: document.createdAt.toISOString(),
    updated_at: document.updatedAt.toISOString(),
  };
}
