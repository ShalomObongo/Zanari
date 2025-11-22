import { SupabaseClient } from '@supabase/supabase-js';
import { InvestmentProduct, InvestmentProductRow, fromRow } from '../models/InvestmentProduct';

export interface InvestmentProductRepository {
  findByCode(code: string): Promise<InvestmentProduct | null>;
  findAllActive(): Promise<InvestmentProduct[]>;
}

export class SupabaseInvestmentProductRepository implements InvestmentProductRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByCode(code: string): Promise<InvestmentProduct | null> {
    const { data, error } = await this.client
      .from('investment_products')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load investment product: ${error.message}`);
    }

    return data ? fromRow(data as InvestmentProductRow) : null;
  }

  async findAllActive(): Promise<InvestmentProduct[]> {
    const { data, error } = await this.client
      .from('investment_products')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to load investment products: ${error.message}`);
    }

    return (data || []).map((row) => fromRow(row as InvestmentProductRow));
  }
}
