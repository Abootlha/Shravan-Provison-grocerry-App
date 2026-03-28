import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(['customer', 'rider', 'admin'])
  role?: 'customer' | 'rider' | 'admin';
}
