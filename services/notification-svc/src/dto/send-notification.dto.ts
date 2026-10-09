import { IsString, IsEnum, IsOptional, IsObject, IsNumber } from 'class-validator';
import { NotificationType } from '../notification.schema';

export class SendNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
