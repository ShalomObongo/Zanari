# Repository Guidelines

## Project Structure & Module Organization
- `src/`: React Native app code — `components/`, `screens/` (auth, payments, etc.), `services/`, `store/`, `utils/`.
- `api/`: Express server — `server.ts`, `migrations/`, and `src/` for backend modules.
- `tests/`: Organized by `unit/`, `integration/`, `performance/`, `security`; includes `setup.ts`, `globalSetup.ts`, `globalTeardown.ts`.
- Other: `assets/`, `docs/`, `supabase/`, root config (`jest.config.js`, `eslint.config.js`, `metro.config.js`, `tsconfig.json`).

## Build, Test, and Development Commands
- `npm start` / `npm run android` / `npm run ios` / `npm run web`: Launch Expo in desired target.
- `npm run dev:api`: Start the API with live reload (`tsx watch api/server.ts`).
- `npm test` / `npm run test:watch`: Run Jest (preset `jest-expo`).
- `npm run lint` / `npm run lint:fix`: Lint and auto-fix.
- `npm run type-check`: TypeScript project check without emit.

## Coding Style & Naming Conventions
- TypeScript throughout; prefer 2-space indentation, single quotes.
- Components: PascalCase `.tsx` (e.g., `src/components/BalanceDisplay.tsx`).
- Services/utilities: camelCase `.ts` (e.g., `src/services/notificationService.ts`).
- Stores: `<domain>Store.ts` (e.g., `src/store/authStore.ts`).
- Imports: use `@/` alias for `src/` (configured in Jest and TS).
- Tools: ESLint + Prettier; fix lint before PRs.

## Testing Guidelines
- Frameworks: Jest + Testing Library React Native (`jest-expo`).
- Location: add tests under `tests/<type>/` with `*.test.ts[x]` or `*.spec.ts[x]`.
- Coverage (enforced in `jest.config.js`): global ≥80%; `src/services` ≥90%; `src/utils` ≥85%; navigation excluded.
- Backend tests live outside `api/` in this repo; `api/` is ignored by Jest here.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat(auth): add PIN flow`, `fix(payments): handle retry backoff`).
- PRs: clear description, link issues, note env/config changes, include UI screenshots or short videos for screen changes.
- Ensure `npm run type-check`, `npm run lint`, and `npm test` pass locally.

## Security & Configuration Tips
- Create `.env` from `.env.example`; never commit secrets.
- Store Supabase and Paystack credentials in env; loaded via `dotenv`.
- Be cautious with sensitive logs; avoid printing tokens.
