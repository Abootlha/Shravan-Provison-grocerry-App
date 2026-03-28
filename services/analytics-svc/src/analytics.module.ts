import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsGrpcController } from './analytics.grpc.controller';
import { MetricsService } from './metrics.service';
import { ReportService } from './report.service';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderEvent, OrderEventSchema } from './schemas/order-event.schema';
import { DailyAnalytics, DailyAnalyticsSchema } from './schemas/daily-analytics.schema';
import { RabbitMQService } from './rabbitmq.service';
import { RedisService } from './redis.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderEvent.name, schema: OrderEventSchema },
      { name: DailyAnalytics.name, schema: DailyAnalyticsSchema },
    ]),
  ],
  controllers: [AnalyticsController, AnalyticsGrpcController],
  providers: [AnalyticsService, MetricsService, ReportService, RabbitMQService, RedisService],
  exports: [AnalyticsService, MetricsService, ReportService],
})
export class AnalyticsModule {}
