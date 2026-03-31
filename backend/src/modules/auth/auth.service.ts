import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RidersService } from '../riders/riders.service';
import { OtpService } from './otp.service';
import { RedisService } from '../../common/utils/redis.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../users/schemas/user.schema';

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
    ) { }

    private getRefreshTokenKey(userId: string): string {
        return `refresh_token:${userId}`;
    }

    private getAccessTokenKey(userId: string): string {
        return `access_token:${userId}`;
    }

    // Admin login with username and password
    async adminLogin(username: string, password: string): Promise<any> {
        const user = await this.usersService.findByUsername(username);

        if (!user || user.role !== 'admin') {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.password) {
            throw new UnauthorizedException('Password not set for this admin user');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is disabled');
        }

        // Generate tokens with 2-hour expiry for access token
        const tokens = await this.generateTokens(user._id.toString(), user.role);

        // Store hashed refresh token in Redis (28 days expiry)
        const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await this.redisService.set(
            this.getRefreshTokenKey(user._id.toString()),
            hashedRefreshToken,
            this.refreshTokenExpiry
        );

        // Store access token in Redis with 2-hour expiry
        await this.redisService.set(
            this.getAccessTokenKey(user._id.toString()),
            tokens.accessToken,
            this.accessTokenExpiry
        );

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

        if (!rider) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!rider.password) {
            throw new UnauthorizedException('Password not set for this rider');
        }

        const isPasswordValid = await bcrypt.compare(password, rider.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!rider.isActive) {
            throw new UnauthorizedException('Account is disabled');
        }

        // Generate tokens with rider role
        const tokens = await this.generateTokens(rider._id.toString(), 'rider');

        // Store hashed refresh token in Redis (28 days expiry)
        const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await this.redisService.set(
            this.getRefreshTokenKey(rider._id.toString()),
            hashedRefreshToken,
            this.refreshTokenExpiry
        );

        // Store access token in Redis with 2-hour expiry
        await this.redisService.set(
            this.getAccessTokenKey(rider._id.toString()),
            tokens.accessToken,
            this.accessTokenExpiry
        );

        return {
            user: {
                id: rider._id,
                name: rider.name,
                username: rider.username,
                role: 'rider',
                phone: rider.phone,
                vehicleType: rider.vehicleType,
            },
            ...tokens,
        };
    }

    async sendOtp(phone: string): Promise<{ message: string; requestId?: string }> {
        return this.otpService.sendOtp(phone);
    }

    async verifyOtp(phone: string, otp: string, name?: string, role?: UserRole): Promise<any> {
        // Verify OTP using OtpService
        await this.otpService.verifyOtp(phone, otp);

        // Find or create user
        let user = await this.usersService.findByPhone(phone);

        if (!user) {
            user = await this.usersService.create({
                name: name || 'User',
                phone,
                role: role || UserRole.CUSTOMER,
            });
        } else if (role && user.role !== role) {
            throw new UnauthorizedException(`This phone number is not registered as a ${role}`);
        }

        // Generate tokens
        const tokens = await this.generateTokens(user._id.toString(), user.role);

        // Store hashed refresh token in Redis (28 days expiry)
        const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await this.redisService.set(
            this.getRefreshTokenKey(user._id.toString()),
            hashedRefreshToken,
            this.refreshTokenExpiry
        );

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

    async refreshTokens(userId: string, refreshToken: string): Promise<any> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new UnauthorizedException('Access denied');
        }

        // Get refresh token from Redis
        const storedHash = await this.redisService.get(this.getRefreshTokenKey(userId));

        if (!storedHash) {
            throw new UnauthorizedException('Session expired. Please login again.');
        }

        const isValid = await bcrypt.compare(refreshToken, storedHash);
        if (!isValid) {
            throw new UnauthorizedException('Invalid session. Please login again.');
        }

        const tokens = await this.generateTokens(user._id.toString(), user.role);

        // Update refresh token in Redis
        const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
        await this.redisService.set(
            this.getRefreshTokenKey(userId),
            hashedRefreshToken,
            this.refreshTokenExpiry
        );

        // Store new access token with 2-hour expiry
        await this.redisService.set(
            this.getAccessTokenKey(userId),
            tokens.accessToken,
            this.accessTokenExpiry
        );

        return tokens;
    }

    async logout(userId: string): Promise<void> {
        // Remove both refresh and access tokens from Redis
        await this.redisService.del(this.getRefreshTokenKey(userId));
        await this.redisService.del(this.getAccessTokenKey(userId));
    }

    async validateAccessToken(userId: string, token: string): Promise<boolean> {
        const storedToken = await this.redisService.get(this.getAccessTokenKey(userId));
        return storedToken === token;
    }

    private async generateTokens(userId: string, role: string) {
        const payload = { sub: userId, role };

        // Access token expires in 2 hours
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: '2h',
        });

        const refreshToken = this.jwtService.sign(payload, {
            secret: this.configService.get<string>('jwt.refreshSecret') || 'refresh-secret',
            expiresIn: '28d',
        });

        return { accessToken, refreshToken };
    }
}
