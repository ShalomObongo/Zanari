# Database Schema

## Core Tables

```sql
-- Users table
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    date_of_birth DATE NOT NULL,
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    kyc_document_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    balance DECIMAL(15,2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
    currency VARCHAR(3) DEFAULT 'KES' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Savings goals table
CREATE TABLE savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    target_amount DECIMAL(15,2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(15,2) DEFAULT 0.00 NOT NULL CHECK (current_amount >= 0),
    target_date DATE,
    icon_emoji VARCHAR(10),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'savings', 'refund')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'KES' NOT NULL,
    description TEXT NOT NULL,
    reference_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    savings_goal_id UUID REFERENCES savings_goals(id) ON DELETE SET NULL,
    mpesa_transaction_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- M-PESA accounts table
CREATE TABLE mpesa_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    round_up_enabled BOOLEAN DEFAULT true,
    round_up_amount DECIMAL(10,2) DEFAULT 10.00 CHECK (round_up_amount > 0),
    daily_limit DECIMAL(15,2),
    last_transaction_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, phone_number)
);

-- M-PESA transactions table (for round-up processing)
CREATE TABLE mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mpesa_account_id UUID REFERENCES mpesa_accounts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    round_up_amount DECIMAL(10,2) NOT NULL,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed')),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goal allocations table
CREATE TABLE goal_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    savings_goal_id UUID REFERENCES savings_goals(id) ON DELETE CASCADE NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(transaction_id, savings_goal_id)
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Indexes for Performance

```sql
-- Performance indexes
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX idx_savings_goals_status ON savings_goals(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_mpesa_accounts_user_id ON mpesa_accounts(user_id);
CREATE INDEX idx_mpesa_transactions_user_id ON mpesa_transactions(user_id);
CREATE INDEX idx_mpesa_transactions_status ON mpesa_transactions(processing_status);
CREATE INDEX idx_goal_allocations_user_id ON goal_allocations(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

## Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Wallets access policies
CREATE POLICY "Users can view own wallet" ON wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can update wallet balances" ON wallets
    FOR UPDATE USING (auth.uid() = user_id);

-- Savings goals access policies
CREATE POLICY "Users can view own goals" ON savings_goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own goals" ON savings_goals
    FOR ALL USING (auth.uid() = user_id);

-- Transactions access policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- M-PESA accounts access policies
CREATE POLICY "Users can view own M-PESA accounts" ON mpesa_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own M-PESA accounts" ON mpesa_accounts
    FOR ALL USING (auth.uid() = user_id);

-- M-PESA transactions processing policies
CREATE POLICY "System can process M-PESA transactions" ON mpesa_transactions
    FOR ALL USING (auth.uid() = user_id);

-- Goal allocations access policies
CREATE POLICY "Users can view own goal allocations" ON goal_allocations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create goal allocations" ON goal_allocations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications access policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notifications" ON notifications
    FOR ALL USING (auth.uid() = user_id);
```

## Triggers for Data Integrity

```sql
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_savings_goals_updated_at BEFORE UPDATE ON savings_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mpesa_accounts_updated_at BEFORE UPDATE ON mpesa_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update goal status when target is reached
CREATE OR REPLACE FUNCTION update_goal_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_amount >= NEW.target_amount AND NEW.status = 'active' THEN
        NEW.status = 'completed';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER check_goal_completion BEFORE UPDATE ON savings_goals
    FOR EACH ROW EXECUTE FUNCTION update_goal_status();

-- Ensure only one default M-PESA account per user
CREATE OR REPLACE FUNCTION ensure_single_default_mpesa()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE mpesa_accounts
        SET is_default = false
        WHERE user_id = NEW.user_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER check_single_default_mpesa BEFORE UPDATE ON mpesa_accounts
    FOR EACH ROW EXECUTE FUNCTION ensure_single_default_mpesa();
```
