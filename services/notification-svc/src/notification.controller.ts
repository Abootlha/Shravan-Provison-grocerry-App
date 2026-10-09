import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushNotificationDto } from './dto/push-notification.dto';
import { SmsNotificationDto } from './dto/sms-notification.dto';
import { NotificationTemplateType } from './template.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  async sendNotification(@Body() dto: SendNotificationDto) {
    const notification = await this.notificationService.sendNotification(dto);
    return { success: true, notification };
  }

  @Post('push')
  async sendPush(@Body() dto: PushNotificationDto) {
    const success = await this.notificationService.sendPushNotification(dto);
    return { success };
  }

  @Post('sms')
  async sendSms(@Body() dto: SmsNotificationDto) {
    const success = await this.notificationService.sendSmsNotification(dto);
    return { success };
  }

  @Post('template/:type')
  async sendTemplate(
    @Param('type') type: NotificationTemplateType,
    @Body() body: { userId: string; data: Record<string, string> },
  ) {
    const notification = await this.notificationService.sendTemplateNotification(
      body.userId,
      type,
      body.data,
    );
    return { success: true, notification };
  }

  @Post('otp')
  async sendOtp(@Body() body: { userId: string; phone: string; otp: string }) {
    await this.notificationService.sendOtp(body.userId, body.phone, body.otp);
    return { success: true };
  }

  @Get('user/:userId')
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    const notifications = await this.notificationService.getUserNotifications(userId, limit);
    return { notifications };
  }

  @Get('stats')
  async getStats() {
    const stats = await this.notificationService.getNotificationStats();
    return stats;
  }

  @Post('retry')
  async retryFailed() {
    await this.notificationService.retryFailedNotifications();
    return { success: true };
  }
}
