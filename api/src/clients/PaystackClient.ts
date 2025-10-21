import { Logger, NullLogger, PaystackClient } from '../services/types';

type FetchFn = typeof fetch;

export interface PaystackClientOptions {
  secretKey: string;
  baseUrl?: string;
  logger?: Logger;
  fetchImpl?: FetchFn;
}

interface PaystackApiResponse<TData = unknown> {
  status: boolean;
  message: string;
  data: TData;
}

export class PaystackApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string | undefined,
    public readonly requestId: string | undefined,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = 'PaystackApiError';
  }
}

const resolveFetch = (provided?: FetchFn): FetchFn => {
  if (provided) {
    return provided;
  }

  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch implementation not found. Provide a fetch implementation in PaystackClientOptions.');
  }

  return globalThis.fetch.bind(globalThis);
};

export class HttpPaystackClient implements PaystackClient {
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchFn;
  private readonly logger: Logger;

  constructor(options: PaystackClientOptions) {
    if (!options.secretKey) {
      throw new Error('Paystack secret key is required to initialise HttpPaystackClient');
    }

    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl?.replace(/\/$/, '') ?? 'https://api.paystack.co';
    this.logger = options.logger ?? NullLogger;
    this.fetch = resolveFetch(options.fetchImpl);
  }

  private async request<TData>(path: string, init?: RequestInit & { skipSuccessCheck?: boolean }): Promise<TData> {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const requestId = response.headers.get('x-request-id') ?? response.headers.get('request-id') ?? undefined;

    let body: PaystackApiResponse<TData> | undefined;
    try {
      body = (await response.json()) as PaystackApiResponse<TData>;
    } catch (error) {
      this.logger.error('Failed to parse Paystack response JSON', { path, status: response.status });
      throw new PaystackApiError('Unable to parse Paystack response', response.status, undefined, requestId, undefined);
    }

    if (!response.ok || (!init?.skipSuccessCheck && body?.status === false)) {
      const code = (body?.data as Record<string, unknown> | undefined)?.['code'];
      throw new PaystackApiError(body?.message ?? 'Paystack request failed', response.status, typeof code === 'string' ? code : undefined, requestId, body);
    }

    return body!.data;
  }

  async initializeTransaction(payload: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
    channels?: string[];
  }): Promise<{
    authorizationUrl: string;
    accessCode: string;
    reference: string;
    status: 'success' | 'pending';
    expiresAt?: Date;
    raw: Record<string, unknown>;
  }> {
    const data = await this.request<{
      authorization_url: string;
      access_code: string;
      reference: string;
      status?: string;
      expires_at?: string;
      [key: string]: unknown;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: payload.email,
        amount: payload.amount,
        reference: payload.reference,
        currency: payload.currency,
        callback_url: payload.callbackUrl,
        metadata: payload.metadata,
        channels: payload.channels,
      }),
    });

    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference,
      status: (data.status as 'success' | 'pending' | undefined) ?? 'pending',
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      raw: data as Record<string, unknown>,
    };
  }

  async verifyTransaction(reference: string): Promise<{
    status: 'success' | 'failed' | 'abandoned';
    amount: number;
    currency: string;
    paidAt?: Date;
    channel?: string | null;
    fees?: number | null;
    metadata?: Record<string, unknown>;
    raw: Record<string, unknown>;
  }> {
    const data = await this.request<{
      status: 'success' | 'failed' | 'abandoned';
      amount: number;
      currency: string;
      paid_at?: string;
      channel?: string | null;
      fees?: number | null;
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    }>(`/transaction/verify/${reference}`, { method: 'GET' });

    return {
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      channel: data.channel ?? null,
      fees: data.fees ?? null,
      metadata: data.metadata,
      raw: data as Record<string, unknown>,
    };
  }

  async createTransferRecipient(payload: {
    type: 'mobile_money' | 'nuban';
    name: string;
    accountNumber: string;
    bankCode: string;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    recipientCode: string;
    raw: Record<string, unknown>;
  }> {
    const data = await this.request<{
      recipient_code: string;
      [key: string]: unknown;
    }>('/transferrecipient', {
      method: 'POST',
      body: JSON.stringify({
        type: payload.type,
        name: payload.name,
        account_number: payload.accountNumber,
        bank_code: payload.bankCode,
        currency: payload.currency,
        metadata: payload.metadata,
      }),
    });

    return {
      recipientCode: data.recipient_code,
      raw: data as Record<string, unknown>,
    };
  }

  async initiateTransfer(payload: {
    amount: number;
    recipient: string;
    reference: string;
    reason?: string;
    currency: string;
    source?: 'balance';
  }): Promise<{
    status: 'success' | 'pending' | 'failed';
    transferCode: string;
    reference: string;
    raw: Record<string, unknown>;
  }> {
    const data = await this.request<{
      status: 'success' | 'pending' | 'failed';
      transfer_code: string;
      reference: string;
      [key: string]: unknown;
    }>('/transfer', {
      method: 'POST',
      body: JSON.stringify({
        source: payload.source ?? 'balance',
        amount: payload.amount,
        recipient: payload.recipient,
        reference: payload.reference,
        reason: payload.reason,
        currency: payload.currency,
      }),
    });

    return {
      status: data.status,
      transferCode: data.transfer_code,
      reference: data.reference,
      raw: data as Record<string, unknown>,
    };
  }

  async verifyTransfer(reference: string): Promise<{
    status: 'success' | 'failed' | 'pending' | 'reversed';
    transferCode: string;
    raw: Record<string, unknown>;
  }> {
    const data = await this.request<{
      status: 'success' | 'failed' | 'pending' | 'reversed';
      transfer_code: string;
      [key: string]: unknown;
    }>(`/transfer/verify/${reference}`, { method: 'GET' });

    return {
      status: data.status,
      transferCode: data.transfer_code,
      raw: data as Record<string, unknown>,
    };
  }
}

export type { PaystackClient };
