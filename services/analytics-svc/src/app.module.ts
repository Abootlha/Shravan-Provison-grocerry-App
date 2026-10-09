import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsModule } from './analytics.module';
import { RedisService } from './redis.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/analytics'),
    AnalyticsModule,
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class AppModule {}
