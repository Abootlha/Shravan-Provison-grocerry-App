import { TemplateData } from '../template.service';

export function OrderAssignedTemplate(data: TemplateData): { title: string; body: string } {
  return {
    title: 'Order Assigned',
    body: `Your order #${data.orderNumber || data.orderId} has been assigned to ${data.riderName || 'a rider'}.`,
  };
}
