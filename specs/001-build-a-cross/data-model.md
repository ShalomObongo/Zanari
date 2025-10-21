# Data Model: Cross-Platform Savings & Payments Application

**Date**: 2025-09-23  
**Feature**: 001-build-a-cross  

## Core Entities

### User
**Purpose**: Represents app users (students/young professionals)  
**Storage**: Supabase Auth + users table  

```typescript
interface User {
  id: string;                    // Supabase Auth user ID (UUID)
  email: string;                 // Primary authentication method
  phone?: string;                // Optional phone for SMS backup
  created_at: timestamp;         // Account creation time
  updated_at: timestamp;         // Last profile update
  
  // Profile Information
  first_name: string;
  last_name: string;
  date_of_birth?: date;          // Optional for KYC
  
  // KYC Status
  kyc_status: 'pending' | 'approved' | 'rejected' | 'not_started';
  kyc_submitted_at?: timestamp;
  kyc_approved_at?: timestamp;
  
  // Settings
  notification_preferences: {
    push_enabled: boolean;
    email_enabled: boolean;
    transaction_alerts: boolean;
    savings_milestones: boolean;
  };
  
  // Security
  pin_hash?: string;             // Hashed 4-digit PIN
  pin_set_at?: timestamp;
  failed_pin_attempts: number;   // For progressive delays
  last_failed_attempt_at?: timestamp;
  
  // Status
  status: 'active' | 'suspended' | 'closed';
}
```

**Validation Rules**:
- Email must be valid format
- PIN must be exactly 4 digits when set
- KYC status transitions: not_started → pending → approved/rejected
- Failed PIN attempts max 5 before lockout

**Relationships**:
- One-to-Many: User → Wallets
- One-to-Many: User → Transactions
- One-to-Many: User → SavingsGoals
- One-to-Many: User → KYCDocuments

---

### Wallet
**Purpose**: Financial account container (main wallet + savings wallet)  
**Storage**: Supabase wallets table  

```typescript
interface Wallet {
  id: string;                    // UUID
  user_id: string;               // Foreign key to User
  wallet_type: 'main' | 'savings';
  
  // Balance Information
  balance: number;               // Current balance in KES (stored as cents)
  available_balance: number;     // Balance minus pending transactions
  
  // Metadata
  created_at: timestamp;
  updated_at: timestamp;
  last_transaction_at?: timestamp;
  
  // Settings (for savings wallet)
  withdrawal_restrictions?: {
    min_settlement_delay_minutes: number;  // Default 1-2 minutes
    locked_until?: timestamp;              // For goal lock-in feature
  };
}
```

**Validation Rules**:
- Balance must be >= 0 (no overdrafts)
- Each user must have exactly one main wallet and one savings wallet
- Savings wallet withdrawal restrictions apply
- All monetary values stored as integers (cents) to avoid floating point issues

**Business Logic**:
- Balance updates must be atomic (transaction-wrapped)
- Main wallet used for payments and receiving money
- Savings wallet only receives round-ups and manual transfers

---

### Transaction
**Purpose**: Record of all money movements  
**Storage**: Supabase transactions table  

```typescript
interface Transaction {
  id: string;                    // UUID
  user_id: string;               // Foreign key to User
  
  // Transaction Details
  type: 'payment' | 'transfer_in' | 'transfer_out' | 'round_up' | 
        'bill_payment' | 'withdrawal' | 'deposit';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  
  // Amounts
  amount: number;                // Transaction amount in cents (KES)
  fee?: number;                  // Transaction fee if applicable
  
  // Wallet References
  from_wallet_id?: string;       // Source wallet (if internal)
  to_wallet_id?: string;         // Destination wallet (if internal)
  
  // External References
  external_transaction_id?: string;  // Paystack transaction ID
  external_reference?: string;       // Merchant/Paybill reference
  
  // Payment Details (when applicable)
  payment_method?: 'mpesa' | 'card' | 'internal';
  merchant_info?: {
    name: string;
    till_number?: string;
    paybill_number?: string;
    account_number?: string;
  };
  
  // Round-up Information
  round_up_details?: {
    original_amount: number;     // Original payment amount
    round_up_amount: number;     // Amount saved to savings
    round_up_rule: string;       // Rule used (10s, 50s, 100s, auto)
    related_transaction_id: string;  // Link to original payment
  };
  
  // Categorization
  category: 'airtime' | 'groceries' | 'school_fees' | 'utilities' | 
           'transport' | 'entertainment' | 'savings' | 'transfer' | 'other';
  auto_categorized: boolean;     // If category was auto-assigned
  
  // Metadata
  description?: string;          // User-provided or auto-generated
  created_at: timestamp;
  updated_at: timestamp;
  completed_at?: timestamp;
  
  // Retry Information (for failed external payments)
  retry_count: number;
  last_retry_at?: timestamp;
  next_retry_at?: timestamp;
}
```

**Validation Rules**:
- Amount must be > 0
- Status transitions: pending → completed/failed/cancelled
- External transactions must have external_transaction_id when completed
- Round-up amounts must be consistent with original transaction
- Single transaction limit: KES 5,000 (500,000 cents)
- Daily transaction cap: KES 20,000 (2,000,000 cents)

**State Transitions**:
```
pending → completed   (successful payment)
pending → failed      (payment rejected/timeout)
pending → cancelled   (user cancelled)
failed → pending      (retry queued)
```

---

### SavingsGoal
**Purpose**: User-defined savings targets  
**Storage**: Supabase savings_goals table  

```typescript
interface SavingsGoal {
  id: string;                    // UUID
  user_id: string;               // Foreign key to User
  
  // Goal Details
  name: string;                  // User-defined goal name
  description?: string;          // Optional description
  target_amount: number;         // Target amount in cents (KES)
  current_amount: number;        // Current progress in cents
  
  // Timeline
  target_date?: date;            // Optional target completion date
  created_at: timestamp;
  updated_at: timestamp;
  completed_at?: timestamp;      // When goal was reached
  
  // Status and Settings
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  lock_in_enabled: boolean;      // Prevents withdrawal until goal completion
  
  // Progress Tracking
  milestones?: {
    percentage: number;          // 25%, 50%, 75%, 100%
    amount: number;              // Amount at milestone
    reached_at?: timestamp;      // When milestone was reached
    celebrated: boolean;         // If user was notified/rewarded
  }[];
}
```

**Validation Rules**:
- Target amount must be > 0
- Current amount cannot exceed target amount
- Name must be 1-50 characters
- Target date must be future date if set
- Milestone percentages must be unique and between 0-100

**Business Logic**:
- Progress calculated as (current_amount / target_amount) * 100
- Automatic milestone detection and celebration
- Lock-in feature prevents savings wallet withdrawal

---

### RoundUpRule
**Purpose**: Configuration for automatic round-up savings  
**Storage**: Supabase round_up_rules table  

```typescript
interface RoundUpRule {
  id: string;                    // UUID
  user_id: string;               // Foreign key to User (unique)
  
  // Rule Configuration
  increment_type: '10' | '50' | '100' | 'auto';
  is_enabled: boolean;
  
  // Auto-analyze Settings (when increment_type = 'auto')
  auto_settings?: {
    min_increment: number;       // Minimum round-up amount
    max_increment: number;       // Maximum round-up amount
    analysis_period_days: number;  // Days of history to analyze
    last_analysis_at?: timestamp;
  };
  
  // Usage Statistics
  total_round_ups_count: number;
  total_amount_saved: number;    // Total round-ups in cents
  
  // Metadata
  created_at: timestamp;
  updated_at: timestamp;
  last_used_at?: timestamp;
}
```

**Validation Rules**:
- Each user can have only one round-up rule
- When disabled, no round-ups are processed
- Auto settings required when increment_type is 'auto'
- Analysis period must be 7-90 days

**Business Logic**:
- Applied to all eligible transactions (payments, bill payments)
- Round-up calculation: `ceil(amount / increment) * increment - amount`
- Auto-analyze reviews transaction patterns weekly

---

### KYCDocument
**Purpose**: Identity verification documents  
**Storage**: Supabase kyc_documents table + Supabase Storage  

```typescript
interface KYCDocument {
  id: string;                    // UUID
  user_id: string;               // Foreign key to User
  
  // Document Information
  document_type: 'national_id' | 'passport' | 'driving_license' | 'selfie';
  file_path: string;             // Supabase Storage path
  file_name: string;             // Original filename
  file_size: number;             // File size in bytes
  mime_type: string;             // File MIME type
  
  // Verification Status
  status: 'uploaded' | 'processing' | 'approved' | 'rejected';
  verification_notes?: string;    // Reason for rejection
  
  // Security
  encrypted: boolean;            // If file is encrypted
  access_hash: string;           // Hash for secure access
  
  // Metadata
  uploaded_at: timestamp;
  processed_at?: timestamp;
  expires_at?: date;             // For documents with expiration
  
  // Verification Details
  extracted_data?: {
    full_name?: string;
    id_number?: string;
    date_of_birth?: date;
    issue_date?: date;
    expiry_date?: date;
  };
}
```

**Validation Rules**:
- File size must be < 10MB
- Accepted MIME types: image/jpeg, image/png, application/pdf
- Each document type can have only one approved document per user
- Encrypted storage required for all KYC documents

**Security Requirements**:
- Files encrypted at rest using AES-256
- Access controlled via row-level security
- File URLs signed with expiration
- Audit trail for all document access

---

## Relationships & Constraints

### Primary Keys & Indexes
```sql
-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);

-- Wallets table indexes  
CREATE UNIQUE INDEX idx_user_wallet_type ON wallets(user_id, wallet_type);
CREATE INDEX idx_wallets_updated_at ON wallets(updated_at);

-- Transactions table indexes
CREATE INDEX idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_external_ref ON transactions(external_transaction_id);

-- Savings goals table indexes
CREATE INDEX idx_savings_goals_user_status ON savings_goals(user_id, status);

-- Round-up rules table
CREATE UNIQUE INDEX idx_round_up_rules_user ON round_up_rules(user_id);

-- KYC documents table indexes
CREATE INDEX idx_kyc_docs_user_status ON kyc_documents(user_id, status);
CREATE UNIQUE INDEX idx_kyc_docs_user_type_approved ON kyc_documents(user_id, document_type) 
  WHERE status = 'approved';
```

### Data Integrity Rules

1. **Financial Integrity**:
   - All balance updates must be atomic
   - Transaction amounts must match wallet balance changes
   - Round-up amounts must be mathematically correct
   - No negative balances allowed

2. **User Data Consistency**:
   - Each user has exactly two wallets (main + savings)
   - KYC status progression must be sequential
   - PIN attempts tracking must be accurate

3. **Transaction Consistency**:
   - Internal transfers must have matching from/to transactions
   - External transactions must have valid payment method
   - Status transitions must follow defined workflow

4. **Security Constraints**:
   - KYC documents must be encrypted
   - PIN hashes must use secure hashing algorithm
   - Access control via Row Level Security (RLS)

### Data Retention Policies

- **Transaction History**: Retain indefinitely for audit purposes
- **KYC Documents**: Retain 7 years after account closure per regulations
- **Failed Payment Attempts**: Retain 90 days for fraud analysis
- **User Activity Logs**: Retain 1 year for support and debugging
- **System Logs**: Retain 30 days per constitution requirements

---

**Data Model Status**: ✅ COMPLETE  
**Next**: Contract Generation and API Design