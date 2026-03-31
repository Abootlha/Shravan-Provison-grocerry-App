import Constants from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

type NotificationsModule = typeof import('expo-notifications');

class NotificationService {
  private notifiedKeys = new Set<string>();
  private notificationsModule: NotificationsModule | null = null;
  private handlerInitialized = false;

  private async getNotificationsModule(): Promise<NotificationsModule | null> {
    if (isExpoGo) {
      return null;
    }

    if (!this.notificationsModule) {
      this.notificationsModule = await import('expo-notifications');
    }

    if (!this.handlerInitialized && this.notificationsModule) {
      this.notificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      this.handlerInitialized = true;
    }

    return this.notificationsModule;
  }

  async requestPermissions(): Promise<boolean> {
    const Notifications = await this.getNotificationsModule();
    if (!Notifications) {
      return false;
    }

    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }

    const next = await Notifications.requestPermissionsAsync();
    return Boolean(next.granted || next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
  }

  async notifyOnce(key: string, title: string, body: string): Promise<void> {
    if (this.notifiedKeys.has(key)) {
      return;
    }

    const Notifications = await this.getNotificationsModule();
    if (!Notifications) {
      return;
    }

    const granted = await this.requestPermissions();
    if (!granted) {
      return;
    }

    this.notifiedKeys.add(key);
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
  }

  reset(key: string): void {
    this.notifiedKeys.delete(key);
  }
}

export const notificationService = new NotificationService();
