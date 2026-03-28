import { TemplateData } from '../template.service';

export function OrderConfirmedTemplate(data: TemplateData): { title: string; body: string } {
  return {
    title: 'Order Confirmed! 🎉',
    body: `Your order #${data.orderNumber || data.orderId} has been confirmed. Estimated delivery: ${data.estimatedDelivery || 'Soon'}.`,
  };
}
