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
        // Don't trigger unauthorized handler for PIN verification endpoints
        // Users are already authenticated, they're just verifying their PIN
        const isPinVerification = normalizedPath === '/auth/verify-pin';

        if (response.status === 401 && this.unauthorizedHandler && !isPinVerification) {
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


  // Savings Goals Methods
  async listSavingsGoals(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    category?: string;
    archived?: string;
    sort?: string;
  }): Promise<{
    goals: any[];
    pagination: {
      page: number;
      per_page: number;
      total_items: number;
      total_pages: number;
    };
  }> {
    return this.get('/savings-goals', { searchParams: params });
  }

  async createSavingsGoal(goal: {
    name: string;
    targetAmount: number;
    category?: string;
    description?: string;
    targetDate?: string;
    roundUpEnabled?: boolean;
  }): Promise<any> {
    return this.post('/savings-goals', goal);
  }

  async updateSavingsGoal(goalId: string, updates: {
    name?: string;
    targetAmount?: number;
    category?: string;
    description?: string;
    targetDate?: string;
    status?: string;
  }): Promise<any> {
    return this.put(`/savings-goals/${goalId}`, updates);
  }

  async depositToSavingsGoal(
    goalId: string,
    amount: number,
    sourceWallet?: 'main' | 'savings'
  ): Promise<{
    goal: any;
    milestonesReached: any[];
    completed: boolean;
  }> {
    return this.post(`/savings-goals/${goalId}/deposit`, {
      amount,
      source_wallet: sourceWallet || 'main'
    });
  }

  async deleteSavingsGoal(goalId: string): Promise<{ goal_id: string; deleted: boolean }> {
    return this.delete(`/savings-goals/${goalId}`);
  }

  async withdrawFromSavingsGoal(
    goalId: string,
    destinationWallet: 'main' | 'savings'
  ): Promise<{
    goal: any;
    amount_withdrawn: number;
    destination_wallet: string;
  }> {
    return this.post(`/savings-goals/${goalId}/withdraw`, {
      destination_wallet: destinationWallet,
    });
  }

  async cancelSavingsGoal(goalId: string): Promise<any> {
    return this.post(`/savings-goals/${goalId}/cancel`, {});
  }

  // Wallet Transfer Methods
  async transferToSavings(amount: number, pinToken: string): Promise<{
    transaction_id: string;
    amount: number;
    from_wallet: string;
    to_wallet: string;
    status: string;
  }> {
    return this.post('/wallets/transfer-to-savings', { amount, pin_token: pinToken });
  }

  async transferFromSavings(amount: number, pinToken: string): Promise<{
    transaction_id: string;
    amount: number;
    from_wallet: string;
    to_wallet: string;
    status: string;
  }> {
    return this.post('/wallets/transfer-from-savings', { amount, pin_token: pinToken });
  }

  // Payment Preview Method
  async previewTransfer(
    amount: number,
    paymentMethod: 'wallet' | 'mpesa' | 'card',
    recipientUserId: string
  ): Promise<{
    amount: number;
    fee: number;
    round_up_amount: number;
    round_up_description: string;
    total: number;
    payment_method: string;
    recipient: {
      user_id: string;
      name: string;
    };
  }> {
    return this.post('/payments/preview', {
      amount,
      payment_method: paymentMethod,
      recipient_user_id: recipientUserId,
    });
  }

  // Round-Up Rules Methods
  async getRoundUpRule(): Promise<{
    rule: {
      rule_id: string | null;
      is_enabled: boolean;
      increment_type: string;
      percentage_value?: number | null;
      target_amount: number | null;
      fixed_amount: number | null;
      auto_settings: any;
      allocation: { main_wallet_percentage: number; savings_goals_percentage: number };
    };
    usage_statistics: {
      total_round_ups_count: number;
      total_amount_saved: number;
      period_start: string;
      period_end: string;
    };
    weekly_breakdown: any[] | null;
    last_updated_at: string | null;
    is_default: boolean;
  }> {
    return this.get('/round-up-rules');
  }

  async updateRoundUpRule(updates: {
    increment_type?: '10' | '50' | '100' | 'auto' | 'percentage';
    is_enabled?: boolean;
    percentage_value?: number | null;
    auto_settings?: {
      min_increment?: number;
      max_increment?: number;
      analysis_period_days?: number;
    } | null;
    allocation?: { main: number; savings: number };
  }): Promise<{
    user_id: string;
    rules: {
      enabled: boolean;
      rule_type: string | null;
      target_amount: number | null;
      fixed_amount: number | null;
      allocation: { main_wallet_percentage: number; savings_goals_percentage: number } | null;
    };
    updated_at: string;
    auto_analysis: any;
  }> {
    return this.put('/round-up-rules', updates);
  }

  async analyzeRoundUp(params?: {
    analysis_period_days?: number;
    include_projections?: boolean;
    include_category_breakdown?: boolean;
  }): Promise<{
    user_id: string;
    analysis: any;
    recommendations: any;
    projections?: any;
    generated_at: string;
  }> {
    return this.get('/round-up-rules/auto-analysis', { searchParams: params });
  }

  // Savings Investment Methods (Phase 1)
  async getSavingsInvestmentSummary(): Promise<SavingsInvestmentSummaryResponse> {
    return this.get('/investments/savings/summary');
  }

  async updateSavingsInvestmentPreference(payload: SavingsInvestmentPreferencePayload): Promise<SavingsInvestmentSummaryResponse> {
    return this.post('/investments/savings/preferences', {
      auto_invest_enabled: payload.autoInvestEnabled,
      target_allocation_pct: payload.targetAllocationPct,
    });
  }

  async allocateSavingsInvestment(amount: number): Promise<SavingsInvestmentSummaryResponse> {
    return this.post('/investments/savings/allocate', { amount });
  }

  async redeemSavingsInvestment(amount: number): Promise<SavingsInvestmentSummaryResponse> {
    return this.post('/investments/savings/redeem', { amount });
  }

  async claimSavingsInvestmentInterest(): Promise<SavingsInvestmentSummaryResponse> {
    return this.post('/investments/savings/claim-interest', {});
  }
}

export interface SavingsInvestmentSummaryResponse {
  summary: {
    auto_invest_enabled: boolean;
    target_allocation_pct: number;
    product_code: string;
    product_name: string;
    annual_yield_bps: number;
    invested_amount: number;
    accrued_interest: number;
    projected_monthly_yield: number;
    savings_cash_balance: number;
    savings_available_balance: number;
    total_value: number;
    last_accrued_at: string | null;
  };
}

export interface SavingsInvestmentPreferencePayload {
  autoInvestEnabled?: boolean;
  targetAllocationPct?: number;
}

export const apiClient = new ApiClient();

ensureDefaultInterceptors();

export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  apiClient.setUnauthorizedHandler(handler);
};

export default apiClient;
