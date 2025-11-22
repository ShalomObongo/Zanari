-- Migration: Real Investment Setup
-- Date: 2025-11-22
-- Description: Adds investment products table and updates positions for high-precision interest

-- Create investment_products table
CREATE TABLE IF NOT EXISTS investment_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  annual_yield_bps INTEGER NOT NULL CHECK (annual_yield_bps >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default product
INSERT INTO investment_products (code, name, annual_yield_bps)
VALUES ('default_savings_pool', 'Zanari Yield Pool', 1200)
ON CONFLICT (code) DO NOTHING;

-- Create savings_investment_preferences if not exists
CREATE TABLE IF NOT EXISTS savings_investment_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  auto_invest_enabled BOOLEAN NOT NULL DEFAULT false,
  target_allocation_pct INTEGER NOT NULL DEFAULT 0 CHECK (target_allocation_pct >= 0 AND target_allocation_pct <= 100),
  preferred_product_code TEXT NOT NULL DEFAULT 'default_savings_pool',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create savings_investment_positions if not exists
CREATE TABLE IF NOT EXISTS savings_investment_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL DEFAULT 'default_savings_pool',
  invested_amount BIGINT NOT NULL DEFAULT 0 CHECK (invested_amount >= 0),
  accrued_interest NUMERIC(20, 10) NOT NULL DEFAULT 0, -- High precision
  last_accrued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_code)
);

-- If the table already existed with BIGINT accrued_interest, alter it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'savings_investment_positions' 
    AND column_name = 'accrued_interest' 
    AND data_type = 'bigint'
  ) THEN
    ALTER TABLE savings_investment_positions 
    ALTER COLUMN accrued_interest TYPE NUMERIC(20, 10);
  END IF;
END $$;

-- Add FK if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_savings_investment_positions_product'
  ) THEN
    ALTER TABLE savings_investment_positions
    ADD CONSTRAINT fk_savings_investment_positions_product
    FOREIGN KEY (product_code)
    REFERENCES investment_products(code);
  END IF;
END $$;

-- Add RLS policies
ALTER TABLE investment_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_investment_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_investment_positions ENABLE ROW LEVEL SECURITY;

-- Policies for investment_products (Public read, admin write)
DROP POLICY IF EXISTS "Everyone can view active investment products" ON investment_products;
CREATE POLICY "Everyone can view active investment products" ON investment_products
  FOR SELECT USING (is_active = true);

-- Policies for preferences
DROP POLICY IF EXISTS "Users can view own investment preferences" ON savings_investment_preferences;
CREATE POLICY "Users can view own investment preferences" ON savings_investment_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investment preferences" ON savings_investment_preferences;
CREATE POLICY "Users can update own investment preferences" ON savings_investment_preferences
  FOR UPDATE USING (auth.uid() = user_id);
  
DROP POLICY IF EXISTS "Users can insert own investment preferences" ON savings_investment_preferences;
CREATE POLICY "Users can insert own investment preferences" ON savings_investment_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for positions
DROP POLICY IF EXISTS "Users can view own investment positions" ON savings_investment_positions;
CREATE POLICY "Users can view own investment positions" ON savings_investment_positions
  FOR SELECT USING (auth.uid() = user_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_investment_products_updated_at ON investment_products;
CREATE TRIGGER update_investment_products_updated_at BEFORE UPDATE ON investment_products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_savings_investment_preferences_updated_at ON savings_investment_preferences;
CREATE TRIGGER update_savings_investment_preferences_updated_at BEFORE UPDATE ON savings_investment_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_savings_investment_positions_updated_at ON savings_investment_positions;
CREATE TRIGGER update_savings_investment_positions_updated_at BEFORE UPDATE ON savings_investment_positions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
