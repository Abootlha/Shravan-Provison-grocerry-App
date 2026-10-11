import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const ADMIN_CUSTOMER_SORTS = [
  'createdAt',
  '-createdAt',
  'name',
  '-name',
  'orderCount',
  '-orderCount',
  'totalSpent',
  '-totalSpent',
  'lastOrderAt',
  '-lastOrderAt',
] as const;

/** GET /admin/customers: q searches name, phone and email. */
export class AdminCustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ADMIN_CUSTOMER_SORTS)
  sort?: (typeof ADMIN_CUSTOMER_SORTS)[number];
}
