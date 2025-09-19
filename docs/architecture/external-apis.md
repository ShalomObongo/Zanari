# External APIs

## M-PESA Daraja API Integration

**Purpose:** Integrate with Safaricom's M-PESA API for payment processing and round-up savings

**Purpose:** Primary payment integration for automated savings

**Documentation:** https://developer.safaricom.co.ke/docs

**Base URL(s):**
- Sandbox: https://sandbox.safaricom.co.ke
- Production: https://api.safaricom.co.ke

**Authentication:** OAuth 2.0 + API Key

**Rate Limits:**
- Sandbox: 30 requests per minute
- Production: 1000 requests per minute

**Key Endpoints Used:**

### B2C Payment API
- `POST /mpesa/b2c/v1/paymentrequest`
- **Purpose:** Transfer funds from Zanari to user's M-PESA (withdrawals)
- **Authentication:** OAuth 2.0 Access Token
- **Parameters:** Initiator, SecurityCredential, CommandID, Amount, PartyA, PartyB, Remarks, QueueTimeOutURL, ResultURL

### C2B Register API
- `POST /mpesa/c2b/v1/registerurl`
- **Purpose:** Register validation and confirmation URLs for C2B transactions
- **Authentication:** OAuth 2.0 Access Token
- **Parameters:** ValidationURL, ConfirmationURL, ResponseType, ShortCode

### STK Push API
- `POST /mpesa/stkpush/v1/processrequest`
- **Purpose:** Initiate STK push for user confirmation (deposits)
- **Authentication:** OAuth 2.0 Access Token
- **Parameters:** BusinessShortCode, Password, Timestamp, TransactionType, Amount, PartyA, PartyB, PhoneNumber, CallBackURL, AccountReference, TransactionDesc

### Transaction Status API
- `POST /mpesa/transactionstatus/v1/query`
- **Purpose:** Check status of M-PESA transactions
- **Authentication:** OAuth 2.0 Access Token
- **Parameters:** Initiator, SecurityCredential, CommandID, TransactionID, PartyA, IdentifierType, Remarks, QueueTimeOutURL, ResultURL

**Integration Notes:**

1. **Security Requirements:**
   - All API calls must use HTTPS
   - OAuth tokens must be refreshed every hour
   - Security credentials must be encrypted at rest
   - IP whitelisting required for production

2. **Error Handling:**
   - Implement retry logic with exponential backoff
   - Handle M-PESA specific error codes
   - Log all failed transactions for audit purposes
   - Provide user-friendly error messages

3. **Webhook Processing:**
   - Validation URL: Verify transaction authenticity
   - Confirmation URL: Process completed transactions
   - Implement idempotency for duplicate webhook calls
   - Respond within 30 seconds to prevent timeouts

4. **Rate Limiting:**
   - Implement request queuing during peak times
   - Monitor API usage to avoid limits
   - Implement circuit breaker pattern for API failures
   - Use multiple API keys if needed for scaling

**Webhook Security:**
- Validate M-PESA signatures using shared secret
- Verify transaction IDs to prevent replay attacks
- Implement IP whitelisting for webhook sources
- Log all webhook requests for audit trails

## SMS Gateway API Integration

**Purpose:** Send SMS notifications for transactions and account updates

**Documentation:** Provider-specific (Africa's Talking, Twilio, etc.)

**Base URL(s):** Provider-specific

**Authentication:** API Key + Username/Password

**Rate Limits:** Provider-specific, typically 10-50 messages per second

**Key Endpoints Used:**
- `POST /version1/messaging` - Send SMS messages
- `GET /version1/account` - Check account balance
- `POST /version1/airtime/send` - Send airtime (future feature)

**Integration Notes:**
- Implement message templates for common notifications
- Handle delivery status callbacks
- Optimize for Kenyan number formats
- Implement message queuing for bulk sends
