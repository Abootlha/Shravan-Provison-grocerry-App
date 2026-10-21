import { riderApi } from './api';
import { notificationService } from './notifications';
import { storage } from './storage';

let inFlight: Promise<boolean> | null = null;

/**
 * Asks for notification permission (once; the OS remembers the answer) and
 * registers this phone's push token with the server, so new-order alerts
 * arrive even when the app is closed. Safe to call on every sign-in and
 * foreground: it only talks to the server when the token is new.
 */
export const registerPushNotifications = (): Promise<boolean> => {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        await notificationService.requestPermissions();
        const token = await notificationService.getPushToken();
        if (!token) return false;
        if ((await storage.getPushToken()) !== token || notificationService.pushToken !== token) {
          await riderApi.registerPushToken(token);
          await storage.setPushToken(token);
        }
        notificationService.pushToken = token;
        return true;
      } catch {
        return false;
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight;
};

/** On logout: this phone stops getting the rider's alerts. Needs a live session. */
export const unregisterPushNotifications = async (): Promise<void> => {
  const token = notificationService.pushToken ?? (await storage.getPushToken());
  notificationService.pushToken = null;
  await storage.setPushToken(null).catch(() => undefined);
  if (token) await riderApi.removePushToken(token).catch(() => undefined);
};
