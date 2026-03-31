import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private notifiedKeys = new Set<string>();

  async requestPermissions(): Promise<boolean> {
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
