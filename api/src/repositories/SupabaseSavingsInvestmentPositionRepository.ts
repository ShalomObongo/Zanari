import { SupabaseClient } from '@supabase/supabase-js';

import { SavingsInvestmentPosition, SavingsInvestmentPositionRow, fromRow, toRow } from '../models/SavingsInvestmentPosition';
import { UUID } from '../models/base';
import { SavingsInvestmentPositionRepository } from '../services/types';

export class SupabaseSavingsInvestmentPositionRepository implements SavingsInvestmentPositionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: UUID): Promise<SavingsInvestmentPosition | null> {
    const { data, error } = await this.client
      .from('savings_investment_positions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load savings investment position: ${error.message}`);
    }

    return data ? fromRow(data as SavingsInvestmentPositionRow) : null;
  }

  async findAllUserIds(): Promise<UUID[]> {
    const { data, error } = await this.client
      .from('savings_investment_positions')
      .select('user_id');

    if (error) {
      throw new Error(`Failed to load investment user IDs: ${error.message}`);
    }

    return (data || []).map((row) => row.user_id as UUID);
  }

  async save(position: SavingsInvestmentPosition): Promise<SavingsInvestmentPosition> {
    const row = toRow(position);
    const { data, error } = await this.client
      .from('savings_investment_positions')
      .upsert(row, { onConflict: 'user_id,product_code' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save savings investment position: ${error.message}`);
    }

    return fromRow(data as SavingsInvestmentPositionRow);
  }
}
