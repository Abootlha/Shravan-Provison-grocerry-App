import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('payu.clientId') || '';
    this.clientSecret =
      this.configService.get<string>('payu.clientSecret') || '';
  }

  /**
   * Generates a PayU OAuth access token using Client Credentials
   * Useful for PayU Payment Links APIs and related integrations.
   */
  async getAccessToken(): Promise<string> {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      // 'scope' might be needed depending on the specific PayU API
      // params.append('scope', 'payment_links');

      const response = await axios.post(
        'https://accounts.payu.in/oauth/token',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.access_token;
    } catch (error: any) {
      this.logger.error(
        'Failed to get PayU access token',
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Payment Gateway Configuration Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Example method to create a payment link using the token
   */
  async createPaymentLink(paymentDetails: any) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.post(
        'https://api.payu.in/payment_links',
        paymentDetails,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        'Failed to create payment link',
        error.response?.data || error.message,
      );
      throw new HttpException(
        'Payment Link Generation Failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
