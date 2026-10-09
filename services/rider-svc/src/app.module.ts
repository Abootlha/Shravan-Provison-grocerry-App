import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RiderModule } from './rider.module';
import { RedisService } from './redis.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/rider-svc'),
    RiderModule,
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class AppModule {}
