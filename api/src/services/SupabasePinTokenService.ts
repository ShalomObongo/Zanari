import { SupabaseClient } from '@supabase/supabase-js';

import { UUID } from '../models/base';
import { PinTokenService } from './types';

interface PinTokenRow {
  token: string;
  user_id: UUID;
  expires_at: string;
  created_at: string;
}

export class SupabasePinTokenService implements PinTokenService {
  constructor(private readonly client: SupabaseClient) {}

  async issue(userId: UUID, token: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const row: PinTokenRow = {
      token,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    };

    const { error } = await this.client
      .from('pin_tokens')
      .upsert(row, { onConflict: 'token' });

    if (error) {
      throw new Error(`Failed to issue PIN token: ${error.message}`);
    }
  }

  async validate(userId: UUID, token: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('pin_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate PIN token: ${error.message}`);
    }

    if (!data) {
      return false;
    }

    const row = data as PinTokenRow;
    if (row.user_id !== userId) {
      return false;
    }

    const expiresAt = new Date(row.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      await this.invalidate(token);
      return false;
    }

    return true;
  }

  async invalidate(token: string): Promise<void> {
    const { error } = await this.client
      .from('pin_tokens')
      .delete()
      .eq('token', token);

    if (error) {
      throw new Error(`Failed to invalidate PIN token: ${error.message}`);
    }
  }
}
