# Quickstart Guide: Cross-Platform Savings & Payments Application

**Date**: 2025-09-23  
**Feature**: 001-build-a-cross  
**Purpose**: End-to-end testing and validation of core user scenarios

## Prerequisites

### Environment Setup
- React Native development environment (Node.js 18+, React Native CLI)
- Expo CLI installed globally (`npm install -g expo-cli`)
- iOS Simulator (macOS) and/or Android Emulator
- Supabase project configured with database schema
- Paystack test account with API keys
- Test M-Pesa phone numbers (Paystack sandbox)

### Test Data
- Test user email: `sarah.test@zanari.app`
- Test M-Pesa phone: `254712345678` (Paystack sandbox)
- Test merchant till number: `123456`
- Test paybill: `400200` with account `ACC001`

## Core User Journey Validation

### Scenario 1: First-Time User Onboarding
**Goal**: Validate complete user registration and setup flow

```bash
# Test Steps:
1. Open app → Should show welcome screen
2. Tap "Sign Up" → Enter email: sarah.test@zanari.app
3. Check email → Enter 6-digit OTP code
4. Complete profile → Enter name: "Sarah Mutindi"
5. Set PIN → Enter 4-digit PIN (test: 1234)
6. KYC Upload → Upload test ID photo and selfie
7. Initial wallet setup → Should see KES 0.00 in both wallets

# Expected Results:
✅ User account created with 'pending' KYC status
✅ Two wallets created (main: KES 0, savings: KES 0)  
✅ Round-up rule created (default: 10 KES increment, enabled)
✅ PIN authentication required for next app launch
```

**Validation Commands**:
```sql
-- Check user creation
SELECT id, email, kyc_status, created_at FROM users WHERE email = 'sarah.test@zanari.app';

-- Check wallet creation  
SELECT wallet_type, balance FROM wallets WHERE user_id = (SELECT id FROM users WHERE email = 'sarah.test@zanari.app');

-- Check round-up rule
SELECT increment_type, is_enabled FROM round_up_rules WHERE user_id = (SELECT id FROM users WHERE email = 'sarah.test@zanari.app');
```

---

### Scenario 2: Add Money and First Payment with Round-up
**Goal**: Validate payment processing and automatic round-up savings

```bash
# Test Steps:
1. Add KES 1,000 to main wallet (simulated top-up)
2. Navigate to "Pay Merchant" 
3. Enter amount: KES 230
4. Enter merchant: "Java House", Till: 123456
5. Enter PIN: 1234
6. Confirm payment

# Expected Results:
✅ Payment transaction: KES 230 to merchant
✅ Round-up transaction: KES 20 to savings wallet (230 → 250)
✅ Main wallet balance: KES 750 (1000 - 230 - 20)
✅ Savings wallet balance: KES 20
✅ Transaction history shows both transactions
```

**Validation Commands**:
```sql
-- Check wallet balances after payment
SELECT w.wallet_type, w.balance 
FROM wallets w 
JOIN users u ON w.user_id = u.id 
WHERE u.email = 'sarah.test@zanari.app';

-- Check transaction records
SELECT type, amount, status, round_up_details 
FROM transactions t
JOIN users u ON t.user_id = u.id  
WHERE u.email = 'sarah.test@zanari.app'
ORDER BY created_at DESC;
```

---

### Scenario 3: Savings Goal Creation and Progress Tracking
**Goal**: Validate savings goal management and milestone tracking

```bash
# Test Steps:
1. Navigate to "Savings Goals"
2. Tap "Create Goal"
3. Enter name: "Emergency Fund"
4. Target amount: KES 5,000
5. Target date: 2025-12-31
6. Enable lock-in: No
7. Save goal

# Expected Results:
✅ Savings goal created with 0.4% progress (20/5000)
✅ Goal shows current savings: KES 20
✅ Progress bar displays correctly
✅ No milestones reached yet (need 25% = KES 1,250)
```

**Additional Round-up Test**:
```bash
# Make additional payments to test milestone progress
1. Pay KES 480 → rounds to KES 500 (saves KES 20)
2. Pay KES 750 → rounds to KES 760 (saves KES 10) 
3. Continue until savings reach KES 1,250 (25% milestone)

# Expected Results:
✅ Milestone notification at 25% completion
✅ Goal progress updates in real-time
✅ Total round-ups: 62 transactions, KES 1,250 saved
```

---

### Scenario 4: P2P Money Transfer
**Goal**: Validate peer-to-peer transfer with round-up

```bash
# Test Steps:
1. Navigate to "Send Money"
2. Enter recipient: 254712345679 (different test number)
3. Enter amount: KES 500  
4. Add note: "Money for textbooks"
5. Enter PIN: 1234
6. Confirm transfer

# Expected Results:
✅ Transfer transaction: KES 500 sent
✅ Round-up transaction: KES 10 to savings (500 → 510)
✅ Main wallet debited: KES 510 total
✅ Recipient receives KES 500 (no round-up for them)
✅ Transaction categorized as "transfer"
```

---

### Scenario 5: Bill Payment (Paybill)
**Goal**: Validate utility bill payment through M-Pesa paybill

```bash
# Test Steps:
1. Navigate to "Pay Bills"
2. Select "Utilities"
3. Enter paybill: 400200
4. Enter account: ACC001
5. Enter amount: KES 1,500
6. Enter PIN: 1234
7. Confirm payment

# Expected Results:
✅ Bill payment: KES 1,500 processed via Paystack
✅ Round-up: KES 10 saved (1500 → 1510) 
✅ Paystack transaction ID recorded
✅ Transaction categorized as "utilities"
✅ Payment confirmation received
```

---

### Scenario 6: Savings Wallet Withdrawal
**Goal**: Validate savings withdrawal with settlement delay

```bash
# Test Steps:
1. Navigate to savings wallet
2. Current balance should be ~KES 1,290 (from previous round-ups)
3. Tap "Withdraw"
4. Enter amount: KES 200
5. Enter M-Pesa phone: 254712345678
6. Enter PIN: 1234
7. Confirm withdrawal

# Expected Results:
✅ Withdrawal status: "Processing" 
✅ Settlement delay: 1-2 minutes shown
✅ M-Pesa integration via Paystack initiated
✅ Balance temporarily reduced during processing
✅ After delay: withdrawal completed, M-Pesa received
```

---

### Scenario 7: Round-up Configuration Changes
**Goal**: Validate round-up rule customization

```bash
# Test Steps:
1. Navigate to "Settings" → "Round-up Rules"
2. Current: 10 KES increment, enabled
3. Change to: 50 KES increment
4. Make test payment: KES 430
5. Verify round-up: KES 20 saved (430 → 450)

# Test Auto-analyze Feature:
1. Change to "Auto" increment type
2. Set analysis period: 30 days
3. Make several varied payments
4. Check that round-ups adapt to spending patterns

# Expected Results:
✅ Round-up rule updates successfully
✅ New increment applied to subsequent payments
✅ Auto-analyze optimizes round-up amounts based on history
✅ Statistics show total round-ups and amount saved
```

---

### Scenario 8: Security and PIN Management
**Goal**: Validate security features and PIN protection

```bash
# Test Failed PIN Attempts:
1. Close app and reopen
2. Enter wrong PIN: 0000 → "Invalid PIN, 4 attempts remaining"
3. Enter wrong PIN: 1111 → "Invalid PIN, 3 attempts remaining"  
4. Enter wrong PIN: 2222 → "Invalid PIN, 2 attempts remaining"
5. Enter wrong PIN: 3333 → "Account locked for 30 seconds"
6. Wait 30 seconds, enter correct PIN: 1234 → Access granted

# Test Transaction Security:
1. Attempt payment without PIN token → Should fail
2. Use expired PIN token → Should fail  
3. Enter correct PIN and complete payment → Should succeed

# Expected Results:
✅ Progressive delays enforced correctly (30s → 2min → 5min → 15min)
✅ PIN verification required for all transactions
✅ Failed attempts counter resets after successful authentication
✅ Transaction authorization tokens expire appropriately
```

---

### Scenario 9: Offline Functionality
**Goal**: Validate app behavior without network connectivity

```bash
# Test Steps:
1. Ensure app has cached data (previous transactions, balances)
2. Disable device internet connection
3. Open app → Enter PIN to access
4. Navigate through transaction history
5. View current balances (should show last known values)
6. Attempt new payment → Should show "offline" message

# Re-enable Network:
1. Turn internet back on
2. Pull to refresh on transaction history
3. Balances should update if changes occurred server-side

# Expected Results:
✅ Offline access to historical data and balances
✅ Graceful handling of network failures
✅ Clear offline indicators and messaging
✅ Automatic sync when connectivity returns
```

---

### Scenario 10: KYC Document Processing
**Goal**: Validate document upload and verification flow

```bash
# Test Steps:
1. Navigate to "Profile" → "Identity Verification"
2. Current status should show uploaded documents
3. Simulate KYC approval (manual admin action)
4. Check app updates to show "Verified" status
5. Higher transaction limits should be available

# Test Higher Limits Post-KYC:
1. Attempt payment > KES 5,000 → Should succeed after KYC
2. Daily limit increases should apply
3. Savings goal limits should increase

# Expected Results:
✅ KYC status updates reflect server-side changes
✅ Transaction limits increase after verification
✅ UI shows verification badges and status
✅ Document security and encryption maintained
```

---

## Performance Validation

### Response Time Testing
```bash
# Target Metrics:
- App startup: < 3 seconds to main screen
- PIN entry response: < 200ms
- Payment processing: < 2 seconds 
- Transaction history load: < 1 second
- Balance refresh: < 500ms

# Load Testing:
- 100 rapid round-up calculations: < 1 second total
- Transaction list pagination: < 500ms per page
- Real-time balance updates: < 200ms after transaction
```

### Memory and Battery Usage
```bash
# Monitoring:
- RAM usage: < 100MB during normal operation
- Battery impact: Minimal background processing
- Storage: < 50MB app size + user data
- Network usage: Efficient API calls, cached data
```

---

## Error Handling Validation

### Network Error Scenarios
```bash
# Test Cases:
1. Payment during network timeout → Should queue and retry
2. Server error (500) → Should show retry option
3. API rate limiting → Should backoff and retry
4. Paystack service down → Should queue transactions

# Expected Results:
✅ Graceful error messages with clear actions
✅ Transaction queuing prevents data loss
✅ Exponential backoff prevents API flooding
✅ User notifications when retries fail
```

### Financial Error Scenarios
```bash
# Test Cases:
1. Insufficient funds → Clear message, no partial charge
2. Round-up insufficient → Skip round-up, process payment
3. Duplicate transaction → Idempotency prevents double-charge
4. Paystack payment failure → Proper rollback handling

# Expected Results:  
✅ Financial integrity maintained in all error cases
✅ Clear error messages help user understand issues
✅ No money lost during error scenarios
✅ Audit trail preserved for troubleshooting
```

---

## Success Criteria

The quickstart is considered successful when:

1. **✅ Core Flows Complete**: All 10 scenarios execute without critical errors
2. **✅ Data Integrity**: Database state matches expected values after each scenario
3. **✅ Performance Targets**: Response times meet constitutional requirements
4. **✅ Security Validation**: PIN protection and transaction security function correctly
5. **✅ Financial Accuracy**: All money movements are accurate and traceable
6. **✅ Error Resilience**: App handles errors gracefully without data corruption
7. **✅ User Experience**: UI remains responsive and provides clear feedback

## Troubleshooting Guide

### Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| OTP not received | Email/SMS not delivered | Check spam folder, verify test credentials |
| Payment fails | "Transaction failed" error | Verify Paystack test mode settings |
| Round-up not working | No savings wallet credit | Check round-up rule configuration |
| PIN lockout | Cannot access app | Wait for lockout period or reset via email |
| Offline sync issues | Stale data after reconnect | Force app refresh, check API endpoints |
| KYC upload fails | Document rejection | Verify file size < 10MB, format JPEG/PNG |

### Logs and Debugging
```bash
# Check application logs:
npx react-native log-ios     # iOS logs
npx react-native log-android # Android logs

# Check API response logs:
# Monitor network tab in React Native Debugger
# Verify Supabase dashboard for database queries
# Check Paystack dashboard for payment webhooks
```

---

**Quickstart Status**: ✅ READY FOR EXECUTION  
**Next Phase**: Task Generation (Phase 2)