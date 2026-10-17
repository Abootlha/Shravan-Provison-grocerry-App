import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ScrapeStatus } from '../schemas/scraped-product.schema';

export const MAX_URLS_PER_SUBMISSION = 100;

export class SubmitScrapeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_URLS_PER_SUBMISSION)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { each: true, message: 'Each link must be a full http(s) URL' },
  )
  urls!: string[];

  /** Optional: file every product in this batch under this category. */
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsMongoId()
  subcategoryId?: string;

  @IsOptional()
  @IsMongoId()
  itemGroupId?: string;
}

export class ScrapeListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['in_progress', ...Object.values(ScrapeStatus)])
  status?: ScrapeStatus | 'in_progress';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchId?: string;
}

/** Reviewer edits. null clears an optional reference. */
export class UpdateScrapedProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  highlights?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsMongoId()
  categoryId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsMongoId()
  subcategoryId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsMongoId()
  itemGroupId?: string | null;

  /** Kept images in display order (subset of the scraped image URLs). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  imageUrls?: string[];
}

export class ApproveScrapedProductDto extends UpdateScrapedProductDto {
  /** Publish straight to the store (default) or keep it as a draft. */
  @IsOptional()
  @IsIn(['active', 'draft'])
  publishAs?: 'active' | 'draft';
}

export class DeclineScrapedProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BulkScrapeIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];

  @IsOptional()
  @IsIn(['active', 'draft'])
  publishAs?: 'active' | 'draft';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ImportCsvDto {
  @IsArray()
  rows!: Record<string, any>[];

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsMongoId()
  subcategoryId?: string;

  @IsOptional()
  @IsMongoId()
  itemGroupId?: string;
}

