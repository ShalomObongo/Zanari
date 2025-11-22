# Zanari

<div align="center">

  ![Zanari Banner](https://via.placeholder.com/1200x300/4F46E5/FFFFFF?text=Zanari+Financial+Wellness)

  **Next-Gen Personal Finance for Africa**
  
  *Empowering financial growth through automated savings, seamless payments, and intelligent insights.*

  [![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 🌟 Overview

Zanari is a cutting-edge fintech application designed to simplify personal finance for the African market. By combining automated savings tools with robust payment infrastructure, Zanari helps users build wealth effortlessly while managing their day-to-day transactions.

Built with an **Offline-First** architecture, Zanari ensures a seamless experience even in low-connectivity environments, syncing data intelligently when connectivity is restored.

## ✨ Key Features

### 🤖 Smart Automation & Savings
-   **AI-Powered Round-Ups**: Our "Smart Auto" mode analyzes spending patterns to automatically round up transactions and save the spare change.
-   **Goal-Based Savings**: Create custom targets (e.g., "New Laptop", "Emergency Fund") and track progress visually.
-   **High-Yield Investments**: (Phase 1) Integrated investment portfolios allow savings to earn competitive returns.

### 💳 Payments & Transactions
-   **M-Pesa Integration**: Seamless mobile money payments via Paystack.
-   **P2P Transfers**: Instant peer-to-peer transfers between Zanari users.
-   **Bill Payments**: Pay merchants and utility bills directly from the app.
-   **Auto-Categorization**: Intelligent transaction tagging for better spending analytics.

### 🔒 Enterprise-Grade Security
-   **Biometric Authentication**: Secure access via FaceID and TouchID.
-   **PIN Protection**: Custom 4-digit PIN with progressive lockout delays to prevent brute-force attacks.
-   **Digital KYC**: Streamlined identity verification workflow with document upload and status tracking.
-   **Data Privacy**: Strict RLS (Row Level Security) policies ensure users only access their own data.

### ⚡️ Technical Excellence
-   **Offline-First Engine**: A robust synchronization queue (`syncService`) handles data persistence and background syncing.
-   **Dark Mode Support**: Fully adaptive UI for comfortable viewing in any lighting condition.
-   **Real-time Notifications**: Instant alerts for transactions, milestones, and security events.

## 📚 Documentation

We maintain comprehensive documentation for developers in the [`dev-docs/`](./dev-docs) directory.

| Section | Description |
|---------|-------------|
| [**Architecture**](./dev-docs/README.md) | System design, backend services, and frontend structure. |
| [**User Journeys**](./dev-docs/README.md#🚀-modules-user-journeys) | Detailed guides for Auth, KYC, Payments, Savings, and more. |
| [**Database Schema**](./dev-docs/database-schema.md) | Supabase tables, relationships, and policies. |

## 🚀 Quick Start

### Prerequisites
-   **Node.js** 18+
-   **npm** 9+
-   **Expo CLI**
-   **Supabase Project** (or use local sandbox mode)
-   **Paystack Test Account**

### Installation

1.  **Clone the repository**
    ```bash
    git clone www.github.com/ShalomObongo/Zanari.git
    cd Zanari
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Copy the example configuration:
    ```bash
    cp .env.example .env
    ```
    *Tip: The app runs in "Sandbox Mode" with in-memory data if Supabase/Paystack keys are missing, perfect for quick testing.*

4.  **Launch the Application**
    ```bash
    # Terminal 1: Start the Mobile App
    npm start

    # Terminal 2: Start the Backend API
    npm run dev:api
    ```

## 🏗 Architecture Stack

-   **Frontend**: React Native (Expo), Zustand (State), React Navigation.
-   **Backend**: Node.js, Express.js, TypeScript.
-   **Database**: Supabase (PostgreSQL), Supabase Auth, Supabase Storage.
-   **Payments**: Paystack API.
-   **Testing**: Jest, Testing Library, Supertest.

## 🧪 Testing & Quality

We maintain high code quality standards through rigorous testing.

```bash
# Run Unit Tests
npm test

# Run Integration Tests
npm run test:integration

# Run Performance Benchmarks
npm test -- tests/performance/performance_benchmarks.test.ts

# Type Checking
npm run type-check
```

---

<div align="center">
  <sub>Built by the Zanari Team/Shalom</sub>
</div>
