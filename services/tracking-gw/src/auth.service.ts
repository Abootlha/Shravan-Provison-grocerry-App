import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string;
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwtService: JwtService) {}

  async validateToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      
      if (!payload || !payload.userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return {
        userId: payload.userId,
        role: payload.role || 'user',
      };
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  extractTokenFromHandshake(handshake: any): string | null {
    const authHeader = handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const token = handshake.auth?.token;
    if (token) {
      return token;
    }

    const queryToken = handshake.query?.token;
    if (queryToken) {
      return queryToken;
    }

    return null;
  }
}
