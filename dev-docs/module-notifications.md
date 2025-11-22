# Module: Notifications

This module handles user alerts across the platform, bridging backend events with frontend push notifications and local scheduling.

## User Journey

1.  **Permission Request**: On app launch or first relevant action, the user is asked to grant notification permissions.
2.  **Transactional Alerts**:
    -   **Payment Success**: "Payment completed: KES 500.00 paid to Netflix."
    -   **Money In**: "You received KES 2,000.00 from John Doe."
3.  **Engagement**:
    -   **Savings Milestones**: "You just reached 50% of your 'New Laptop' goal!"
    -   **KYC Updates**: "Your identity verification has been approved."

## Frontend Implementation

### Service: `notificationService` (`src/services/notificationService.ts`)
A singleton wrapper around `expo-notifications`.

-   **Initialization**:
    -   Configures Android channels (Importance: MAX, Vibration: Yes).
    -   Sets foreground presentation options (Alert: Yes, Sound: Yes).
-   **Push Token Management**:
    -   `registerForPushNotifications()`: Requests permissions and retrieves the Expo Push Token.
    -   This token is typically sent to the backend (via `AuthService` or `UserService` - *implementation pending in current codebase*).
-   **Local Scheduling**:
    -   `scheduleTransactionAlert(data)`: Formats currency and schedules an immediate local notification.
    -   `scheduleSavingsMilestone(data)`: Encourages users based on progress.
    -   `schedulePaymentConfirmation(data)`: Updates on payment status (Success/Pending/Failed).
-   **Listeners**:
    -   `addNotificationReceivedListener`: Handles notifications while the app is open.
    -   `addNotificationResponseListener`: Handles user taps on notifications.

## Backend Implementation

### Service: `ConsoleNotificationService` (`api/src/services/ConsoleNotificationService.ts`)
Currently, the backend uses a placeholder service that logs notifications to the server console instead of sending real push messages.

-   **Interface**: `NotificationService`
    -   `notifyUser(userId, payload)`: Logs `[NOTIFY] {userId} -> {title}: {body}`.
-   **Integration Points**:
    -   **KYCService**: Notifies on status change (`approved`/`rejected`).
    -   **SavingsGoalService**: Notifies on goal completion or milestone achievement.

### Future Roadmap (Real Push Notifications)
To enable real push notifications from the backend:
1.  **Store Tokens**: Update `users` table to store `expo_push_token`.
2.  **Expo SDK**: Replace `ConsoleNotificationService` with a service using `expo-server-sdk`.
3.  **Queueing**: Use a job queue (like BullMQ or Supabase Edge Functions) to offload sending logic.

## Configuration

-   **Expo Project ID**: Retrieved from `app.json` / `eas.json` configuration.
-   **Android Channel**: 'default' channel created with high importance.
