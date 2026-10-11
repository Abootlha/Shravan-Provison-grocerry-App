import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SeamlessHashDto {
  // Either the human-readable orderId (ORD-...) or the order's Mongo _id.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  orderId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,20}$/)
  pg?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,30}$/)
  bankcode?: string;
}
