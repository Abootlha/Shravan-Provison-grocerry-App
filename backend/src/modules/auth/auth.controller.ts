import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsString,
  IsOptional,
  Length,
  IsIn,
  Matches,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import type { Response } from 'express';
import { AuthService, SessionException } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRole } from '../users/schemas/user.schema';

const PHONE_PATTERN = /^\+?[0-9]{10,14}$/;

class SendOtpDto {
  @IsString()
  @Length(10, 15)
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone!: string;
}

class VerifyOtpDto {
  @IsString()
  @Length(10, 15)
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone!: string;

  @IsString()
  @Length(4, 6)
  @Matches(/^[0-9]+$/, { message: 'otp must contain only digits' })
  otp!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // Only customer or rider may be requested; admin can never log in via OTP.
  @IsOptional()
  @IsIn([UserRole.CUSTOMER, UserRole.RIDER])
  role?: UserRole.CUSTOMER | UserRole.RIDER;
}

class RefreshTokenDto {
  // Optional: web clients may rely on the httpOnly refreshToken cookie instead.
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  refreshToken?: string;
}

class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}

const cookieBase = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
});

// Ten years: browsers cap cookie lifetimes anyway; the server-side session
// record decides whether the refresh token is still valid.
const UNLIMITED_COOKIE_MS = 10 * 365 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Cookie lifetimes follow the token lifetimes from config. */
  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
    role: string,
  ) {
    const refreshIdleSeconds = this.authService.getRefreshIdleSeconds(role);
    res.cookie('accessToken', tokens.accessToken, {
      ...cookieBase(),
      maxAge: this.authService.getAccessTtlSeconds() * 1000,
    });
    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieBase(),
      maxAge: refreshIdleSeconds
        ? refreshIdleSeconds * 1000
        : UNLIMITED_COOKIE_MS,
    });
  }

  @Post('admin/login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.adminLogin(
      dto.username,
      dto.password,
    );

    // Set tokens as HTTP-only cookies with appropriate expiry
    this.setAuthCookies(res, result, result.user?.role);

    // Return user info and tokens
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Login successful',
    };
  }

  @Post('rider/login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async riderLogin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.riderLogin(
      dto.username,
      dto.password,
    );

    this.setAuthCookies(res, result, result.user?.role);

    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Login successful',
    };
  }

  @Post('send-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(
      dto.phone,
      dto.otp,
      dto.name,
      dto.role,
    );

    this.setAuthCookies(res, result, result.user?.role);

    // Mobile apps rely on bearer tokens, so return them in the response body too.
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Login successful',
    };
  }

  /**
   * POST /auth/refresh
   * Body: { refreshToken } (or the httpOnly refreshToken cookie).
   * No access token required. Rotates the refresh token and slides the
   * session's idle timeout.
   * Returns { user, accessToken, refreshToken, message } (same shape as login).
   * Errors: 401 { code: SESSION_EXPIRED | SESSION_REVOKED | REFRESH_REUSED |
   * USER_NOT_FOUND }. Clients end the session only on these; 5xx and network
   * errors are transient.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Request() req: any,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto?.refreshToken || req.cookies?.refreshToken;
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new SessionException(
        'SESSION_EXPIRED',
        'Refresh token is required',
      );
    }

    const result = await this.authService.refreshTokens(refreshToken);

    this.setAuthCookies(res, result, result.user?.role);

    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Tokens refreshed',
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.userId, {
      jti: req.user.jti,
      exp: req.user.exp,
      sid: req.user.sid,
      role: req.user.role,
    });

    // Clear cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return { message: 'Logged out successfully' };
  }

  /** POST /auth/logout-all: sign out every device of the current user. */
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessions = await this.authService.logoutAll(
      req.user.userId,
      req.user.role,
    );

    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return { message: 'Logged out from all devices', sessions };
  }
}
