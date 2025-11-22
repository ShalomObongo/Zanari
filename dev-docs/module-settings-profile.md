# Module: Settings & Profile

This module empowers users to manage their personal information, security preferences, and application behavior.

## User Journey

1.  **Access**: User taps the "Settings" tab (gear icon).
2.  **Profile Management**:
    -   User taps "Edit Profile" to update name, email, or phone number.
    -   Input validation ensures Kenyan phone number format (2547...).
3.  **Security Configuration**:
    -   **Change PIN**: User verifies old PIN, then sets a new one.
    -   **Biometrics**: User toggles FaceID/TouchID. Requires PIN verification to enable.
    -   **KYC Status**: User views verification level (Verified, Pending, Action Required).
4.  **App Preferences**:
    -   **Theme**: Light, Dark, or System Default.
    -   **Notifications**: Toggle Email, SMS, Push alerts.
    -   **Privacy**: Toggle data sharing.

## Frontend Implementation

### Screens

#### `SettingsScreen` (`src/screens/settings/SettingsScreen.tsx`)
The main dashboard for configuration.
-   **State**: Connects to `authStore` (user data), `settingsStore` (biometrics), and `themeContext`.
-   **Biometrics**: Uses `expo-local-authentication` to check hardware capability.
-   **Logout**: Clears all Zustand stores (`walletStore`, `transactionStore`, `savingsStore`) to prevent data leaks.

#### `EditProfileScreen` (`src/screens/settings/EditProfileScreen.tsx`)
-   **Validation**:
    -   Name length >= 2 chars.
    -   Email regex check.
    -   Phone number normalization (auto-formats `07...` to `2547...`).
-   **Action**: Calls `authStore.updateProfile()`.

#### `ChangePINScreen` (`src/screens/settings/ChangePINScreen.tsx`)
A secure, multi-step wizard.
-   **Step 1: Verify**: Authenticates current PIN.
-   **Step 2: New PIN**: Enforces security rules (no `1234`, `1111`).
-   **Step 3: Confirm**: Ensures match.
-   **Lockout**: Handles `PinLockError` if user fails verification too many times.

#### `RoundUpSettingsScreen` (`src/screens/settings/RoundUpSettingsScreen.tsx`)
-   **Configuration**: Select increment (10, 50, 100), Percentage, or AI Auto-mode.
-   **Visualization**: Shows total saved and projected savings based on spending habits.

## State Management

### `settingsStore`
-   **Biometric Preference**: Persists `isBiometricEnabled` per user ID.
-   **Logic**: `enableBiometric` requires a successful PIN check first.

### `authStore`
-   **Profile Updates**: `updateProfile` syncs changes to Supabase `users` table.
-   **PIN Management**: `verifyPin` and `setupPin` interact with the backend `AuthService`.

## Security Considerations

-   **Sensitive Actions**: Enabling biometrics or changing PIN always requires re-authentication (entering current PIN).
-   **Input Masking**: PIN inputs are always masked.
-   **Data Clearing**: Logout explicitly resets all stores to remove cached financial data from memory.
