import { UUID } from './base';

export interface InvestmentProduct {
  id: UUID;
  code: string;
  name: string;
  annualYieldBps: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentProductRow {
  id: string;
  code: string;
  name: string;
  annual_yield_bps: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function fromRow(row: InvestmentProductRow): InvestmentProduct {
  return {
    id: row.id as UUID,
    code: row.code,
    name: row.name,
    annualYieldBps: row.annual_yield_bps,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
