# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React Native app — `components/`, `screens/` (auth, payments, etc.), `services/`, `store/`, `utils/`.
- `api/`: Express server with `server.ts`, `migrations/`, and backend modules under `api/src/`.
- `tests/`: Split into `unit/`, `integration/`, `performance/`, `security/`; shared setup in `tests/setup.ts`, `globalSetup.ts`, `globalTeardown.ts`.
- Other roots: `assets/`, `docs/`, `supabase/`, plus tool config (`jest.config.js`, `eslint.config.js`, `metro.config.js`, `tsconfig.json`).

## Architecture at a Glance
- Mobile/web client runs via Expo; backend served by the Express API. Jest in this repo targets the app; backend specs live outside `api/` and are ignored by Jest.

## Build, Test, and Development Commands
- `npm start` / `npm run android` / `npm run ios` / `npm run web`: Launch Expo for web or device targets.
- `npm run dev:api`: Start the API with hot reload (`tsx watch api/server.ts`).
- `npm test` or `npm run test:watch`: Run Jest (preset `jest-expo`).
- `npm run lint` / `npm run lint:fix`: Lint and auto-fix with ESLint + Prettier rules.
- `npm run type-check`: TypeScript project check without emit.

## Coding Style & Naming Conventions
- Language: TypeScript only; 2-space indent, single quotes.
- Components: PascalCase `.tsx` (e.g., `src/components/BalanceDisplay.tsx`). Services/utils: camelCase `.ts` (e.g., `src/services/notificationService.ts`). Stores: `<domain>Store.ts` (e.g., `src/store/authStore.ts`).
- Imports: prefer `@/` alias for `src/` (mirrored in Jest and TS configs).
- Run lint/format before PRs; keep functions small and typed explicitly when helpful.

## Testing Guidelines
- Stack: Jest + Testing Library React Native (`jest-expo`).
- Location & names: add specs in `tests/<type>/` using `*.test.ts[x]` or `*.spec.ts[x]`.
- Coverage gates: global ≥80%; `src/services` ≥90%; `src/utils` ≥85%; navigation excluded.
- API tests are maintained outside `api/`; Jest in this repo will skip that folder.

## Commit & Pull Request Guidelines
- Commits use Conventional Commits (e.g., `feat(auth): add PIN flow`, `fix(payments): handle retry backoff`).
- PRs: concise description, linked issues, note env/config changes, attach UI screenshots or short videos for screen tweaks.
- Before opening: run `npm run type-check`, `npm run lint`, and `npm test`; ensure Expo and API dev servers start cleanly.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; keep secrets out of git. Supabase and Paystack keys must come from env variables loaded via `dotenv`.
- Avoid logging tokens or PII; scrub debug logs before commits.
- Keep dependencies lean; prefer audited packages and update via PRs when possible.
