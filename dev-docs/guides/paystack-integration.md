# Paystack Payment Flow - Callback-Based (Simplified)

**Integration Pattern:** Client-Side Verification with Paystack WebView

---

## 📋 Overview

Zanari2 uses the **simplified callback-based approach** recommended for React Native Paystack integrations. This eliminates the need for complex webhook infrastructure while maintaining payment security.

**Flow:**
1. **Backend** initializes transaction via Paystack API → returns `reference`
2. **Mobile app** uses `react-native-paystack-webview` with the `reference`
3. **Paystack WebView** handles payment securely in-app
4. **onSuccess callback** fires when payment completes
5. **Mobile app** calls backend `/payments/verify` endpoint
6. **Backend** updates transaction status to `completed`

---

## ✅ Why This Approach?

### Advantages:
- ✅ **Simpler setup** - No webhook URLs, no ngrok for local dev
- ✅ **Faster development** - No need to configure public endpoints
- ✅ **Better UX** - Immediate payment confirmation in the app
- ✅ **Works with Expo** - No native configuration required
- ✅ **Recommended by library** - Official `react-native-paystack-webview` pattern

### When Webhooks ARE Useful:
- 🔄 **Recurring subscriptions** - Background charge notifications
- 📱 **Offline scenarios** - User closes app before callback fires
- 🔐 **Extra security** - Double verification (callback + webhook)
- 💸 **Refunds/disputes** - Notification when payment is reversed

**For Zanari2's use case (immediate merchant payments, top-ups, and external transfers)**, webhooks are optional.

---

## 🔧 Implementation

### 1. Backend Payment Initialization

This pattern applies to:
- **Merchant Payments**: `POST /payments/merchant`
- **Wallet Top-ups**: `POST /payments/topup`
- **External P2P Transfers**: `POST /payments/transfer` (when payment_method is mpesa/card)

**Example Endpoint:** `POST /payments/merchant`

**Request:**
```json
{
  "amount": 23000,
  "pin_token": "txn_abc123",
  "merchant_info": {
    "name": "Java House",
    "till_number": "123456"
  },
  "description": "Lunch payment"
}
```

**Response:**
```json
{
  "payment_transaction_id": "uuid-payment-123",
  "paystack_reference": "ps_ref_xyz789",
  "paystack_access_code": "access_code_456",
  "paystack_authorization_url": "https://checkout.paystack.com/...",
  "total_charged": 25000,
  "round_up_amount": 2000,
  "paystack_status": "pending"
}
```

### 2. Mobile App Payment Execution

```typescript
import { usePaystack } from 'react-native-paystack-webview';

const PaymentScreen = () => {
  const { popup } = usePaystack();

  const handlePay = async () => {
    // 1. Initialize with backend
    const response = await api.post('/payments/merchant', {
      amount: 23000, // KES 230 in cents
      pin_token: pinToken,
      merchant_info: {
        name: 'Java House',
        till_number: '123456'
      }
    });

    const { paystack_reference } = response.data;

    // 2. Open Paystack checkout
    popup.newTransaction({
      email: userEmail,
      amount: 230, // KES (not cents)
      reference: paystack_reference,
      onSuccess: async (res) => {
        console.log('Payment successful:', res);
        
        // 3. Verify with backend
        await api.post('/payments/verify', {
          reference: paystack_reference
        });

        // 4. Show success UI
        navigation.navigate('PaymentSuccess');
      },
      onCancel: () => {
        console.log('User cancelled payment');
        Alert.alert('Payment Cancelled');
      },
      onError: (error) => {
        console.error('Payment error:', error);
        Alert.alert('Payment Failed', error.message);
      }
    });
  };

  return <Button title="Pay Now" onPress={handlePay} />;
};
```

### 3. Backend Payment Verification

**Endpoint:** `POST /payments/verify`

**Request:**
```json
{
  "reference": "ps_ref_xyz789"
}
```

**Response:**
```json
{
  "transaction_id": "uuid-payment-123",
  "status": "completed",
  "amount": 23000,
  "verified_at": "2025-10-03T12:34:56Z"
}
```

**Backend Logic:**
```typescript
// api/src/routes/payments.ts
verifyPayment: async (request) => {
  const { reference } = request.body;
  
  // Find transaction by Paystack reference
  const transaction = await transactionRepository.findByExternalReference(reference);
  
  if (!transaction) {
    throw new HttpError(404, 'Transaction not found');
  }
  
  // Update status to completed
  const updated = await transactionRepository.update({
    ...transaction,
    status: 'completed',
    updatedAt: new Date()
  });
  
  return { transaction_id: updated.id, status: 'completed' };
}
```

---

## 🧪 Testing

### Test Payment Flow:

```bash
# 1. Start API server
npm run dev:api

# 2. Start React Native app
npm start

# 3. In app, initiate payment

# 4. Use Paystack test credentials:
Test Card: 4084084084084081
Expiry: 09/26
CVV: 408
```

### Test M-Pesa:
```
Phone: +254710000000
PIN: Any 4-digit
OTP: 123456 (auto-fills in test mode)
```

---

## 🔐 Security Considerations

### 1. Transaction Reference Validation
```typescript
// Backend verifies user owns the transaction
if (transaction.userId !== request.userId) {
  throw new HttpError(403, 'Access denied');
}
```

### 2. Idempotency
```typescript
// Allow multiple verify calls (user might retry)
if (transaction.status === 'completed') {
  return { already_verified: true, ...transaction };
}
```

### 3. Amount Verification
```typescript
// In production, optionally call Paystack Verify API
const paystackVerification = await paystackClient.verifyTransaction(reference);

if (paystackVerification.amount !== transaction.amount) {
  throw new Error('Amount mismatch');
}
```

---

## 🚀 Going Live

Before production:

- [ ] Replace test Paystack keys with live keys
- [ ] Add real user email to `popup.newTransaction()`
- [ ] Implement proper PIN verification flow
- [ ] Add loading states and error handling
- [ ] Log payment events for monitoring
- [ ] Consider adding optional webhooks for backup verification

---

## 📊 Monitoring

### Key Metrics to Track:
- Payment success rate (onSuccess / attempts)
- Verification failures (callback fired but verify failed)
- User cancellations (onCancel rate)
- Average payment completion time

### Logging:
```typescript
logger.info('Payment initiated', {
  userId,
  amount,
  reference,
  timestamp: new Date().toISOString()
});

logger.info('Payment verified', {
  userId,
  reference,
  verificationTime: Date.now() - startTime
});
```

---

## 🆘 Troubleshooting

### "Transaction not found" on verify
**Cause:** Race condition - verify called before backend created transaction
**Solution:** Add retry logic or ensure initialization completes

### onSuccess callback not firing
**Cause:** Paystack WebView closed before payment completed
**Solution:** Add `onCancel` and `onError` handlers to guide user

### Duplicate transactions
**Cause:** User initiated payment multiple times
**Solution:** Disable button during loading, check for pending transactions

---

## 📝 Optional: Add Webhooks for Backup

If you want extra reliability, you can keep webhook handler as backup:

```typescript
// api/src/routes/webhooks.ts
// Handle charge.success event
if (event === 'charge.success') {
  const transaction = await transactionRepository.findByExternalReference(data.reference);
  
  // Only update if not already completed (callback might have already done this)
  if (transaction && transaction.status !== 'completed') {
    await transactionRepository.update({
      ...transaction,
      status: 'completed',
      updatedAt: new Date()
    });
  }
}
```

This provides a safety net if the mobile callback fails for any reason.

---

**Happy Coding! 🎉**

The callback-based approach is simpler, faster to implement, and perfect for Zanari2's immediate payment use case.
