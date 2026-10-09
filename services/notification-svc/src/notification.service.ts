import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationStatus, NotificationType } from './notification.schema';
import { FcmService } from './fcm.service';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { TemplateService, NotificationTemplateType, TemplateData } from './template.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushNotificationDto } from './dto/push-notification.dto';
import { SmsNotificationDto } from './dto/sms-notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly MAX_RETRY_COUNT = 3;

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private fcmService: FcmService,
    private smsService: SmsService,
    private emailService: EmailService,
    private templateService: TemplateService,
  ) {}

  async sendNotification(dto: SendNotificationDto): Promise<Notification> {
    const notification = new this.notificationModel({
      userId: new Types.ObjectId(dto.userId),
      type: dto.type,
      title: dto.title,
      body: dto.body,
      data: dto.data || {},
      status: NotificationStatus.PENDING,
    });

    await notification.save();

    try {
      const sent = await this.deliverNotification(notification);
      notification.status = sent ? NotificationStatus.SENT : NotificationStatus.FAILED;
      notification.sentAt = sent ? new Date() : undefined;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error}`);
      notification.status = NotificationStatus.FAILED;
    }

    await notification.save();
    return notification;
  }

  async sendPushNotification(dto: PushNotificationDto): Promise<boolean> {
    const success = await this.fcmService.sendPushNotification(
      dto.deviceToken || '',
      dto.title,
      dto.body,
      dto.data as Record<string, string>,
    );

    if (!success && dto.userId) {
      await this.queueForRetry(dto.userId, NotificationType.PUSH, dto.title, dto.body, dto.data || {});
    }

    return success;
  }

  async sendSmsNotification(dto: SmsNotificationDto): Promise<boolean> {
    const success = await this.smsService.sendSms(dto.phone, dto.message, dto.templateId);

    if (!success && dto.userId) {
      await this.queueForRetry(dto.userId, NotificationType.SMS, dto.message, '', { phone: dto.phone });
    }

    return success;
  }

  async sendTemplateNotification(
    userId: string,
    templateType: NotificationTemplateType,
    data: TemplateData,
  ): Promise<Notification> {
    const template = this.templateService.getTemplate(templateType, data);
    return this.sendNotification({
      userId,
      type: NotificationType.PUSH,
      title: template.title,
      body: template.body,
      data,
    });
  }

  async sendOtp(userId: string, phone: string, otp: string): Promise<boolean> {
    const template = this.templateService.getOtpTemplate(otp);
    const notification = await this.sendNotification({
      userId,
      type: NotificationType.SMS,
      title: template.title,
      body: template.body,
      data: { otp },
    });

    const success = notification.status === NotificationStatus.SENT;
    if (!success) {
      await this.smsService.sendOtp(phone, otp);
    }

    return true;
  }

  private async deliverNotification(notification: NotificationDocument): Promise<boolean> {
    switch (notification.type) {
      case NotificationType.PUSH:
        return this.fcmService.sendPushNotification(
          notification.data?.deviceToken || '',
          notification.title,
          notification.body,
          notification.data as Record<string, string>,
        );
      case NotificationType.SMS:
        return this.smsService.sendSms(
          notification.data?.phone || '',
          notification.body,
        );
      case NotificationType.EMAIL:
        return this.emailService.sendEmail(
          notification.data?.email || '',
          notification.title,
          notification.body,
        );
      default:
        return false;
    }
  }

  private async queueForRetry(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, any>,
  ): Promise<void> {
    await this.sendNotification({ userId, type, title, body, data });
  }

  async handlePushQueue(payload: any): Promise<void> {
    const { userId, title, body, data, deviceToken } = payload;
    const success = await this.sendPushNotification({ userId, title, body, data, deviceToken });

    if (!success) {
      this.logger.warn(`Push notification queued for retry: ${userId}`);
    }
  }

  async handleSmsQueue(payload: any): Promise<void> {
    const { userId, phone, message } = payload;
    const success = await this.sendSmsNotification({ userId, phone, message });

    if (!success) {
      this.logger.warn(`SMS notification queued for retry: ${userId}`);
    }
  }

  async retryFailedNotifications(): Promise<void> {
    const failedNotifications = await this.notificationModel.find({
      status: NotificationStatus.FAILED,
      retryCount: { $lt: this.MAX_RETRY_COUNT },
    });

    for (const notification of failedNotifications) {
      notification.retryCount += 1;
      await notification.save();

      const sent = await this.deliverNotification(notification);
      notification.status = sent ? NotificationStatus.SENT : NotificationStatus.FAILED;
      notification.sentAt = sent ? new Date() : undefined;
      await notification.save();
    }

    this.logger.log(`Retried ${failedNotifications.length} failed notifications`);
  }

  async getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getNotificationStats(): Promise<{ pending: number; sent: number; failed: number }> {
    const counts = await this.notificationModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return {
      pending: counts.find((c) => c._id === NotificationStatus.PENDING)?.count || 0,
      sent: counts.find((c) => c._id === NotificationStatus.SENT)?.count || 0,
      failed: counts.find((c) => c._id === NotificationStatus.FAILED)?.count || 0,
    };
  }
}
