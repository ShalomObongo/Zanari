# Style & Conventions

- Language: TypeScript throughout; strict compiler options enabled.
- Indentation: 2 spaces; single quotes preferred.
- Components: PascalCase `.tsx` (e.g., `src/components/BalanceDisplay.tsx`).
- Services/Utilities: camelCase `.ts` (e.g., `src/services/notificationService.ts`).
- Stores: `<domain>Store.ts` (e.g., `src/store/authStore.ts`).
- Imports: use `@/` alias for `src/` (configured in TS + Jest).
- ESLint: strong TypeScript safety rules; React Native + hooks plugins; warnings for inline styles/color literals; no console in prod.
- Prettier: 2-space tabs, single quotes, 100 char print width, trailing commas (`es5`), LF EOL.
- Testing framework: Jest (`jest-expo`) + Testing Library RN; global setup/teardown; coverage thresholds: global ≥80%; `src/services` ≥90%; `src/utils` ≥85%; navigation excluded.
- Commit & PRs: Conventional Commits; ensure lint, type-check, and tests pass; PRs include clear description and screenshots for UI changes.
- Security: Never commit secrets; use `.env`; cautious logs; Supabase RLS policies for storage; PIN security and rate limiting on API.
