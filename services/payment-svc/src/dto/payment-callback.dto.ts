import { IsString, IsOptional } from 'class-validator';

export class PaymentCallbackDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  @IsOptional()
  razorpaySignature?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
