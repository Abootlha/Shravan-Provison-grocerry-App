import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsImageSource } from '../../products/dto/image-source.validator';
import { CategoryType } from '../schemas/category.schema';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameHi?: string;

  @IsString()
  @IsNotEmpty()
  @IsImageSource({ allowPlainIcon: true })
  icon!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  color!: string;

  @IsOptional()
  @IsString()
  @IsImageSource()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @IsOptional()
  @IsMongoId()
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionHi?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameHi?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsImageSource({ allowPlainIcon: true })
  icon?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsString()
  @IsImageSource()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionHi?: string;
}
