import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  Request,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SeamlessHashDto } from './dto/seamless-hash.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('seamless-hash')
  @UseGuards(JwtAuthGuard)
  async generateSeamlessHash(
    @Request() req: any,
    @Body() body: SeamlessHashDto,
  ) {
    const payload = await this.paymentsService.generateSeamlessPayload(
      req.user.userId,
      body,
    );
    return { success: true, data: payload };
  }

  // Webhook/IPN endpoint (no JwtAuthGuard since it is called by PayU server).
  // Authenticity comes from the reverse hash, verified in the service.
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() payload: any) {
    const result = await this.paymentsService.handlePayuCallback(
      payload,
      'webhook',
    );
    if (result.status === 'invalid') {
      throw new BadRequestException('Invalid payment notification');
    }
    return { success: true, data: { status: result.status } };
  }

  // PayU browser form posts (application/x-www-form-urlencoded).
  @Post('success')
  async handleSuccess(@Body() body: any, @Res() res: Response) {
    return this.handleBrowserReturn(body, 'success', res);
  }

  @Post('failure')
  async handleFailure(@Body() body: any, @Res() res: Response) {
    return this.handleBrowserReturn(body, 'failure', res);
  }

  private async handleBrowserReturn(
    body: any,
    source: 'success' | 'failure',
    res: Response,
  ) {
    let outcome: 'success' | 'failed' = 'failed';
    let orderId: string | undefined;

    try {
      const result = await this.paymentsService.handlePayuCallback(
        body,
        source,
      );
      orderId = result.orderId;
      outcome = result.status === 'success' ? 'success' : 'failed';
    } catch (error) {
      this.logger.error(
        `Failed to process PayU ${source} return: ${(error as Error).message}`,
      );
    }

    return res.redirect(
      302,
      this.paymentsService.buildReturnRedirect(outcome, orderId),
    );
  }
}
