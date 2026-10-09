import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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
}
