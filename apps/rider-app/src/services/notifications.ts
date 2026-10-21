import { AppState, Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';

// Expo Go (SDK 53+) dropped parts of expo-notifications; a dev build has them all.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

type NotificationsModule = typeof import('expo-notifications');

const ORDERS_CHANNEL = 'order-alerts';
const UPDATES_CHANNEL = 'order-updates';

/** Long, distinct buzz for a new order request (wait, buzz, wait, buzz...). */
const NEW_ORDER_VIBRATION = [0, 600, 250, 600, 250, 900];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** EAS project id from app.json (extra.eas.projectId); push needs a real one. */
const easProjectId = (): string | null => {
  const id =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return id && UUID.test(id) ? id : null;
};

class NotificationService {
  private notifiedKeys = new Set<string>();
  /** Set once the backend has this phone's push token: the server alerts it directly. */
  pushToken: string | null = null;
  /** Why push could not be set up (shown in Profile for support). */
  pushError: string | null = null;
  private notificationsModule: NotificationsModule | null = null;
  private setupPromise: Promise<NotificationsModule | null> | null = null;

  private getModule(): Promise<NotificationsModule | null> {
    if (isExpoGo || Platform.OS === 'web') return Promise.resolve(null);
    if (!this.setupPromise) {
      this.setupPromise = (async () => {
        try {
          const Notifications = await import('expo-notifications');
          Notifications.setNotificationHandler({
            handleNotification: async (notification) => {
              // A server push arriving while the app is open duplicates the
              // in-app card and the local alert, so it is shown only in the list.
              const remote = (notification.request.trigger as { type?: string } | null)?.type === 'push';
              const foreground = AppState.currentState === 'active';
              const banner = !(remote && foreground);
              return {
                shouldShowAlert: banner,
                shouldPlaySound: banner,
                shouldSetBadge: false,
                shouldShowBanner: banner,
                shouldShowList: true,
              };
            },
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

  /**
   * Gets this phone's Expo push token. Null (with pushError set) in Expo Go,
   * on simulators, without permission, or while the app is not linked to an
   * EAS project (app.json extra.eas.projectId).
   */
  async getPushToken(): Promise<string | null> {
    const Notifications = await this.getModule();
    if (!Notifications) {
      this.pushError = 'Push alerts need the installed app (not Expo Go).';
      return null;
    }
    const projectId = easProjectId();
    if (!projectId) {
      this.pushError = 'Push alerts are not set up for this build (missing EAS project id).';
      return null;
    }
    try {
      const { granted } = await Notifications.getPermissionsAsync();
      if (!granted) {
        this.pushError = 'Notifications are turned off for this app.';
        return null;
      }
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      this.pushError = null;
      return data;
    } catch (error) {
      this.pushError = error instanceof Error ? error.message : 'Could not register for push alerts.';
      return null;
    }
  }

  private async show(key: string, title: string, body: string, channel: string): Promise<void> {
    if (this.notifiedKeys.has(key)) return;
    // In the background the server push already alerts this phone; a second
    // local notification would ring twice.
    if (this.pushToken && AppState.currentState !== 'active') return;
    const Notifications = this.notificationsModule || (await this.getModule());
    if (!Notifications) return;
    try {
      const { granted } = await Notifications.getPermissionsAsync();
      // Not marked as notified: once permission is given it can still alert.
      if (!granted) return;
      this.notifiedKeys.add(key);
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
