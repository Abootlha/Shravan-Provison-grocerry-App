import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private fcmApp: admin.app.App | null = null;

  constructor(private configService: ConfigService) {
    this.initializeFcm();
  }

  private initializeFcm(): void {
    try {
      const projectId = this.configService.get<string>('FCM_PROJECT_ID');
      const privateKey = this.configService.get<string>('FCM_PRIVATE_KEY');
      const clientEmail = this.configService.get<string>('FCM_CLIENT_EMAIL');

      if (!projectId || !privateKey || !clientEmail) {
        this.logger.warn('FCM not configured - push notifications will be mocked');
        return;
      }

      this.fcmApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });

      this.logger.log('FCM initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize FCM', error);
    }
  }

  async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.fcmApp) {
      this.logger.warn(`[MOCK] Push to ${deviceToken}: ${title} - ${body}`);
      return true;
    }

    try {
      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: { title, body },
        data: data || {},
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'high_priority_channel',
          },
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
            },
          },
        },
      };

      const response = await admin.messaging(this.fcmApp).send(message);
      this.logger.log(`Push sent successfully: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error}`);
      return false;
    }
  }

  async sendMulticastPush(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.fcmApp) {
      this.logger.warn(`[MOCK] Multicast push to ${deviceTokens.length} devices: ${title}`);
      return { successCount: deviceTokens.length, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: deviceTokens,
        notification: { title, body },
        data: data || {},
      };

      const response = await admin.messaging(this.fcmApp).sendEachForMulticast(message);
      this.logger.log(`Multicast push: ${response.successCount} succeeded, ${response.failureCount} failed`);
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`Failed to send multicast push: ${error}`);
      return { successCount: 0, failureCount: deviceTokens.length };
    }
  }
}
