import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RedisService } from '../../../common/utils/redis.service';
import { AuthKeys } from '../auth.keys';

// Custom extractor to get JWT from cookie or Authorization header
export const cookieExtractor = (req: Request): string | null => {
  // First try to get from cookie
  if (req && req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  // Fallback to Authorization header (for mobile apps)
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

export interface JwtPayload {
  sub: string;
  role: string;
  jti?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  role: string;
  jti?: string;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Refresh tokens must never be accepted as access tokens.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Invalid token');
    }

    const [denied, revokedBefore] = await this.redisService
      .getClient()
      .mget(
        AuthKeys.accessDenylist(payload.jti || '-'),
        AuthKeys.revokedBefore(payload.sub),
      );

    if (payload.jti && denied) {
      throw new UnauthorizedException('Session has been logged out');
    }

    if (
      revokedBefore &&
      typeof payload.iat === 'number' &&
      payload.iat < Number(revokedBefore)
    ) {
      throw new UnauthorizedException('Session has been logged out');
    }

    return {
      userId: payload.sub,
      role: payload.role,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
