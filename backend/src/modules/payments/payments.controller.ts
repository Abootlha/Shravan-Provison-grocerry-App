import { Controller, Post, Body, UseGuards, Get, Res } from '@nestjs/common';
import { Response } from 'express';
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

  @Post('seamless-hash')
  @UseGuards(JwtAuthGuard)
  generateSeamlessHash(@Body() paymentDetails: any) {
    const payload = this.paymentsService.generateSeamlessPayload(paymentDetails);
    return { success: true, data: payload };
  }

  @Post('webhook')
  async handleWebhook(@Body() payload: any) {
    // Webhook/IPN endpoint (no JwtAuthGuard since it is called by PayU server)
    const result = await this.paymentsService.processWebhook(payload);
    return { success: true, data: result };
  }

  @Post('success')
  handleSuccess(@Body() body: any, @Res() res: any) {
    // PayU sends payment data in body. Redirect back to customer app's Checkout screen to place order
    return res.redirect('http://localhost:8081/Checkout?payment=success');
  }

  @Post('failure')
  handleFailure(@Body() body: any, @Res() res: any) {
    // Redirect back to customer app's checkout screen with failure status
    return res.redirect('http://localhost:8081/Checkout?payment=failed');
  }
}
