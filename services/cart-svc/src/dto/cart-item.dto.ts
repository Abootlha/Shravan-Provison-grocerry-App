import { IsNotEmpty, IsString, IsNumber, IsOptional, IsMongoId, Min } from 'class-validator';

export class AddCartItemDto {
    @IsNotEmpty()
    @IsMongoId()
    productId!: string;

    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    quantity!: number;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    price!: number;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsString()
    unit?: string;
}

export class UpdateCartItemDto {
    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    quantity!: number;
}

export class CartItemResponse {
    productId!: string;
    name!: string;
    quantity!: number;
    price!: number;
    image?: string;
    unit?: string;
}

export class CartResponse {
    userId!: string;
    items!: CartItemResponse[];
    itemTotal!: number;
    itemCount!: number;
}
