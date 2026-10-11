import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ToBoolean } from '../../../common/dto/query-transforms';
import { ProductStatus } from '../schemas/product.schema';
import { StockAdjustmentReason } from '../schemas/stock-adjustment.schema';

export const ADMIN_PRODUCT_SORTS = [
  'name',
  '-name',
  'price',
  '-price',
  'stock',
  '-stock',
  'soldCount',
  '-soldCount',
  'createdAt',
  '-createdAt',
  'updatedAt',
  '-updatedAt',
] as const;

export class AdminProductsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsMongoId()
  subcategoryId?: string;

  @IsOptional()
  @IsMongoId()
  itemGroupId?: string;

  /** low: 0 < stock <= reorderLevel; out: stock <= 0. */
  @IsOptional()
  @IsIn(['low', 'out'])
  stock?: 'low' | 'out';

  /** Missing/zero price, no image, missing unit, or a barcode in the unit. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  needsAttention?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsIn(ADMIN_PRODUCT_SORTS)
  sort?: (typeof ADMIN_PRODUCT_SORTS)[number];
}

export class UpdateProductStatusDto {
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}

export class StockAdjustmentDto {
  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  @Min(-1_000_000)
  @Max(1_000_000)
  delta!: number;

  @IsEnum(StockAdjustmentReason)
  reason!: StockAdjustmentReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReorderLevelDto {
  @IsInt()
  @Min(0)
  @Max(100_000)
  reorderLevel!: number;
}

export class StockAdjustmentsQueryDto extends PaginationQueryDto {}

export class BulkStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];

  @IsEnum(ProductStatus)
  status!: ProductStatus;
}
