import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { OrderStatus } from '../schemas/order.schema';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  // Required (by the service) when status is DELIVERED.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'deliveryOtp must be 4-6 digits' })
  deliveryOtp?: string;
}

export class AdminUpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
