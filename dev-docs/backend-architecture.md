# Backend Architecture

The Zanari backend is built with **Express.js** but follows a clean architecture pattern to decouple the business logic from the HTTP framework.

## Core Components

### 1. Server Entry Point (`api/server.ts`)
The server entry point is responsible for:
-   Loading environment variables.
-   Initializing the **Dependency Injection (DI) Container**.
-   Setting up Express middleware (CORS, JSON parsing, logging).
-   Adapting framework-agnostic route handlers to Express middleware using `adaptRoute`.
-   Defining the HTTP routes and mapping them to container methods.

### 2. Dependency Injection Container (`api/src/container.ts`)
The application uses a manual dependency injection container to manage the lifecycle of services and repositories.
-   **`createAppContainer()`**: This function composes the entire application graph.
-   It initializes repositories (Supabase-backed).
-   It initializes services, injecting necessary repositories and other services.
-   It initializes route handlers, injecting the required services.
-   **Fallback Mechanism**: If Supabase credentials are missing, it falls back to an in-memory container (`dev/inMemoryAppContainer.ts`) for development and testing.

### 3. Layered Architecture
The backend is structured into three distinct layers:

#### A. Routes Layer (`api/src/routes/`)
-   **Responsibility**: Handles HTTP requests, validates input, and formats responses.
-   **Characteristics**: Framework-agnostic. Handlers accept a generic `HttpRequest` and return an `HttpResponse`. They do not depend directly on Express `req` or `res` objects.
-   **Adapters**: The `adaptRoute` function in `server.ts` bridges the gap between Express and these agnostic handlers.

#### B. Service Layer (`api/src/services/`)
-   **Responsibility**: Contains the core business logic.
-   **Characteristics**: Orchestrates operations between repositories and external clients (e.g., Paystack). It handles validation rules, calculations, and side effects like sending emails or notifications.

#### C. Repository Layer (`api/src/repositories/`)
-   **Responsibility**: Abstraction over the data source (Supabase/PostgreSQL).
-   **Characteristics**: Provides methods to CRUD data. This allows the underlying database to be swapped or mocked (e.g., for unit tests) without affecting the business logic.

## External Integrations
-   **Supabase**: Used as the primary database and for authentication session management.
-   **Paystack**: Used for payment processing. The `PaymentService` interacts with `PaystackClient`.
-   **SMTP/Email**: Configurable via environment variables. Falls back to Supabase native auth emails if SMTP is not configured.

## Background Jobs & Scripts
-   **Interest Accrual**: `scripts/accrue-interest.ts` is a standalone script designed to be run via cron (e.g., daily or hourly). It iterates through all users with investment positions and persists their accrued interest to the database.

## Development Mode
The backend supports a "Sandbox" mode. If `SUPABASE_URL` is not set, the container initializes in-memory repositories and services. This allows developers to run the API and frontend without a live internet connection or external dependencies.
