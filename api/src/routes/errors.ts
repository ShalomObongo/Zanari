/**
 * Route-level HTTP error helpers for consistent responses.
 */

import { ValidationError } from '../models/base';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, message: string, code = 'HTTP_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'HttpError';
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST', details?: Record<string, unknown>): HttpError {
  return new HttpError(400, message, code, details);
}

export function unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): HttpError {
  return new HttpError(401, message, code);
}

export function forbidden(message = 'Forbidden', code = 'FORBIDDEN'): HttpError {
  return new HttpError(403, message, code);
}

export function notFound(message = 'Not Found', code = 'NOT_FOUND'): HttpError {
  return new HttpError(404, message, code);
}

export function conflict(message = 'Conflict', code = 'CONFLICT'): HttpError {
  return new HttpError(409, message, code);
}

export function tooManyRequests(message = 'Too Many Requests', retryAfterSeconds?: number): HttpError {
  return new HttpError(429, message, 'RATE_LIMIT_EXCEEDED', retryAfterSeconds ? { retry_after: retryAfterSeconds } : undefined);
}

export function fromValidationError(error: ValidationError, status = 400): HttpError {
  return new HttpError(status, error.message, error.code ?? 'VALIDATION_ERROR');
}
