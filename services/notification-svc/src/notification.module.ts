import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGrpcController } from './notification.grpc.controller';
import { FcmService } from './fcm.service';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { TemplateService } from './template.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
  ],
  controllers: [NotificationController, NotificationGrpcController],
  providers: [NotificationService, FcmService, SmsService, EmailService, TemplateService],
  exports: [NotificationService],
})
export class NotificationModule {}
