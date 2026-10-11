import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { UsersService } from '../users/users.service';
import { RidersService } from '../riders/riders.service';
import { OtpService } from './otp.service';
import { RedisService } from '../../common/utils/redis.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../users/schemas/user.schema';
import { AuthKeys } from './auth.keys';
import { JwtPayload } from './strategies/jwt.strategy';

/** Roles that may be requested on /auth/verify-otp. */
export type OtpLoginRole = UserRole.CUSTOMER | UserRole.RIDER;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Why /auth/refresh refused. Clients log the user out on any of these (and
 * only on these): network errors and 5xx must never end a session.
 */
export type SessionErrorCode =
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'REFRESH_REUSED'
  | 'USER_NOT_FOUND';

export class SessionException extends UnauthorizedException {
  constructor(
    readonly code: SessionErrorCode,
    message: string,
  ) {
    super({ statusCode: 401, error: 'Unauthorized', code, message });
  }
}

interface SessionRecord {
  /** SHA-256 of the current refresh token. */
  hash: string;
  /** SHA-256 of the token it replaced (reuse grace window). */
  prevHash?: string;
  /** Epoch ms of the last rotation. */
  rotatedAt?: number;
  createdAt: number;
}

const DAY_SECONDS = 24 * 60 * 60;
const REVOKED_MARKER_TTL_SECONDS = 30 * DAY_SECONDS;
const UNLIMITED_REFRESH_JWT_SECONDS = 100 * 365 * DAY_SECONDS;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private ridersService: RidersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private redisService: RedisService,
  ) {}

  /**
   * Refresh tokens are high-entropy JWTs, so a fast SHA-256 is appropriate.
   * (bcrypt only looks at the first 72 bytes, which are identical for every
   * token of the same subject, so it must not be used here.)
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesEqual(hash: string, storedHash: string): boolean {
    const a = Buffer.from(hash);
    const b = Buffer.from(storedHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Admin login with username and password
  async adminLogin(username: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);

    if (!user || user.role !== UserRole.ADMIN || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const tokens = await this.issueSession(user._id.toString(), user.role);

    return {
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
      ...tokens,
    };
  }

  // Rider login with username and password - checks Rider collection
  async riderLogin(username: string, password: string): Promise<any> {
    const rider = await this.ridersService.findByUsername(username);

    if (!rider || !rider.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, rider.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!rider.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const tokens = await this.issueSession(rider._id.toString(), 'rider');

    return {
      user: this.riderView(rider),
      ...tokens,
    };
  }

  async sendOtp(
    phone: string,
  ): Promise<{ message: string; requestId?: string }> {
    return this.otpService.sendOtp(phone);
  }

  /**
   * OTP login.
   * - role 'rider': logs in an EXISTING active rider (riders are pre-created by an admin).
   * - otherwise: logs in / registers a CUSTOMER. Accounts with any other role
   *   (e.g. admin) can never be accessed via OTP.
   */
  async verifyOtp(
    phone: string,
    otp: string,
    name?: string,
    role?: OtpLoginRole,
  ): Promise<any> {
    if (role && role !== UserRole.CUSTOMER && role !== UserRole.RIDER) {
      throw new UnauthorizedException('Invalid role');
    }

    await this.otpService.verifyOtp(phone, otp);

    if (role === UserRole.RIDER) {
      const rider = await this.ridersService.ensureOtpRider(phone);
      const tokens = await this.issueSession(rider._id.toString(), 'rider');
      return {
        user: this.riderView(rider),
        ...tokens,
      };
    }

    let user = await this.usersService.findByPhone(phone);

    if (!user) {
      user = await this.usersService.create({
        name: name || 'User',
        phone,
        role: UserRole.CUSTOMER,
      });
    } else if (user.role !== UserRole.CUSTOMER) {
      throw new UnauthorizedException(
        'This phone number is not registered as a customer',
      );
    } else if (user.isActive === false) {
      throw new UnauthorizedException('Account is disabled');
    }

    const tokens = await this.issueSession(user._id.toString(), user.role);

    return {
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
      ...tokens,
    };
  }

  /**
   * Exchange a valid refresh token for a new access/refresh pair.
   * Does not require an access token. Works for customers, admins and riders.
   *
   * Sliding sessions: every successful refresh rotates the refresh token and
   * resets the session's idle timeout, so a user who keeps opening the app is
   * never logged out. Failures are 401 with a `code` (see SessionErrorCode).
   */
  async refreshTokens(refreshToken: string): Promise<any> {
    if (!refreshToken) {
      throw new SessionException(
        'SESSION_EXPIRED',
        'Refresh token is required',
      );
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new SessionException(
          'SESSION_EXPIRED',
          'Session expired. Please login again.',
        );
      }
      throw new SessionException(
        'SESSION_REVOKED',
        'Invalid session. Please login again.',
      );
    }

    // Legacy refresh tokens have no type claim; new ones must be 'refresh'.
    if (!payload?.sub || (payload.type && payload.type !== 'refresh')) {
      throw new SessionException(
        'SESSION_REVOKED',
        'Invalid session. Please login again.',
      );
    }

    if (!payload.sid) {
      return this.migrateLegacySession(refreshToken, payload);
    }

    const role = payload.role;
    const sessionId = payload.sid;
    const record = await this.redisService.getJSON<SessionRecord>(
      AuthKeys.refreshSession(role, payload.sub, sessionId),
    );

    if (!record) {
      const revoked = await this.redisService.get(
        AuthKeys.revokedSession(sessionId),
      );
      throw revoked
        ? new SessionException(
            'SESSION_REVOKED',
            'This session was signed out. Please login again.',
          )
        : new SessionException(
            'SESSION_EXPIRED',
            'Session expired. Please login again.',
          );
    }

    const presentedHash = this.hashToken(refreshToken);
    const isCurrent = this.hashesEqual(presentedHash, record.hash);
    if (!isCurrent) {
      // A token we signed for this session, but not the latest one. Accept it
      // only inside the grace window (the client may never have received the
      // previous refresh response); otherwise treat it as stolen.
      const graceSeconds =
        this.configService.get<number>('jwt.refreshReuseGraceSeconds') ?? 300;
      const withinGrace =
        !!record.prevHash &&
        !!record.rotatedAt &&
        this.hashesEqual(presentedHash, record.prevHash) &&
        Date.now() - record.rotatedAt <= graceSeconds * 1000;
      if (!withinGrace) {
        await this.revokeSession(role, payload.sub, sessionId);
        throw new SessionException(
          'REFRESH_REUSED',
          'This sign-in was used again from another device. Please login again.',
        );
      }
    }

    const user = await this.loadSessionUser(payload.sub, role, sessionId);

    const tokens = this.generateTokens(payload.sub, role, sessionId);
    await this.saveSession(role, payload.sub, sessionId, tokens.refreshToken, {
      createdAt: record.createdAt,
      // Normal path: the presented token becomes the "previous" one.
      // Grace path: keep the original rotation time so replaying an old token
      // cannot stretch the window.
      prevHash: isCurrent ? record.hash : record.prevHash,
      rotatedAt: isCurrent ? Date.now() : record.rotatedAt,
    });
    return { user, ...tokens };
  }

  /**
   * Sign out one device: delete that session's refresh record and deny-list
   * the presented access token until it would have expired anyway.
   */
  async logout(
    userId: string,
    accessToken?: { jti?: string; exp?: number; sid?: string; role?: string },
  ): Promise<void> {
    if (accessToken?.sid && accessToken.role) {
      await this.revokeSession(
        accessToken.role,
        userId,
        accessToken.sid,
        false,
      );
    } else {
      // Token issued before per-session ids: the legacy key is all there is.
      await this.redisService.del(AuthKeys.legacyRefreshToken(userId));
    }

    if (accessToken?.jti) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ttl = accessToken.exp
        ? Math.max(accessToken.exp - nowSeconds, 1)
        : this.accessTtlSeconds;
      await this.redisService.set(
        AuthKeys.accessDenylist(accessToken.jti),
        '1',
        ttl,
      );
    } else {
      // Legacy token without jti: revoke every access token issued before now.
      await this.markRevokedBefore(userId);
    }
  }

  /**
   * Sign out every device of a subject and reject every access token issued so
   * far. Use on password/role change or when an account may be compromised.
   * Returns the number of sessions revoked.
   */
  async logoutAll(userId: string, role: string): Promise<number> {
    const indexKey = AuthKeys.sessionIndex(role, userId);
    const sessionIds: string[] = await this.redisService
      .getClient()
      .smembers(indexKey);
    for (const sessionId of sessionIds) {
      await this.revokeSession(role, userId, sessionId);
    }
    await this.redisService.del(indexKey);
    await this.redisService.del(AuthKeys.legacyRefreshToken(userId));
    await this.markRevokedBefore(userId);
    return sessionIds.length;
  }

  private riderView(rider: any) {
    return {
      id: rider._id,
      name: rider.name,
      username: rider.username,
      role: 'rider',
      phone: rider.phone,
      vehicleType: rider.vehicleType,
    };
  }

  /** Start a new session (one per device) and return its token pair. */
  private async issueSession(
    subjectId: string,
    role: string,
  ): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const tokens = this.generateTokens(subjectId, role, sessionId);
    await this.saveSession(role, subjectId, sessionId, tokens.refreshToken, {
      createdAt: Date.now(),
    });
    return tokens;
  }

  /**
   * Store (or replace) a session record. The TTL is reset on every write,
   * which is what makes the idle timeout slide. Idle 0 = no TTL at all.
   */
  private async saveSession(
    role: string,
    subjectId: string,
    sessionId: string,
    refreshToken: string,
    meta: Omit<SessionRecord, 'hash'>,
  ): Promise<void> {
    const idleSeconds = this.refreshIdleSeconds(role);
    const record: SessionRecord = {
      hash: this.hashToken(refreshToken),
      ...meta,
    };
    await this.redisService.setJSON(
      AuthKeys.refreshSession(role, subjectId, sessionId),
      record,
      idleSeconds || undefined,
    );

    const client = this.redisService.getClient();
    const indexKey = AuthKeys.sessionIndex(role, subjectId);
    await client.sadd(indexKey, sessionId);
    if (idleSeconds) {
      await client.expire(indexKey, idleSeconds);
    } else {
      await client.persist(indexKey);
    }
  }

  /**
   * Delete a session. `markRevoked` leaves a marker so a later refresh with
   * that token reports SESSION_REVOKED rather than SESSION_EXPIRED.
   */
  private async revokeSession(
    role: string,
    subjectId: string,
    sessionId: string,
    markRevoked = true,
  ): Promise<void> {
    await this.redisService.del(
      AuthKeys.refreshSession(role, subjectId, sessionId),
    );
    await this.redisService
      .getClient()
      .srem(AuthKeys.sessionIndex(role, subjectId), sessionId);
    if (markRevoked) {
      await this.redisService.set(
        AuthKeys.revokedSession(sessionId),
        '1',
        REVOKED_MARKER_TTL_SECONDS,
      );
    }
  }

  private async markRevokedBefore(subjectId: string): Promise<void> {
    await this.redisService.set(
      AuthKeys.revokedBefore(subjectId),
      Math.floor(Date.now() / 1000).toString(),
      this.accessTtlSeconds,
    );
  }

  /**
   * Re-check the account behind a session on every refresh. Disabled, deleted
   * or re-roled accounts lose the session.
   */
  private async loadSessionUser(
    subjectId: string,
    role: string,
    sessionId: string | null,
  ): Promise<Record<string, any>> {
    const reject = async (
      code: SessionErrorCode,
      message: string,
    ): Promise<never> => {
      if (sessionId) await this.revokeSession(role, subjectId, sessionId);
      throw new SessionException(code, message);
    };

    if (role === (UserRole.RIDER as string)) {
      const rider = await this.ridersService
        .findRiderById(subjectId)
        .catch(() => null);
      if (!rider) return reject('USER_NOT_FOUND', 'Account not found');
      if (!rider.isActive) {
        return reject('SESSION_REVOKED', 'Account is disabled');
      }
      return this.riderView(rider);
    }

    const dbUser = await this.usersService.findById(subjectId);
    if (!dbUser) return reject('USER_NOT_FOUND', 'Account not found');
    if (dbUser.isActive === false) {
      return reject('SESSION_REVOKED', 'Account is disabled');
    }
    // Role changed since sign-in: the session belonged to the old role.
    if ((dbUser.role as string) !== role) {
      return reject('SESSION_REVOKED', 'Account role changed');
    }
    return {
      id: dbUser._id,
      name: dbUser.name,
      phone: dbUser.phone,
      username: dbUser.username,
      role: dbUser.role,
    };
  }

  /**
   * Refresh tokens issued before per-session ids were stored under one key per
   * subject. Accept such a token once and move the device onto a proper
   * session, so nobody is logged out by the upgrade.
   */
  private async migrateLegacySession(
    refreshToken: string,
    payload: JwtPayload,
  ): Promise<any> {
    const legacyKey = AuthKeys.legacyRefreshToken(payload.sub);
    const storedHash = await this.redisService.get(legacyKey);
    if (
      !storedHash ||
      !this.hashesEqual(this.hashToken(refreshToken), storedHash)
    ) {
      throw new SessionException(
        'SESSION_EXPIRED',
        'Session expired. Please login again.',
      );
    }
    await this.redisService.del(legacyKey);

    // Legacy tokens may carry a stale role; the database is authoritative.
    let role = payload.role;
    if (role !== (UserRole.RIDER as string)) {
      const dbUser = await this.usersService.findById(payload.sub);
      role = dbUser?.role ?? role;
    }
    const user = await this.loadSessionUser(payload.sub, role, null);
    const tokens = await this.issueSession(payload.sub, role);
    return { user, ...tokens };
  }

  private refreshIdleSeconds(role: string): number {
    const days =
      role === (UserRole.ADMIN as string)
        ? (this.configService.get<number>('jwt.adminRefreshIdleDays') ?? 28)
        : (this.configService.get<number>('jwt.refreshIdleDays') ?? 365);
    return Math.max(0, days) * DAY_SECONDS;
  }

  private get accessTtlSeconds(): number {
    return this.configService.get<number>('jwt.accessTtlSeconds') ?? 15 * 60;
  }

  private generateTokens(
    userId: string,
    role: string,
    sessionId: string,
  ): AuthTokens {
    const accessToken = this.jwtService.sign(
      { sub: userId, role, sid: sessionId, jti: randomUUID() },
      { expiresIn: this.accessTtlSeconds },
    );

    // Idle 0 (no idle expiry): a JWT still needs an exp, so use a far one;
    // the Redis record (no TTL) is what keeps such a session alive.
    const idleSeconds = this.refreshIdleSeconds(role);
    const refreshToken = this.jwtService.sign(
      { sub: userId, role, sid: sessionId, type: 'refresh', jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: idleSeconds || UNLIMITED_REFRESH_JWT_SECONDS,
      },
    );

    return { accessToken, refreshToken };
  }

  /** Lifetime of access tokens, for cookies. */
  getAccessTtlSeconds(): number {
    return this.accessTtlSeconds;
  }

  /** Lifetime of a refresh token for this role (0 = no idle expiry), for cookies. */
  getRefreshIdleSeconds(role: string): number {
    return this.refreshIdleSeconds(role);
  }
}
