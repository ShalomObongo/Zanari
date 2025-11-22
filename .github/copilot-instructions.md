# Zanari AI Guide
## Quick Map
- React Native + Expo app under `src/` drives UX, Express API under `api/` handles Supabase + Paystack; `App.tsx` boots `PaystackProvider` and `AppNavigator`.
- Navigation splits auth vs main flows (`src/navigation/*`); auth funnel enforces OTP→PIN setup before reaching `MainNavigator` tabs.
- Shared path alias `@/*` (see tsconfig.json) — use it when importing anything from `src` to match existing modules.
## Backend Shape
- `api/src/container.ts` composes repositories/services; it auto-falls back to `dev/inMemoryAppContainer` when Supabase creds are missing (seed user `sarah.test@zanari.app`).
- Routes are framework-agnostic handlers; `api/server.ts` adapts them onto Express and resolves `userId` from `X-User-Id` or bearer `access-<uuid>` tokens for manual testing.
- Paystack wiring lives in `PaymentService` with retry queue + round-up logic; without `PAYSTACK_SECRET_KEY` the container swaps to `InMemoryPaystackClient` and logs a warning.
## Mobile Patterns
- Network calls go through `src/services/api.ts`, which adds request ids, idempotency keys, timeout handling, and auto-invokes `setUnauthorizedHandler` to clear state on 401s.
- Persistent state sits in Zustand stores (`src/store/*`) with `persist` → AsyncStorage; cross-store resets happen inside `authStore.clearAuth()` so reuse that when handling logouts.
- Offline flows rely on `src/services/syncService.ts`: queue new sync types with `syncService.registerHandler` and store operations in AsyncStorage (`zanari.sync.queue.v1`).
- PIN security utilities (`src/utils/pinSecurity.ts`) enforce 4-digit rules, progressive lockouts, and local hashing; front end caches hash payloads after `/auth/verify-pin` responses.
## Environments & Config
- Mobile client base URL is resolved in `api.ts` (`EXPO_PUBLIC_API_URL` or platform loopback); keep parity when adding endpoints.
- Backend expects `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; set `PAYSTACK_SECRET_KEY` for live API calls, otherwise you’re in sandbox mode with simulated payments.
- Expo Paystack public key (`EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`) is required for the `PaystackProvider`; `config/paystack.ts` warns via `Alert` if the placeholder key persists.
- Common scripts: `npm run start` (Expo), `npm run dev:api` (tsx watch on `api/server.ts`), `npm run lint`, `npm run type-check`, `npm test` (+ `npm test -- tests/contract` for contract suites).
## Testing & QA
- Jest setup (`tests/setup.ts`) mocks RN, Expo, Supabase, Paystack; add new native modules there to keep tests stable.
- Contract + integration specs live in `tests/contract` and `tests/integration`; they target the Express routes, so update mocks/seed data in `api/dev` when expanding coverage.
- Performance suite sits at `tests/performance/performance_benchmarks.test.ts`; run via `npm test -- tests/performance/...` to avoid full suite.
- `test-connections.ts` provides infra smoke tests (Supabase storage + Paystack REST) — run with `npx tsx test-connections.ts` before touching prod credentials.
## Docs & Next Steps
- Payment callback behaviour and manual test matrices are in `docs/PAYSTACK_CALLBACK_FLOW.md` and `docs/PAYMENT_FIXES.md`.
- Supabase schema + migrations live under `api/migrations` (backend) and `supabase/migrations`; keep both in sync when altering tables.
- Feature scenarios and acceptance workflows are documented in `specs/001-build-a-cross/quickstart.md` — align new flows with those tasks to satisfy stakeholders.
- For new services/repos, update `api/src/container.ts` (Supabase mode) and `dev/inMemoryAppContainer.ts` (sandbox parity) together so tests and local dev stay consistent.
