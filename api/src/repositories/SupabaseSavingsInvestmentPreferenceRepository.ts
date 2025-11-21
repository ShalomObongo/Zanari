import { SupabaseClient } from '@supabase/supabase-js';

import { SavingsInvestmentPreference, SavingsInvestmentPreferenceRow, fromRow, createDefaultPreference, toRow } from '../models/SavingsInvestmentPreference';
import { UUID } from '../models/base';
import { SavingsInvestmentPreferenceRepository } from '../services/types';

export class SupabaseSavingsInvestmentPreferenceRepository implements SavingsInvestmentPreferenceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByUserId(userId: UUID): Promise<SavingsInvestmentPreference | null> {
    const { data, error } = await this.client
      .from('savings_investment_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load savings investment preference: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return fromRow(data as SavingsInvestmentPreferenceRow, userId);
  }

  async save(preference: SavingsInvestmentPreference): Promise<SavingsInvestmentPreference> {
    const row = toRow(preference);
    const { data, error } = await this.client
      .from('savings_investment_preferences')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save savings investment preference: ${error.message}`);
    }

    return fromRow(data as SavingsInvestmentPreferenceRow, preference.userId);
  }

  async getOrCreateDefault(userId: UUID): Promise<SavingsInvestmentPreference> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const preference = createDefaultPreference(userId);
    return this.save(preference);
  }
}
