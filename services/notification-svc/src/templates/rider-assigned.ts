import { TemplateData } from '../template.service';

export function RiderAssignedTemplate(data: TemplateData): { title: string; body: string } {
  return {
    title: 'Rider on the way! 🚴',
    body: `${data.riderName || 'Our rider'} is on the way to deliver your order #${data.orderNumber || data.orderId}.`,
  };
}
