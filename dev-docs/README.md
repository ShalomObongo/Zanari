# Developer Documentation

Welcome to the Zanari technical documentation. This folder contains detailed guides on the system architecture, database schema, and comprehensive user journeys for each module.

## 🏗 Architecture

High-level overviews of the system's structure.

-   [**Backend Architecture**](./backend-architecture.md): Express.js, Supabase, and Service Layer patterns.
-   [**Backend Services**](./backend-services.md): Detailed breakdown of the service container and dependency injection.
-   [**Frontend Architecture**](./frontend-architecture.md): React Native (Expo) structure, Navigation, and API integration.
-   [**Frontend State & Services**](./frontend-state-services.md): Zustand stores and client-side business logic.
-   [**Database Schema**](./database-schema.md): Supabase tables, relationships, and RLS policies.

## 🚀 Modules (User Journeys)

Detailed documentation for each functional area of the application, covering the user flow, frontend implementation, and backend logic.

-   [**Auth & Onboarding**](./module-auth-onboarding.md): Registration, Login, PIN setup, and Biometrics.
-   [**KYC (Identity Verification)**](./module-kyc.md): Document upload, status tracking, and compliance.
-   [**Wallet & Payments**](./module-wallet-payments.md): Wallet management, Paystack integration, and Transfers.
-   [**Transactions & Categorization**](./module-transactions-categorization.md): History, Categorization logic, and Analytics.
-   [**Savings Goals**](./module-savings-goals.md): Goal creation, tracking, and top-ups.
-   [**Savings Investments**](./module-savings-investments.md): Investment preferences and portfolio tracking.
-   [**Round-Ups**](./module-round-ups.md): Spare change savings logic and configuration.
-   [**Settings & Profile**](./module-settings-profile.md): User profile, Security settings, and App preferences.
-   [**Notifications**](./module-notifications.md): Push notifications and local alerts.
-   [**Offline Sync**](./module-offline-sync.md): Offline queueing and data synchronization strategy.

## 📘 Guides & Recipes

Specific technical implementation details and how-to guides.

-   [**Paystack Integration**](./guides/paystack-integration.md): Deep dive into the callback-based payment flow.
-   [**Supabase Storage & RLS**](./guides/supabase-storage.md): Security policies for KYC document storage.
-   [**Glassmorphism UI**](./guides/ui-glassmorphism.md): Implementation details for the frosted glass tab bar.

## 🛠 Development

-   **API Development**: The backend runs on `localhost:3000`. See `api/server.ts`.
-   **Mobile Development**: Run `npm start` to launch Expo.
-   **Testing**:
    -   Run `npm test` for unit tests.
    -   Run `npm run test:integration` for integration tests.
