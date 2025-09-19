# Zanari Product Requirements Document (PRD)

## 1. Goals and Background Context

### 1.1. Goals

The primary goals for the Zanari project are:

*   Acquire 100,000 active users within the first 12 months of launch.
*   Achieve a 70% monthly active user rate.
*   Manage KES 50 million in total user savings by the end of the first year.
*   Enable users to save an average of 5-10% of their monthly income automatically.
*   Ensure 60% of users achieve at least one of their savings goals within six months.
*   Become Kenya's leading automated savings platform by making saving effortless and integrated into daily financial life.

### 1.2. Background Context

Millions of Kenyans are active users of mobile money systems like M-PESA, but they lack structured and automated tools to build savings. The discipline required for manual saving is a significant barrier, and existing financial apps are often complex or not tailored to the savings-focused user. Mobile money platforms themselves are designed for transactions, not for fostering savings habits.

Zanari addresses this gap by providing a mobile-first application that makes saving effortless. By integrating directly with mobile money systems, it automates savings through rules like transaction round-ups. The platform provides a unified wallet, goal-tracking features, and debit card functionality to give users a comprehensive and seamless tool for building financial resilience. The initial focus is on the M-PESA ecosystem, with plans to expand.

### 1.3. Change Log

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 2025-09-17 | 0.1 | Initial draft | John (PM) |

---

## 2. Requirements

### 2.1. Functional Requirements

*   **FR1:** Users must be able to complete a simple onboarding process, including identity verification (KYC) and linking their M-PESA account.
*   **FR2:** The application must provide a basic wallet view showing the current balance, a summary of savings, and recent transactions.
*   **FR3:** The application must fully integrate with M-PESA for deposits, withdrawals, and payments.
*   **FR4:** The system must provide an automated "round-up" savings feature that captures spare change from user transactions.
*   **FR5:** Users must be able to create, view, and track progress towards simple savings goals with a target amount and date.
*   **FR6:** A complete transaction history for all deposits, withdrawals, and savings transfers must be available to the user.
*   **FR7:** The application must be secured with PIN protection for access and send notifications for key transactions.
*   **FR8:** The solution must be delivered as a mobile application for Android and iOS.
*   **FR9:** The application must display simple charts and summaries of the user's savings progress.

### 2.2. Non-Functional Requirements

*   **NFR1:** The mobile application must load in under 3 seconds on a standard 4G connection.
*   **NFR2:** Core API responses must be faster than 500ms for 95% of requests.
*   **NFR3:** The system architecture must be designed to support over 100,000 concurrent users.
*   **NFR4:** Core services must maintain a 99.9% uptime Service Level Agreement (SLA).
*   **NFR5:** All user data, both at rest and in transit, must be secured with end-to-end encryption.
*   **NFR6:** The platform must comply with the Kenya Data Protection Act 2019, including plans for data localization.
*   **NFR7:** The backend will be built on Supabase, utilizing its managed PostgreSQL, Auth, and Edge Functions.
*   **NFR8:** The mobile application will be developed using React Native with TypeScript.
*   **NFR9:** The production database must be automatically backed up daily.
*   **NFR10:** In case of a critical failure, the Recovery Time Objective (RTO) for core services is 4 hours.

### 2.3. Out of Scope for MVP

To ensure a focused and timely launch, the following features and integrations are explicitly out of scope for the initial MVP release:

*   Physical debit cards
*   Airtel Money and T-Kash integrations
*   Advanced group savings (Chama) features
*   Investment or credit-scoring features
*   A full-featured web dashboard

---

## 3. User Interface Design Goals

### 3.1. Overall UX Vision

The user experience should be clean, simple, and trustworthy. The design should feel encouraging and motivating, visually celebrating the user's saving progress. The primary focus is on clarity and ease of use, ensuring users can understand their financial position at a glance and feel in control of their automated savings.

### 3.2. Key Interaction Paradigms

The application will adhere to standard mobile interaction patterns to ensure familiarity. Key paradigms will include a bottom tab navigator for primary sections, a card-based dashboard for displaying key information, and simple, guided forms for processes like goal creation. We will use subtle animations to confirm actions and celebrate milestones (e.g., reaching a savings goal).

### 3.3. Core Screens and Views

From a product perspective, the following conceptual screens are critical for the MVP:

*   **Onboarding & Login:** A simple, secure flow for registration and subsequent logins.
*   **Main Dashboard:** An at-a-glance view of the main wallet balance, total amount saved, and a summary of recent activity.
*   **Goal Management Screen:** A view to create new savings goals and track the progress of existing ones.
*   **Transaction History:** A detailed, searchable list of all transactions.
*   **Settings Page:** For managing the user profile, security settings (like PIN), and linked accounts.

### 3.4. Accessibility: WCAG AA

The application should meet WCAG 2.1 Level AA guidelines to ensure it is usable by people with a wide range of disabilities.

### 3.5. Branding

Branding is to be defined. However, the visual identity should evoke feelings of security, modernity, and optimism. The color palette should be clean and professional, potentially using greens and blues to signify growth and stability, complemented by a clear, legible font.

### 3.6. Target Device and Platforms: Cross-Platform

The application will be developed using React Native to target both Android and iOS from a single codebase, ensuring a consistent experience. A responsive web dashboard is planned for a post-MVP phase.

---

## 4. Technical Assumptions

These technical decisions and assumptions are derived from the Project Brief and will serve as critical constraints for the Architect.

### 4.1. Repository Structure: Monorepo

The project will use a monorepo structure. This will contain separate packages for the mobile app, the future web app, and shared utilities (like TypeScript types), facilitating code sharing and unified versioning.

### 4.2. Service Architecture: Serverless (via BaaS)

The architecture will be centered around a Backend-as-a-Service (BaaS) model provided by **Supabase**. Custom server-side logic, particularly for payment integrations, will be handled by serverless **Supabase Edge Functions**.

### 4.3. Testing Requirements: Unit + Integration

The project will require, at a minimum, comprehensive unit tests for individual components and integration tests to verify interactions between different parts of the system, especially the Supabase services and external M-PESA APIs.

### 4.4. Additional Technical Assumptions and Requests

*   **Frontend:** The mobile application will be built with **React Native and TypeScript**.
*   **Backend Platform:** The entire backend infrastructure (database, authentication, serverless functions, storage) will be provided by **Supabase**.
*   **Database:** The primary data store will be **Supabase's managed PostgreSQL**.
*   **Hosting:** The MVP will be hosted on **Supabase Cloud**. A plan must be in place to migrate to a self-hosted Supabase instance on a Kenyan cloud provider to ensure data localization compliance post-MVP.
*   **Primary Integration:** The initial and most critical integration is with the **M-PESA Daraja API**.

---

## 5. Cross-Functional Requirements

### 5.1. Operational Requirements

*   **Monitoring:** Core application services and Supabase functions must have basic health and performance monitoring in place.
*   **Alerting:** An alerting mechanism must be configured to notify the development team of critical failures or significant performance degradation.
*   **Logging:** All services and functions must produce structured logs to facilitate debugging and auditing.

---

## 6. Epic List

*   **Epic 1: Foundation & Core Savings Engine:** Establish the project's technical foundation, including user onboarding and M-PESA integration, to deliver the core automated "round-up" savings functionality.
*   **Epic 2: Goal Management & Visualization:** Enhance the core savings experience by allowing users to create, track, and visualize their progress towards specific, user-defined financial goals.

---

## 7. Epic 1: Foundation & Core Savings Engine

**Goal:** This epic lays the complete groundwork for the Zanari application. It covers setting up the Supabase backend, creating a secure user authentication flow, and building the critical integration with the M-PESA API. The epic culminates in delivering the core value proposition: automatically saving a user's spare change from their transactions.

### Story 1.1: Project & Backend Setup
*As a developer, I want to initialize the monorepo and configure the Supabase project, so that we have a foundational environment for development.*

**Acceptance Criteria:**
1.  A Git monorepo is initialized and configured with the basic folder structure for the mobile app and Supabase functions.
2.  A new Supabase project is created and environment details are securely stored.
3.  The mobile app can successfully connect to the Supabase backend.
4.  A basic "health-check" Supabase Edge Function is created and can be successfully deployed and invoked.

### Story 1.2: User Onboarding & Authentication
*As a new user, I want to create an account using my phone number and set a secure PIN, so that I can access the application safely.*

**Acceptance Criteria:**
1.  A user can register for a new account using their phone number.
2.  The user must set a multi-digit PIN for their account during the registration process.
3.  The user can successfully log in and log out using their phone number and PIN.
4.  User identity and sessions are securely managed using Supabase Auth.

### Story 1.3: Link M-PESA Account
*As a logged-in user, I want to securely link my M-PESA account to my Zanari wallet, so that the app can process transactions on my behalf.*

**Acceptance Criteria:**
1.  The user is presented with a clear interface to initiate the M-PESA account linking process.
2.  The user must confirm authorization for Zanari to interact with their M-PESA account (e.g., via an STK push confirmation).
3.  The linked M-PESA account status is securely stored against the user's profile.
4.  The user can see the linked status of their account in the app's settings.

### Story 1.4: Basic Wallet & Transaction Display
*As a user, I want to see my Zanari wallet balance and a list of my recent transactions, so that I can track my money.*

**Acceptance Criteria:**
1.  The main dashboard screen clearly displays the current Zanari wallet balance.
2.  A dedicated "History" screen displays a list of all transactions (e.g., deposits, savings).
3.  Each item in the transaction list shows the date, description, and amount.
4.  The list is displayed in reverse chronological order (newest first).

### Story 1.5: Implement Automated Round-Up Savings
*As a user with a linked account, I want the system to automatically round up my M-PESA transactions to the nearest KES 10 and transfer the difference to my Zanari savings wallet.*

**Acceptance Criteria:**
1.  A Supabase function (triggered by an M-PESA webhook) correctly calculates the round-up amount from a transaction (e.g., a KES 147 spend results in a KES 3 saving).
2.  The function successfully initiates an M-PESA C2B transfer of the calculated amount to the Zanari wallet.
3.  The user's Zanari wallet balance is correctly updated upon a successful transfer.
4.  A new "Savings" transaction appears in the user's transaction history.
5.  The user receives an in-app notification confirming the automated saving.

---

## 8. Epic 2: Goal Management & Visualization

**Goal:** This epic builds on the core savings engine by introducing features that make saving more purposeful and engaging. Users will be able to create specific financial goals, allocate funds towards them, and visually track their progress. This transforms the abstract act of saving into a tangible journey towards a desired outcome.

### Story 2.1: Create a Savings Goal
*As a user, I want to create a new savings goal with a name, target amount, and an optional target date, so that I can start saving for something specific.*

**Acceptance Criteria:**
1.  The user can access a "Create Goal" form from a primary UI element (e.g., a button on the dashboard).
2.  The form must allow the user to input a goal name (e.g., "New Phone"), a target amount, and optionally select a target date.
3.  The user can choose a simple icon or emoji to visually represent the goal.
4.  Upon submission, the new goal is saved and appears on the user's goal list.

### Story 2.2: View Savings Goals
*As a user, I want to see a list of all my savings goals and their progress at a glance, so that I can stay motivated.*

**Acceptance Criteria:**
1.  A dedicated "Goals" screen lists all active savings goals.
2.  Each goal in the list must display its name, the amount saved, and the target amount (e.g., "KES 5,000 / KES 20,000").
3.  A visual progress bar must show the percentage of the goal that has been completed.
4.  Tapping on a goal in the list navigates to a detailed view for that goal.

### Story 2.3: Manually Allocate Savings to Goals
*As a user, I want to manually transfer money from my main Zanari wallet to a specific savings goal, so that I can prioritize my savings.*

**Acceptance Criteria:**
1.  From a goal's detail view, the user can select an option to "Add Money".
2.  The user can specify an amount to transfer from their main wallet balance to the goal.
3.  The transfer fails with a clear error message if the main wallet has insufficient funds.
4.  On successful transfer, the goal's current saved amount is updated, and the main wallet balance is decreased accordingly.
5.  The transfer is recorded as a transaction in the main transaction history.

### Story 2.4. Basic Savings Analytics
*As a user, I want to see a simple chart of my total savings over time, so that I can understand my savings habits.*

**Acceptance Criteria:**
1.  A dedicated "Analytics" or "Progress" screen is accessible from the main navigation.
2.  This screen displays a simple line or bar chart showing the user's total savings balance over the last 30 days.
3.  The chart data is updated whenever the user's savings balance changes.
4.  The view includes at least one summary statistic, such as "Total Saved This Month" or "Average Saved Per Week".

---

## 9. Next Steps

### 9.1. UX Expert Prompt

**To the UX Expert:** Please review this Product Requirements Document (`docs/prd.md`), paying close attention to the 'User Interface Design Goals' (Section 3). Your task is to create the high-level UI/UX architecture, including wireframes or mockups for the core screens and detailed user flows for the primary user journeys defined in the epics.

### 9.2. Architect Prompt

**To the Architect:** Please review this Product Requirements Document (`docs/prd.md`). Your task is to create the detailed technical architecture document based on the requirements, assumptions, and epics defined within it. Ensure your architecture adheres to all functional, non-functional, and operational requirements.
