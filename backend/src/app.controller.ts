import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection, ConnectionStates } from 'mongoose';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Liveness/readiness probe for Docker and load balancers. */
  @Get('health')
  @SkipThrottle()
  health() {
    if (this.connection.readyState !== ConnectionStates.connected) {
      throw new ServiceUnavailableException({ status: 'error', mongo: 'down' });
    }
    return { status: 'ok' };
  }
}
