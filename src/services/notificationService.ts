import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export type NotificationCategory = 'transaction' | 'savings' | 'payment';

interface RegisterPushOptions {
  projectId?: string;
  onToken?: (token: string) => Promise<void> | void;
}

interface ScheduleOptions {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  triggerSeconds?: number;
  category?: NotificationCategory;
}

export type NotificationListener = (notification: Notifications.Notification) => void;
export type NotificationResponseListener = (response: Notifications.NotificationResponse) => void;

class NotificationServiceClass {
  private initialized = false;
  private pushToken: string | null = null;
  private receivedListener?: Notifications.EventSubscription;
  private responseListener?: Notifications.EventSubscription;

  async initialize() {
    if (this.initialized) {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    this.initialized = true;
  }

  async requestPermissions() {
    await this.initialize();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async registerForPushNotifications(options?: RegisterPushOptions): Promise<string | null> {
    await this.initialize();

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('Notification permission denied');
      return null;
    }

    const projectId =
      options?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      // Cast to any to avoid overly strict Expo type definition on manifest2
      (Constants.manifest2 as any)?.extra?.expoClient?.projectId;

    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const token = tokenResponse.data;
      this.pushToken = token;

      if (options?.onToken) {
        await options.onToken(token);
      }

      return token;
    } catch (error) {
      console.warn('Failed to retrieve Expo push token', error);
      return null;
    }
  }

  getPushToken() {
    return this.pushToken;
  }

  addNotificationReceivedListener(listener: NotificationListener) {
    if (this.receivedListener) {
      this.receivedListener.remove();
    }
    this.receivedListener = Notifications.addNotificationReceivedListener(listener);
    return () => this.receivedListener?.remove();
  }

  addNotificationResponseListener(listener: NotificationResponseListener) {
    if (this.responseListener) {
      this.responseListener.remove();
    }
    this.responseListener = Notifications.addNotificationResponseReceivedListener(listener);
    return () => this.responseListener?.remove();
  }

  async schedule(options: ScheduleOptions) {
    await this.initialize();

    const trigger: Notifications.NotificationTriggerInput | null = options.triggerSeconds
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: options.triggerSeconds,
          repeats: false,
        } as Notifications.NotificationTriggerInput
      : null;

    const content: Notifications.NotificationContentInput = {
      title: options.title,
      body: options.body,
      data: {
        category: options.category,
        ...options.data,
      },
    };

    return Notifications.scheduleNotificationAsync({ content, trigger: trigger ?? null });
  }

  async scheduleTransactionAlert(data: {
    amount: number;
    merchantName?: string;
    transactionId: string;
  }) {
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(data.amount);

    return this.schedule({
      title: 'Transaction Completed',
      body: `${formattedAmount} paid${data.merchantName ? ` to ${data.merchantName}` : ''}.`,
      data: {
        transactionId: data.transactionId,
      },
      category: 'transaction',
    });
  }

  async scheduleSavingsMilestone(data: {
    goalName: string;
    progressPercentage: number;
    milestoneName?: string;
  }) {
    const body = data.milestoneName
      ? `You just reached the ${data.milestoneName} milestone in ${data.goalName}!`
      : `You're ${data.progressPercentage}% towards ${data.goalName}. Keep going!`;

    return this.schedule({
      title: 'Savings milestone reached',
      body,
      data: {
        goalName: data.goalName,
      },
      category: 'savings',
    });
  }

  async schedulePaymentConfirmation(data: {
    amount: number;
    reference: string;
    status: 'success' | 'pending' | 'failed';
  }) {
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(data.amount);

    const statusMessage =
      data.status === 'success'
        ? 'completed successfully'
        : data.status === 'pending'
          ? 'is pending confirmation'
          : 'failed';

    return this.schedule({
      title: 'Payment update',
      body: `Payment ${statusMessage}: ${formattedAmount} (ref ${data.reference}).`,
      data: {
        reference: data.reference,
        status: data.status,
      },
      category: 'payment',
    });
  }

  async cancelNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export const notificationService = new NotificationServiceClass();

export default notificationService;
