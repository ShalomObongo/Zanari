# Frontend Architecture

The Zanari mobile application is built using **React Native** with **Expo**.

## Project Structure (`src/`)

-   **`components/`**: Reusable UI components (Buttons, Inputs, Cards).
-   **`screens/`**: Feature-specific screens (e.g., `LoginScreen`, `DashboardScreen`).
-   **`navigation/`**: Routing configuration.
-   **`services/`**: API clients and background services.
-   **`store/`**: Global state management using Zustand.
-   **`theme/`**: Design tokens (colors, typography, spacing).
-   **`utils/`**: Helper functions and formatters.

## Navigation (`src/navigation/`)

The app uses `react-navigation` and is structured into three main navigators:

### 1. AppNavigator (`AppNavigator.tsx`)
-   The root navigator.
-   **Responsibility**: Determines whether to show the `AuthNavigator` or the `MainNavigator` based on the user's authentication state.
-   It listens to the `authStore` to switch contexts automatically.

### 2. AuthNavigator (`AuthNavigator.tsx`)
-   **Scope**: Screens accessible when the user is *not* logged in.
-   **Screens**:
    -   Welcome/Onboarding
    -   Login / Register
    -   OTP Verification
    -   PIN Setup

### 3. MainNavigator (`MainNavigator.tsx`)
-   **Scope**: Screens accessible *after* successful login.
-   **Structure**: Typically a Tab Navigator (Dashboard, Savings, Invest, Profile) with nested Stack Navigators for specific flows (e.g., Payment flow, Settings flow).

## Design System
The app uses a centralized theme system located in `src/theme/`. Components consume these tokens to ensure consistency in:
-   Colors (Primary, Secondary, Backgrounds)
-   Typography (Font families, sizes, weights)
-   Spacing (Margins, Paddings)

## Environment Configuration
-   The app uses Expo's environment variable system (`.env` files).
-   Key variables include `EXPO_PUBLIC_API_URL` (Backend URL) and `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`.
