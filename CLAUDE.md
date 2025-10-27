# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Zanari** is a React Native + Express API fintech application with Supabase backend integration. It provides automated round-up savings, M-Pesa payments via Paystack, and student-friendly personal finance tools.

**Tech Stack:**
- **Frontend:** React Native + Expo SDK 54
- **Backend:** Express.js with framework-agnostic route handlers
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Payments:** Paystack integration for M-Pesa and card payments
- **State Management:** Zustand with AsyncStorage persistence
- **Navigation:** React Navigation 7

## Architecture

### Clean Architecture Pattern
The codebase follows clean architecture principles:
- **Domain models** (`api/src/models/`) are framework-agnostic
- **Repositories** (`api/src/repositories/`) abstract data access
- **Services** (`api/src/services/`) contain business logic
- **Routes** (`api/src/routes/`) handle HTTP concerns
- **Dependency injection** via `api/src/container.ts`

### Development Modes
- **Production Mode:** Full Supabase + Paystack integration
- **Sandbox Mode:** In-memory storage with simulated services (when credentials missing)
  - Pre-seeded demo user: `sarah.test@zanari.app` / `254712345678`
  - OTPs printed to terminal for testing
  - Simulated Paystack payments

## Common Development Commands

### Mobile App
```bash
npm run start          # Start Expo dev server
npm run android        # Launch on Android
npm run ios           # Launch on iOS
npm run web           # Launch web version
```

### Backend API
```bash
npm run dev:api       # Start API with hot-reload (tsx watch)
```

### Testing
```bash
npm test                    # Run full test suite
npm run test:watch         # Run tests in watch mode
npm test -- tests/contract # Run API contract tests only
npm test -- tests/performance/performance_benchmarks.test.ts  # Run performance benchmarks
```

### Code Quality
```bash
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix linting issues
npm run type-check    # TypeScript validation
```

## Key Architectural Components

### Authentication System
- **Multi-factor flow:** OTP → PIN setup → Biometric (optional)
- **Session management:** Bearer tokens (`access-<userId>-<uuid>`)
- **PIN security:** Progressive delays, attempt limiting, local hashing (`src/utils/pinSecurity.ts`)
- **Services:** `api/src/services/AuthService.ts`, `src/store/authStore.ts`

### Payment Architecture
- **PaymentService:** Orchestrates payment flows with retry logic
- **PaystackClient:** External payment API integration
- **Round-up savings:** Automatic micro-savings from transactions
- **Callback-based:** No webhooks needed (see `docs/PAYSTACK_CALLBACK_FLOW.md`)

### State Management
- **Zustand stores** in `src/store/` with AsyncStorage persistence
- **Cross-store cleanup:** Use `authStore.clearAuth()` for logout flows
- **Offline sync:** Queue mechanism via `src/services/syncService.ts`

### API Client
- **Base client:** `src/services/api.ts` with request IDs, idempotency, timeouts
- **Auto-logout:** Handles 401s via `setUnauthorizedHandler`
- **Base URL resolution:** Platform-aware (uses loopback for local dev)

## Path Aliases

Use `@/*` imports consistently (configured in `tsconfig.json`):
```typescript
import { authStore } from '@/store/authStore';
import { PaymentService } from '@/services/PaymentService';
import { PinInput } from '@/components/PinInput';
```

## Environment Configuration

### Mobile App (.env)
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
```

### API Server (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key
PAYSTACK_SECRET_KEY=sk_test_...
API_PORT=3000
```

## Testing Guidelines

### Coverage Requirements
- **Global:** ≥80% coverage
- **Services:** ≥90% coverage (`src/services/`, `api/src/services/`)
- **Utils:** ≥85% coverage (`src/utils/`)
- **Navigation excluded** from coverage requirements

### Test Organization
- **Unit tests:** `tests/unit/`
- **Integration tests:** `tests/integration/`
- **Contract tests:** `tests/contract/` (API endpoints)
- **Performance tests:** `tests/performance/`
- **Security tests:** `tests/security/`

### Test Setup
All tests use `tests/setup.ts` which mocks React Native, Expo, Supabase, and Paystack. Add new native module mocks there.

## Database Migrations

### Dual Migration System
- **API migrations:** `api/migrations/*.sql` (backend schema)
- **Supabase migrations:** `supabase/migrations/*.sql` (keep in sync)

Apply migrations to Supabase before starting the API server.

## Key Files to Understand

### Backend Entry Points
- `api/server.ts` - Express server that adapts routes to HTTP
- `api/src/container.ts` - Dependency injection container
- `api/dev/inMemoryAppContainer.ts` - Sandbox mode container

### Frontend Entry Points
- `App.tsx` - Main app entry with PaystackProvider
- `src/navigation/AppNavigator.tsx` - Root navigation
- `src/services/api.ts` - API client with auth handling

### Authentication Flow
- `src/screens/auth/` - OTP, PIN setup, welcome screens
- `api/src/services/AuthService.ts` - Backend auth logic
- `src/store/authStore.ts` - Frontend auth state

### Payment Flow
- `src/screens/payments/` - Payment and transfer screens
- `api/src/services/PaymentService.ts` - Payment orchestration
- `api/src/clients/PaystackClient.ts` - External payment API

## Development Workflow

### Adding New Features
1. **Backend:** Add route to `api/src/routes/`, service to `api/src/services/`
2. **Update container:** Add dependencies to `api/src/container.ts` and `api/dev/inMemoryAppContainer.ts`
3. **Frontend:** Add screen to `src/screens/`, integrate with stores
4. **Tests:** Add contract tests in `tests/contract/`, unit tests as needed

### Testing Payments
- Use sandbox mode for development (no external calls)
- See `docs/PAYSTACK_CALLBACK_FLOW.md` for testing procedures
- Run `npx tsx test-connections.ts` to verify infrastructure

### Security Considerations
- PIN handling uses `src/utils/pinSecurity.ts` utilities
- Row Level Security (RLS) policies in Supabase
- Bearer token validation in API routes
- Biometric authentication via `expo-local-authentication`

## Code Style

- **TypeScript:** Strict mode enabled with comprehensive type checking
- **Imports:** Use `@/` path aliases consistently
- **Components:** PascalCase `.tsx` files
- **Services/Utils:** camelCase `.ts` files
- **Stores:** `<domain>Store.ts` pattern
- **Linting:** ESLint + Prettier (run `npm run lint:fix` before commits)