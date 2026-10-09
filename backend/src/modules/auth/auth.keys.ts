/** Redis keys used by the auth module. */
export const AuthKeys = {
  refreshToken: (subjectId: string) => `refresh_token:${subjectId}`,
  /** Present while a specific access token (by jti) is revoked. */
  accessDenylist: (jti: string) => `auth:denylist:${jti}`,
  /** Unix seconds; access tokens issued before this are rejected (legacy tokens without jti). */
  revokedBefore: (subjectId: string) => `auth:revoked_before:${subjectId}`,
  otpSession: (phone: string) => `otp_session:${phone}`,
  otpAttempts: (phone: string) => `otp_attempts:${phone}`,
  otpCooldown: (phone: string) => `otp_cooldown:${phone}`,
  otpHourly: (phone: string) => `otp_hourly:${phone}`,
};
