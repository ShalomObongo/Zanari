/**
 * Shared validation utilities for API routes to keep handlers focused on orchestration.
 */

import { ValidationError } from '../models/base';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const KENYAN_PHONE_REGEX = /^254[0-9]{9}$/;

export function requireString(value: unknown, message: string, code = 'INVALID_INPUT'): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(message, code);
  }
  return value.trim();
}

export function requireNumber(value: unknown, message: string, code = 'INVALID_INPUT'): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(message, code);
  }
  return value;
}

export function requireInteger(value: unknown, message: string, code = 'INVALID_INPUT'): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(message, code);
  }
  return value;
}

export function ensureRange(value: number, { min, max, code, message }: { min?: number; max?: number; code?: string; message?: string }): number {
  if (typeof min === 'number' && value < min) {
    throw new ValidationError(message ?? `Value must be >= ${min}`, code ?? 'VALUE_TOO_LOW');
  }
  if (typeof max === 'number' && value > max) {
    throw new ValidationError(message ?? `Value must be <= ${max}`, code ?? 'VALUE_TOO_HIGH');
  }
  return value;
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new ValidationError('Invalid email format', 'INVALID_EMAIL');
  }
  return normalized;
}

export function normalizeKenyanPhone(phone: string): string {
  const normalized = phone.trim();
  if (!KENYAN_PHONE_REGEX.test(normalized)) {
    throw new ValidationError('Invalid Kenyan phone number format', 'INVALID_PHONE');
  }
  return normalized;
}

export function parsePagination(query: { limit?: string; offset?: string }): { limit: number; offset: number } {
  const limit = clamp(parseOptionalInt(query.limit, 20), 1, 100);
  const offset = Math.max(0, parseOptionalInt(query.offset, 0));
  return { limit, offset };
}

function parseOptionalInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
