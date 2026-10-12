import { IsBoolean, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { ToBoolean } from './query-transforms';
import { CategoryType } from '../../modules/categories/schemas/category.schema';

/**
 * GET /admin/categories | /admin/subcategories | /admin/item-groups.
 * Deactivated records are only returned with ?includeInactive=true.
 */
export class AdminCatalogListQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;

  /** /admin/categories only (default: category). */
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  /** /admin/subcategories only. */
  @IsOptional()
  @IsMongoId()
  parentId?: string;

  /** /admin/item-groups only. */
  @IsOptional()
  @IsMongoId()
  subcategoryId?: string;
}
