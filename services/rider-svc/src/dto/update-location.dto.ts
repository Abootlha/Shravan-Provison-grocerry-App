import { IsString, IsNumber, IsOptional, Min, Max, IsBoolean } from 'class-validator';

export class UpdateLocationDto {
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;
}
