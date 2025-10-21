import { SupabaseClient } from '@supabase/supabase-js';

import { User, UserRow, fromRow, toRow } from '../models/User';
import { UUID } from '../models/base';
import { UserRepository } from '../services/types';

export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(user: User): Promise<User> {
    const row = toRow(user);
    const { data, error } = await this.client
      .from('users')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return fromRow(data);
  }

  async findById(userId: UUID): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user by id: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase();
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find user by phone: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  async update(userId: UUID, update: Partial<User>): Promise<User> {
    const patch = this.mapUpdate(update);
    const updatedAt = update.updatedAt ?? new Date();
    patch.updated_at = updatedAt.toISOString();

    const { data, error } = await this.client
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return fromRow(data);
  }

  private mapUpdate(update: Partial<User>): Partial<UserRow> {
    const patch: Partial<UserRow> = {};

    if (update.email !== undefined) {
      patch.email = update.email.toLowerCase();
    }
    if (update.phone !== undefined) {
      patch.phone = update.phone ?? null;
    }
    if (update.firstName !== undefined) {
      patch.first_name = update.firstName;
    }
    if (update.lastName !== undefined) {
      patch.last_name = update.lastName;
    }
    if (update.dateOfBirth !== undefined) {
      patch.date_of_birth = update.dateOfBirth ? update.dateOfBirth.toISOString().split('T')[0] : null;
    }
    if (update.kycStatus !== undefined) {
      patch.kyc_status = update.kycStatus;
    }
    if (update.kycSubmittedAt !== undefined) {
      patch.kyc_submitted_at = update.kycSubmittedAt ? update.kycSubmittedAt.toISOString() : null;
    }
    if (update.kycApprovedAt !== undefined) {
      patch.kyc_approved_at = update.kycApprovedAt ? update.kycApprovedAt.toISOString() : null;
    }
    if (update.notificationPreferences !== undefined) {
      const prefs = update.notificationPreferences;
      patch.notification_preferences = {
        push_enabled: prefs.pushEnabled,
        email_enabled: prefs.emailEnabled,
        transaction_alerts: prefs.transactionAlerts,
        savings_milestones: prefs.savingsMilestones,
      };
    }
    if (update.pinHash !== undefined) {
      patch.pin_hash = update.pinHash ?? null;
    }
    if (update.pinSetAt !== undefined) {
      patch.pin_set_at = update.pinSetAt ? update.pinSetAt.toISOString() : null;
    }
    if (update.failedPinAttempts !== undefined) {
      patch.failed_pin_attempts = update.failedPinAttempts;
    }
    if (update.lastFailedAttemptAt !== undefined) {
      patch.last_failed_attempt_at = update.lastFailedAttemptAt ? update.lastFailedAttemptAt.toISOString() : null;
    }
    if (update.status !== undefined) {
      patch.status = update.status;
    }

    return patch;
  }
}
