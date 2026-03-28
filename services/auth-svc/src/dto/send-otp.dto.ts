import { IsString, IsPhoneNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendOtpDto {
  @IsString()
  @Transform(({ value }) => value?.replace(/\s/g, ''))
  @IsPhoneNumber('IN', { message: 'Invalid phone number format. Use +91XXXXXXXXXX' })
  phone: string;
}
