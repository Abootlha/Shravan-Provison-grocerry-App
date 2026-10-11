import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuoteItemDto {
  @IsMongoId()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** Accepted for payload compatibility with POST /orders; ignored (server prices). */
  @IsOptional()
  @IsNumber()
  price?: number;

  /** Accepted for payload compatibility with POST /orders; ignored. */
  @IsOptional()
  @IsString()
  image?: string;
}

/** POST /orders/quote: the same items payload POST /orders takes. */
export class QuoteOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}
