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

export class CalculateRouteDto {
  @IsNotEmpty()
  origin: GeoLocationDto;

  @IsNotEmpty()
  destination: GeoLocationDto;
}

export class RouteResponseDto {
  points: GeoLocationDto[];
  distance_km: number;
  duration_seconds: number;
  polyline: string;
}
