<p align="center">
  <img src="assets/branding/zanari-banner.svg" alt="Zanari" width="620" />
</p>

<p align="center">
  <b>Next‑Gen Personal Finance for Africa</b><br />
  Build wealth automatically with round‑ups, smart goals, and seamless payments.
</p>

<p align="center">
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native" /></a>
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
</p>

<p align="center">
  <a href="#demo">Live Flow (Demo)</a>
  ·
  <a href="#quick-start">Quick Start</a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#for-developers">For Developers</a>
</p>

---

## 💡 What is Zanari?

Zanari is a modern fintech experience purpose‑built for the African market. It helps people **save effortlessly**, **spend with confidence**, and **grow wealth over time** — all inside a beautifully designed mobile app.

Under the hood, Zanari is a **React Native + Expo** client backed by a **TypeScript/Express API** on **Supabase** with **Paystack** payments, **offline‑first sync**, and strong security primitives baked in.

> "Set your goals once, and Zanari quietly does the heavy lifting in the background."

---

## ✨ Product Highlights

### 🤖 Automated Savings & Wealth Growth
- **Smart round‑ups**: Automatically round card or wallet transactions and save the spare change.
- **Goal‑based saving**: Create goals like `Emergency Fund`, `New Laptop`, or `Rent Buffer` and track progress visually.
- **Investment rails**: Configurable investment types (e.g., low‑risk, balanced) defined in the backend to grow idle balances.

### 💳 Wallet, Payments & Transfers
- **Wallet‑first experience** with Paystack‑backed funding and payouts.
- **P2P transfers** between Zanari users with memo support and instant balance updates.
- **Bill and merchant payments** via Paystack; designed to extend to local rails such as M‑Pesa and bank transfers.
- **Smart categorisation** of transactions for clear, digestible spending insights.

### 🧠 Insights & Nudges
- **Spending summaries** by category and period (weekly/monthly trends).
- **Savings streaks & milestones** that nudge users to stay consistent.
- **Configurable automation rules** (e.g. “round up aggressively on weekdays, relaxed on weekends”).

### 🔒 Security, Compliance & Trust
- **4‑digit PIN** with progressive lockouts and local hashing rules.
- **Biometric login** (Face ID / Touch ID) on supported devices.
- **KYC workflow** with document upload, review states, and timestamps.
- **Supabase RLS policies** so each user only ever sees their own data.

---

## 🧭 Demo Flow <a name="demo"></a>

1. **Create account** → verify email/phone via OTP.
2. **Set PIN** and enable biometrics (optional).
3. **Complete KYC** with ID upload to unlock transfers & higher limits.
4. **Fund wallet** via Paystack and create your first savings goal.
5. **Enable round‑ups** and watch Zanari move spare change into that goal.
6. **Track insights** on the dashboard: balances, goals, and recent activity.

> In local dev, you can run Zanari in **sandbox mode** with in‑memory data and Paystack test keys for safe experimentation.

---

## 📸 Screens & Visuals

<p align="center">
  <img src="New%20Screen%20designs/sign_in_to_zanari/screen.png" alt="Zanari sign in screen" width="260" />
  <img src="New%20Screen%20designs/finance_dashboard_overview/screen.png" alt="Zanari finance dashboard" width="260" />
  <img src="New%20Screen%20designs/create_goal_form/screen.png" alt="Create savings goal" width="260" />
</p>

<p align="center">
  <sub>From onboarding to the money dashboard and goal creation, Zanari keeps the experience clean, focused, and calm.</sub>
</p>

---

## 🚀 Quick Start <a name="quick-start"></a>

### 1. Clone & Install

```bash
git clone https://github.com/ShalomObongo/Zanari.git
cd Zanari
npm install
```

### 2. Environment Setup

Copy the example env and plug in keys as you get them:

```bash
cp .env.example .env
```

Key variables to be aware of:

- `EXPO_PUBLIC_API_URL` – base URL for the Express API.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` – backend data + auth.
- `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY` – Paystack public key for the client.
- `PAYSTACK_SECRET_KEY` – server‑side Paystack secret (sandbox or live).

If Supabase and Paystack keys are **missing**, the backend gracefully falls back to an **in‑memory dev container**, ideal for quick UI and flow work.

### 3. Run the Stack

Use two terminals during development:

```bash
# Terminal 1 – Expo app
npm start

# Terminal 2 – Express API
npm run dev:api
```

Then open the Expo app on a simulator, emulator, or physical device.

---

## 🏗 Architecture <a name="architecture"></a>

Zanari is intentionally split into a **mobile client** and a **backend API** so each can evolve independently.

### Frontend (Expo / React Native)

- Located under `src/`.
- **Navigation**: Auth vs main flows defined in `src/navigation` (OTP → PIN → dashboard tabs).
- **State**: Zustand stores in `src/store` with `persist` to AsyncStorage for auth and wallet data.
- **Networking**: All HTTP calls go through `src/services/api.ts`, which adds request IDs, idempotency keys, timeouts, and automatic 401 handling.
- **Offline sync**: `src/services/syncService.ts` queues work locally and replays it when the network comes back.
- **Theming**: Dark mode + shared design tokens live in `src/theme`.

### Backend (Express / Supabase)

- Entry point: `api/server.ts`.
- Service wiring: `api/src/container.ts` composes repositories, services, and Paystack/Supabase clients.
- Supabase mode vs in‑memory sandbox is toggled automatically based on env presence.
- Payment orchestration (including round‑ups and retries) lives in the `PaymentService` with a retry queue.
- Database schema and migrations are in `api/migrations` and `supabase/migrations`.

For a deeper dive, see the **Developer Docs** in [`dev-docs/`](./dev-docs).

---

## 🧪 Testing & Quality

Zanari ships with batteries‑included testing to keep regression risk low.

```bash
# Core test suite (unit + most integration)
npm test

# Contract tests (API behaviours)
npm test -- tests/contract

# Performance benchmarks
npm test -- tests/performance/performance_benchmarks.test.ts

# TypeScript project check
npm run type-check

# Linting
npm run lint
```

- Jest is configured via `jest.config.js` with `jest-expo`.
- `tests/setup.ts` mocks React Native, Expo, Supabase, and Paystack.
- API tests live outside `api/` and hit the Express routes directly.

---

## 👩🏾‍💻 For Developers <a name="for-developers"></a>

- **Architecture & module guides**: see `dev-docs/` (auth, KYC, round‑ups, savings, notifications, offline sync, etc.).
- **Scripts**:
  - `npm run dev:api` – hot‑reload Express API with `tsx`.
  - `npm run android` / `npm run ios` / `npm run web` – run Zanari on your target.
  - `npx tsx test-connections.ts` – smoke test Supabase + Paystack credentials.
- **Path aliases**: use `@/` for anything under `src/` (e.g. `@/services/api`).

If you’re adding new services or repositories, remember to update both:

- `api/src/container.ts` (Supabase mode), and
- `api/src/dev/inMemoryAppContainer.ts` (sandbox mode)

so local dev and tests stay in sync.

---

## 🤝 Contributing

Contributions, feedback, and ideas are very welcome.

1. Fork the repo and create a feature branch.
2. Run `npm run lint`, `npm run type-check`, and `npm test` before opening a PR.
3. Follow Conventional Commits (e.g. `feat(auth): add PIN flow`).

If you’re exploring the project and just want to share thoughts on UX, flows, or markets, opening a **GitHub Discussion** or issue is also greatly appreciated.

---

<p align="center">
  <sub>Designed for the next generation of African savers and builders.</sub>
</p>
