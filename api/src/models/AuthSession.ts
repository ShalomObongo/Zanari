/**
 * AuthSession domain model captures OTP-based authentication sessions.
 */

import { randomBytes } from 'node:crypto';

import { TimestampedEntity, UUID, assert } from './base';

const DIGIT_OTP_REGEX = /^[0-9]{6}$/;
const SUPABASE_OTP_PREFIX = 'supabase:';

export const SUPABASE_EMAIL_OTP_CODE = `${SUPABASE_OTP_PREFIX}email`;

export function isSupabaseOtpCode(value: string): boolean {
  return value.startsWith(SUPABASE_OTP_PREFIX);
}

export interface AuthSession extends TimestampedEntity {
  id: string;
  userId: UUID | null;
  email: string | null;
  phone: string | null;
  otpCode: string;
  expiresAt: Date;
  verifiedAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
}

export interface CreateAuthSessionInput {
  userId: UUID | null;
  email: string | null;
  phone: string | null;
  otpCode: string;
  ttlSeconds: number;
  maxAttempts?: number;
}

export function createAuthSession(input: CreateAuthSessionInput): AuthSession {
  assert(Boolean(input.email) !== Boolean(input.phone), 'Provide either email or phone for session', 'INVALID_CONTACT');
  assert(
    isSupabaseOtpCode(input.otpCode) || DIGIT_OTP_REGEX.test(input.otpCode),
    'OTP code must be 6 digits or Supabase-managed',
    'INVALID_OTP',
  );
  assert(input.ttlSeconds > 0, 'TTL must be positive');

  const now = new Date();
  const session: AuthSession = {
    id: generateSessionId(),
    userId: input.userId,
    email: input.email,
    phone: input.phone,
    otpCode: input.otpCode,
    expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
    verifiedAt: null,
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 5,
    createdAt: now,
    updatedAt: now,
  };

  validateAuthSession(session);
  return session;
}

export function validateAuthSession(session: AuthSession): void {
  assert(session.id.startsWith('sess_'), 'Session id must have sess_ prefix', 'INVALID_SESSION_ID');
  assert(session.userId === null || typeof session.userId === 'string', 'User id must be null or UUID');
  assert(Boolean(session.email) !== Boolean(session.phone), 'Session must target exactly one contact', 'INVALID_CONTACT');
  assert(session.attemptCount >= 0, 'Attempt count cannot be negative');
  assert(
    isSupabaseOtpCode(session.otpCode) || DIGIT_OTP_REGEX.test(session.otpCode),
    'OTP code must be 6 digits or Supabase-managed',
    'INVALID_OTP',
  );
  assert(session.maxAttempts > 0 && Number.isInteger(session.maxAttempts), 'maxAttempts must be positive integer');
  assert(session.expiresAt instanceof Date, 'expiresAt must be a Date');
  assert(session.createdAt instanceof Date, 'createdAt must be a Date');
  assert(session.updatedAt instanceof Date, 'updatedAt must be a Date');
}

export function generateOtpCode(): string {
  const buffer = randomBytes(3); // 24 bits -> < 0xffffff
  const code = buffer.readUIntBE(0, 3) % 1_000_000;
  return code.toString().padStart(6, '0');
}

function generateSessionId(): string {
  return `sess_${randomBytes(12).toString('hex')}`;
}
