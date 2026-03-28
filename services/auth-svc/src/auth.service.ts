import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from './redis.service';
import { v4 as uuidv4 } from 'uuid';
import {
  AuthTokens,
  TokenPayload,
  SendOtpResponse,
  VerifyOtpResponse,
  RefreshTokenResponse,
  ValidateTokenResponse,
  LogoutResponse,
  AdminLoginResponse,
} from './interfaces/auth.interface';

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly OTP_TTL = 300;
  private readonly MAX_OTP_ATTEMPTS = 3;
  private readonly ACCESS_TOKEN_TTL = 7200;
  private readonly REFRESH_TOKEN_TTL = 864000;

  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(phone: string): Promise<SendOtpResponse> {
    try {
      const existingOtpKey = `otp:${phone}:locked`;
      const isLocked = await this.redisService.get(existingOtpKey);
      if (isLocked) {
        throw new BadRequestException('Too many attempts. Please try again after 5 minutes.');
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpKey = `otp:${phone}`;

      const attemptsKey = `otp:${phone}:attempts`;
      const attempts = await this.redisService.incr(attemptsKey);

      if (attempts === 1) {
        await this.redisService.expire(attemptsKey, this.OTP_TTL);
      }

      if (attempts > this.MAX_OTP_ATTEMPTS) {
        await this.redisService.set(existingOtpKey, '1', 300);
        await this.redisService.del(attemptsKey);
        throw new BadRequestException('Too many attempts. Please try again after 5 minutes.');
      }

      await this.redisService.set(otpKey, JSON.stringify({ otp, attempts }), this.OTP_TTL);

      await this.sendOtpVia2Factor(phone, otp);

      this.logger.log(`OTP sent to ${phone}`);
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to send OTP: ${error}`);
      throw new BadRequestException('Failed to send OTP');
    }
  }

  private async sendOtpVia2Factor(phone: string, otp: string): Promise<void> {
    const apiKey = process.env.TWOFACTOR_API_KEY;
    if (!apiKey) {
      this.logger.warn('TWOFACTOR_API_KEY not configured, skipping SMS');
      return;
    }

    try {
      const twofactor = require('2factor')({ apiKey });
      await twofactor.sendOTP(phone.replace('+91', ''), otp);
    } catch (error) {
      this.logger.error(`2Factor API error: ${error}`);
    }
  }

  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
    try {
      const otpKey = `otp:${phone}`;
      const storedData = await this.redisService.get(otpKey);

      if (!storedData) {
        throw new UnauthorizedException('OTP expired or not found');
      }

      const { otp: storedOtp, attempts } = JSON.parse(storedData);

      if (storedOtp !== otp) {
        if (attempts >= this.MAX_OTP_ATTEMPTS) {
          await this.redisService.del(otpKey);
          await this.redisService.del(`otp:${phone}:attempts`);
          await this.redisService.del(`otp:${phone}:locked`);
        }
        throw new UnauthorizedException('Invalid OTP');
      }

      await this.redisService.del(otpKey);
      await this.redisService.del(`otp:${phone}:attempts`);

      const userId = uuidv4();
      const tokens = await this.generateTokens(userId, phone);

      this.logger.log(`User ${userId} authenticated successfully`);
      return { success: true, tokens, message: 'Authentication successful' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`OTP verification failed: ${error}`);
      throw new UnauthorizedException('OTP verification failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const isBlacklisted = await this.redisService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const accessToken = this.jwtService.sign(
        { sub: payload.sub, phone: payload.phone, type: 'access' },
        { secret: process.env.JWT_SECRET, expiresIn: this.ACCESS_TOKEN_TTL },
      );

      return { success: true, accessToken, message: 'Token refreshed successfully' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Token refresh failed: ${error}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateToken(token: string): Promise<ValidateTokenResponse> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      if (payload.type !== 'access') {
        return { valid: false };
      }

      return { valid: true, userId: payload.sub, phone: payload.phone };
    } catch {
      return { valid: false };
    }
  }

  async logout(refreshToken: string): Promise<LogoutResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      });

      const ttl = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : this.REFRESH_TOKEN_TTL;
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${refreshToken}`, '1', ttl);
      }

      this.logger.log(`User ${payload.sub} logged out`);
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Logout failed: ${error}`);
      return { success: true, message: 'Logged out successfully' };
    }
  }

  async adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
    if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userId = 'admin-001';
    const tokens = await this.generateTokens(userId, username);

    return {
      success: true,
      user: {
        id: userId,
        name: 'Admin',
        username: username,
        role: 'admin',
      },
      ...tokens,
      message: 'Login successful',
    };
  }

  private async generateTokens(userId: string, phone: string): Promise<AuthTokens> {
    const payload = { sub: userId, phone };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { secret: process.env.JWT_SECRET, expiresIn: this.ACCESS_TOKEN_TTL },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, expiresIn: this.REFRESH_TOKEN_TTL },
    );

    return { accessToken, refreshToken };
  }
}
