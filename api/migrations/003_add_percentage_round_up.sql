-- Migration: Add percentage-based round-up support
-- Date: 2025-10-31
-- Description: Adds percentage_value column to round_up_rules table to support percentage-based round-ups

-- Add 'percentage' value to the round_up_increment enum type
ALTER TYPE round_up_increment ADD VALUE IF NOT EXISTS 'percentage';

-- Add percentage_value column to round_up_rules
ALTER TABLE round_up_rules
ADD COLUMN IF NOT EXISTS percentage_value DECIMAL(5,2) CHECK (percentage_value > 0 AND percentage_value <= 100);

COMMENT ON COLUMN round_up_rules.percentage_value IS 'Percentage value for percentage-based round-ups (e.g., 5.5 for 5.5%)';
