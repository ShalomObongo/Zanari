# Epic 1: Foundation & Core Savings Engine - Detailed User Stories

## Story 1.1: Project & Backend Setup
**ID:** E1-S1
**Priority:** High
**Effort:** 3 days
**Dependencies:** None

### User Story
*As a developer, I want to initialize the monorepo and configure the Supabase project, so that we have a foundational environment for development.*

### Acceptance Criteria
1. **Repository Initialization:** A Git monorepo is initialized with the following structure:
   ```
   zanari/
   ├── apps/
   │   ├── mobile/              # React Native app
   │   └── web/                 # Future web dashboard
   ├── packages/
   │   ├── shared/              # Shared TypeScript types and utilities
   │   ├── ui/                  # Shared UI components
   │   ├── data/               # Data models and validation schemas
   │   └── config/             # Shared configuration
   ├── supabase/               # Database migrations and edge functions
   ├── docs/                   # Documentation
   └── infrastructure/         # IaC for future self-hosting
   ```
2. **Supabase Project Setup:**
   - Create new Supabase project with PostgreSQL database
   - Configure Row Level Security (RLS) policies
   - Set up authentication with phone number provider
   - Generate and securely store environment variables
3. **Mobile App Connection:** The mobile app can successfully connect to the Supabase backend using the provided credentials.
4. **Health Check Function:** A basic "health-check" Supabase Edge Function is created and can be successfully deployed and invoked.

### Technical Implementation Details
- **Repository Tool:** Nx for monorepo management
- **Package Manager:** npm or yarn
- **Environment Variables:** Use `.env` files with `.env.example` template
- **Database:** PostgreSQL with Prisma ORM or direct SQL migrations
- **API:** Supabase auto-generated REST API

### Tasks/Subtasks
1. [ ] Initialize Git repository with proper `.gitignore`
2. [ ] Set up Nx monorepo structure
3. [ ] Create Supabase project and get connection details
4. [ ] Configure environment variables securely
5. [ ] Set up React Native app in `apps/mobile`
6. [ ] Create shared TypeScript packages
7. [ ] Implement health check Edge Function
8. [ ] Write integration tests for backend connectivity

### Testing Requirements
- Unit tests for all shared utilities
- Integration tests for database connectivity
- E2E tests for mobile app to Supabase connection
- Health check endpoint monitoring

### Story Draft Checklist Validation

| Category                             | Status  | Issues |
| ------------------------------------ | ------- | ------ |
| 1. Goal & Context Clarity            | PASS    |        |
| 2. Technical Implementation Guidance | PASS    |        |
| 3. Reference Effectiveness           | N/A     |        |
| 4. Self-Containment Assessment       | PASS    |        |
| 5. Testing Guidance                  | PASS    |        |

**Final Assessment:** READY

---

## Story 1.2: User Onboarding & Authentication
**ID:** E1-S2
**Priority:** High
**Effort:** 5 days
**Dependencies:** E1-S1

### User Story
*As a new user, I want to create an account using my phone number and set a secure PIN, so that I can access the application safely.*

### Acceptance Criteria
1. **Phone Number Registration:** A user can register for a new account using their phone number in international format (+254 XXX XXX XXX).
2. **PIN Setup:** The user must set a 4-6 digit PIN for their account during the registration process.
3. **Login/Logout:** The user can successfully log in and log out using their phone number and PIN.
4. **Session Management:** User identity and sessions are securely managed using Supabase Auth.
5. **Phone Verification:** One-time password (OTP) verification is implemented for phone number validation.
6. **PIN Security:** PIN is securely hashed and stored in the database.
7. **Password Reset:** Users can reset their PIN via phone number verification.

### Technical Implementation Details
- **Authentication:** Supabase Auth with phone provider
- **Session Management:** JWT tokens with secure storage
- **PIN Storage:** bcrypt hashing for PIN security
- **OTP:** Supabase phone verification service
- **Security:** Rate limiting for login attempts

### User Flow
1. User opens app and sees "Get Started" screen
2. User enters phone number and receives OTP
3. User verifies OTP and sets up PIN
4. User completes profile setup
5. User is logged in and sees dashboard

### Error Handling
- Invalid phone number format
- OTP delivery failure
- OTP expiration handling
- Network connectivity issues
- Duplicate account detection

### Testing Requirements
- Unit tests for PIN hashing and validation logic
- Integration tests for Supabase Auth phone provider and OTP service
- E2E tests for the complete user registration, login, and logout flows
- Error handling tests for scenarios like invalid OTP, expired OTP, and duplicate user registration

### Story Draft Checklist Validation

| Category                             | Status  | Issues |
| ------------------------------------ | ------- | ------ |
| 1. Goal & Context Clarity            | PASS    |        |
| 2. Technical Implementation Guidance | PASS    |        |
| 3. Reference Effectiveness           | N/A     |        |
| 4. Self-Containment Assessment       | PASS    |        |
| 5. Testing Guidance                  | NEEDS REVISION    |        |

**Final Assessment:** NEEDS REVISION

---

## Story 1.3: Link M-PESA Account
**ID:** E1-S3
**Priority:** High
**Effort:** 7 days
**Dependencies:** E1-S2

### User Story
*As a logged-in user, I want to securely link my M-PESA account to my Zanari wallet, so that the app can process transactions on my behalf.*

### Acceptance Criteria
1. **Linking Interface:** The user is presented with a clear interface to initiate the M-PESA account linking process.
2. **Authorization Confirmation:** The user must confirm authorization for Zanari to interact with their M-PESA account via STK push confirmation.
3. **Secure Storage:** The linked M-PESA account status is securely stored against the user's profile.
4. **Status Display:** The user can see the linked status of their account in the app's settings.
5. **Unlinking:** Users can unlink their M-PESA account with confirmation.
6. **Multiple Accounts:** Support for linking multiple M-PESA accounts (phone numbers) to a single Zanari account.

### Technical Implementation Details
- **M-PESA API:** Safaricom Daraja API integration
- **Authentication:** OAuth 2.0 with proper token management
- **Security:** API keys and credentials stored securely
- **Webhooks:** C2B payment notification endpoints
- **Error Handling:** Comprehensive error scenarios

### M-PESA Integration Components
1. **C2B Register URL:** Register validation and confirmation URLs
2. **STK Push:** Initiate payment prompts on user phones
3. **Transaction Status:** Check payment completion status
4. **B2C Payments:** Future withdrawal functionality
5. **Balance Inquiry:** Check M-PESA account balance

### Security Considerations
- API signature verification
- IP whitelisting for webhooks
- Request encryption
- Audit logging for all M-PESA interactions

### Testing Requirements
- Unit tests for API credential management and secure storage
- Integration tests for the Safaricom Daraja API endpoints (C2B Register, STK Push, Transaction Status)
- Mock tests for webhook handling to simulate various M-PESA notifications
- E2E tests for the complete account linking and unlinking user flow
- Security tests for API vulnerabilities and data protection

### Story Draft Checklist Validation

| Category                             | Status  | Issues |
| ------------------------------------ | ------- | ------ |
| 1. Goal & Context Clarity            | PASS    |        |
| 2. Technical Implementation Guidance | PASS    |        |
| 3. Reference Effectiveness           | N/A     |        |
| 4. Self-Containment Assessment       | PASS    |        |
| 5. Testing Guidance                  | NEEDS REVISION    |        |

**Final Assessment:** NEEDS REVISION

---

## Story 1.4: Basic Wallet & Transaction Display
**ID:** E1-S4
**Priority:** Medium
**Effort:** 4 days
**Dependencies:** E1-S3

### User Story
*As a user, I want to see my Zanari wallet balance and a list of my recent transactions, so that I can track my money.*

### Acceptance Criteria
1. **Dashboard Balance:** The main dashboard screen clearly displays the current Zanari wallet balance in KES.
2. **Transaction History:** A dedicated "History" screen displays a list of all transactions (deposits, savings, withdrawals).
3. **Transaction Details:** Each item in the transaction list shows the date, description, amount, and status.
4. **Chronological Order:** The list is displayed in reverse chronological order (newest first).
5. **Filtering:** Users can filter transactions by type (savings, deposits, withdrawals) and date range.
6. **Search:** Users can search transactions by description or amount.
7. **Refresh:** Pull-to-refresh functionality for transaction updates.

### Technical Implementation Details
- **Database Schema:** Transactions table with proper indexing
- **API:** Supabase auto-generated API with RLS policies
- **Real-time Updates:** Supabase real-time for instant balance updates
- **Caching:** Local caching for offline viewing
- **Pagination:** Infinite scroll for large transaction lists

### UI Components
1. **Balance Card:** Large, prominent balance display
2. **Transaction List:** Scrollable list with transaction items
3. **Filter Bar:** Date range and type filters
4. **Search Input:** Real-time search functionality
5. **Loading States:** Skeleton loaders and refresh indicators

### Testing Requirements
- Unit tests for transaction filtering and search logic
- Integration tests for the Supabase API with RLS policies to ensure users only see their own transactions
- UI tests for the transaction list, including filtering, searching, and pagination
- Performance tests for loading and scrolling through a large number of transactions
- Real-time update tests to verify that the balance and transaction list update automatically

### Story Draft Checklist Validation

| Category                             | Status  | Issues |
| ------------------------------------ | ------- | ------ |
| 1. Goal & Context Clarity            | PASS    |        |
| 2. Technical Implementation Guidance | PASS    |        |
| 3. Reference Effectiveness           | N/A     |        |
| 4. Self-Containment Assessment       | PASS    |        |
| 5. Testing Guidance                  | NEEDS REVISION    |        |

**Final Assessment:** NEEDS REVISION

---

## Story 1.5: Implement Automated Round-Up Savings
**ID:** E1-S5
**Priority:** High
**Effort:** 8 days
**Dependencies:** E1-S3, E1-S4

### User Story
*As a user with a linked account, I want the system to automatically round up my M-PESA transactions to the nearest KES 10 and transfer the difference to my Zanari savings wallet.*

### Acceptance Criteria
1. **Round-Up Calculation:** A Supabase function (triggered by an M-PESA webhook) correctly calculates the round-up amount from a transaction (e.g., a KES 147 spend results in a KES 3 saving).
2. **C2B Transfer:** The function successfully initiates an M-PESA C2B transfer of the calculated amount to the Zanari wallet.
3. **Balance Update:** The user's Zanari wallet balance is correctly updated upon a successful transfer.
4. **Transaction Recording:** A new "Savings" transaction appears in the user's transaction history.
5. **User Notification:** The user receives an in-app notification confirming the automated saving.
6. **Round-Up Settings:** Users can enable/disable round-up savings and set limits (e.g., maximum daily round-up amount).
7. **Failure Handling:** Proper error handling for failed transfers with user notification.

### Technical Implementation Details
- **Webhook Handler:** Supabase Edge Function for M-PESA webhooks
- **Business Logic:** Round-up calculation and transfer initiation
- **Transaction Processing:** Atomic operations for balance updates
- **Notification System:** In-app and push notifications
- **Error Handling:** Retry mechanisms and failure logging

### Round-Up Algorithm
```typescript
function calculateRoundUp(amount: number): number {
  const remainder = amount % 10;
  if (remainder === 0) return 0; // No round-up needed
  return 10 - remainder; // Round up to nearest 10
}
```

### Webhook Processing Flow
1. Receive M-PESA transaction webhook
2. Verify webhook signature
3. Extract transaction details
4. Calculate round-up amount
5. Initiate C2B payment to Zanari
6. Wait for payment confirmation
7. Update user balance
8. Record transaction
9. Send notification to user

### Security & Reliability
- Webhook signature verification
- Idempotency keys for duplicate prevention
- Rate limiting for webhook processing
- Comprehensive logging and monitoring

### Testing Requirements
- Unit tests for the round-up calculation algorithm
- Integration tests for the M-PESA webhook handler, including signature verification and idempotency
- E2E tests for the entire round-up savings flow, from M-PESA transaction to Zanari wallet update and user notification
- Failure handling tests for scenarios like failed C2B transfers, webhook processing errors, and notification delivery issues
- Security tests to ensure the webhook handler is not vulnerable to replay attacks or other threats

### Story Draft Checklist Validation

| Category                             | Status  | Issues |
| ------------------------------------ | ------- | ------ |
| 1. Goal & Context Clarity            | PASS    |        |
| 2. Technical Implementation Guidance | PASS    |        |
| 3. Reference Effectiveness           | N/A     |        |
| 4. Self-Containment Assessment       | PASS    |        |
| 5. Testing Guidance                  | NEEDS REVISION    |        |

**Final Assessment:** NEEDS REVISION