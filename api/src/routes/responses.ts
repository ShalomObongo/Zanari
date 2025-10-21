/**
 * Response helpers to keep handlers concise.
 */

import { HttpResponse } from './types';

export function ok<T>(body: T, headers?: Record<string, string>): HttpResponse<T> {
  return { status: 200, body, headers };
}

export function created<T>(body: T, headers?: Record<string, string>): HttpResponse<T> {
  return { status: 201, body, headers };
}

export function noContent(headers?: Record<string, string>): HttpResponse<undefined> {
  return { status: 204, body: undefined, headers };
}
