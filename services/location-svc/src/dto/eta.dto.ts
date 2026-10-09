import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GeoLocationDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  longitude: number;
}

export class CalculateETADto {
  @IsNotEmpty()
  origin: GeoLocationDto;

  @IsNotEmpty()
  destination: GeoLocationDto;
}

export class ETAResponseDto {
  duration_seconds: number;
  formatted: string;
  arrival_time: Date;
}
