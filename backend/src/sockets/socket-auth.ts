import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { RedisService } from '../common/utils/redis.service';
import { AuthKeys } from '../modules/auth/auth.keys';

export type SocketAuthErrorCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'REFRESH_TOKEN_NOT_ALLOWED';

/** Event emitted to an open socket right before it is closed for auth reasons. */
export const SOCKET_AUTH_ERROR_EVENT = 'auth_error';

export class SocketAuthError extends Error {
  constructor(
    readonly code: SocketAuthErrorCode,
    readonly detail: string,
  ) {
    // Clients match /unauthori[sz]ed|token/ on connect_error messages.
    super('unauthorized');
  }

  /** Shape sent as connect_error `data` and as the auth_error payload. */
  toPayload(): { code: SocketAuthErrorCode; message: string } {
    return { code: this.code, message: this.detail };
  }
}

export interface SocketUser {
  userId: string;
  role: string;
  jti?: string;
  sid?: string;
  /** Unix seconds. */
  exp?: number;
}

export function extractSocketToken(client: Socket): string | null {
  const authToken = client.handshake?.auth?.token;
  if (authToken && typeof authToken === 'string') return authToken;

  const queryToken = client.handshake?.query?.token;
  if (queryToken && typeof queryToken === 'string') return queryToken;

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

/**
 * Verifies a socket access token with the same rules as the REST JwtStrategy:
 * valid signature and expiry, refresh tokens rejected, and sessions revoked
 * by logout / logout-all / admin action rejected.
 */
export async function verifySocketToken(
  jwtService: JwtService,
  redisService: RedisService,
  token: string | null,
  secret?: string,
): Promise<SocketUser> {
  if (!token) {
    throw new SocketAuthError('TOKEN_MISSING', 'No access token provided');
  }

  let payload: {
    sub: string;
    role: string;
    jti?: string;
    sid?: string;
    type?: string;
    iat?: number;
    exp?: number;
  };
  try {
    payload = await jwtService.verifyAsync(
      token,
      secret ? { secret } : undefined,
    );
  } catch (error) {
    if ((error as Error)?.name === 'TokenExpiredError') {
      throw new SocketAuthError('TOKEN_EXPIRED', 'Access token expired');
    }
    throw new SocketAuthError('TOKEN_INVALID', 'Invalid access token');
  }

  if (payload?.type === 'refresh') {
    throw new SocketAuthError(
      'REFRESH_TOKEN_NOT_ALLOWED',
      'Refresh tokens cannot be used for sockets',
    );
  }
  if (!payload?.sub || !payload.role) {
    throw new SocketAuthError('TOKEN_INVALID', 'Invalid access token');
  }

  const [denied, revokedBefore] = await redisService
    .getClient()
    .mget(
      AuthKeys.accessDenylist(payload.jti || '-'),
      AuthKeys.revokedBefore(payload.sub),
    );
  if (
    (payload.jti && denied) ||
    (revokedBefore &&
      typeof payload.iat === 'number' &&
      payload.iat < Number(revokedBefore))
  ) {
    throw new SocketAuthError('TOKEN_REVOKED', 'Session has been logged out');
  }

  return {
    userId: payload.sub,
    role: payload.role,
    jti: payload.jti,
    sid: payload.sid,
    exp: payload.exp,
  };
}

/** Tells the client why, then closes the socket. */
export function rejectSocket(client: Socket, error: SocketAuthError): void {
  client.emit(SOCKET_AUTH_ERROR_EVENT, error.toPayload());
  client.disconnect(true);
}
