import { SupabaseClient } from '@supabase/supabase-js';

import { SavingsGoal, SavingsGoalRow, fromRow, toRow } from '../models/SavingsGoal';
import { UUID } from '../models/base';
import { SavingsGoalRepository } from '../services/types';

export class SupabaseSavingsGoalRepository implements SavingsGoalRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(goal: SavingsGoal): Promise<SavingsGoal> {
    const row = toRow(goal);
    const { data, error } = await this.client
      .from('savings_goals')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save savings goal: ${error.message}`);
    }

    return fromRow(data as SavingsGoalRow);
  }

  async listByUser(userId: UUID): Promise<SavingsGoal[]> {
    const { data, error } = await this.client
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list savings goals: ${error.message}`);
    }

    return (data as SavingsGoalRow[]).map(fromRow);
  }

  async findActiveByUser(userId: UUID): Promise<SavingsGoal[]> {
    const { data, error } = await this.client
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to find active savings goals: ${error.message}`);
    }

    return (data as SavingsGoalRow[]).map(fromRow);
  }

  async findById(goalId: UUID): Promise<SavingsGoal | null> {
    const { data, error } = await this.client
      .from('savings_goals')
      .select('*')
      .eq('id', goalId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find savings goal by id: ${error.message}`);
    }

    return data ? fromRow(data as SavingsGoalRow) : null;
  }

  async delete(goalId: UUID): Promise<void> {
    const { error } = await this.client
      .from('savings_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      throw new Error(`Failed to delete savings goal: ${error.message}`);
    }
  }
}
