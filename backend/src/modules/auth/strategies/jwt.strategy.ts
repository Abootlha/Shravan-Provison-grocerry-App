import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// Custom extractor to get JWT from cookie or Authorization header
const cookieExtractor = (req: Request): string | null => {
  // First try to get from cookie
  if (req && req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  // Fallback to Authorization header (for mobile apps)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret',
    });
  }

  async validate(payload: { sub: string; role: string }) {
    return { userId: payload.sub, role: payload.role };
  }
}
