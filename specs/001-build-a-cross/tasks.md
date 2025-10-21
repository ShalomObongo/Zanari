# Tasks: Cross-Platform Savings & Payments Application

**Input**: Design documents from `/specs/001-build-a-cross/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory ✅
   → Tech stack: React Native + Expo, TypeScript, Supabase, Paystack
   → Structure: Mobile + API (React Native app with backend services)
2. Load design documents ✅:
   → data-model.md: 6 entities → 6 model tasks
   → contracts/api-spec.yaml: 22 endpoints → 22 contract test tasks
   → quickstart.md: 10 scenarios → 10 integration tests
3. Generated tasks by category:
   → Setup: 8 tasks (project init, dependencies, environment)
   → Tests: 42 tasks (22 contract + 10 integration + 10 unit)
   → Core: 28 tasks (6 models + 6 services + 16 components)
   → Integration: 12 tasks (API, payment, state management)
   → Polish: 8 tasks (performance, documentation, validation)
4. Applied task rules:
   → [P] tasks: Different files/independent components
   → Sequential: Shared files/dependencies
   → TDD: All tests before implementation
5. Total: 98 tasks across 5 phases
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Mobile + API**: `api/src/`, `src/` (React Native), `tests/`
- Database: Supabase PostgreSQL with migrations
- Storage: Supabase Storage for KYC documents
- Payment: Paystack Mobile Money API integration

## Phase 3.1: Environment & Setup
- [x] T001 Initialize React Native Expo project with TypeScript configuration
- [x] T002 [P] Configure Supabase client and environment variables in `src/config/supabase.ts`
- [x] T003 [P] Configure Paystack SDK and test credentials in `src/config/paystack.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before implementing.**
- [x] T004 [P] Set up database schema and migrations for 6 entities (User, Wallet, Transaction, SavingsGoal, RoundUpRule, KYCDocument) in `api/migrations/001_initial_schema.sql`
- [x] T005 [P] Configure ESLint, Prettier, and TypeScript strict mode
- [x] T006 [P] Set up React Native navigation structure in `src/navigation/AppNavigator.tsx`
- [x] T007 [P] Configure Zustand store structure in `src/store/index.ts`
- [x] T008 [P] Set up testing environment (Jest, React Native Testing Library, Detox)

## Phase 3.2: Contract Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Authentication Contract Tests
- [x] T009 [P] Contract test POST /auth/login in `tests/contract/auth/test_login.test.ts`
- [x] T010 [P] Contract test POST /auth/verify-otp in `tests/contract/auth/test_verify_otp.test.ts`
- [x] T011 [P] Contract test POST /auth/setup-pin in `tests/contract/auth/test_setup_pin.test.ts`
- [x] T012 [P] Contract test POST /auth/verify-pin in `tests/contract/auth/test_verify_pin.test.ts`

### Wallet Contract Tests
- [x] T013 [P] Contract test GET /wallets in `tests/contract/wallets/test_get_wallets.test.ts`
- [x] T014 [P] Contract test POST /wallets/{walletId}/withdraw in `tests/contract/wallets/test_withdraw.test.ts`

### Transaction Contract Tests
- [x] T015 [P] Contract test GET /transactions in `tests/contract/transactions/test_get_transactions.test.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before writing tests.**
- [x] T016 [P] Contract test GET /transactions/{transactionId} in `tests/contract/transactions/test_get_transaction_detail.test.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before writing tests.**

### Payment Contract Tests
- [x] T017 [P] Contract test POST /payments/merchant in `tests/contract/payments/test_merchant_payment.test.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before writing tests.**
- [x] T018 [P] Contract test POST /payments/transfer in `tests/contract/payments/test_p2p_transfer.test.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before writing tests.**

### Savings Goals Contract Tests
- [x] T019 [P] Contract test GET /savings-goals in `tests/contract/goals/test_get_goals.test.ts`
- [x] T020 [P] Contract test POST /savings-goals in `tests/contract/goals/test_create_goal.test.ts`
- [x] T021 [P] Contract test PUT /savings-goals/{goalId} in `tests/contract/goals/test_update_goal.test.ts`

### Round-up Rules Contract Tests
- [x] T022 [P] Contract test GET /round-up-rules in `tests/contract/roundup/test_get_rules.test.ts`
- [x] T023 [P] Contract test PUT /round-up-rules in `tests/contract/roundup/test_update_rules.test.ts`

### KYC Contract Tests
- [x] T024 [P] Contract test GET /kyc/documents in `tests/contract/kyc/test_get_documents.test.ts`
- [x] T025 [P] Contract test POST /kyc/documents in `tests/contract/kyc/test_upload_document.test.ts`

### Auto-Analyze Contract Tests
- [x] T107 [P] Contract test GET /round-up-rules/analyze in `tests/contract/roundup/test_auto_analyze.test.ts`

### Categorization Contract Tests
- [x] T108 [P] Contract test GET /transactions/categories in `tests/contract/transactions/test_get_categories.test.ts`
- [x] T109 [P] Contract test PUT /transactions/{transactionId}/category in `tests/contract/transactions/test_update_category.test.ts`

### Integration Tests (Based on Quickstart Scenarios)
- [x] T026 [P] Integration test user onboarding flow in `tests/integration/test_user_onboarding.test.ts`
- [x] T027 [P] Integration test payment with round-up in `tests/integration/test_payment_roundup.test.ts`
- [x] T028 [P] Integration test savings goal creation in `tests/integration/test_savings_goal.test.ts`
- [x] T029 [P] Integration test P2P transfer in `tests/integration/test_p2p_transfer.test.ts`
- [x] T030 [P] Integration test bill payment in `tests/integration/test_bill_payment.test.ts`
- [x] T031 [P] Integration test savings withdrawal in `tests/integration/test_savings_withdrawal.test.ts`
- [x] T032 [P] Integration test round-up configuration in `tests/integration/test_roundup_config.test.ts`
- [x] T033 [P] Integration test PIN security in `tests/integration/test_pin_security.test.ts`
- [x] T034 [P] Integration test offline functionality in `tests/integration/test_offline_mode.test.ts`
- [x] T035 [P] Integration test KYC document processing in `tests/integration/test_kyc_processing.test.ts`

## Phase 3.3: Data Models (ONLY after tests are failing)
- [x] T036 [P] User model with authentication in `api/src/models/User.ts`
- [x] T037 [P] Wallet model with balance management in `api/src/models/Wallet.ts`
- [x] T038 [P] Transaction model with state management in `api/src/models/Transaction.ts`
- [x] T039 [P] SavingsGoal model with milestone tracking in `api/src/models/SavingsGoal.ts`
- [x] T040 [P] RoundUpRule model with auto-analysis in `api/src/models/RoundUpRule.ts`
- [x] T041 [P] KYCDocument model with encryption in `api/src/models/KYCDocument.ts`

## Phase 3.4: Core Services (ONLY after models)
- [x] T042 AuthService with PIN management in `api/src/services/AuthService.ts`
- [x] T043 WalletService with balance operations in `api/src/services/WalletService.ts`
- [x] T044 TransactionService with round-up logic in `api/src/services/TransactionService.ts`
- [x] T101 Transaction limits validation (KES 5,000 single, KES 20,000 daily) in `api/src/services/TransactionService.ts`
- [x] T045 PaymentService with Paystack integration and exponential backoff retry logic (3 attempts, 1s→2s→4s intervals, queue on failure) in `api/src/services/PaymentService.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before implementing.**
- [x] T046 SavingsGoalService with milestone tracking in `api/src/services/SavingsGoalService.ts`
- [x] T047 KYCService with document processing in `api/src/services/KYCService.ts`
- [x] T102 AutoAnalyzeService for optimal round-up calculation using 30-day transaction history and spending pattern analysis in `api/src/services/AutoAnalyzeService.ts`
- [x] T103 CategorizationService with rule-based merchant categorization (80% accuracy target) and manual re-tagging support in `api/src/services/CategorizationService.ts`

## Phase 3.5: API Endpoints Implementation
### Authentication Endpoints
- [x] T048 POST /auth/login endpoint in `api/src/routes/auth.ts`
- [x] T049 POST /auth/verify-otp endpoint in `api/src/routes/auth.ts`
- [x] T050 POST /auth/setup-pin endpoint in `api/src/routes/auth.ts`
- [x] T051 POST /auth/verify-pin endpoint in `api/src/routes/auth.ts`

### Wallet Endpoints
- [x] T052 GET /wallets endpoint in `api/src/routes/wallets.ts`
- [x] T053 POST /wallets/{walletId}/withdraw endpoint in `api/src/routes/wallets.ts`

### Transaction Endpoints
- [x] T054 GET /transactions endpoint in `api/src/routes/transactions.ts`
- [x] T055 GET /transactions/{transactionId} endpoint in `api/src/routes/transactions.ts`

### Payment Endpoints
- [x] T056 POST /payments/merchant endpoint in `api/src/routes/payments.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before coding.**
- [x] T057 POST /payments/transfer endpoint in `api/src/routes/payments.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before coding.**

### Savings Goal Endpoints
- [x] T058 GET /savings-goals endpoint in `api/src/routes/savings-goals.ts`
- [x] T059 POST /savings-goals endpoint in `api/src/routes/savings-goals.ts`
- [x] T060 PUT /savings-goals/{goalId} endpoint in `api/src/routes/savings-goals.ts`

### Round-up Rule Endpoints
- [x] T061 GET /round-up-rules endpoint in `api/src/routes/round-up-rules.ts`
- [x] T062 PUT /round-up-rules endpoint in `api/src/routes/round-up-rules.ts`

### KYC Endpoints
- [x] T063 GET /kyc/documents endpoint in `api/src/routes/kyc.ts`
- [x] T064 POST /kyc/documents endpoint in `api/src/routes/kyc.ts`

### Auto-Analyze Endpoints
- [x] T104 GET /round-up-rules/analyze endpoint for auto-optimization in `api/src/routes/round-up-rules.ts`

### Categorization Endpoints
- [x] T105 GET /transactions/categories endpoint in `api/src/routes/transactions.ts`
- [x] T106 PUT /transactions/{transactionId}/category endpoint for manual re-tagging in `api/src/routes/transactions.ts`

## Phase 3.6: React Native UI Components
### Authentication Screens
- [x] T065 [P] Welcome screen in `src/screens/auth/WelcomeScreen.tsx`
- [x] T066 [P] Login screen in `src/screens/auth/LoginScreen.tsx`
- [x] T067 [P] OTP verification screen in `src/screens/auth/OTPScreen.tsx`
- [x] T068 [P] PIN setup screen in `src/screens/auth/PINSetupScreen.tsx`
- [x] T069 [P] PIN entry screen in `src/screens/auth/PINEntryScreen.tsx`

### Main App Screens
- [x] T070 [P] Dashboard screen in `src/screens/main/DashboardScreen.tsx`
- [x] T071 [P] Payment screen in `src/screens/payments/PaymentScreen.tsx`
- [x] T072 [P] Transfer screen in `src/screens/payments/TransferScreen.tsx`
- [x] T073 [P] Transaction history screen in `src/screens/transactions/TransactionHistoryScreen.tsx`
- [x] T074 [P] Savings goals screen in `src/screens/savings/SavingsGoalsScreen.tsx`
- [x] T075 [P] Settings screen in `src/screens/settings/SettingsScreen.tsx`
- [x] T076 [P] KYC upload screen in `src/screens/kyc/KYCUploadScreen.tsx`

### Shared Components
 - [x] T077 [P] Transaction card component in `src/components/TransactionCard.tsx`
 - [x] T078 [P] Balance display component in `src/components/BalanceDisplay.tsx`
 - [x] T079 [P] Progress bar component in `src/components/ProgressBar.tsx`
 - [x] T080 [P] PIN input component in `src/components/PINInput.tsx`

## Phase 3.7: State Management & Integration
- [x] T081 User authentication store in `src/store/authStore.ts`
- [x] T082 Wallet balance store in `src/store/walletStore.ts`
- [x] T083 Transaction history store in `src/store/transactionStore.ts`
- [x] T084 Savings goals store in `src/store/savingsStore.ts`
- [x] T085 API client with error handling in `src/services/api.ts` (depends on T048-T064 API endpoints)
- [x] T086 Paystack payment integration in `src/services/paystack.ts` - **REQUIREMENT: Refer to `docs/paystack-links.md` and review the referenced Paystack docs (do research) before implementing.**
- [x] T087 Offline data synchronization in `src/services/syncService.ts`
- [x] T088 Push notification setup for transaction alerts, savings milestones, and payment confirmations in `src/services/notificationService.ts`

## Phase 3.8: Security & Error Handling
- [x] T089 PIN encryption and validation in `src/utils/pinSecurity.ts`
- [x] T100 Progressive PIN delay implementation (30s→2min→5min→15min) in `src/utils/pinSecurity.ts`
- [x] T090 Request/response interceptors in `src/services/interceptors.ts`
- [x] T091 Error boundary components in `src/components/ErrorBoundary.tsx`
- [x] T092 Biometric authentication setup in `src/services/biometricAuth.ts`
- [x] T099 Security testing for PIN delay system with automated brute-force simulation in `tests/security/test_pin_security.test.ts`

## Phase 3.9: Polish & Validation
- [x] T093 [P] Unit tests for round-up calculation in `tests/unit/test_roundup_calculation.test.ts`
- [x] T094 [P] Unit tests for PIN security in `tests/unit/test_pin_security.test.ts`
- [x] T095 [P] Unit tests for transaction validation in `tests/unit/test_transaction_validation.test.ts`
- [x] T096 [P] Performance optimization and validation: mobile interactions <200ms p95, API endpoints <300ms p95, load testing with 100 concurrent users, memory usage <100MB per process in `tests/performance/performance_benchmarks.test.ts`
- [x] T097 [P] Update README.md with setup instructions
- [x] T098 Execute quickstart.md validation scenarios

## Dependencies

### Critical Path Dependencies
- **Setup** (T001-T008) must complete before any other phase
- **Contract Tests** (T009-T035) must complete and FAIL before implementation
- **Models** (T036-T041) must complete before Services (T042-T047)
- **Services** (T042-T047) must complete before API Endpoints (T048-T064)
- **API Endpoints** must complete before UI Components can connect to backend

### Specific Task Dependencies
- T004 (database schema) blocks T036-T041 (models)
- T002 (Supabase config) blocks T036-T041 (models)
- T003 (Paystack config) blocks T045 (PaymentService)
- T042 (AuthService) blocks T048-T051 (auth endpoints)
- T081-T084 (stores) depend on T085 (API client)
- T085 (API client) depends on T048-T064 (API endpoints)

### Additional Dependencies
- T100 (PIN progressive delays) depends on T089 (PIN encryption)
- T101 (transaction limits) must complete before T048-T064 (API endpoints)
- T085 (API client) depends on completion of T048-T064 (all API endpoints)

### Parallel Execution Groups
```
# Phase 3.1 - Setup (can run T002, T003, T005, T007, T008 in parallel)
T002: Configure Supabase client
T003: Configure Paystack SDK  
T005: Configure linting tools
T007: Configure Zustand stores
T008: Set up testing environment

# Phase 3.2 - Contract Tests (all T009-T035 can run in parallel)
T009-T025: API contract tests (22 tests)
T026-T035: Integration tests (10 tests)

# Phase 3.3 - Models (all T036-T041 can run in parallel after T004)
T036: User model
T037: Wallet model
T038: Transaction model
T039: SavingsGoal model
T040: RoundUpRule model
T041: KYCDocument model

# Phase 3.6 - UI Components (T065-T080 can run in parallel)
T065-T069: Authentication screens
T070-T076: Main app screens
T077-T080: Shared components

# Phase 3.9 - Unit Tests (T093-T095 can run in parallel)
T093: Round-up calculation tests
T094: PIN security tests
T095: Transaction validation tests
```

## Parallel Example
```bash
# Launch contract tests together (Phase 3.2):
Task: "Contract test POST /auth/login in tests/contract/auth/test_login.test.ts"
Task: "Contract test GET /wallets in tests/contract/wallets/test_get_wallets.test.ts"
Task: "Contract test POST /payments/merchant in tests/contract/payments/test_merchant_payment.test.ts"
Task: "Integration test user onboarding flow in tests/integration/test_user_onboarding.test.ts"

# Launch model creation together (Phase 3.3):
Task: "User model with authentication in api/src/models/User.ts"
Task: "Wallet model with balance management in api/src/models/Wallet.ts"  
Task: "Transaction model with state management in api/src/models/Transaction.ts"

# Launch service layer together (Phase 3.4):
Task: "AuthService with PIN management in api/src/services/AuthService.ts"
Task: "WalletService with balance operations in api/src/services/WalletService.ts"
Task: "TransactionService with round-up logic in api/src/services/TransactionService.ts"
Note: T101 (transaction limits) must complete before API endpoint tasks

# Launch UI components together (Phase 3.6):
Task: "Dashboard screen in src/screens/main/DashboardScreen.tsx"
Task: "Payment screen in src/screens/payments/PaymentScreen.tsx"
Task: "Settings screen in src/screens/settings/SettingsScreen.tsx"
```

## Notes
- **[P] tasks**: Different files, no dependencies - can run simultaneously
- **Sequential tasks**: Shared files or dependency relationships
- **TDD Requirement**: All tests (T009-T035) must fail before implementation
- **File Conflicts**: No [P] task modifies the same file as another [P] task
- **Commit Strategy**: Commit after each task completion
- **Testing**: Run tests continuously during development

## Task Generation Rules Applied

1. **From API Contracts** (22 endpoints):
   - Each endpoint → contract test task [P] (T009-T025)
   - Each endpoint → implementation task (T048-T064)
   
2. **From Data Model** (6 entities):
   - Each entity → model creation task [P] (T036-T041)
   - Relationships → service layer tasks (T042-T047)
   
3. **From User Stories** (10 quickstart scenarios):
   - Each story → integration test [P] (T026-T035)
   - Quickstart validation → final task (T098)

4. **From Tech Stack** (React Native + Expo + Supabase + Paystack):
   - Environment setup → setup tasks (T001-T008)
   - UI components → React Native screens (T065-T076)
   - State management → Zustand stores (T081-T084)

## Validation Checklist ✅
**GATE: Checked before task execution**

- [x] All 22 API contracts have corresponding tests (T009-T025)
- [x] All 6 entities have model tasks (T036-T041)
- [x] All contract and integration tests come before implementation (T009-T035 → T036+)
- [x] Parallel tasks are truly independent (different files, no shared dependencies)
- [x] Each task specifies exact file path with proper structure (api/, src/, tests/)
- [x] No [P] task modifies same file as another [P] task
- [x] TDD workflow enforced (tests first, implementation after)
- [x] All quickstart scenarios have corresponding integration tests
- [x] Dependencies properly mapped and sequential execution enforced

## Summary
- **Total Tasks**: 109 tasks across 9 phases (updated after adding missing coverage)
- **Parallel Tasks**: 55 tasks marked [P] for concurrent execution
- **Sequential Tasks**: 54 tasks with dependency requirements
- **Test Tasks**: 45 tasks (25 contract + 10 integration + 10 unit)
- **Implementation Tasks**: 64 tasks (models, services, endpoints, UI, security)
- **Expected Timeline**: 4-5 weeks with parallel execution capabilities
- **Constitutional Compliance**: TDD approach, <200ms response times, security-first design

**Status**: ✅ READY FOR EXECUTION - All tasks validated and dependencies mapped