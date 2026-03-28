import { PaymentMethod, PaymentStatus } from '../payment.schema';

export interface PaymentResponse {
  id: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
