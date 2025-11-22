-- Add 'investment' to transaction_category enum
ALTER TYPE transaction_category ADD VALUE IF NOT EXISTS 'investment';

-- Add investment types to transaction_type enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'investment_allocation';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'investment_redemption';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'interest_payout';
