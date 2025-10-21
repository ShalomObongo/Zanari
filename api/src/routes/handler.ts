/**
 * Helper to execute a route handler and standardize error responses.
 */

import { ValidationError } from '../models/base';
import { HttpError, fromValidationError, unauthorized } from './errors';
import { HttpRequest, HttpResponse, RouteHandler } from './types';

interface ErrorBody {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

export async function executeRoute<TResponse>(
  handler: RouteHandler<HttpRequest, TResponse>,
  request: HttpRequest,
): Promise<HttpResponse<TResponse | ErrorBody>> {
  try {
    return await handler(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return {
        status: error.status,
        body: {
          error: error.message,
          code: error.code,
          ...(error.details ?? {}),
        },
      };
    }

    if (error instanceof ValidationError) {
      const httpError = fromValidationError(error);
      return {
        status: httpError.status,
        body: {
          error: httpError.message,
          code: httpError.code,
          ...(httpError.details ?? {}),
        },
      };
    }

    console.error('Unhandled route error', error);
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      },
    };
  }
}

export function ensureAuthenticated<T extends HttpRequest>(request: T): asserts request is T & { userId: string } {
  if (!request.userId) {
    throw unauthorized('Authentication required', 'AUTH_REQUIRED');
  }
}
