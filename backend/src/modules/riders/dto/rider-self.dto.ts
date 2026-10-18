import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleType } from '../schemas/rider.schema';

/** PUT /riders/me: fields a rider may change on their own profile. */
export class UpdateRiderProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  /** Empty string clears it. */
  @IsOptional()
  @IsString()
  @Matches(/^$|^[A-Za-z0-9 -]{2,20}$/, {
    message: 'vehicleNumber must be 2-20 letters, digits, spaces or hyphens',
  })
  vehicleNumber?: string;
}

/** PUT /riders/me/location (REST fallback for the socket event). */
export class RiderLocationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1) // -1 = unknown (iOS)
  @Max(360)
  heading?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1) // -1 = unknown (iOS)
  speed?: number;
}
