# M-PESA Daraja API Integration Setup Guide

## Overview

This guide provides detailed instructions for setting up M-PESA Daraja API integration for the Zanari application. This is a critical component that enables automated savings through M-PESA transactions.

## Prerequisites

Before starting, ensure you have:
- Active Safaricom M-PESA business account
- Registered business with necessary documentation
- Technical team with API integration experience
- SSL certificate for production webhooks
- Development environment with Node.js 18+ and TypeScript

## Step 1: Daraja Developer Portal Setup

### 1.1 Account Registration
1. Navigate to [Safaricom Developer Portal](https://developer.safaricom.co.ke)
2. Click "Register" and create a developer account
3. Verify your email address
4. Complete your profile with business information

### 1.2 Create New Application
1. Log in to the developer portal
2. Navigate to "My Apps" → "Create New App"
3. Fill in application details:
   - **App Name:** "Zanari Production" or "Zanari Sandbox"
   - **Description:** "Automated savings platform"
   - **Callback URLs:**
     - Sandbox: `https://your-app-url/api/webhooks/mpesa/sandbox`
     - Production: `https://your-app-url/api/webhooks/mpesa/production`
4. Select required APIs:
   - [x] C2B (Customer to Business)
   - [x] B2C (Business to Customer)
   - [x] STK Push
   - [x] Transaction Status
   - [x] Account Balance

### 1.3 Obtain API Credentials
After creating the app, you'll receive:
- **Consumer Key:** Public identifier for your application
- **Consumer Secret:** Secret key for authentication
- **Passkey:** For STK Push transactions
- **Shortcode:** Your business short code
- **Initiator Name:** For B2C transactions
- **Security Credential:** Encrypted credential for B2C

**Important:** Store these credentials securely in your environment variables.

## Step 2: Environment Configuration

### 2.1 Environment Variables
Create a `.env` file in your project root:

```bash
# M-PESA API Configuration
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=your_shortcode
MPESA_INITIATOR_NAME=your_initiator_name
MPESA_SECURITY_CREDENTIAL=your_security_credential

# Environment Configuration
MPESA_ENVIRONMENT=sandbox  # or 'production'

# Webhook Configuration
MPESA_C2B_VALIDATION_URL=https://your-app-url/api/webhooks/mpesa/validation
MPESA_C2B_CONFIRMATION_URL=https://your-app-url/api/webhooks/mpesa/confirmation
MPESA_RESULT_URL=https://your-app-url/api/webhooks/mpesa/result
MPESA_TIMEOUT_URL=https://your-app-url/api/webhooks/mpesa/timeout

# Callback URLs (for development)
MPESA_CALLBACK_URL=http://localhost:3001/api/webhooks/mpesa/callback
```

### 2.2 API Endpoints Configuration
Create configuration for different environments:

```typescript
// config/mpesa.ts
export const MPESA_CONFIG = {
  sandbox: {
    auth: {
      baseUrl: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    },
    c2b: {
      registerUrl: 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl',
      simulate: 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate',
    },
    stkPush: {
      request: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      query: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/querystatus',
    },
    transactionStatus: 'https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query',
    accountBalance: 'https://sandbox.safaricom.co.ke/mpesa/accountbalance/v1/query',
  },
  production: {
    auth: {
      baseUrl: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    },
    c2b: {
      registerUrl: 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl',
      simulate: 'https://api.safaricom.co.ke/mpesa/c2b/v1/simulate',
    },
    stkPush: {
      request: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      query: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/querystatus',
    },
    transactionStatus: 'https://api.safaricom.co.ke/mpesa/transactionstatus/v1/query',
    accountBalance: 'https://api.safaricom.co.ke/mpesa/accountbalance/v1/query',
  },
};
```

## Step 3: Authentication Setup

### 3.1 OAuth 2.0 Token Management
Create a service for handling M-PESA authentication:

```typescript
// services/mpesa/auth.ts
import axios from 'axios';

export class MpesaAuthService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    try {
      const response = await axios.post(
        MPESA_CONFIG[process.env.MPESA_ENVIRONMENT].auth.baseUrl,
        {},
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get M-PESA access token:', error);
      throw new Error('M-PESA authentication failed');
    }
  }
}
```

### 3.2 API Client Setup
Create a base API client for M-PESA requests:

```typescript
// services/mpesa/client.ts
import axios from 'axios';
import { MpesaAuthService } from './auth';

export class MpesaApiClient {
  private authService: MpesaAuthService;

  constructor() {
    this.authService = new MpesaAuthService();
  }

  async makeRequest(endpoint: string, data: any): Promise<any> {
    const token = await this.authService.getAccessToken();

    try {
      const response = await axios.post(endpoint, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      console.error('M-PESA API request failed:', error);
      throw error;
    }
  }
}
```

## Step 4: C2B Integration Setup

### 4.1 Register C2B URLs
Register your validation and confirmation URLs with M-PESA:

```typescript
// services/mpesa/c2b.ts
import { MpesaApiClient } from './client';

export class MpesaC2BService {
  private client: MpesaApiClient;

  constructor() {
    this.client = new MpesaApiClient();
  }

  async registerUrls(): Promise<void> {
    const data = {
      ShortCode: process.env.MPESA_SHORTCODE,
     ResponseType: 'Completed',
      ConfirmationURL: process.env.MPESA_C2B_CONFIRMATION_URL,
      ValidationURL: process.env.MPESA_C2B_VALIDATION_URL,
    };

    const response = await this.client.makeRequest(
      MPESA_CONFIG[process.env.MPESA_ENVIRONMENT].c2b.registerUrl,
      data
    );

    console.log('C2B URLs registered successfully:', response);
  }

  async simulateTransaction(phoneNumber: string, amount: number): Promise<void> {
    const data = {
      ShortCode: process.env.MPESA_SHORTCODE,
      CommandID: 'CustomerPayBillOnline',
      Amount: amount,
      Msisdn: phoneNumber,
      BillRefNumber: 'ZANARI_TEST',
    };

    const response = await this.client.makeRequest(
      MPESA_CONFIG[process.env.MPESA_ENVIRONMENT].c2b.simulate,
      data
    );

    console.log('C2B simulation successful:', response);
  }
}
```

### 4.2 Webhook Handlers
Create webhook endpoints for M-PESA callbacks:

```typescript
// api/webhooks/mpesa/confirmation.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook signature
    const signature = request.headers.get('x-mpesa-signature');
    if (!verifyMpesaSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Process the transaction
    await processMpesaTransaction(body);

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Failed' }, { status: 500 });
  }
}

function verifyMpesaSignature(payload: any, signature: string): boolean {
  // Implement signature verification logic
  // This typically involves hashing the payload with your secret
  // and comparing it with the provided signature
  return true; // Placeholder
}

async function processMpesaTransaction(transaction: any): Promise<void> {
  // Process the transaction and update user balances
  // This is where the round-up logic will be implemented
  console.log('Processing M-PESA transaction:', transaction);
}
```

## Step 5: STK Push Integration

### 5.1 STK Push Service
Implement STK Push for payment initiation:

```typescript
// services/mpesa/stkPush.ts
import { MpesaApiClient } from './client';

export class MpesaStkPushService {
  private client: MpesaApiClient;

  constructor() {
    this.client = new MpesaApiClient();
  }

  async initiateStkPush(phoneNumber: string, amount: number, description: string): Promise<any> {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const data = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phoneNumber,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: 'ZANARI',
      TransactionDesc: description,
    };

    return await this.client.makeRequest(
      MPESA_CONFIG[process.env.MPESA_ENVIRONMENT].stkPush.request,
      data
    );
  }

  async checkTransactionStatus(checkoutRequestID: string): Promise<any> {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');

    const data = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID,
    };

    return await this.client.makeRequest(
      MPESA_CONFIG[process.env.MPESA_ENVIRONMENT].stkPush.query,
      data
    );
  }
}
```

## Step 6: Testing and Validation

### 6.1 Sandbox Testing
1. **C2B Registration Test:**
   ```bash
   curl -X POST https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl \
   -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
   -H "Content-Type: application/json" \
   -d '{"ShortCode": "YOUR_SHORTCODE", "ResponseType": "Completed", "ConfirmationURL": "https://your-app-url/api/webhooks/mpesa/confirmation", "ValidationURL": "https://your-app-url/api/webhooks/mpesa/validation"}'
   ```

2. **STK Push Test:**
   ```typescript
   const stkService = new MpesaStkPushService();
   const result = await stkService.initiateStkPush('254712345678', 10, 'Test payment');
   console.log('STK Push result:', result);
   ```

### 6.2 Production Readiness Checklist
- [ ] All sandbox tests pass
- [ ] Production credentials obtained
- [ ] SSL certificates configured
- [ ] Webhook endpoints are publicly accessible
- [ ] Error handling and retry mechanisms implemented
- [ ] Logging and monitoring set up
- [ ] Security audit completed
- [ ] Load testing performed

## Step 7: Security Considerations

### 7.1 Webhook Security
- Implement signature verification for all incoming webhooks
- Use HTTPS for all webhook endpoints
- Validate webhook payloads before processing
- Implement rate limiting for webhook endpoints
- Use IP whitelisting for M-PESA webhook requests

### 7.2 Credential Management
- Store all M-PESA credentials in environment variables
- Never commit credentials to version control
- Use secure secret management in production
- Rotate credentials regularly
- Implement access controls for credential access

### 7.3 Transaction Security
- Implement idempotency keys for duplicate prevention
- Use proper transaction isolation in database operations
- Implement comprehensive audit logging
- Set up fraud detection mechanisms
- Regular security audits and penetration testing

## Troubleshooting

### Common Issues
1. **Authentication Failures:** Check consumer key/secret and network connectivity
2. **Webhook Timeouts:** Ensure webhook endpoints are responsive and handle large payloads
3. **Transaction Failures:** Validate phone numbers, amounts, and business shortcodes
4. **SSL Certificate Issues:** Use valid certificates and proper certificate chains
5. **Rate Limiting:** Implement exponential backoff for API requests

### Debug Tips
- Enable debug logging for M-PESA API requests
- Use proper error handling with retry mechanisms
- Monitor webhook callback failures
- Test with sandbox environment before production
- Implement comprehensive logging for troubleshooting

## Support

For technical support:
- Safaricom Developer Portal documentation
- M-PESA Daraja API community forums
- Safaricom business support contacts
- Stack Overflow with #mpesa-api tag

Remember to follow all Safaricom's terms of service and comply with Kenyan financial regulations when implementing M-PESA integration.