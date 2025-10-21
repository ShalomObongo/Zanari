import { SupabaseClient } from '@supabase/supabase-js';

import { KYCDocument, KYCDocumentRow, toRow, fromRow } from '../models/KYCDocument';
import { UUID } from '../models/base';
import { KYCDocumentRepository } from '../services/types';

export class SupabaseKYCDocumentRepository implements KYCDocumentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(document: KYCDocument): Promise<KYCDocument> {
    const row = toRow(document);
    const { data, error } = await this.client
      .from('kyc_documents')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create KYC document: ${error.message}`);
    }

    return fromRow(data as KYCDocumentRow);
  }

  async update(document: KYCDocument): Promise<KYCDocument> {
    const row = toRow(document);
    const { id, ...updateRow } = row;

    const { data, error } = await this.client
      .from('kyc_documents')
      .update(updateRow)
      .eq('id', document.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update KYC document: ${error.message}`);
    }

    return fromRow(data as KYCDocumentRow);
  }

  async findByUserAndType(userId: UUID, type: KYCDocument['documentType']): Promise<KYCDocument | null> {
    const { data, error } = await this.client
      .from('kyc_documents')
      .select('*')
      .eq('user_id', userId)
      .eq('document_type', type)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find KYC document by type: ${error.message}`);
    }

    return data ? fromRow(data as KYCDocumentRow) : null;
  }

  async findById(documentId: UUID): Promise<KYCDocument | null> {
    const { data, error } = await this.client
      .from('kyc_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find KYC document by id: ${error.message}`);
    }

    return data ? fromRow(data as KYCDocumentRow) : null;
  }

  async listByUser(userId: UUID): Promise<KYCDocument[]> {
    const { data, error } = await this.client
      .from('kyc_documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list KYC documents: ${error.message}`);
    }

    return (data as KYCDocumentRow[]).map(fromRow);
  }
}
