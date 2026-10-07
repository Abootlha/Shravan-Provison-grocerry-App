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
import { IsString, IsOptional, Length } from 'class-validator';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRole } from '../users/schemas/user.schema';

class SendOtpDto {
  @IsString()
  @Length(10, 15)
  phone!: string;
}

class VerifyOtpDto {
  @IsString()
  @Length(10, 15)
  phone!: string;

  @IsString()
  @Length(4, 6)
  otp!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: UserRole;
}

class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

class AdminLoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

// Cookie config
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 2 * 60 * 60 * 1000, // 2 hours for access token
  path: '/',
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 28 * 24 * 60 * 60 * 1000, // 28 days for refresh token
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('admin/login')
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
    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    // Return user info and tokens
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Login successful',
    };
  }

  @Post('rider/login')
  @HttpCode(HttpStatus.OK)
  async riderLogin(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.riderLogin(
      dto.username,
      dto.password,
    );

    // Set tokens as HTTP-only cookies
    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Login successful',
    };
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
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

    // Set tokens as HTTP-only cookies
    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    // Mobile apps rely on bearer tokens, so return them in the response body too.
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      message: 'Login successful',
    };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Request() req: any,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshTokens(
      req.user.userId,
      dto.refreshToken,
    );

    // Update cookies with new tokens
    res.cookie('accessToken', tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

    return { message: 'Tokens refreshed' };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.userId);

    // Clear cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });

    return { message: 'Logged out successfully' };
  }
}
