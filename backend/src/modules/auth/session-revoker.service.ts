import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/utils/redis.service';
import { AuthKeys } from './auth.keys';

const REVOKED_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Ends every session of an account (all devices) and rejects every access
 * token issued so far. Used when staff deactivate a rider or a team member,
 * change a role or reset a password. Only depends on Redis, so modules that
 * AuthModule itself imports (riders, users) can use it without a cycle.
 */
@Injectable()
export class SessionRevokerService {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async revokeAll(subjectId: string, role: string): Promise<number> {
    const client = this.redisService.getClient();
    const indexKey = AuthKeys.sessionIndex(role, subjectId);
    const sessionIds: string[] = await client.smembers(indexKey);
    for (const sessionId of sessionIds) {
      await this.redisService.del(
        AuthKeys.refreshSession(role, subjectId, sessionId),
      );
      await this.redisService.set(
        AuthKeys.revokedSession(sessionId),
        '1',
        REVOKED_MARKER_TTL_SECONDS,
      );
    }
    await this.redisService.del(indexKey);
    await this.redisService.del(AuthKeys.legacyRefreshToken(subjectId));
    const accessTtl =
      this.configService.get<number>('jwt.accessTtlSeconds') ?? 15 * 60;
    await this.redisService.set(
      AuthKeys.revokedBefore(subjectId),
      Math.floor(Date.now() / 1000).toString(),
      accessTtl,
    );
    return sessionIds.length;
  }
}
