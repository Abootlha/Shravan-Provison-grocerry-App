import { AUTH_SERVICE_URL } from '../utils/constants';
import { storage } from './storage';

type SessionHandlers = {
  onTokenRefreshed?: (accessToken: string) => void;
  onSessionExpired?: () => void;
};

let handlers: SessionHandlers = {};
let refreshPromise: Promise<string | null> | null = null;

export const setSessionHandlers = (next: SessionHandlers): void => {
  handlers = next;
};

type RefreshResult = { token: string | null; expired: boolean };

const requestNewTokens = async (): Promise<RefreshResult> => {
  const refreshToken = await storage.getRefreshToken();
  if (!refreshToken) {
    return { token: null, expired: true };
  }

  // Plain fetch (not the axios clients) so this works from the background
  // location task and can never recurse through the 401 interceptor.
  const response = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // 5xx is treated as transient; anything else means the refresh token is no good.
    return { token: null, expired: response.status < 500 };
  }

  const body = await response.json().catch(() => ({}));
  const accessToken: string | undefined = body?.accessToken || body?.tokens?.accessToken;
  const nextRefreshToken: string | undefined = body?.refreshToken || body?.tokens?.refreshToken;
  if (!accessToken) {
    return { token: null, expired: true };
  }

  await storage.setToken(accessToken);
  if (nextRefreshToken) {
    await storage.setRefreshToken(nextRefreshToken);
  }
  return { token: accessToken, expired: false };
};

/**
 * Single-flight token refresh: concurrent callers share one request.
 * Resolves to the new access token, or null. When the server rejects the
 * refresh token, tokens are cleared and the session-expired handler runs;
 * network failures leave the session intact.
 */
export const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let result: RefreshResult;
      try {
        result = await requestNewTokens();
      } catch {
        result = { token: null, expired: false };
      }

      if (result.token) {
        handlers.onTokenRefreshed?.(result.token);
      } else if (result.expired) {
        await storage.clearAll().catch(() => undefined);
        handlers.onSessionExpired?.();
      }
      return result.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};
