import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_CART_ITEM_QUANTITY = 50;

export class AddToCartDto {
  @IsMongoId()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity?: number;

  /** Pack-size variant (ProductVariant.sku); optional. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[\w./-]+$/, { message: 'variantSku has invalid characters' })
  variantSku?: string;
}

export class UpdateCartItemDto {
  @IsMongoId()
  productId!: string;

  // 0 removes the item (existing behaviour of CartService.updateQuantity).
  @IsInt()
  @Min(0)
  @Max(MAX_CART_ITEM_QUANTITY)
  quantity!: number;

  /** Pack-size variant (ProductVariant.sku); optional. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[\w./-]+$/, { message: 'variantSku has invalid characters' })
  variantSku?: string;
}
