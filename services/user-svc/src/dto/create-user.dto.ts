import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';

export class CreateUserDto {
  @IsString()
  phone: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(['customer', 'rider', 'admin'])
  role?: 'customer' | 'rider' | 'admin';
}
