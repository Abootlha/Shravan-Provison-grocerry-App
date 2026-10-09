export interface TokenPayload {
  sub: string;
  phone: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OtpPayload {
  phone: string;
  otp: string;
  attempts: number;
}

export interface ValidateTokenResponse {
  valid: boolean;
  userId?: string;
  phone?: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  tokens?: AuthTokens;
  message: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken?: string;
  message: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface AdminLoginResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    username: string;
    role: string;
  };
  accessToken?: string;
  refreshToken?: string;
  message: string;
}
