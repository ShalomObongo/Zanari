/**
 * User domain model aligned with Supabase schema.
 */

import { UUID, TimestampedEntity, assert } from './base';

export type KYCStatus = 'not_started' | 'pending' | 'approved' | 'rejected';
export type UserStatus = 'active' | 'suspended' | 'closed';

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  transactionAlerts: boolean;
  savingsMilestones: boolean;
}

export interface User extends TimestampedEntity {
  id: UUID;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | null;
  kycStatus: KYCStatus;
  kycSubmittedAt?: Date | null;
  kycApprovedAt?: Date | null;
  notificationPreferences: NotificationPreferences;
  pinHash?: string | null;
  pinSetAt?: Date | null;
  failedPinAttempts: number;
  lastFailedAttemptAt?: Date | null;
  status: UserStatus;
}

export interface UserRow {
  id: string;
  email: string;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  kyc_status: KYCStatus;
  kyc_submitted_at?: string | null;
  kyc_approved_at?: string | null;
  notification_preferences: {
    push_enabled: boolean;
    email_enabled: boolean;
    transaction_alerts: boolean;
    savings_milestones: boolean;
  };
  pin_hash?: string | null;
  pin_set_at?: string | null;
  failed_pin_attempts: number;
  last_failed_attempt_at?: string | null;
  status: UserStatus;
}

export interface CreateUserInput {
  id: UUID;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  dateOfBirth?: Date | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KENYAN_PHONE_REGEX = /^254[0-9]{9}$/;

export function validateNotificationPreferences(prefs: NotificationPreferences): void {
  assert(typeof prefs.pushEnabled === 'boolean', 'pushEnabled must be boolean');
  assert(typeof prefs.emailEnabled === 'boolean', 'emailEnabled must be boolean');
  assert(typeof prefs.transactionAlerts === 'boolean', 'transactionAlerts must be boolean');
  assert(typeof prefs.savingsMilestones === 'boolean', 'savingsMilestones must be boolean');
}

export function createDefaultNotificationPreferences(): NotificationPreferences {
  return {
    pushEnabled: true,
    emailEnabled: true,
    transactionAlerts: true,
    savingsMilestones: true,
  };
}

export function createUser(input: CreateUserInput): User {
  assert(EMAIL_REGEX.test(input.email), 'Invalid email format', 'INVALID_EMAIL');
  if (input.phone) {
    assert(KENYAN_PHONE_REGEX.test(input.phone), 'Phone must be Kenyan MSISDN (254XXXXXXXXX)', 'INVALID_PHONE');
  }

  const now = new Date();
  const notificationPreferences = createDefaultNotificationPreferences();

  const user: User = {
    id: input.id,
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    dateOfBirth: input.dateOfBirth ?? null,
    kycStatus: 'not_started',
    notificationPreferences,
    pinHash: null,
    pinSetAt: null,
    failedPinAttempts: 0,
    lastFailedAttemptAt: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  validateUser(user);
  return user;
}

export function validateUser(user: User): void {
  assert(EMAIL_REGEX.test(user.email), 'Invalid email format', 'INVALID_EMAIL');
  if (user.phone) {
    assert(KENYAN_PHONE_REGEX.test(user.phone), 'Invalid Kenyan phone number', 'INVALID_PHONE');
  }
  assert(user.firstName.length > 0 && user.firstName.length <= 50, 'First name must be 1-50 characters');
  assert(user.lastName.length > 0 && user.lastName.length <= 50, 'Last name must be 1-50 characters');
  if (user.pinHash) {
    assert(user.pinHash.length >= 32, 'PIN hash must be stored securely');
  }
  assert(user.failedPinAttempts >= 0, 'Failed attempts cannot be negative');
  validateNotificationPreferences(user.notificationPreferences);
}

export function fromRow(row: UserRow): User {
  const user: User = {
    id: row.id,
    email: row.email,
    phone: row.phone ?? null,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
    kycStatus: row.kyc_status,
    kycSubmittedAt: row.kyc_submitted_at ? new Date(row.kyc_submitted_at) : null,
    kycApprovedAt: row.kyc_approved_at ? new Date(row.kyc_approved_at) : null,
    notificationPreferences: {
      pushEnabled: row.notification_preferences.push_enabled,
      emailEnabled: row.notification_preferences.email_enabled,
      transactionAlerts: row.notification_preferences.transaction_alerts,
      savingsMilestones: row.notification_preferences.savings_milestones,
    },
    pinHash: row.pin_hash ?? null,
    pinSetAt: row.pin_set_at ? new Date(row.pin_set_at) : null,
    failedPinAttempts: row.failed_pin_attempts,
    lastFailedAttemptAt: row.last_failed_attempt_at ? new Date(row.last_failed_attempt_at) : null,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };

  validateUser(user);
  return user;
}

export function toRow(user: User): UserRow {
  validateUser(user);

  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
    first_name: user.firstName,
    last_name: user.lastName,
    date_of_birth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null,
    kyc_status: user.kycStatus,
    kyc_submitted_at: user.kycSubmittedAt ? user.kycSubmittedAt.toISOString() : null,
    kyc_approved_at: user.kycApprovedAt ? user.kycApprovedAt.toISOString() : null,
    notification_preferences: {
      push_enabled: user.notificationPreferences.pushEnabled,
      email_enabled: user.notificationPreferences.emailEnabled,
      transaction_alerts: user.notificationPreferences.transactionAlerts,
      savings_milestones: user.notificationPreferences.savingsMilestones,
    },
    pin_hash: user.pinHash ?? null,
    pin_set_at: user.pinSetAt ? user.pinSetAt.toISOString() : null,
    failed_pin_attempts: user.failedPinAttempts,
    last_failed_attempt_at: user.lastFailedAttemptAt ? user.lastFailedAttemptAt.toISOString() : null,
    status: user.status,
  };
}
