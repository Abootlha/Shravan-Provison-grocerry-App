import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user.module';
import { RedisService } from './redis.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/user-svc'),
    UserModule,
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class AppModule {}
