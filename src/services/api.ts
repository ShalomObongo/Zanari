import { Platform } from 'react-native';
import {
  createRequestContext,
  createResponseContext,
  ensureDefaultInterceptors,
  runErrorInterceptors,
  runRequestInterceptors,
  runResponseInterceptors,
} from './interceptors';

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  code?: string;
  details?: Record<string, unknown> | null;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown> | null;

  constructor(status: number, message: string, code?: string, details?: Record<string, unknown> | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  body?: TBody;
  searchParams?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeoutMs?: number;
  skipAuth?: boolean;
}

export interface ApiClientConfig {
  baseUrl?: string;
  defaultTimeoutMs?: number;
}

type UnauthorizedHandler = () => void;

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Resolve platform-specific loopback address for local development
 * - Android emulator: 10.0.2.2 (host machine's localhost)
 * - iOS simulator & others: 127.0.0.1 (localhost)
 * - Production: use EXPO_PUBLIC_API_URL from env
 */
const resolveApiBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.API_BASE_URL;
  
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  
  // Default local development URL with platform-specific loopback
  const loopback = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
  return `http://${loopback}:3000`;
};

const API_BASE_URL = resolveApiBaseUrl();

const buildQueryString = (params?: RequestOptions['searchParams']): string => {
  if (!params) return '';

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.append(key, String(value));
  });

  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } catch (error) {
    if ((error as DOMException).name === 'AbortError') {
      throw new ApiError(408, 'Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private accessToken: string | null = null;
  private unauthorizedHandler: UnauthorizedHandler | null = null;

  constructor(config?: ApiClientConfig) {
    this.baseUrl = (config?.baseUrl ?? API_BASE_URL).replace(/\/$/, '');
    this.defaultTimeout = config?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  public setUnauthorizedHandler(handler: UnauthorizedHandler) {
    this.unauthorizedHandler = handler;
  }

  public clearUnauthorizedHandler() {
    this.unauthorizedHandler = null;
  }

  public async request<TResponse, TBody = unknown>(method: HttpMethod, path: string, options?: RequestOptions<TBody>): Promise<TResponse> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const requestOptions: RequestOptions<TBody> = {
      ...(options ?? {}),
    };

    const url = `${this.baseUrl}${normalizedPath}${buildQueryString(requestOptions.searchParams)}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Client-Platform': Platform.OS,
      'X-Client-Version': String(Platform.Version ?? 'unknown'),
      ...requestOptions.headers,
    };

    if (!requestOptions.skipAuth && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let body: RequestInit['body'];
    if (requestOptions.body !== undefined) {
      body = headers['Content-Type'] === 'application/json' ? JSON.stringify(requestOptions.body) : (requestOptions.body as RequestInit['body']);
    }

    const requestContext = createRequestContext(method, url, requestOptions, { ...headers }, body);
    await runRequestInterceptors(requestContext);

    const timeout = requestContext.options.timeoutMs ?? this.defaultTimeout;

    const finalHeaders = requestContext.headers;
    const finalInit: RequestInit = {
      method,
      headers: finalHeaders,
    };

    let finalBody = requestContext.body;

    const contentTypeHeaderKey = Object.keys(finalHeaders).find((key) => key.toLowerCase() === 'content-type');
    const requestContentType = contentTypeHeaderKey ? finalHeaders[contentTypeHeaderKey] : undefined;

    const shouldStringifyBody =
      finalBody !== undefined &&
      finalBody !== null &&
      typeof finalBody !== 'string' &&
      !(finalBody instanceof FormData) &&
      !(finalBody instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(finalBody as ArrayBufferView) &&
      (requestContentType?.includes('application/json') ?? false);

    if (shouldStringifyBody) {
      finalBody = JSON.stringify(finalBody);
    }

    if (finalBody !== undefined) {
      finalInit.body = finalBody;
    }

    const responseContext = createResponseContext<TBody, TResponse>(requestContext);
    const startedAt = typeof requestContext.metadata.startedAt === 'number' ? requestContext.metadata.startedAt : Date.now();

    try {
      const response = await fetchWithTimeout(requestContext.url, finalInit, timeout);
      responseContext.response = response;

      if (response.status === 204) {
        responseContext.payload = undefined as unknown as TResponse;
        responseContext.durationMs = Date.now() - startedAt;
        await runResponseInterceptors(responseContext);
        return responseContext.payload as TResponse;
      }

      const contentType = response.headers.get('Content-Type');
      let payload: unknown = null;

      if (contentType && contentType.includes('application/json')) {
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }
      } else {
        payload = await response.text();
      }

      responseContext.payload = payload as TResponse;

      if (!response.ok) {
        if (response.status === 401 && this.unauthorizedHandler) {
          this.unauthorizedHandler();
        }

        let apiError: ApiError;
        if (payload && typeof payload === 'object') {
          const { error, message, code, details } = payload as ApiErrorPayload;
          apiError = new ApiError(response.status, message || error || 'Unexpected API error', code, details ?? null);
        } else {
          apiError = new ApiError(response.status, typeof payload === 'string' && payload ? payload : 'Unexpected API error');
        }

        responseContext.error = apiError;
        responseContext.durationMs = Date.now() - startedAt;
        const interceptedError = await runErrorInterceptors(apiError, responseContext);
        throw interceptedError ?? apiError;
      }

      responseContext.durationMs = Date.now() - startedAt;
      await runResponseInterceptors(responseContext);

      return responseContext.payload as TResponse;
    } catch (error) {
      const normalizedError = error instanceof ApiError ? error : new ApiError(503, (error as Error).message || 'Network request failed');
      responseContext.error = normalizedError;
      responseContext.durationMs = Date.now() - startedAt;
      const interceptedError = await runErrorInterceptors(normalizedError, responseContext);
      throw interceptedError ?? normalizedError;
    }
  }

  public get<TResponse>(path: string, options?: RequestOptions) {
    return this.request<TResponse>('GET', path, options);
  }

  public post<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, 'body'>) {
    return this.request<TResponse, TBody>('POST', path, { ...options, body });
  }

  public put<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, 'body'>) {
    return this.request<TResponse, TBody>('PUT', path, { ...options, body });
  }

  public patch<TResponse, TBody = unknown>(path: string, body?: TBody, options?: Omit<RequestOptions<TBody>, 'body'>) {
    return this.request<TResponse, TBody>('PATCH', path, { ...options, body });
  }

  public delete<TResponse>(path: string, options?: RequestOptions) {
    return this.request<TResponse>('DELETE', path, options);
  }
}

export const apiClient = new ApiClient();

ensureDefaultInterceptors();

export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  apiClient.setUnauthorizedHandler(handler);
};

export default apiClient;
