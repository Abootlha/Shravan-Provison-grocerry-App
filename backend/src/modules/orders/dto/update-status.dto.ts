import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../schemas/order.schema';
import { LocationDto } from './location.dto';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  // Required (by the service) when status is DELIVERED.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'deliveryOtp must be 4-6 digits' })
  deliveryOtp?: string;

  /** Rider position, stored on the timeline for PICKED_UP / DELIVERED. */
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

/** PATCH /orders/:id/reject (rider hands a reserved order back). */
export class RejectOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class AdminUpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
