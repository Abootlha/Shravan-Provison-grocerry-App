import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, timingSafeEqual } from 'crypto';
import { RedisService } from '../../common/utils/redis.service';
import { AuthKeys } from './auth.keys';
import axios from 'axios';

export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_MAX_SENDS_PER_HOUR = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly apiKey: string;
  private readonly templateName: string;
  private readonly otpExpiry: number;
  private readonly otpLength: number;
  /** Dev-mode OTP (no SMS provider, OTP printed to the local log) is only allowed in development. */
  private readonly allowDevOtp: boolean;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.apiKey = this.configService.get<string>('twofactor.apiKey') || '';
    this.templateName =
      this.configService.get<string>('twofactor.templateName') || 'OTP1';
    this.otpExpiry =
      this.configService.get<number>('twofactor.otpExpiry') || 300;
    this.otpLength = this.configService.get<number>('twofactor.otpLength') || 4;
    this.allowDevOtp =
      !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  }

  private maskPhone(phone: string): string {
    return phone.length > 4
      ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`
      : '****';
  }

  private generateOtp(): string {
    const max = 10 ** this.otpLength;
    return randomInt(0, max).toString().padStart(this.otpLength, '0');
  }

  /**
   * Per-phone send rate limit: 1 per 30s and 5 per hour.
   */
  private async enforceSendRateLimit(phone: string): Promise<void> {
    const client = this.redisService.getClient();

    const cooldownSet = await client.set(
      AuthKeys.otpCooldown(phone),
      '1',
      'EX',
      OTP_RESEND_COOLDOWN_SECONDS,
      'NX',
    );
    if (cooldownSet !== 'OK') {
      throw new HttpException(
        `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const hourlyKey = AuthKeys.otpHourly(phone);
    const sends = await client.incr(hourlyKey);
    if (sends === 1) {
      await client.expire(hourlyKey, 3600);
    }
    if (sends > OTP_MAX_SENDS_PER_HOUR) {
      throw new HttpException(
        'Too many OTP requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Send OTP via 2Factor.in using OTP Template
   */
  async sendOtp(
    phone: string,
  ): Promise<{ message: string; sessionId?: string }> {
    if (!this.apiKey && !this.allowDevOtp) {
      this.logger.error('TWOFACTOR_API_KEY is not configured');
      throw new ServiceUnavailableException(
        'OTP service unavailable. Please try again later.',
      );
    }

    try {
      await this.enforceSendRateLimit(phone);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Redis error while rate limiting OTP: ${String(error)}`,
      );
      throw new BadRequestException('Service unavailable. Please try again.');
    }

    const otp = this.generateOtp();
    const sessionKey = AuthKeys.otpSession(phone);

    // Store OTP in Redis for local verification; a new OTP resets the attempt counter.
    try {
      await this.redisService.set(sessionKey, `LOCAL:${otp}`, this.otpExpiry);
      await this.redisService.del(AuthKeys.otpAttempts(phone));
    } catch (redisError) {
      this.logger.error(`Redis error while storing OTP: ${String(redisError)}`);
      throw new BadRequestException('Service unavailable. Please try again.');
    }

    if (!this.apiKey) {
      // Development only (other environments fail above): there is no SMS provider,
      // so the OTP is only obtainable from the local server log.
      this.logger.warn(
        `[DEV MODE] TWOFACTOR_API_KEY not set. OTP for ${this.maskPhone(phone)}: ${otp}`,
      );
      return {
        message: 'OTP sent successfully (dev mode)',
        sessionId: `dev-${Date.now()}`,
      };
    }

    try {
      // Use SMS OTP endpoint with custom OTP and template name
      // Format: /SMS/{phone}/{otp}/{template_name}
      const apiUrl = `https://2factor.in/API/V1/${encodeURIComponent(this.apiKey)}/SMS/${encodeURIComponent(phone)}/${otp}/${encodeURIComponent(this.templateName)}`;

      const response = await axios.get(apiUrl, { timeout: 15000 });

      if (response.data?.Status === 'Success') {
        this.logger.log(`OTP sent to ${this.maskPhone(phone)}`);
        return {
          message: 'OTP sent successfully',
          sessionId: response.data.Details,
        };
      }

      this.logger.error(
        `2Factor send failed for ${this.maskPhone(phone)}: ${response.data?.Status}`,
      );
    } catch (error: any) {
      this.logger.error(
        `2Factor error for ${this.maskPhone(phone)}: ${error?.response?.status || error?.message}`,
      );
    }

    await this.redisService.del(sessionKey).catch(() => undefined);
    throw new BadRequestException('Failed to send OTP. Please try again.');
  }

  private otpEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }

  /**
   * Verify OTP locally (we generated it ourselves).
   * The OTP is invalidated after OTP_MAX_ATTEMPTS wrong attempts and deleted on success.
   */
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const sessionKey = AuthKeys.otpSession(phone);
    const attemptsKey = AuthKeys.otpAttempts(phone);
    const sessionData = await this.redisService.get(sessionKey);

    if (!sessionData) {
      throw new BadRequestException(
        'OTP expired or not found. Please request a new one.',
      );
    }

    const client = this.redisService.getClient();
    const attempts = await client.incr(attemptsKey);
    if (attempts === 1) {
      await client.expire(attemptsKey, this.otpExpiry);
    }

    if (attempts > OTP_MAX_ATTEMPTS) {
      await this.redisService.del(sessionKey);
      await this.redisService.del(attemptsKey);
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new OTP.',
      );
    }

    const storedOtp =
      sessionData.startsWith('DEV:') || sessionData.startsWith('LOCAL:')
        ? sessionData.split(':')[1]
        : sessionData; // legacy format

    if (this.otpEquals(storedOtp, String(otp))) {
      await this.redisService.del(sessionKey);
      await this.redisService.del(attemptsKey);
      this.logger.log(`OTP verified for ${this.maskPhone(phone)}`);
      return true;
    }

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await this.redisService.del(sessionKey);
      await this.redisService.del(attemptsKey);
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new OTP.',
      );
    }

    throw new BadRequestException('Invalid OTP. Please try again.');
  }

  /**
   * Resend OTP (rate limited by sendOtp).
   */
  async resendOtp(
    phone: string,
  ): Promise<{ message: string; sessionId?: string }> {
    return this.sendOtp(phone);
  }
}
