import {
  Allow,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Indian mobile number: 10 digits starting 6-9, optionally prefixed with +91. */
export const RECEIVER_PHONE_PATTERN = /^(\+91)?[6-9]\d{9}$/;

/**
 * Optional free-text detail. An empty string is allowed and clears the stored
 * value (UsersService.applyAddressFields), so validation is skipped for it.
 */
const isProvided = (_: unknown, value: unknown) =>
  value !== undefined && value !== null && value !== '';

/**
 * Fields a client may set on a saved address. Only these are ever copied into
 * the user's address subdocument (see UsersService.applyAddressFields).
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

  @ValidateIf(isProvided)
  @IsString()
  @MaxLength(60)
  houseNo?: string;

  @ValidateIf(isProvided)
  @IsString()
  @MaxLength(30)
  floor?: string;

  @ValidateIf(isProvided)
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @ValidateIf(isProvided)
  @IsString()
  @MaxLength(80)
  receiverName?: string;

  @ValidateIf(isProvided)
  @IsString()
  @Matches(RECEIVER_PHONE_PATTERN, {
    message: 'receiverPhone must be a 10-digit Indian mobile number',
  })
  receiverPhone?: string;

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
