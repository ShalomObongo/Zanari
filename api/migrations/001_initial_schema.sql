-- Zanari2 Database Schema - Initial Migration
-- Based on data model specification from specs/001-build-a-cross/data-model.md
-- Target: Supabase PostgreSQL with Row Level Security (RLS)

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types for enums
CREATE TYPE user_kyc_status AS ENUM ('not_started', 'pending', 'approved', 'rejected');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE wallet_type AS ENUM ('main', 'savings');
CREATE TYPE transaction_type AS ENUM ('payment', 'transfer_in', 'transfer_out', 'round_up', 'bill_payment', 'withdrawal', 'deposit');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE transaction_category AS ENUM ('airtime', 'groceries', 'school_fees', 'utilities', 'transport', 'entertainment', 'savings', 'transfer', 'other');
CREATE TYPE payment_method AS ENUM ('mpesa', 'card', 'internal');
CREATE TYPE savings_goal_status AS ENUM ('active', 'completed', 'paused', 'cancelled');
CREATE TYPE round_up_increment AS ENUM ('10', '50', '100', 'auto');
CREATE TYPE kyc_document_type AS ENUM ('national_id', 'passport', 'driving_license', 'selfie');
CREATE TYPE kyc_document_status AS ENUM ('uploaded', 'processing', 'approved', 'rejected');

-- Users Table
-- Extends Supabase Auth with additional profile and KYC information
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  
  -- KYC Information
  kyc_status user_kyc_status NOT NULL DEFAULT 'not_started',
  kyc_submitted_at TIMESTAMPTZ,
  kyc_approved_at TIMESTAMPTZ,
  
  -- Notification preferences stored as JSONB for flexibility
  notification_preferences JSONB NOT NULL DEFAULT '{
    "push_enabled": true,
    "email_enabled": true,
    "transaction_alerts": true,
    "savings_milestones": true
  }'::jsonb,
  
  -- PIN Security (hashed, never store plain text)
  pin_hash TEXT,
  pin_set_at TIMESTAMPTZ,
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
  last_failed_attempt_at TIMESTAMPTZ,
  
  -- Account Status
  status user_status NOT NULL DEFAULT 'active',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallets Table
-- Each user has exactly one main wallet and one savings wallet
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_type wallet_type NOT NULL,
  
  -- Balance Information (stored in cents to avoid floating point issues)
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  available_balance BIGINT NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  
  -- Withdrawal restrictions for savings wallet
  withdrawal_restrictions JSONB DEFAULT NULL,
  
  -- Metadata
  last_transaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, wallet_type) -- Each user has exactly one wallet of each type
);

-- Transactions Table
-- Complete audit trail of all money movements
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Transaction Classification
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  
  -- Financial Details (amounts in cents)
  amount BIGINT NOT NULL CHECK (amount > 0),
  fee BIGINT DEFAULT 0 CHECK (fee >= 0),
  
  -- Wallet References (for internal transfers)
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  
  -- External Payment Information
  external_transaction_id TEXT, -- Paystack transaction ID
  external_reference TEXT,      -- Merchant/Paybill reference
  payment_method payment_method,
  
  -- Merchant Information (stored as JSONB for flexibility)
  merchant_info JSONB,
  
  -- Round-up Details (when applicable)
  round_up_details JSONB,
  
  -- Categorization
  category transaction_category NOT NULL DEFAULT 'other',
  auto_categorized BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  
  -- Retry Logic for Failed Payments
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Savings Goals Table
-- User-defined savings targets with milestone tracking
CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Goal Details
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 50),
  description TEXT CHECK (length(description) <= 200),
  target_amount BIGINT NOT NULL CHECK (target_amount > 0),
  current_amount BIGINT NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  
  -- Timeline
  target_date DATE,
  
  -- Status and Configuration
  status savings_goal_status NOT NULL DEFAULT 'active',
  lock_in_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Milestone Tracking (stored as JSONB array)
  milestones JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CHECK (current_amount <= target_amount),
  CHECK (target_date IS NULL OR target_date > CURRENT_DATE)
);

-- Round-up Rules Table
-- Configuration for automatic savings through transaction round-ups
CREATE TABLE round_up_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Rule Configuration
  increment_type round_up_increment NOT NULL DEFAULT '10',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Auto-analyze Settings (when increment_type = 'auto')
  auto_settings JSONB,
  
  -- Usage Statistics
  total_round_ups_count INTEGER NOT NULL DEFAULT 0,
  total_amount_saved BIGINT NOT NULL DEFAULT 0,
  
  -- Metadata
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KYC Documents Table
-- Encrypted storage of identity verification documents
CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Document Information
  document_type kyc_document_type NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage path
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  mime_type TEXT NOT NULL,
  
  -- Verification Status
  status kyc_document_status NOT NULL DEFAULT 'uploaded',
  verification_notes TEXT,
  
  -- Security
  encrypted BOOLEAN NOT NULL DEFAULT true,
  access_hash TEXT NOT NULL,
  expires_at DATE,
  
  -- Extracted Data (populated by verification process)
  extracted_data JSONB,
  
  -- Metadata
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Constraints
  CHECK (file_size <= 10485760), -- 10MB limit
  UNIQUE(user_id, document_type, status) 
    DEFERRABLE INITIALLY DEFERRED -- Only one approved document per type per user
);

-- Create indexes for performance

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_status ON users(status);

-- Wallets table indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_updated_at ON wallets(updated_at);

-- Transactions table indexes (most queried table)
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_external_id ON transactions(external_transaction_id);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_retry ON transactions(status, next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Savings goals indexes
CREATE INDEX idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX idx_savings_goals_user_status ON savings_goals(user_id, status);
CREATE INDEX idx_savings_goals_status ON savings_goals(status);

-- KYC documents indexes
CREATE INDEX idx_kyc_docs_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_docs_user_status ON kyc_documents(user_id, status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_savings_goals_updated_at BEFORE UPDATE ON savings_goals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_round_up_rules_updated_at BEFORE UPDATE ON round_up_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Users can only access their own data

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_up_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Wallets policies
CREATE POLICY "Users can view own wallets" ON wallets
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can update own wallets" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

-- Savings goals policies
CREATE POLICY "Users can view own goals" ON savings_goals
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can manage own goals" ON savings_goals
  FOR ALL USING (auth.uid() = user_id);

-- Round-up rules policies
CREATE POLICY "Users can view own round-up rules" ON round_up_rules
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can manage own round-up rules" ON round_up_rules
  FOR ALL USING (auth.uid() = user_id);

-- KYC documents policies
CREATE POLICY "Users can view own KYC documents" ON kyc_documents
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can upload KYC documents" ON kyc_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to automatically create wallets for new users
CREATE OR REPLACE FUNCTION create_user_wallets()
RETURNS TRIGGER AS $$
BEGIN
  -- Create main wallet
  INSERT INTO wallets (user_id, wallet_type, balance, available_balance)
  VALUES (NEW.id, 'main', 0, 0);
  
  -- Create savings wallet
  INSERT INTO wallets (user_id, wallet_type, balance, available_balance)
  VALUES (NEW.id, 'savings', 0, 0);
  
  -- Create default round-up rule
  INSERT INTO round_up_rules (user_id, increment_type, is_enabled)
  VALUES (NEW.id, '10', true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create wallets when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_user_wallets();

-- Create function to validate transaction limits
CREATE OR REPLACE FUNCTION validate_transaction_limits()
RETURNS TRIGGER AS $$
DECLARE
  daily_total BIGINT;
  single_limit BIGINT := 500000; -- KES 5,000 in cents
  daily_limit BIGINT := 2000000; -- KES 20,000 in cents
BEGIN
  -- Check single transaction limit
  IF NEW.amount > single_limit THEN
    RAISE EXCEPTION 'Transaction amount exceeds single transaction limit of KES 5,000';
  END IF;
  
  -- Check daily limit (only for outgoing transactions)
  IF NEW.type IN ('payment', 'transfer_out', 'bill_payment', 'withdrawal') THEN
    SELECT COALESCE(SUM(amount), 0) INTO daily_total
    FROM transactions 
    WHERE user_id = NEW.user_id 
      AND type IN ('payment', 'transfer_out', 'bill_payment', 'withdrawal')
      AND status = 'completed'
      AND DATE(created_at) = DATE(NEW.created_at);
    
    IF daily_total + NEW.amount > daily_limit THEN
      RAISE EXCEPTION 'Daily transaction limit of KES 20,000 exceeded';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply transaction limits validation
CREATE TRIGGER validate_transaction_limits_trigger
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION validate_transaction_limits();

-- Create function to calculate savings goal progress
CREATE OR REPLACE FUNCTION update_savings_goal_progress()
RETURNS TRIGGER AS $$
DECLARE
  goal_record savings_goals%ROWTYPE;
  new_milestone JSONB;
  milestone_percentages INTEGER[] := ARRAY[25, 50, 75, 100];
  milestone_pct INTEGER;
  progress_pct NUMERIC;
BEGIN
  -- Get the savings goal
  SELECT * INTO goal_record FROM savings_goals WHERE id = NEW.to_wallet_id;
  
  IF FOUND AND goal_record.status = 'active' THEN
    -- Calculate current progress percentage
    progress_pct := (goal_record.current_amount::NUMERIC / goal_record.target_amount::NUMERIC) * 100;
    
    -- Check for milestone achievements
    FOREACH milestone_pct IN ARRAY milestone_percentages
    LOOP
      IF progress_pct >= milestone_pct THEN
        -- Check if milestone already exists
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(goal_record.milestones) AS milestone
          WHERE (milestone->>'percentage')::INTEGER = milestone_pct
            AND milestone->>'reached_at' IS NOT NULL
        ) THEN
          -- Add new milestone
          new_milestone := jsonb_build_object(
            'percentage', milestone_pct,
            'amount', (goal_record.target_amount * milestone_pct / 100)::BIGINT,
            'reached_at', NOW(),
            'celebrated', false
          );
          
          UPDATE savings_goals 
          SET milestones = milestones || new_milestone
          WHERE id = goal_record.id;
        END IF;
      END IF;
    END LOOP;
    
    -- Mark goal as completed if target reached
    IF goal_record.current_amount >= goal_record.target_amount THEN
      UPDATE savings_goals 
      SET status = 'completed', completed_at = NOW()
      WHERE id = goal_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for milestone tracking (will be used when savings transactions are processed)
-- Note: This will be called from application logic when savings are credited

-- Comments for future reference
COMMENT ON TABLE users IS 'User profiles extending Supabase Auth with KYC and preferences';
COMMENT ON TABLE wallets IS 'User financial accounts - main wallet for payments, savings for round-ups';
COMMENT ON TABLE transactions IS 'Complete audit trail of all financial transactions with round-up logic';
COMMENT ON TABLE savings_goals IS 'User-defined savings targets with milestone tracking and lock-in feature';
COMMENT ON TABLE round_up_rules IS 'Configuration for automatic micro-savings through transaction round-ups';
COMMENT ON TABLE kyc_documents IS 'Encrypted identity verification documents with security controls';

COMMENT ON COLUMN transactions.amount IS 'Transaction amount in cents to avoid floating point precision issues';
COMMENT ON COLUMN wallets.balance IS 'Wallet balance in cents (KES * 100) for precision';
COMMENT ON COLUMN round_up_rules.total_amount_saved IS 'Total savings from round-ups in cents';

-- Migration complete
-- Next steps:
-- 1. Apply this migration to Supabase project
-- 2. Set up Supabase Storage bucket for KYC documents with RLS
-- 3. Configure Supabase Edge Functions for webhook handling
-- 4. Set up real-time subscriptions for balance updates