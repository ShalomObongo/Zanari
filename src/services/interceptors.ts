import type { ApiError, HttpMethod, RequestOptions } from './api';

type UnknownRecord = Record<string, unknown>;

type MutableRequestOptions<TBody = unknown> = RequestOptions<TBody> & {
  metadata?: UnknownRecord;
};

export interface RequestContext<TBody = unknown> {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: RequestInit['body'];
  options: MutableRequestOptions<TBody>;
  metadata: UnknownRecord;
}

export interface ResponseContext<TBody = unknown, TResponse = unknown> {
  request: RequestContext<TBody>;
  response: Response | null;
  payload: TResponse | null;
  durationMs: number;
  metadata: UnknownRecord;
  error?: ApiError | Error;
}

export type RequestInterceptor = <TBody>(context: RequestContext<TBody>) => Promise<void> | void;
export type ResponseInterceptor = <TBody, TResponse>(context: ResponseContext<TBody, TResponse>) => Promise<void> | void;
export type ErrorInterceptor = (error: ApiError | Error, context: ResponseContext) => Promise<ApiError | Error | void> | ApiError | Error | void;

const requestInterceptors = new Set<RequestInterceptor>();
const responseInterceptors = new Set<ResponseInterceptor>();
const errorInterceptors = new Set<ErrorInterceptor>();

const now = (): number => {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
};

const toHeaderKey = (key: string) => key.toLowerCase();

const findHeaderKey = (headers: Record<string, string>, targetKey: string): string | undefined => {
  const lowerTarget = toHeaderKey(targetKey);
  return Object.keys(headers).find((key) => toHeaderKey(key) === lowerTarget);
};

const setHeader = (headers: Record<string, string>, key: string, value: string) => {
  const existingKey = findHeaderKey(headers, key);
  if (existingKey) {
    headers[existingKey] = value;
  } else {
    headers[key] = value;
  }
};

const getHeaderValue = (headers: Record<string, string>, key: string): string | undefined => {
  const resolvedKey = findHeaderKey(headers, key);
  return resolvedKey ? headers[resolvedKey] : undefined;
};

const generateToken = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

const MUTATING_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let defaultsRegistered = false;

export const createRequestContext = <TBody>(
  method: HttpMethod,
  url: string,
  options: RequestOptions<TBody>,
  headers: Record<string, string>,
  body?: RequestInit['body'],
): RequestContext<TBody> => ({
  method,
  url,
  headers,
  body,
  options: { ...options },
  metadata: {},
});

export const createResponseContext = <TBody, TResponse>(request: RequestContext<TBody>): ResponseContext<TBody, TResponse> => ({
  request,
  response: null,
  payload: null,
  durationMs: 0,
  metadata: request.metadata,
});

export const addRequestInterceptor = (interceptor: RequestInterceptor): (() => void) => {
  requestInterceptors.add(interceptor);
  return () => {
    requestInterceptors.delete(interceptor);
  };
};

export const addResponseInterceptor = (interceptor: ResponseInterceptor): (() => void) => {
  responseInterceptors.add(interceptor);
  return () => {
    responseInterceptors.delete(interceptor);
  };
};

export const addErrorInterceptor = (interceptor: ErrorInterceptor): (() => void) => {
  errorInterceptors.add(interceptor);
  return () => {
    errorInterceptors.delete(interceptor);
  };
};

export const runRequestInterceptors = async <TBody>(context: RequestContext<TBody>): Promise<RequestContext<TBody>> => {
  for (const interceptor of requestInterceptors) {
    // eslint-disable-next-line no-await-in-loop
    await interceptor(context);
  }
  return context;
};

export const runResponseInterceptors = async <TBody, TResponse>(
  context: ResponseContext<TBody, TResponse>,
): Promise<ResponseContext<TBody, TResponse>> => {
  for (const interceptor of responseInterceptors) {
    // eslint-disable-next-line no-await-in-loop
    await interceptor(context);
  }
  return context;
};

export const runErrorInterceptors = async (error: ApiError | Error, context: ResponseContext): Promise<ApiError | Error> => {
  let currentError: ApiError | Error = error;

  for (const interceptor of errorInterceptors) {
    // eslint-disable-next-line no-await-in-loop
    const maybeNext = await interceptor(currentError, context);
    if (maybeNext instanceof Error) {
      currentError = maybeNext;
    }
  }

  return currentError;
};

export const clearInterceptors = () => {
  requestInterceptors.clear();
  responseInterceptors.clear();
  errorInterceptors.clear();
  defaultsRegistered = false;
};

const correlationIdInterceptor: RequestInterceptor = (context) => {
  if (!context.metadata.startedAt) {
    context.metadata.startedAt = now();
  }

  const existing = getHeaderValue(context.headers, 'X-Request-Id');
  const requestId = existing ?? `req-${generateToken()}`;
  setHeader(context.headers, 'X-Request-Id', requestId);
  context.metadata.requestId = requestId;
};

const idempotencyKeyInterceptor: RequestInterceptor = (context) => {
  if (!MUTATING_METHODS.has(context.method)) {
    return;
  }

  const existing = getHeaderValue(context.headers, 'Idempotency-Key') ?? getHeaderValue(context.headers, 'X-Idempotency-Key');
  if (existing) {
    context.metadata.idempotencyKey = existing;
    return;
  }

  const key = `idem-${generateToken()}`;
  setHeader(context.headers, 'Idempotency-Key', key);
  context.metadata.idempotencyKey = key;
};

const requestTimingInterceptor: RequestInterceptor = (context) => {
  context.metadata.startedAt = context.metadata.startedAt ?? now();
};

const responseTimingInterceptor: ResponseInterceptor = (context) => {
  if (!context.durationMs) {
    const startedAt = typeof context.metadata.startedAt === 'number' ? context.metadata.startedAt : now();
    context.durationMs = Math.max(0, now() - startedAt);
  }

  if (__DEV__) {
    const status = context.response?.status ?? (context.error && 'status' in context.error ? (context.error as { status?: number }).status ?? 'ERR' : 'ERR');
    // eslint-disable-next-line no-console
    console.debug(`%c[API] ${context.request.method} ${context.request.url} → ${String(status)} (${Math.round(context.durationMs)}ms)`, 'color:#0A84FF');
  } else if (context.durationMs > 2000) {
    const status = context.response?.status ?? 'N/A';
    // eslint-disable-next-line no-console
    console.warn(`[API] Slow response ${context.request.method} ${context.request.url} (${Math.round(context.durationMs)}ms, status ${status})`);
  }
};

const errorLoggingInterceptor: ErrorInterceptor = (error, context) => {
  const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : undefined;
  const shouldLog = __DEV__ || (typeof status === 'number' && status >= 500);

  if (!shouldLog) {
    return error;
  }

  const requestId = context.request.metadata.requestId;
  const suffix = status ? ` (status ${status})` : '';
  // eslint-disable-next-line no-console
  console.warn(`[API] ${context.request.method} ${context.request.url}${suffix} failed: ${error.message}`, {
    requestId,
  });

  return error;
};

export const ensureDefaultInterceptors = () => {
  if (defaultsRegistered) {
    return;
  }

  addRequestInterceptor(requestTimingInterceptor);
  addRequestInterceptor(correlationIdInterceptor);
  addRequestInterceptor(idempotencyKeyInterceptor);
  addResponseInterceptor(responseTimingInterceptor);
  addErrorInterceptor(errorLoggingInterceptor);

  defaultsRegistered = true;
};

export const getHeaderUtilitiesForTesting = () => ({
  findHeaderKey,
  setHeader,
  getHeaderValue,
});
