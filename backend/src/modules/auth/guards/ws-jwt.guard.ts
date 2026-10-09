import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn({
          message: 'Failed authentication attempt: No token provided',
          socketId: client.id,
          timestamp: new Date().toISOString(),
          ip: client.handshake.address,
        });
        throw new WsException('Unauthorized: No token provided');
      }

      const payload = await this.jwtService.verifyAsync(token);

      // Attach user info to socket for later use
      client.data.user = {
        userId: payload.sub,
        role: payload.role,
      };

      return true;
    } catch (error) {
      const client: Socket = context.switchToWs().getClient<Socket>();
      this.logger.error({
        message: 'Failed authentication attempt: Invalid token',
        socketId: client.id,
        timestamp: new Date().toISOString(),
        ip: client.handshake.address,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new WsException('Unauthorized: Invalid token');
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Try to get token from auth object in handshake
    const token = client.handshake?.auth?.token;
    if (token) {
      return token;
    }

    // Fallback: try to get from query parameters
    const queryToken = client.handshake?.query?.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Fallback: try to get from headers
    const authHeader = client.handshake?.headers?.authorization;
    if (
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      return authHeader.substring(7);
    }

    return null;
  }
}
