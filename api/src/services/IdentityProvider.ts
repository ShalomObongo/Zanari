import { randomUUID } from 'node:crypto';
import { SupabaseClient } from '@supabase/supabase-js';

import { UUID, ValidationError } from '../models/base';
import { IdentityProvider } from './types';

export class InMemoryIdentityProvider implements IdentityProvider {
  async createIdentity(_input: { email: string; phone?: string | null }): Promise<{ id: UUID }> {
    return { id: randomUUID() };
  }
}

export class SupabaseIdentityProvider implements IdentityProvider {
  constructor(private readonly client: SupabaseClient) {}

  async createIdentity(input: { email: string; phone?: string | null }): Promise<{ id: UUID }> {
    const { email, phone } = input;

    const response = await this.client.auth.admin.createUser({
      email,
      phone: phone ?? undefined,
      email_confirm: false,
      phone_confirm: false,
    });

    if (response.error) {
      const message = response.error.message ?? 'Failed to create user identity';
      if (/already registered/i.test(message)) {
        throw new ValidationError('Account already exists', 'ACCOUNT_EXISTS');
      }
      throw new Error(`Supabase identity creation failed: ${message}`);
    }

    const user = response.data.user;
    if (!user) {
      throw new Error('Supabase identity creation failed: missing user record');
    }

    return { id: user.id };
  }
}
