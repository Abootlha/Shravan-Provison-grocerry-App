/** Redis keys used by the auth module. */
export const AuthKeys = {
  /** Pre-session-id refresh token hash (one per subject). Read only for migration. */
  legacyRefreshToken: (subjectId: string) => `refresh_token:${subjectId}`,
  /** One record per signed-in device (session). */
  refreshSession: (role: string, subjectId: string, sessionId: string) =>
    `refresh:${role}:${subjectId}:${sessionId}`,
  /** Set of a subject's session ids, used by logout-all. */
  sessionIndex: (role: string, subjectId: string) =>
    `refresh:index:${role}:${subjectId}`,
  /** Present for a while after a session is revoked, so refresh can say "revoked" instead of "expired". */
  revokedSession: (sessionId: string) => `refresh:revoked:${sessionId}`,
  /** Present while a specific access token (by jti) is revoked. */
  accessDenylist: (jti: string) => `auth:denylist:${jti}`,
  /** Unix seconds; access tokens issued before this are rejected. */
  revokedBefore: (subjectId: string) => `auth:revoked_before:${subjectId}`,
  otpSession: (phone: string) => `otp_session:${phone}`,
  otpAttempts: (phone: string) => `otp_attempts:${phone}`,
  otpCooldown: (phone: string) => `otp_cooldown:${phone}`,
  otpHourly: (phone: string) => `otp_hourly:${phone}`,
};
