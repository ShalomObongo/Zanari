import { SupabaseClient } from '@supabase/supabase-js';

import { AuthSession } from '../models/AuthSession';
import { UUID } from '../models/base';
import { AuthSessionRepository } from '../services/types';

interface AuthSessionRow {
  id: string;
  user_id: UUID | null;
  email: string | null;
  phone: string | null;
  otp_code: string;
  expires_at: string;
  verified_at: string | null;
  attempt_count: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

function toRow(session: AuthSession): AuthSessionRow {
  return {
    id: session.id,
    user_id: session.userId,
    email: session.email,
    phone: session.phone,
    otp_code: session.otpCode,
    expires_at: session.expiresAt.toISOString(),
    verified_at: session.verifiedAt ? session.verifiedAt.toISOString() : null,
    attempt_count: session.attemptCount,
    max_attempts: session.maxAttempts,
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
  };
}

function fromRow(row: AuthSessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    phone: row.phone,
    otpCode: row.otp_code,
    expiresAt: new Date(row.expires_at),
    verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SupabaseAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(session: AuthSession): Promise<AuthSession> {
    const row = toRow(session);
    const { data, error } = await this.client
      .from('auth_sessions')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create auth session: ${error.message}`);
    }

    return fromRow(data as AuthSessionRow);
  }

  async findById(sessionId: string): Promise<AuthSession | null> {
    const { data, error } = await this.client
      .from('auth_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find auth session: ${error.message}`);
    }

    return data ? fromRow(data as AuthSessionRow) : null;
  }

  async save(session: AuthSession): Promise<AuthSession> {
    const row = toRow(session);
    const { id, ...updateRow } = row;

    const { data, error } = await this.client
      .from('auth_sessions')
      .update(updateRow)
      .eq('id', session.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save auth session: ${error.message}`);
    }

    return fromRow(data as AuthSessionRow);
  }

  async delete(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('auth_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to delete auth session: ${error.message}`);
    }
  }
}
