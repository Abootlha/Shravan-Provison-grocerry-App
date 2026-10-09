import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @IsString()
  @Transform(({ value }) => value?.replace(/\s/g, ''))
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
