import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { ValidateTokenResponse } from './interfaces/auth.interface';

@Controller()
export class AuthGrpcController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: { token: string }): Promise<ValidateTokenResponse> {
    return this.authService.validateToken(data.token);
  }

  @GrpcMethod('AuthService', 'SendOtp')
  async sendOtp(data: { phone: string }) {
    return this.authService.sendOtp(data.phone);
  }

  @GrpcMethod('AuthService', 'VerifyOtp')
  async verifyOtp(data: { phone: string; otp: string }) {
    return this.authService.verifyOtp(data.phone, data.otp);
  }

  @GrpcMethod('AuthService', 'RefreshToken')
  async refreshToken(data: { refreshToken: string }) {
    return this.authService.refreshToken(data.refreshToken);
  }

  @GrpcMethod('AuthService', 'Logout')
  async logout(data: { refreshToken: string }) {
    return this.authService.logout(data.refreshToken);
  }
}
