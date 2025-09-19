# 4. Technical Assumptions

These technical decisions and assumptions are derived from the Project Brief and will serve as critical constraints for the Architect.

## 4.1. Repository Structure: Monorepo

The project will use a monorepo structure. This will contain separate packages for the mobile app, the future web app, and shared utilities (like TypeScript types), facilitating code sharing and unified versioning.

## 4.2. Service Architecture: Serverless (via BaaS)

The architecture will be centered around a Backend-as-a-Service (BaaS) model provided by **Supabase**. Custom server-side logic, particularly for payment integrations, will be handled by serverless **Supabase Edge Functions**.

## 4.3. Testing Requirements: Unit + Integration

The project will require, at a minimum, comprehensive unit tests for individual components and integration tests to verify interactions between different parts of the system, especially the Supabase services and external M-PESA APIs.

## 4.4. Additional Technical Assumptions and Requests

*   **Frontend:** The mobile application will be built with **React Native and TypeScript**.
*   **Backend Platform:** The entire backend infrastructure (database, authentication, serverless functions, storage) will be provided by **Supabase**.
*   **Database:** The primary data store will be **Supabase's managed PostgreSQL**.
*   **Hosting:** The MVP will be hosted on **Supabase Cloud**. A plan must be in place to migrate to a self-hosted Supabase instance on a Kenyan cloud provider to ensure data localization compliance post-MVP.
*   **Primary Integration:** The initial and most critical integration is with the **M-PESA Daraja API**.

---
