import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly key: string;
  private readonly salt: string;

  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  // Queue state for rate limiting (max 20 requests per minute)
  private requestQueue: (() => Promise<void>)[] = [];
  private isProcessingQueue = false;
  private requestsThisMinute = 0;
  private minuteStartTime = Date.now();

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('payu.clientId') || '';
    this.clientSecret =
      this.configService.get<string>('payu.clientSecret') || '';
    this.key = this.configService.get<string>('payu.key') || '';
    this.salt = this.configService.get<string>('payu.salt') || '';
  }

  /**
   * Generates a PayU OAuth access token using Client Credentials
   * Useful for PayU Payment Links APIs and related integrations.
   * Caches the token to avoid hitting rate limits (valid for ~8 hours).
   */
  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    try {
      if (!this.clientId || !this.clientSecret || this.clientId.includes('test')) {
        this.logger.warn('PayU credentials missing or appear to be test credentials. Please verify your account status is active/live.');
      }

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

      this.cachedToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 28800;
      this.tokenExpiry = Date.now() + (expiresIn - 300) * 1000; // cache until 5 mins before expiry

      return this.cachedToken!;
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
   * Internal queue processor to enforce rate limit (max 20 requests/min).
   */
  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      if (now - this.minuteStartTime > 60000) {
        this.minuteStartTime = now;
        this.requestsThisMinute = 0;
      }

      if (this.requestsThisMinute >= 20) {
        const timeToWait = 60000 - (now - this.minuteStartTime);
        this.logger.warn(`Rate limit approached. Delaying PayU requests for ${timeToWait}ms`);
        await new Promise((resolve) => setTimeout(resolve, timeToWait));
        this.minuteStartTime = Date.now();
        this.requestsThisMinute = 0;
      }

      const request = this.requestQueue.shift();
      if (request) {
        this.requestsThisMinute++;
        await request();
      }
    }
    this.isProcessingQueue = false;
  }

  /**
   * Example method to create a payment link using the token
   * Executes via queue to ensure rate limit compliance.
   */
  async createPaymentLink(paymentDetails: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const token = await this.getAccessToken();
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
          resolve(response.data);
        } catch (error: any) {
          this.logger.error(
            'Failed to create payment link',
            error.response?.data || error.message,
          );
          reject(
            new HttpException(
              'Payment Link Generation Failed',
              HttpStatus.BAD_REQUEST,
            )
          );
        }
      });
      this.processQueue();
    });
  }

  /**
   * Generates Payload and Hash for Seamless Web Integration
   * (Direct to PhonePe, Paytm, Card, etc.)
   */
  generateSeamlessPayload(paymentDetails: any) {
    const { txnid, amount, productinfo, firstname, email, phone, surl, furl, pg, bankcode } = paymentDetails;
    
    // Hash sequence: key|txnid|amount|productinfo|firstname|email|||||||||||salt
    const hashString = `${this.key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${this.salt}`;
    
    // Create SHA-512 hash
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    return {
      key: this.key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      hash,
      pg,
      bankcode
    };
  }

  /**
   * Handles incoming webhooks / IPN from PayU
   */
  async processWebhook(payload: any) {
    this.logger.log('Received PayU webhook IPN', payload);
    // Here you would typically verify the hash sent by PayU
    // and then update the order status in the database accordingly.
    // Example: verify reverse hash, update database.
    return { status: 'success' };
  }
}
