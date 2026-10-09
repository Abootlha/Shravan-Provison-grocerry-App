import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { NotificationTemplateType } from './template.service';

@Controller()
export class NotificationGrpcController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('notification.push')
  async handlePushNotification(@Payload() payload: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.notificationService.handlePushQueue(payload);
      channel.ack(originalMsg);
    } catch (error) {
      console.error('Error handling push notification:', error);
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('notification.sms')
  async handleSmsNotification(@Payload() payload: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.notificationService.handleSmsQueue(payload);
      channel.ack(originalMsg);
    } catch (error) {
      console.error('Error handling SMS notification:', error);
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('notification.order.confirmed')
  async handleOrderConfirmed(@Payload() payload: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.notificationService.sendTemplateNotification(
        payload.userId,
        NotificationTemplateType.ORDER_CONFIRMED,
        payload.data,
      );
      channel.ack(originalMsg);
    } catch (error) {
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('notification.order.assigned')
  async handleOrderAssigned(@Payload() payload: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.notificationService.sendTemplateNotification(
        payload.userId,
        NotificationTemplateType.ORDER_ASSIGNED,
        payload.data,
      );
      channel.ack(originalMsg);
    } catch (error) {
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('notification.rider.assigned')
  async handleRiderAssigned(@Payload() payload: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.notificationService.sendTemplateNotification(
        payload.userId,
        NotificationTemplateType.RIDER_ASSIGNED,
        payload.data,
      );
      channel.ack(originalMsg);
    } catch (error) {
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('notification.order.delivered')
  async handleOrderDelivered(@Payload() payload: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.notificationService.sendTemplateNotification(
        payload.userId,
        NotificationTemplateType.ORDER_DELIVERED,
        payload.data,
      );
      channel.ack(originalMsg);
    } catch (error) {
      channel.nack(originalMsg, false, true);
    }
  }
}
