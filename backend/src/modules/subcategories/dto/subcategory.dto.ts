import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsImageSource } from '../../products/dto/image-source.validator';

export class CreateSubcategoryDto {
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

  @IsMongoId()
  parentId!: string;

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

export class UpdateSubcategoryDto {
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
  @IsMongoId()
  parentId?: string;

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
