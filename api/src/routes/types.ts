/**
 * Lightweight HTTP abstractions used by route handlers so they remain framework-agnostic.
 */

import { UUID } from '../models/base';

export interface HttpRequest<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
> {
  body: TBody;
  params: TParams;
  query: TQuery;
  headers: Record<string, string | undefined>;
  userId?: UUID;
}

export interface HttpResponse<T = unknown> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export type RouteHandler<TRequest extends HttpRequest = HttpRequest, TResponse = unknown> = (
  request: TRequest,
) => Promise<HttpResponse<TResponse>>;

export type AuthenticatedRequest<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
> = HttpRequest<TBody, TParams, TQuery> & { userId: UUID };
