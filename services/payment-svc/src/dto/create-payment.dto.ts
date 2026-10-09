import { IsString, IsNumber, IsOptional, IsObject, IsEnum, Min } from 'class-validator';
import { PaymentMethod } from '../payment.schema';

export class CreatePaymentDto {
  @IsString()
  orderId: string;

  @IsString()
  userId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
