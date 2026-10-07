import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('token')
  @UseGuards(JwtAuthGuard)
  async getPaymentToken() {
    const token = await this.paymentsService.getAccessToken();
    // Usually you wouldn't return the token directly to the frontend,
    // but this is a placeholder to verify the integration.
    return { success: true, message: 'Token generated successfully' };
  }

  @Post('create-link')
  @UseGuards(JwtAuthGuard)
  async createLink(@Body() paymentDetails: any) {
    const link = await this.paymentsService.createPaymentLink(paymentDetails);
    return { success: true, data: link };
  }
}
