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
} from 'class-validator';
import { Type } from 'class-transformer';
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

  /**
   * Run uploaded (data URI) images through background removal + pack-shot
   * normalisation. Defaults to true when PRODUCT_IMAGE_BG_PROVIDER != 'none'.
   */
  @IsOptional()
  @IsBoolean()
  removeBackground?: boolean;
}
