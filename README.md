# Zanari Cross-Platform Savings & Payments App

A React Native + Expo application with Supabase backend integrations that powers automated round-up savings, M-Pesa payments via Paystack, and student-friendly personal finance tools.

## 🚀 Setup Status

**Infrastructure:** ✅ READY  
**Database:** ✅ Migrated and configured  
**Storage:** ✅ KYC bucket created  
**Paystack:** ✅ Callback-based integration (no webhooks needed)  

**Next Steps:** See [`docs/PAYSTACK_CALLBACK_FLOW.md`](docs/PAYSTACK_CALLBACK_FLOW.md) for:
- Payment implementation guide (callback-based)
- Testing procedures
- Optional: Paystack dashboard configuration (10-15 min)
- Optional: Supabase storage RLS policies (5-10 min)

## Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) or Android Emulator
- Supabase project with schema from `api/migrations/001_initial_schema.sql`
- Paystack test account with Mobile Money sandbox credentials

## Environment Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` (or configure Expo secrets) with:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - Paystack public/secret keys for sandbox
3. Start the Expo development server:
   ```bash
   npm run start
   ```
4. Launch on a device or simulator:
   - iOS: `npm run ios`
   - Android: `npm run android`

## API Services

Backend handlers live in `api/src` and are now fully wired to Supabase repositories and the Paystack HTTP client. The development server expects credentials in the repository root `.env`:

```
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="service_role_key"
PAYSTACK_SECRET_KEY="psk_test_..."
PAYSTACK_BASE_URL="https://api.paystack.co"            # optional, defaults to Paystack production
PAYSTACK_WEBHOOK_SECRET="psk_webhook_secret"           # optional, falls back to PAYSTACK_SECRET_KEY
API_PORT=3000                                           # optional
```

Run the server with hot-reload:

```bash
npm run dev:api
```

Apply database migrations (`api/migrations/*.sql`) to your Supabase instance before starting the server. The API expects bearer tokens issued by the login flow (`access-<userId>-<uuid>`); during manual testing you can also set the `X-User-Id` header to impersonate a user.

### Developing without Supabase credentials

If `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (or `PAYSTACK_SECRET_KEY`) are missing, the API automatically boots in an **in-memory sandbox mode**:

- Data is stored in memory only and resets on each restart.
- A demo user is pre-seeded (`sarah.test@zanari.app` / `254712345678`).
- Requesting `/auth/login` for the seed user prints OTPs to the terminal, letting you complete the auth flow end-to-end.
- Paystack calls are simulated, so you can exercise payment flows without external network calls.

This helps you work on the mobile app or API logic before wiring up real infrastructure. Once you're ready for Supabase/Paystack, add the environment variables above and restart the server.

### OTP Email Delivery (SMTP)

To send OTP codes to users via email, configure SMTP environment variables. If these are not set, the API falls back to logging OTPs to the console.

```
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_SECURE=false             # true for port 465
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=no-reply@zanari.app
```

When configured, the API uses `SmtpOtpSender` to deliver OTP emails and continues using console logs for SMS until an SMS provider is integrated.

## Testing

- Unit & integration tests:
  ```bash
  npm test
  ```
- Linting & type checks:
  ```bash
  npm run lint
  npm run type-check
  ```
- Performance benchmarks:
  ```bash
  npm test -- tests/performance/performance_benchmarks.test.ts
  ```
- Contract tests (
  REST endpoints):
  ```bash
  npm test -- tests/contract
  ```

## Key Features

- Automated round-up savings with customizable rules and auto-analysis.
- Yield-earning savings (Phase 1) built on top of the existing savings wallet, documented in `docs/SAVINGS_INVESTMENTS_PHASE1.md`.
- Paystack-backed merchant payments, P2P transfers, and bill payments.
- PIN security with progressive delays and biometric authentication support.
- Offline-ready wallet & transaction browsing with sync service.
- End-to-end quickstart scenarios documented in `specs/001-build-a-cross/quickstart.md`.

## Project Structure

```
.
├── App.tsx
├── api/                 # Supabase/Paystack services
├── src/                 # React Native app (components, screens, stores)
├── tests/               # Contract, integration, unit, performance suites
└── specs/001-build-a-cross/  # Feature specs, data model, tasks, research
```

## Helpful Commands

| Command | Description |
|---------|-------------|
| `npm run start` | Start Expo dev server |
| `npm run lint` | Run ESLint checks |
| `npm run type-check` | TypeScript project validation |
| `npm test` | Run Jest test suites |
| `npm test -- tests/performance/performance_benchmarks.test.ts` | Performance benchmarks |

## Troubleshooting

- **DevMenu TurboModule errors**: Ensure you run tests with project-wide setup `tests/setup.ts`.
- **Expo push token issues**: Confirm `extra.eas.projectId` is configured in `app.json`.
- **Paystack errors**: Check sandbox credentials and Paystack status dashboard.
- **Supabase access**: Confirm Row Level Security policies and service keys are correctly set.

For full quickstart validation, follow the scenarios in `specs/001-build-a-cross/quickstart.md` (Task T098).
