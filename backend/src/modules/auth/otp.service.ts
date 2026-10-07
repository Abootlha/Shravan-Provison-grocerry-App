import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/utils/redis.service';
import axios from 'axios';

@Injectable()
export class OtpService {
  private readonly apiKey: string;
  private readonly otpExpiry: number;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.apiKey = this.configService.get<string>('twofactor.apiKey') || '';
    this.otpExpiry =
      this.configService.get<number>('twofactor.otpExpiry') || 300;
  }

  /**
   * Get Redis key for session storage
   */
  private getSessionKey(phone: string): string {
    return `otp_session:${phone}`;
  }

  /**
   * Send OTP via 2Factor.in using OTP Template
   */
  async sendOtp(
    phone: string,
  ): Promise<{ message: string; sessionId?: string }> {
    console.log(
      `[OTP] Sending OTP to ${phone}, API key configured: ${!!this.apiKey}`,
    );

    // Generate OTP locally
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const sessionKey = this.getSessionKey(phone);

    // Store OTP in Redis for local verification
    try {
      await this.redisService.set(sessionKey, `LOCAL:${otp}`, this.otpExpiry);
      console.log(`[OTP] Stored OTP in Redis: ${otp}`);
    } catch (redisError) {
      console.error('[OTP] Redis error:', redisError);
      throw new BadRequestException('Service unavailable. Please try again.');
    }

    // Check if API key is configured
    if (!this.apiKey) {
      console.log(`[DEV MODE] OTP for ${phone}: ${otp}`);
      return {
        message: 'OTP sent successfully (dev mode)',
        sessionId: `dev-${Date.now()}`,
      };
    }

    try {
      // Use SMS OTP endpoint with custom OTP and template name
      // Format: /SMS/{phone}/{otp}/{template_name}
      const templateName = 'OTP1';
      const apiUrl = `https://2factor.in/API/V1/${this.apiKey}/SMS/${phone}/${otp}/${templateName}`;
      console.log(
        `[OTP] Calling 2Factor OTP API with template: ${templateName}`,
      );

      const response = await axios.get(apiUrl, { timeout: 15000 });
      console.log('[OTP] 2Factor Response:', response.data);

      if (response.data.Status === 'Success') {
        return {
          message: 'OTP sent successfully',
          sessionId: response.data.Details,
        };
      } else {
        console.error('[OTP] 2Factor failed:', response.data);
        throw new BadRequestException(
          response.data.Details || 'Failed to send OTP',
        );
      }
    } catch (error: any) {
      console.error(
        '[OTP] 2Factor Error:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to send OTP. Please try again.');
    }
  }

  /**
   * Verify OTP locally (we generated it ourselves)
   */
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const sessionKey = this.getSessionKey(phone);
    const sessionData = await this.redisService.get(sessionKey);

    console.log(
      `[OTP] Verifying ${phone}: input=${otp}, session=${sessionData}`,
    );

    if (!sessionData) {
      throw new BadRequestException(
        'OTP expired or not found. Please request a new one.',
      );
    }

    // Verify locally
    if (sessionData.startsWith('DEV:') || sessionData.startsWith('LOCAL:')) {
      const storedOtp = sessionData.split(':')[1];
      if (storedOtp === otp) {
        await this.redisService.del(sessionKey);
        console.log(`[OTP] Verified successfully for ${phone}`);
        return true;
      }
      throw new BadRequestException('Invalid OTP. Please try again.');
    }

    // Legacy fallback
    if (sessionData === otp) {
      await this.redisService.del(sessionKey);
      return true;
    }

    throw new BadRequestException('Invalid OTP. Please try again.');
  }

  /**
   * Resend OTP
   */
  async resendOtp(
    phone: string,
  ): Promise<{ message: string; sessionId?: string }> {
    const resendKey = `otp_resend:${phone}`;
    const resendCount = await this.redisService.get(resendKey);

    if (resendCount && parseInt(resendCount) >= 3) {
      throw new BadRequestException(
        'Too many OTP requests. Please try again after 10 minutes.',
      );
    }

    await this.redisService.set(
      resendKey,
      (parseInt(resendCount || '0') + 1).toString(),
      600,
    );
    return this.sendOtp(phone);
  }
}
