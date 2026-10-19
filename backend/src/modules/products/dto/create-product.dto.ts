import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsBoolean,
  Min,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  Max,
  ValidateNested,
  IsEnum,
  IsInt,
  Validate,
} from 'class-validator';
import { ProductStatus } from '../schemas/product.schema';
import { Type } from 'class-transformer';
import {
  MAX_VARIANTS,
  ProductVariantDto,
  ValidVariantsConstraint,
} from './variant.dto';
import { IsImageSource } from './image-source.validator';
import { NutritionDto } from './nutrition.dto';
import { ValidateHierarchy } from '../validators/hierarchy.validator';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  barcode?: string;

  @IsNotEmpty()
  @IsMongoId()
  categoryId!: string;

  @IsOptional()
  @IsMongoId()
  @ValidateHierarchy()
  subcategoryId?: string;

  @IsOptional()
  @IsMongoId()
  itemGroupId?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  unit!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  stock!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  highlights?: string;

  @IsOptional()
  @IsString()
  @IsImageSource()
  image?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @IsImageSource({}, { each: true })
  images?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shelfLife?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  storageType?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NutritionDto)
  nutrition?: NutritionDto;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  /** Fresh produce / dairy: short shelf life, perishable returns policy. */
  @IsOptional()
  @IsBoolean()
  isPerishable?: boolean;

  /** draft | active | archived. Defaults to active on create. */
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  /** Low-stock threshold for this product (default 10). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  reorderLevel?: number;

  /**
   * Run uploaded (data URI) images through background removal + pack-shot
   * normalisation. Defaults to true when PRODUCT_IMAGE_BG_PROVIDER != 'none'.
   */
  @IsOptional()
  @IsBoolean()
  removeBackground?: boolean;

  /** Pack sizes (Blinkit-style variants). Sent whole: the list replaces the stored one. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @Validate(ValidVariantsConstraint)
  variants?: ProductVariantDto[];
}
