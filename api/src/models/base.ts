/**
 * Shared model utilities for Zanari API domain entities.
 */

export type UUID = string;

export interface TimestampedEntity {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDeleteEntity {
  deletedAt?: Date | null;
}

export class ValidationError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

export function assert(condition: unknown, message: string, code?: string): asserts condition {
  if (!condition) {
    throw new ValidationError(message, code);
  }
}
