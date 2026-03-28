import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://2factor.in/API/R';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TWOFACTOR_API_KEY', '');
  }

  async sendSms(phone: string, message: string, templateId?: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn(`[MOCK] SMS to ${phone}: ${message}`);
      return true;
    }

    try {
      const url = `${this.baseUrl}/?ApiKey=${this.apiKey}&To=${phone}&Message=${encodeURIComponent(message)}`;
      const response = await axios.get(url);

      if (response.data.Status === 'Success') {
        this.logger.log(`SMS sent successfully to ${phone}`);
        return true;
      } else {
        this.logger.warn(`SMS delivery issue to ${phone}: ${response.data.Details}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phone}: ${error}`);
      return false;
    }
  }

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const templateId = 'otp';
    const message = `Your OTP is ${otp}. Please do not share it with anyone.`;
    return this.sendSms(phone, message, templateId);
  }
}
