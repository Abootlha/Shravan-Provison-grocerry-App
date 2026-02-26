import { IsNotEmpty, IsString, IsNumber, IsOptional, IsMongoId, IsBoolean, Min } from 'class-validator';
import { ValidateHierarchy } from '../validators/hierarchy.validator';

export class CreateProductDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    brand?: string;

    @IsOptional()
    @IsString()
    barcode?: string;

    @IsNotEmpty()
    @IsMongoId()
    categoryId: string;

    @IsNotEmpty()
    @IsMongoId()
    @ValidateHierarchy()
    subcategoryId: string;

    @IsNotEmpty()
    @IsMongoId()
    itemGroupId: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    price: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    originalPrice?: number;

    @IsNotEmpty()
    @IsString()
    unit: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    stock: number;

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
