import { TemplateData } from '../template.service';

export function OrderDeliveredTemplate(data: TemplateData): { title: string; body: string } {
  return {
    title: 'Order Delivered! ✅',
    body: `Your order #${data.orderNumber || data.orderId} has been delivered. Enjoy!`,
  };
}
