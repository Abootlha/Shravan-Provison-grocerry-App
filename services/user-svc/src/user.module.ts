import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserGrpcController } from './user.grpc.controller';
import { RedisService } from './redis.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UserController, UserGrpcController],
  providers: [UserService, RedisService],
  exports: [UserService],
})
export class UserModule {}
