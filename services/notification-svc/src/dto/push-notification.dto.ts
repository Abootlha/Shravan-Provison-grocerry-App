import { IsString, IsOptional, IsObject } from 'class-validator';

export class PushNotificationDto {
  @IsString()
  userId: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  deviceToken?: string;
}
