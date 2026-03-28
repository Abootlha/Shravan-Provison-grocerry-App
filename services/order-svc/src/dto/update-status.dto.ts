import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '../interfaces/order.interface';

export class UpdateStatusDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsEnum(OrderStatus)
  newStatus: OrderStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
