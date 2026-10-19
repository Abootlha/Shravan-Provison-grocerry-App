import { Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';

// Expo Go (SDK 53+) dropped parts of expo-notifications; a dev build has them all.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

type NotificationsModule = typeof import('expo-notifications');

const ORDERS_CHANNEL = 'order-alerts';
const UPDATES_CHANNEL = 'order-updates';

/** Long, distinct buzz for a new order request (wait, buzz, wait, buzz...). */
const NEW_ORDER_VIBRATION = [0, 600, 250, 600, 250, 900];

class NotificationService {
  private notifiedKeys = new Set<string>();
  private notificationsModule: NotificationsModule | null = null;
  private setupPromise: Promise<NotificationsModule | null> | null = null;

  private getModule(): Promise<NotificationsModule | null> {
    if (isExpoGo || Platform.OS === 'web') return Promise.resolve(null);
    if (!this.setupPromise) {
      this.setupPromise = (async () => {
        try {
          const Notifications = await import('expo-notifications');
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
            await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
              name: 'New order requests',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: NEW_ORDER_VIBRATION,
              sound: 'default',
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
              bypassDnd: false,
            });
            await Notifications.setNotificationChannelAsync(UPDATES_CHANNEL, {
              name: 'Order updates',
              importance: Notifications.AndroidImportance.HIGH,
              sound: 'default',
            });
          }
          this.notificationsModule = Notifications;
          return Notifications;
        } catch {
          return null;
        }
      })();
    }
    return this.setupPromise;
  }

  async requestPermissions(): Promise<boolean> {
    const Notifications = await this.getModule();
    if (!Notifications) return false;
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    const next = await Notifications.requestPermissionsAsync();
    return Boolean(next.granted || next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  }

  private async show(key: string, title: string, body: string, channel: string): Promise<void> {
    if (this.notifiedKeys.has(key)) return;
    this.notifiedKeys.add(key);
    const Notifications = this.notificationsModule || (await this.getModule());
    if (!Notifications) return;
    try {
      const { granted } = await Notifications.getPermissionsAsync();
      if (!granted) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { key },
        },
        trigger: Platform.OS === 'android' ? { channelId: channel } : null,
      });
    } catch {
      // Alerts are best effort; the in-app card still shows the request.
    }
  }

  /**
   * New order request: strong vibration plus a local notification with sound.
   * The notification also covers the case where the app is in the background.
   */
  async alertNewOrder(orderId: string, orderNumber: string, summary: string): Promise<void> {
    if (this.notifiedKeys.has(`offer:${orderId}`)) return;
    if (Platform.OS !== 'web') Vibration.vibrate(NEW_ORDER_VIBRATION);
    await this.show(`offer:${orderId}`, `New order request ${orderNumber}`, summary, ORDERS_CHANNEL);
  }

  async notifyUpdate(key: string, title: string, body: string): Promise<void> {
    await this.show(key, title, body, UPDATES_CHANNEL);
  }

  reset(key: string): void {
    this.notifiedKeys.delete(key);
  }
}

export const notificationService = new NotificationService();
