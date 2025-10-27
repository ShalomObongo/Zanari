# Post-Task Checklist

- Run validation:
  - `npm run type-check`
  - `npm run lint`
  - `npm test`
- Ensure coverage thresholds met (global ≥80%; services ≥90%; utils ≥85%).
- Verify no secrets/configs committed; `.env` used; docs updated if needed.
- For API changes: confirm local `.env` has Supabase/Paystack keys or in-memory mode is acceptable; run `npm run dev:api` smoke checks.
- For app changes: build and run on at least one simulator (`npm run ios`/`android`) and basic navigation flows.
- Update relevant docs in `docs/` when flows/configs change (e.g., Paystack or Supabase setup).
- Follow Conventional Commits in the commit message.
