import { IsString, IsOptional } from 'class-validator';

export class SmsNotificationDto {
  @IsString()
  userId: string;

  @IsString()
  phone: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}
