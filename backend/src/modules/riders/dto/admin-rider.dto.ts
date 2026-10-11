import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { RiderStatus, VehicleType } from '../schemas/rider.schema';
import { ToBoolean } from '../../../common/dto/query-transforms';

export class AdminUpdateRiderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  /** 10-digit Indian mobile, optionally with +91; stored as +91XXXXXXXXXX. */
  @IsOptional()
  @IsString()
  @Length(10, 15)
  @Matches(/^(\+91)?\s?[0-9]{10}$/, {
    message: 'phone must be a 10-digit mobile number',
  })
  phone?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}

export class RiderStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class AdminRidersQueryDto {
  @IsOptional()
  @IsEnum(RiderStatus)
  status?: RiderStatus;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isActive?: boolean;
}
