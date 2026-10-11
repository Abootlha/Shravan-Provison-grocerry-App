import { AUTH_SERVICE_URL } from '../utils/constants';
import { storage } from './storage';

/** Codes the backend returns (401) from /auth/refresh when a session is really over. */
export type SessionEndCode = 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'REFRESH_REUSED' | 'USER_NOT_FOUND';

export const SESSION_ENDED_MESSAGE = 'Your session has ended. Please log in again.';

type SessionHandlers = {
  onTokenRefreshed?: (accessToken: string) => void;
  onSessionExpired?: (code: SessionEndCode) => void;
};

let handlers: SessionHandlers = {};
let refreshPromise: Promise<string | null> | null = null;

/** Renew this long before the access token expires. */
const REFRESH_SKEW_MS = 60 * 1000;

export const setSessionHandlers = (next: SessionHandlers): void => {
  handlers = next;
};

/** Access token `exp` in ms, or null for opaque / malformed tokens. */
export const getTokenExpiryMs = (token: string | null | undefined): number | null => {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)));
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
};

/** True when the token is missing or expires within `skewMs`. Unknown expiry counts as fresh. */
export const isTokenExpiring = (token: string | null | undefined, skewMs = REFRESH_SKEW_MS): boolean => {
  if (!token) return true;
  const exp = getTokenExpiryMs(token);
  return exp !== null && Date.now() >= exp - skewMs;
};

type RefreshResult = { token: string | null; ended: SessionEndCode | null };

const requestNewTokens = async (): Promise<RefreshResult> => {
  const refreshToken = await storage.getRefreshToken();
  if (!refreshToken) {
    return { token: null, ended: 'SESSION_EXPIRED' };
  }

  // Plain fetch (not the axios clients) so this works from the background
  // location task and can never recurse through the 401 interceptor.
  const response = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    return { token: null, ended: (body?.code as SessionEndCode) || 'SESSION_EXPIRED' };
  }
  if (!response.ok) {
    // 5xx, 429 and the like are transient: keep the session and retry later.
    return { token: null, ended: null };
  }

  const body = await response.json().catch(() => ({}));
  const accessToken: string | undefined = body?.accessToken || body?.tokens?.accessToken;
  const nextRefreshToken: string | undefined = body?.refreshToken || body?.tokens?.refreshToken;
  if (!accessToken) {
    return { token: null, ended: null };
  }

  // Refresh tokens rotate on every call: always store the new one.
  await storage.setToken(accessToken);
  if (nextRefreshToken) {
    await storage.setRefreshToken(nextRefreshToken);
  }
  return { token: accessToken, ended: null };
};

/**
 * Single-flight token refresh: concurrent callers share one request.
 * Resolves to the new access token, or null. Only a 401 from /auth/refresh
 * ends the session (tokens cleared, notice saved for the Login screen,
 * session-expired handler called). Network errors and 5xx leave it intact.
 */
export const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let result: RefreshResult;
      try {
        result = await requestNewTokens();
      } catch {
        result = { token: null, ended: null };
      }

      if (result.token) {
        handlers.onTokenRefreshed?.(result.token);
      } else if (result.ended) {
        const hadSession = Boolean(await storage.getUser());
        await storage.clearAll().catch(() => undefined);
        // The background location task can end a session while the UI is not
        // running; the notice tells the rider why on the next app start.
        if (hadSession) await storage.setSessionNotice(SESSION_ENDED_MESSAGE).catch(() => undefined);
        handlers.onSessionExpired?.(result.ended);
      }
      return result.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

/**
 * Renew the access token if it is missing, expired or about to expire.
 * Safe to call often (app start, app foreground, background task).
 * Resolves to a usable access token, or null.
 */
export const ensureFreshAccessToken = async (): Promise<string | null> => {
  const [token, refreshToken] = await Promise.all([storage.getToken(), storage.getRefreshToken()]);
  if (!refreshToken) return token;
  if (token && !isTokenExpiring(token)) return token;
  return refreshAccessToken();
};
