import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RedisService } from '../../../common/utils/redis.service';
import {
  SocketAuthError,
  extractSocketToken,
  rejectSocket,
  verifySocketToken,
} from '../../../sockets/socket-auth';

/**
 * Per-message check for socket handlers. The connection itself is already
 * authenticated by the gateway; this re-checks the handshake token on every
 * message so an expired or revoked session stops working immediately. On
 * failure the client gets `auth_error { code, message }` and is disconnected.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    try {
      const user = await verifySocketToken(
        this.jwtService,
        this.redisService,
        extractSocketToken(client),
      );
      client.data.user = user;
      return true;
    } catch (error) {
      if (error instanceof SocketAuthError) {
        this.logger.warn({
          message: 'Socket message rejected',
          code: error.code,
          socketId: client.id,
          ip: client.handshake?.address,
        });
        rejectSocket(client, error);
        throw new WsException(`Unauthorized: ${error.detail}`);
      }
      this.logger.error(
        `Socket auth check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new WsException('Authentication is temporarily unavailable');
    }
  }
}
