import { SupabaseClient } from '@supabase/supabase-js';

import {
  Transaction,
  TransactionRow,
  fromRow,
  toRow,
} from '../models/Transaction';
import { UUID } from '../models/base';
import { TransactionRepository } from '../services/types';

const OUTGOING_TRANSACTION_TYPES = ['payment', 'transfer_out', 'bill_payment', 'withdrawal'];

export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(transaction: Transaction): Promise<Transaction> {
    const row = toRow(transaction);
    const { data, error } = await this.client
      .from('transactions')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return fromRow(data as TransactionRow);
  }

  async update(transaction: Transaction): Promise<Transaction> {
    const row = toRow(transaction);
    const { id, ...updateRow } = row;

    const { data, error } = await this.client
      .from('transactions')
      .update(updateRow)
      .eq('id', transaction.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update transaction: ${error.message}`);
    }

    return fromRow(data as TransactionRow);
  }

  async sumUserTransactionsForDay(userId: UUID, dayStart: Date): Promise<number> {
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await this.client
      .from('transactions')
      .select('amount, type, status')
      .eq('user_id', userId)
      .in('type', OUTGOING_TRANSACTION_TYPES)
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString());

    if (error) {
      throw new Error(`Failed to sum user transactions: ${error.message}`);
    }

    return (data as { amount: number; status: string }[]).reduce((total, row) => {
      if (row.status === 'failed' || row.status === 'cancelled') {
        return total;
      }
      return total + Number(row.amount ?? 0);
    }, 0);
  }

  async listRecentTransactions(userId: UUID, since: Date): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(`Failed to list recent transactions: ${error.message}`);
    }

    return (data as TransactionRow[]).map(fromRow);
  }

  async listByUser(
    userId: UUID,
    options: {
      limit: number;
      offset: number;
      type?: Transaction['type'];
      category?: Transaction['category'];
    },
  ): Promise<Transaction[]> {
    let query = this.client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);

    if (options.type) {
      query = query.eq('type', options.type);
    }
    if (options.category) {
      query = query.eq('category', options.category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list user transactions: ${error.message}`);
    }

    return (data as TransactionRow[]).map(fromRow);
  }

  async countByUser(
    userId: UUID,
    options: { type?: Transaction['type']; category?: Transaction['category'] },
  ): Promise<number> {
    let query = this.client
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (options.type) {
      query = query.eq('type', options.type);
    }
    if (options.category) {
      query = query.eq('category', options.category);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count user transactions: ${error.message}`);
    }

    return count ?? 0;
  }

  async findById(transactionId: UUID): Promise<Transaction | null> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find transaction by id: ${error.message}`);
    }

    return data ? fromRow(data as TransactionRow) : null;
  }

  async findByExternalReference(reference: string): Promise<Transaction | null> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('external_reference', reference)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find transaction by external reference: ${error.message}`);
    }

    return data ? fromRow(data as TransactionRow) : null;
  }
}
