/**
 * KYCService manages document uploads, verification status, and notifications.
 */

import { randomUUID } from 'node:crypto';

import { UUID } from '../models/base';
import {
  KYCDocument,
  KYCDocumentStatus,
  KYCDocumentType,
  createKYCDocument,
  validateKYCDocument,
} from '../models/KYCDocument';
import { Clock, KYCDocumentRepository, Logger, NullLogger, NotificationService, SystemClock } from './types';

export interface UploadDocumentInput {
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

export interface UpdateDocumentStatusInput {
  documentId: UUID;
  status: KYCDocumentStatus;
  verificationNotes?: string | null;
  extractedData?: KYCDocument['extractedData'];
}

export class KYCService {
  private readonly repository: KYCDocumentRepository;
  private readonly notificationService: NotificationService;
  private readonly clock: Clock;
  private readonly logger: Logger;

  constructor(options: {
    repository: KYCDocumentRepository;
    notificationService: NotificationService;
    clock?: Clock;
    logger?: Logger;
  }) {
    this.repository = options.repository;
    this.notificationService = options.notificationService;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
  }

  async uploadDocument(input: UploadDocumentInput): Promise<KYCDocument> {
    const existing = await this.repository.findByUserAndType(input.userId, input.documentType);
    if (existing && existing.status === 'approved') {
      throw new Error('An approved document already exists for this type');
    }

    const document = createKYCDocument({
      id: randomUUID(),
      userId: input.userId,
      documentType: input.documentType,
      filePath: input.filePath,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      encrypted: input.encrypted,
      accessHash: input.accessHash,
      expiresAt: input.expiresAt ?? null,
    });

    const saved = await this.repository.create(document);
    this.logger.info('KYC document uploaded', { userId: input.userId, type: input.documentType, documentId: saved.id });
    return saved;
  }

  async listDocuments(userId: UUID): Promise<KYCDocument[]> {
    return this.repository.listByUser(userId);
  }

  async getDocument(documentId: UUID): Promise<KYCDocument> {
    return this.requireDocument(documentId);
  }

  async updateStatus(input: UpdateDocumentStatusInput): Promise<KYCDocument> {
    const document = await this.requireDocument(input.documentId);
    const now = this.clock.now();

    const updated: KYCDocument = {
      ...document,
      status: input.status,
      verificationNotes: input.verificationNotes ?? document.verificationNotes ?? null,
      processedAt: now,
      extractedData: input.extractedData ?? document.extractedData ?? null,
      updatedAt: now,
    };

    validateKYCDocument(updated);
    const saved = await this.repository.update(updated);

    await this.notifyStatusChange(saved);
    this.logger.info('KYC document status updated', { documentId: saved.id, status: saved.status });

    return saved;
  }

  private async notifyStatusChange(document: KYCDocument): Promise<void> {
    if (document.status === 'approved') {
      await this.notificationService.notifyUser(document.userId, {
        title: 'KYC Approved',
        body: 'Your identity verification is complete. Higher limits now available.',
        data: { documentId: document.id },
      });
    } else if (document.status === 'rejected') {
      await this.notificationService.notifyUser(document.userId, {
        title: 'KYC Requires Attention',
        body: document.verificationNotes ?? 'Please resubmit your documents.',
        data: { documentId: document.id },
      });
    }
  }

  private async requireDocument(documentId: UUID): Promise<KYCDocument> {
    const document = await this.repository.findById(documentId);
    if (!document) {
      throw new Error('KYC document not found');
    }
    return document;
  }
}
