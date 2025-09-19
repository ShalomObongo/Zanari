# Data Models

## User

**Purpose:** Core user entity representing Zanari account holders

**Key Attributes:**
- id: uuid - Primary key from Supabase Auth
- phone_number: string - User's phone number (unique)
- pin_hash: string - Hashed PIN for authentication
- first_name: string - User's first name
- last_name: string - User's last name
- email: string - Optional email address
- date_of_birth: date - User's date of birth
- kyc_status: 'pending' | 'verified' | 'rejected' - KYC verification status
- kyc_document_url: string - URL to KYC document
- is_active: boolean - Account status
- created_at: timestamp - Account creation timestamp
- updated_at: timestamp - Last update timestamp

**TypeScript Interface:**
```typescript
interface User {
  id: string;
  phone_number: string;
  pin_hash: string;
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth: string;
  kyc_status: 'pending' | 'verified' | 'rejected';
  kyc_document_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Relationships:**
- One-to-many with Wallet (user has one wallet)
- One-to-many with SavingsGoal (user has multiple goals)
- One-to-many with Transaction (user has multiple transactions)
- One-to-many with MpesaAccount (user can link multiple M-PESA accounts)

## Wallet

**Purpose:** Primary wallet for storing user's funds

**Key Attributes:**
- id: uuid - Primary key
- user_id: uuid - Foreign key to User
- balance: decimal - Current wallet balance
- currency: string - Currency code (KES)
- created_at: timestamp - Wallet creation timestamp
- updated_at: timestamp - Last update timestamp

**TypeScript Interface:**
```typescript
interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}
```

**Relationships:**
- Many-to-one with User (belongs to user)
- One-to-many with Transaction (source of transactions)

## SavingsGoal

**Purpose:** User-defined savings goals with targets and deadlines

**Key Attributes:**
- id: uuid - Primary key
- user_id: uuid - Foreign key to User
- name: string - Goal name
- description?: string - Optional goal description
- target_amount: decimal - Target amount to save
- current_amount: decimal - Currently saved amount
- target_date?: date - Optional target date
- icon_emoji?: string - Emoji/icon for goal
- status: 'active' | 'completed' | 'paused' - Goal status
- created_at: timestamp - Goal creation timestamp
- updated_at: timestamp - Last update timestamp

**TypeScript Interface:**
```typescript
interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  icon_emoji?: string;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}
```

**Relationships:**
- Many-to-one with User (belongs to user)
- One-to-many with GoalAllocation (funds allocated to this goal)
- One-to-many with Transaction (transactions related to this goal)

## Transaction

**Purpose:** Records all financial transactions in the system

**Key Attributes:**
- id: uuid - Primary key
- user_id: uuid - Foreign key to User
- wallet_id: uuid - Foreign key to Wallet
- type: 'deposit' | 'withdrawal' | 'savings' | 'refund' - Transaction type
- amount: decimal - Transaction amount
- currency: string - Currency code (KES)
- description: string - Transaction description
- reference_number?: string - External reference number
- status: 'pending' | 'completed' | 'failed' - Transaction status
- savings_goal_id?: uuid - Foreign key to SavingsGoal (if applicable)
- mpesa_transaction_id?: string - M-PESA transaction reference
- created_at: timestamp - Transaction timestamp
- updated_at: timestamp - Last update timestamp

**TypeScript Interface:**
```typescript
interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  type: 'deposit' | 'withdrawal' | 'savings' | 'refund';
  amount: number;
  currency: string;
  description: string;
  reference_number?: string;
  status: 'pending' | 'completed' | 'failed';
  savings_goal_id?: string;
  mpesa_transaction_id?: string;
  created_at: string;
  updated_at: string;
}
```

**Relationships:**
- Many-to-one with User (belongs to user)
- Many-to-one with Wallet (belongs to wallet)
- Many-to-one with SavingsGoal (optional association with goal)

## MpesaAccount

**Purpose:** Linked M-PESA accounts for automatic savings

**Key Attributes:**
- id: uuid - Primary key
- user_id: uuid - Foreign key to User
- phone_number: string - M-PESA registered phone number
- account_name: string - M-PESA account holder name
- is_active: boolean - Account linkage status
- is_default: boolean - Default account for round-ups
- round_up_enabled: boolean - Round-up savings enabled
- round_up_amount: decimal - Round-up amount (KES 10)
- daily_limit?: decimal - Daily savings limit
- last_transaction_date?: date - Last transaction processed
- created_at: timestamp - Account linking timestamp
- updated_at: timestamp - Last update timestamp

**TypeScript Interface:**
```typescript
interface MpesaAccount {
  id: string;
  user_id: string;
  phone_number: string;
  account_name: string;
  is_active: boolean;
  is_default: boolean;
  round_up_enabled: boolean;
  round_up_amount: number;
  daily_limit?: number;
  last_transaction_date?: string;
  created_at: string;
  updated_at: string;
}
```

**Relationships:**
- Many-to-one with User (belongs to user)
- One-to-many with MpesaTransaction (M-PESA transactions processed)

## MpesaTransaction

**Purpose:** Records M-PESA transactions for round-up processing

**Key Attributes:**
- id: uuid - Primary key
- mpesa_account_id: uuid - Foreign key to MpesaAccount
- user_id: uuid - Foreign key to User
- transaction_id: string - M-PESA transaction ID
- transaction_type: string - M-PESA transaction type
- amount: decimal - Original transaction amount
- round_up_amount: decimal - Calculated round-up amount
- processing_status: 'pending' | 'processed' | 'failed' - Processing status
- processed_at?: timestamp - When round-up was processed
- created_at: timestamp - Transaction received timestamp

**TypeScript Interface:**
```typescript
interface MpesaTransaction {
  id: string;
  mpesa_account_id: string;
  user_id: string;
  transaction_id: string;
  transaction_type: string;
  amount: number;
  round_up_amount: number;
  processing_status: 'pending' | 'processed' | 'failed';
  processed_at?: string;
  created_at: string;
}
```

**Relationships:**
- Many-to-one with MpesaAccount (belongs to M-PESA account)
- Many-to-one with User (belongs to user)
- One-to-one with Transaction (generated savings transaction)

## GoalAllocation

**Purpose:** Tracks how savings are allocated across multiple goals

**Key Attributes:**
- id: uuid - Primary key
- user_id: uuid - Foreign key to User
- savings_goal_id: uuid - Foreign key to SavingsGoal
- transaction_id: uuid - Foreign key to Transaction
- amount: decimal - Amount allocated to this goal
- percentage: number - Percentage of total allocation
- created_at: timestamp - Allocation timestamp

**TypeScript Interface:**
```typescript
interface GoalAllocation {
  id: string;
  user_id: string;
  savings_goal_id: string;
  transaction_id: string;
  amount: number;
  percentage: number;
  created_at: string;
}
```

**Relationships:**
- Many-to-one with User (belongs to user)
- Many-to-one with SavingsGoal (belongs to goal)
- Many-to-one with Transaction (belongs to transaction)
