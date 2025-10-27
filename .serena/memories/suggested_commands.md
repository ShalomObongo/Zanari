# Suggested Commands

- Dev servers:
  - `npm start` — Expo dev server
  - `npm run ios` / `npm run android` / `npm run web` — launch targets
  - `npm run dev:api` — start API with hot reload (tsx watch `api/server.ts`)

- Testing:
  - `npm test` — run all Jest suites
  - `npm run test:watch` — watch mode
  - `npm test -- tests/contract` — run contract/API endpoint tests
  - `npm test -- tests/performance/performance_benchmarks.test.ts` — perf benchmarks

- Lint & Types:
  - `npm run lint` — ESLint checks
  - `npm run lint:fix` — auto-fix
  - `npm run type-check` — TypeScript project validation (no emit)

- Formatting:
  - Prettier configured via `.prettierrc`; run lint:fix to apply common fixes.

- Environment:
  - Copy `.env.example` to `.env` and fill Supabase + Paystack credentials.
  - API sandbox mode triggers if missing Supabase/Paystack keys.

- iOS/Android simulators:
  - Requires Xcode/Android Studio; use Expo CLI shortcuts in DevTools.

- Utilities (Darwin/macOS):
  - `ls`, `cd`, `grep`/`rg`, `find`, `sed`, `awk`, `open`, `pbcopy`/`pbpaste`, `say`.
  - `git` basics: `git status`, `git add -p`, `git commit -m`, `git log --oneline`, `git diff`.
