import {
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ToBoolean, ToStringArray } from '../../../common/dto/query-transforms';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../schemas/order.schema';

export const ADMIN_ORDER_SORT_VALUES = [
  'createdAt',
  '-createdAt',
  'updatedAt',
  '-updatedAt',
  'totalAmount',
  '-totalAmount',
] as const;

/**
 * GET /admin/orders. `status` accepts a comma-separated list.
 * startDate/endDate are the legacy names of dateFrom/dateTo.
 */
export class AdminOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @ToStringArray()
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** A rider id, or "none" for orders without a rider. */
  @IsOptional()
  @IsMongoId()
  riderId?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  requiresManualReview?: boolean;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(ADMIN_ORDER_SORT_VALUES)
  sort?: (typeof ADMIN_ORDER_SORT_VALUES)[number];
}
