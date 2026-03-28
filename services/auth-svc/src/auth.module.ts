import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGrpcController } from './auth.grpc.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: 7200 },
    }),
  ],
  controllers: [AuthController, AuthGrpcController],
  providers: [AuthService, JwtStrategy, RedisService],
  exports: [AuthService, RedisService, JwtModule],
})
export class AuthModule {}
