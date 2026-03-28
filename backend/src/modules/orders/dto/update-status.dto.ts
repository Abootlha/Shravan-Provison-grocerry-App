import { IsEnum } from 'class-validator';
import { OrderStatus } from '../schemas/order.schema';

export class UpdateStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
