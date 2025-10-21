import { SupabaseClient } from '@supabase/supabase-js';

import { Wallet, WalletRow, fromRow, toRow } from '../models/Wallet';
import { UUID } from '../models/base';
import { WalletRepository } from '../services/types';

export class SupabaseWalletRepository implements WalletRepository {
  constructor(private readonly client: SupabaseClient) {}

  async insert(wallet: Wallet): Promise<Wallet> {
    const row = toRow(wallet);
    const { id, ...insertable } = row;

    const { data, error } = await this.client
      .from('wallets')
      .insert({ id, ...insertable })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to insert wallet: ${error.message}`);
    }

    return fromRow(data as WalletRow);
  }

  async findById(walletId: UUID): Promise<Wallet | null> {
    const { data, error } = await this.client
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find wallet by id: ${error.message}`);
    }

    return data ? fromRow(data as WalletRow) : null;
  }

  async findByUserAndType(userId: UUID, walletType: Wallet['walletType']): Promise<Wallet | null> {
    const { data, error } = await this.client
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('wallet_type', walletType)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find wallet by user and type: ${error.message}`);
    }

    return data ? fromRow(data as WalletRow) : null;
  }

  async listByUser(userId: UUID): Promise<Wallet[]> {
    const { data, error } = await this.client
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list wallets: ${error.message}`);
    }

    return (data as WalletRow[]).map(fromRow);
  }

  async save(wallet: Wallet): Promise<Wallet> {
    const row = toRow(wallet);
    const { id, ...updateRow } = row;

    const { data, error } = await this.client
      .from('wallets')
      .update(updateRow)
      .eq('id', wallet.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save wallet: ${error.message}`);
    }

    return fromRow(data as WalletRow);
  }
}
