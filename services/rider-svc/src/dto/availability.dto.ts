import { IsBoolean, IsOptional } from 'class-validator';

export class AvailabilityDto {
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}
