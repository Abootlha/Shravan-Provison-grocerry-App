import { IsOptional, IsString, IsNumber, IsMongoId, IsBoolean, Min } from 'class-validator';
import { ValidateHierarchy } from '../validators/hierarchy.validator';

export class UpdateProductDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    brand?: string;

    @IsOptional()
    @IsString()
    barcode?: string;

    @IsOptional()
    @IsMongoId()
    categoryId?: string;

    @IsOptional()
    @IsMongoId()
    @ValidateHierarchy()
    subcategoryId?: string;

    @IsOptional()
    @IsMongoId()
    itemGroupId?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    originalPrice?: number;

    @IsOptional()
    @IsString()
    unit?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    stock?: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    gst?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    shelfLife?: number;

    @IsOptional()
    @IsString()
    storageType?: string;

    @IsOptional()
    nutrition?: {
        protein?: number;
        carbs?: number;
        sugar?: number;
        fat?: number;
        transFat?: number;
    };

    @IsOptional()
    @IsBoolean()
    isAvailable?: boolean;
}
