import { SupabaseClient } from '@supabase/supabase-js';

import { RoundUpRule, RoundUpRuleRow, fromRow, toRow } from '../models/RoundUpRule';
import { UUID } from '../models/base';
import { RoundUpRuleRepository } from '../services/types';

export class SupabaseRoundUpRuleRepository implements RoundUpRuleRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: UUID): Promise<RoundUpRule | null> {
    const { data, error } = await this.client
      .from('round_up_rules')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find round-up rule: ${error.message}`);
    }

    return data ? fromRow(data as RoundUpRuleRow) : null;
  }

  async save(rule: RoundUpRule): Promise<RoundUpRule> {
    const row = toRow(rule);
    const { data, error } = await this.client
      .from('round_up_rules')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save round-up rule: ${error.message}`);
    }

    return fromRow(data as RoundUpRuleRow);
  }
}
