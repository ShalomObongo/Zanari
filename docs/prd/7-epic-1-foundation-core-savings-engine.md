# 7. Epic 1: Foundation & Core Savings Engine

**Goal:** This epic lays the complete groundwork for the Zanari application. It covers setting up the Supabase backend, creating a secure user authentication flow, and building the critical integration with the M-PESA API. The epic culminates in delivering the core value proposition: automatically saving a user's spare change from their transactions.

## Story 1.1: Project & Backend Setup
*As a developer, I want to initialize the monorepo and configure the Supabase project, so that we have a foundational environment for development.*

**Acceptance Criteria:**
1.  A Git monorepo is initialized and configured with the basic folder structure for the mobile app and Supabase functions.
2.  A new Supabase project is created and environment details are securely stored.
3.  The mobile app can successfully connect to the Supabase backend.
4.  A basic "health-check" Supabase Edge Function is created and can be successfully deployed and invoked.

## Story 1.2: User Onboarding & Authentication
*As a new user, I want to create an account using my phone number and set a secure PIN, so that I can access the application safely.*

**Acceptance Criteria:**
1.  A user can register for a new account using their phone number.
2.  The user must set a multi-digit PIN for their account during the registration process.
3.  The user can successfully log in and log out using their phone number and PIN.
4.  User identity and sessions are securely managed using Supabase Auth.

## Story 1.3: Link M-PESA Account
*As a logged-in user, I want to securely link my M-PESA account to my Zanari wallet, so that the app can process transactions on my behalf.*

**Acceptance Criteria:**
1.  The user is presented with a clear interface to initiate the M-PESA account linking process.
2.  The user must confirm authorization for Zanari to interact with their M-PESA account (e.g., via an STK push confirmation).
3.  The linked M-PESA account status is securely stored against the user's profile.
4.  The user can see the linked status of their account in the app's settings.

## Story 1.4: Basic Wallet & Transaction Display
*As a user, I want to see my Zanari wallet balance and a list of my recent transactions, so that I can track my money.*

**Acceptance Criteria:**
1.  The main dashboard screen clearly displays the current Zanari wallet balance.
2.  A dedicated "History" screen displays a list of all transactions (e.g., deposits, savings).
3.  Each item in the transaction list shows the date, description, and amount.
4.  The list is displayed in reverse chronological order (newest first).

## Story 1.5: Implement Automated Round-Up Savings
*As a user with a linked account, I want the system to automatically round up my M-PESA transactions to the nearest KES 10 and transfer the difference to my Zanari savings wallet.*

**Acceptance Criteria:**
1.  A Supabase function (triggered by an M-PESA webhook) correctly calculates the round-up amount from a transaction (e.g., a KES 147 spend results in a KES 3 saving).
2.  The function successfully initiates an M-PESA C2B transfer of the calculated amount to the Zanari wallet.
3.  The user's Zanari wallet balance is correctly updated upon a successful transfer.
4.  A new "Savings" transaction appears in the user's transaction history.
5.  The user receives an in-app notification confirming the automated saving.

---
