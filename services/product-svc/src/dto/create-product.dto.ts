import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsOptional,
    IsMongoId,
    IsBoolean,
    IsArray,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NutritionInfoDto {
    @IsOptional()
    @IsNumber()
    calories?: number;

    @IsOptional()
    @IsNumber()
    protein?: number;

    @IsOptional()
    @IsNumber()
    carbs?: number;

    @IsOptional()
    @IsNumber()
    fat?: number;
}

export class CreateProductDto {
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsOptional()
    @IsString()
    nameHi?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    descriptionHi?: string;

    @IsNotEmpty()
    @IsMongoId()
    categoryId!: string;

    @IsOptional()
    @IsMongoId()
    subcategoryId?: string;

    @IsOptional()
    @IsMongoId()
    brandId?: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    price!: number;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    mrp!: number;

    @IsNotEmpty()
    @IsString()
    unit!: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    weight?: number;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    images?: string[];

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    stock!: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    lowStockThreshold?: number;

    @IsOptional()
    @IsBoolean()
    isAvailable?: boolean;

    @IsOptional()
    @IsBoolean()
    isFeatured?: boolean;

    @IsOptional()
    @IsBoolean()
    isOrganic?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsString()
    barcode?: string;

    @IsOptional()
    @IsString()
    sku?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => NutritionInfoDto)
    nutritionInfo?: NutritionInfoDto;
}
