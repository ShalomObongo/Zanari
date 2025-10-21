import { RateLimiter } from './types';

interface RateRecord {
  remaining: number;
  resetAt: number;
}

const DEFAULT_LIMIT = 5;
const DEFAULT_DURATION_SECONDS = 60;

export class InMemoryRateLimiter implements RateLimiter {
  private readonly records = new Map<string, RateRecord>();
  private readonly limit: number;

  constructor(limit = DEFAULT_LIMIT) {
    this.limit = limit;
  }

  async consume(
    key: string,
    options?: {
      points?: number;
      durationSeconds?: number;
    },
  ): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const now = Date.now();
    const durationMs = (options?.durationSeconds ?? DEFAULT_DURATION_SECONDS) * 1000;
    const weight = options?.points ?? 1;

    const record = this.records.get(key);

    if (!record || record.resetAt <= now) {
      this.records.set(key, {
        remaining: Math.max(this.limit - weight, 0),
        resetAt: now + durationMs,
      });
      return { allowed: true };
    }

    if (record.remaining < weight) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    record.remaining -= weight;
    return { allowed: true };
  }
}
