# 2. Requirements

## 2.1. Functional Requirements

*   **FR1:** Users must be able to complete a simple onboarding process, including identity verification (KYC) and linking their M-PESA account.
*   **FR2:** The application must provide a basic wallet view showing the current balance, a summary of savings, and recent transactions.
*   **FR3:** The application must fully integrate with M-PESA for deposits, withdrawals, and payments.
*   **FR4:** The system must provide an automated "round-up" savings feature that captures spare change from user transactions.
*   **FR5:** Users must be able to create, view, and track progress towards simple savings goals with a target amount and date.
*   **FR6:** A complete transaction history for all deposits, withdrawals, and savings transfers must be available to the user.
*   **FR7:** The application must be secured with PIN protection for access and send notifications for key transactions.
*   **FR8:** The solution must be delivered as a mobile application for Android and iOS.
*   **FR9:** The application must display simple charts and summaries of the user's savings progress.

## 2.2. Non-Functional Requirements

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

## 2.3. Out of Scope for MVP

To ensure a focused and timely launch, the following features and integrations are explicitly out of scope for the initial MVP release:

*   Physical debit cards
*   Airtel Money and T-Kash integrations
*   Advanced group savings (Chama) features
*   Investment or credit-scoring features
*   A full-featured web dashboard

---
