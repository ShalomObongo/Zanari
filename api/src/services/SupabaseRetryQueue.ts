import { SupabaseClient } from '@supabase/supabase-js';

import { RetryQueue } from './types';

interface RetryJobRow {
  id: string;
  run_at: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export class SupabaseRetryQueue implements RetryQueue {
  constructor(private readonly client: SupabaseClient) {}

  async enqueue(job: { id: string; runAt: Date; payload: Record<string, unknown> }): Promise<void> {
    const row: RetryJobRow = {
      id: job.id,
      run_at: job.runAt.toISOString(),
      payload: job.payload,
      created_at: new Date().toISOString(),
    };

    const { error } = await this.client
      .from('retry_jobs')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to enqueue retry job: ${error.message}`);
    }
  }
}
