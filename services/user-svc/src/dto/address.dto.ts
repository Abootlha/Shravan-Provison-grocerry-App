import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class AddressDto {
  @IsString()
  label: string;

  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  postalCode: string;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
}
