import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
// The package ships JS without bundled typings in this service setup.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
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
