import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Global rate limiter for HTTP routes.
 * WebSocket/RPC contexts are skipped (the stock guard assumes an HTTP
 * request/response pair). The client IP comes from req.ip, which honours the
 * express "trust proxy" setting configured in main.ts.
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    return super.shouldSkip(context);
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(req.ip || req.socket?.remoteAddress || 'unknown');
  }
}
