import { IsNotEmpty, IsString, IsNumber, IsOptional, ValidateNested, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  image?: string;
}

class CoordinatesDto {
  @IsString()
  type: 'Point';

  @IsArray()
  coordinates: [number, number];
}

class DeliveryAddressDto {
  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNotEmpty()
  @IsString()
  street: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsNotEmpty()
  @IsString()
  postalCode: string;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  deliveryFee: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  packagingFee: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress: DeliveryAddressDto;

  @IsNotEmpty()
  @IsString()
  paymentMethod: string;
}
