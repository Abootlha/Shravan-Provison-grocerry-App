import { IsNumber, IsNotEmpty, IsString, IsOptional, Min, Max } from 'class-validator';
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

export class UpdateRiderLocationDto {
  @IsString()
  @IsNotEmpty()
  rider_id: string;

  @IsNotEmpty()
  location: GeoLocationDto;
}

export class NearbyRidersQueryDto {
  @IsNotEmpty()
  location: GeoLocationDto;

  @IsNumber()
  @Min(0.1)
  @Max(50)
  @Type(() => Number)
  radius_km: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}

export class NearbyRiderDto {
  rider_id: string;
  location: GeoLocationDto;
  distance_km: number;
  geohash: string;
  score?: number;
}

export class RiderRankingQueryDto {
  @IsNotEmpty()
  location: GeoLocationDto;

  @IsNumber()
  @Min(0.1)
  @Max(50)
  @Type(() => Number)
  radius_km: number;

  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 5;

  @IsNumber()
  @Min(0)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  min_rating?: number;
}

export class GeocodeQueryDto {
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class ReverseGeocodeQueryDto {
  @IsNotEmpty()
  location: GeoLocationDto;
}
