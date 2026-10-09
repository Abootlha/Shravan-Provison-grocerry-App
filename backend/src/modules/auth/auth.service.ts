import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

@Injectable()
export class AuthService {
  private readonly refreshTokenExpiry = 28 * 24 * 60 * 60; // 28 days in seconds
  private readonly accessTokenExpiry = 2 * 60 * 60; // 2 hours in seconds

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

  private matchesStoredHash(token: string, storedHash: string): boolean {
    const a = Buffer.from(this.hashToken(token));
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
   * Exchange a valid refresh token for a new access/refresh pair (rotation).
   * Does not require an access token. Works for customers, admins and riders.
   */
  async refreshTokens(refreshToken: string): Promise<any> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid session. Please login again.');
    }

    // Legacy refresh tokens have no type claim; new ones must be 'refresh'.
    if (!payload?.sub || (payload.type && payload.type !== 'refresh')) {
      throw new UnauthorizedException('Invalid session. Please login again.');
    }

    const storedHash = await this.redisService.get(
      AuthKeys.refreshToken(payload.sub),
    );
    if (!storedHash) {
      throw new UnauthorizedException('Session expired. Please login again.');
    }
    if (!this.matchesStoredHash(refreshToken, storedHash)) {
      throw new UnauthorizedException('Invalid session. Please login again.');
    }

    let user: Record<string, any>;
    let role: string;

    if (payload.role === (UserRole.RIDER as string)) {
      const rider = await this.ridersService
        .findRiderById(payload.sub)
        .catch(() => null);
      if (!rider || !rider.isActive) {
        await this.redisService.del(AuthKeys.refreshToken(payload.sub));
        throw new UnauthorizedException('Access denied');
      }
      user = this.riderView(rider);
      role = 'rider';
    } else {
      const dbUser = await this.usersService.findById(payload.sub);
      if (!dbUser || dbUser.isActive === false) {
        await this.redisService.del(AuthKeys.refreshToken(payload.sub));
        throw new UnauthorizedException('Access denied');
      }
      // Always take the role from the database, never from the token.
      role = dbUser.role;
      user = {
        id: dbUser._id,
        name: dbUser.name,
        phone: dbUser.phone,
        username: dbUser.username,
        role: dbUser.role,
      };
    }

    const tokens = await this.issueSession(payload.sub, role);
    return { user, ...tokens };
  }

  /**
   * Revoke the session: delete the stored refresh token and deny-list the
   * presented access token until it would have expired anyway.
   */
  async logout(
    userId: string,
    accessToken?: { jti?: string; exp?: number },
  ): Promise<void> {
    await this.redisService.del(AuthKeys.refreshToken(userId));

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (accessToken?.jti) {
      const ttl = accessToken.exp
        ? Math.max(accessToken.exp - nowSeconds, 1)
        : this.accessTokenExpiry;
      await this.redisService.set(
        AuthKeys.accessDenylist(accessToken.jti),
        '1',
        ttl,
      );
    } else {
      // Legacy token without jti: revoke every access token issued before now.
      await this.redisService.set(
        AuthKeys.revokedBefore(userId),
        nowSeconds.toString(),
        this.accessTokenExpiry,
      );
    }
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

  /** Generate a token pair and store the refresh token hash (single active session per subject). */
  private async issueSession(
    subjectId: string,
    role: string,
  ): Promise<AuthTokens> {
    const tokens = this.generateTokens(subjectId, role);
    await this.redisService.set(
      AuthKeys.refreshToken(subjectId),
      this.hashToken(tokens.refreshToken),
      this.refreshTokenExpiry,
    );
    return tokens;
  }

  private generateTokens(userId: string, role: string): AuthTokens {
    const accessToken = this.jwtService.sign(
      { sub: userId, role, jti: randomUUID() },
      { expiresIn: this.accessTokenExpiry },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, role, type: 'refresh', jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.refreshTokenExpiry,
      },
    );

    return { accessToken, refreshToken };
  }
}
