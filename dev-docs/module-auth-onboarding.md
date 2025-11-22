# Module: Authentication & Onboarding

This module handles the complete user lifecycle from initial sign-up to secure session management. It enforces a strict security model requiring OTP verification for login and a 4-digit PIN for sensitive transactions and app access.

## User Journey

The authentication flow is designed to be secure yet user-friendly, with progressive steps:

1.  **Welcome**: User lands on the app.
2.  **Sign Up / Login**:
    -   **Sign Up**: User provides Name, Email, and Phone.
    -   **Login**: User enters Email or Phone.
3.  **OTP Verification**: A 6-digit code is sent via SMS or Email.
4.  **PIN Setup (New Users)**: If the user hasn't set a PIN, they are forced to create a 4-digit PIN.
5.  **PIN Entry (Returning Users)**: Users must enter their PIN to unlock the full app session.
6.  **KYC (Optional/Mandatory)**: Users may be prompted to upload identity documents.

## Backend Implementation

### Services

#### `AuthService` (`api/src/services/AuthService.ts`)
The core service managing authentication logic.

-   **`requestOtp(input)`**:
    -   Validates contact info (Email regex, Kenyan phone regex).
    -   Rate limits requests (1 per minute).
    -   Generates a 6-digit OTP (or uses a fixed code for test accounts).
    -   Creates an `AuthSession` with a 5-minute TTL.
    -   Sends OTP via `OtpSender` (SMS/Email).

-   **`verifyOtp(input)`**:
    -   Validates the OTP against the active session.
    -   Checks for expiration and max attempts (5 tries).
    -   On success:
        -   Marks session as verified.
        -   Issues **Access Token** (JWT) and **Refresh Token**.
        -   Returns `requiresPinSetup: boolean` based on user profile.

-   **`setupPin(userId, pin)`**:
    -   Hashes the 4-digit PIN using `PinHasher` (bcrypt/argon2).
    -   Stores the hash in the `users` table.

-   **`verifyPin(userId, pin)`**:
    -   Verifies the PIN against the stored hash.
    -   **Lockout Mechanism**: Enforces progressive delays (30s, 2m, 5m, 15m) after failed attempts.
    -   On success: Issues a short-lived `pin_token` (e.g., `txn_...`) used to authorize sensitive actions like payments.

#### `RegistrationService` (`api/src/services/RegistrationService.ts`)
Handles new user creation.

-   **`register(input)`**:
    -   Validates unique Email and Phone.
    -   Creates an identity in the underlying provider (Supabase Auth).
    -   Creates a user record in the `users` table.
    -   Immediately triggers `authService.requestOtp` to start the verification flow.

### Data Model

-   **`users` Table**:
    -   `pin_hash`: Stores the hashed PIN.
    -   `failed_pin_attempts`: Tracks consecutive failures.
    -   `last_failed_attempt_at`: Timestamp for lockout calculation.
-   **`auth_sessions` Table** (or Redis):
    -   Stores active OTP sessions, codes, and attempt counts.

## Frontend Implementation

### Navigation (`src/navigation/AuthNavigator.tsx`)
The `AuthNavigator` manages the stack of screens accessible before the user is fully authenticated.

-   **Screens**: `Welcome`, `Signup`, `Login`, `OTP`, `PINSetup`, `PINEntry`, `KYCUpload`.
-   **Security**: `gestureEnabled: false` is used on critical screens (OTP, PIN) to prevent users from bypassing the flow.

### State Management (`src/store/authStore.ts`)
The `useAuthStore` handles the complex state of the authentication session.

-   **State Variables**:
    -   `isAuthenticated`: True if we have a valid token.
    -   `isPinVerified`: True if the user has successfully entered their PIN this session.
    -   `pinLockedUntil`: Date when the PIN lockout expires.
    -   `pinVerificationToken`: The temporary token returned after PIN verification.

-   **Key Actions**:
    -   `login(email/phone)`: Calls API to request OTP.
    -   `verifyOtp(code)`: Exchanges OTP for tokens. Updates `isAuthenticated`.
    -   `verifyPin(pin)`: Calls API to verify PIN. Handles local lockout logic if the API reports a lock.
    -   `logout()`: Clears all tokens and resets state.

### Security Features

1.  **Session Timeout**: The app tracks `lastActivity`. If inactive for > 30 minutes, the session expires.
2.  **Local PIN Hashing**: The frontend may cache a salted hash of the PIN to allow offline verification (optional feature in `pinSecurity.ts`).
3.  **Secure Storage**: Tokens are persisted using `AsyncStorage` (should be `SecureStore` in production).

## API Endpoints

-   `POST /auth/register`: Create account.
-   `POST /auth/login`: Request OTP.
-   `POST /auth/verify-otp`: Exchange OTP for tokens.
-   `POST /auth/setup-pin`: Set initial PIN.
-   `POST /auth/verify-pin`: Verify PIN and get transaction token.
-   `PATCH /auth/profile`: Update user details.
