import {
  Allow,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Fields a client may set on a saved address. Only these are ever copied into
 * the user's address subdocument (see UsersService.toAddress).
 */
class AddressFieldsDto {
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  // Client-side bookkeeping fields the customer app echoes back when editing
  // an address. Accepted for compatibility but never stored.
  @Allow()
  id?: unknown;

  @Allow()
  _id?: unknown;

  @Allow()
  originalIndex?: unknown;

  @Allow()
  listIndex?: unknown;
}

export class CreateAddressDto extends AddressFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  pincode!: string;
}

export class UpdateAddressDto extends AddressFieldsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  type?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  pincode?: string;
}
