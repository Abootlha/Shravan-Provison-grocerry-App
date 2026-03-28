import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsMongoId,
    IsBoolean,
    IsNumber,
    IsArray,
} from 'class-validator';

export class CreateCategoryDto {
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
    image?: string;

    @IsOptional()
    @IsMongoId()
    parentId?: string;

    @IsOptional()
    @IsNumber()
    order?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}

export class UpdateCategoryDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    nameHi?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsMongoId()
    parentId?: string;

    @IsOptional()
    @IsNumber()
    order?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];
}
