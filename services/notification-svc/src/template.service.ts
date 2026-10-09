import { Injectable } from '@nestjs/common';
import { OrderConfirmedTemplate } from './templates/order-confirmed';
import { OrderAssignedTemplate } from './templates/order-assigned';
import { RiderAssignedTemplate } from './templates/rider-assigned';
import { OrderDeliveredTemplate } from './templates/order-delivered';

export enum NotificationTemplateType {
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_ASSIGNED = 'ORDER_ASSIGNED',
  RIDER_ASSIGNED = 'RIDER_ASSIGNED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  OTP = 'OTP',
}

export interface TemplateData {
  orderId?: string;
  orderNumber?: string;
  riderName?: string;
  riderPhone?: string;
  estimatedDelivery?: string;
  otp?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class TemplateService {
  private templates: Map<NotificationTemplateType, (data: TemplateData) => { title: string; body: string }>;

  constructor() {
    this.templates = new Map();
    this.templates.set(NotificationTemplateType.ORDER_CONFIRMED, OrderConfirmedTemplate);
    this.templates.set(NotificationTemplateType.ORDER_ASSIGNED, OrderAssignedTemplate);
    this.templates.set(NotificationTemplateType.RIDER_ASSIGNED, RiderAssignedTemplate);
    this.templates.set(NotificationTemplateType.ORDER_DELIVERED, OrderDeliveredTemplate);
  }

  getTemplate(type: NotificationTemplateType, data: TemplateData): { title: string; body: string } {
    const template = this.templates.get(type);
    if (!template) {
      return { title: 'Notification', body: JSON.stringify(data) };
    }
    return template(data);
  }

  getOtpTemplate(otp: string): { title: string; body: string } {
    return {
      title: 'Verification Code',
      body: `Your verification code is ${otp}. Do not share it with anyone.`,
    };
  }
}
