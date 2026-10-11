import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidTimezone } from '../store-hours';

// 15-character Indian GSTIN, e.g. 09AAACH7409R1ZZ.
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

@ValidatorConstraint({ name: 'isTimezone', async: false })
class IsTimezoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidTimezone(value);
  }

  defaultMessage(): string {
    return 'timezone must be an IANA timezone such as Asia/Kolkata';
  }
}

/** Partial update: only the fees that are sent change. */
export class StoreFeesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  freeDeliveryThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  packagingFee?: number;

  /** Fraction of the item total: 0.05 = 5%. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.9)
  discountRate?: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class StoreLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}

export class StoreTimingsDto {
  @IsString()
  @Matches(TIME_PATTERN, { message: 'openTime must be HH:mm' })
  openTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'closeTime must be HH:mm' })
  closeTime!: string;
}

export class UpdateStoreSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreLocationDto)
  location?: StoreLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreTimingsDto)
  storeTimings?: StoreTimingsDto;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9 ]{0,19}$/, {
    message: 'contactPhone must be a phone number',
  })
  contactPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  estimatedDeliveryMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Empty string clears the value. */
  @IsOptional()
  @ValidateIf((o: UpdateStoreSettingsDto) => o.contactEmail !== '')
  @IsEmail()
  @MaxLength(200)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  /** Empty string clears the value. */
  @IsOptional()
  @IsString()
  @ValidateIf((o: UpdateStoreSettingsDto) => o.gstin !== '')
  @Matches(GSTIN_PATTERN, {
    message: 'gstin must be a valid 15-character GSTIN',
  })
  gstin?: string;

  @IsOptional()
  @IsString()
  @Validate(IsTimezoneConstraint)
  timezone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreFeesDto)
  fees?: StoreFeesDto;
}
