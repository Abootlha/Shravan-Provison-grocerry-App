// Session helpers shared by the API client, the socket and the app shell.
// No imports from the store or UI here, so anything can depend on this file.

/** Codes the backend returns (401) from /auth/refresh when a session is really over. */
export const SESSION_END_CODES = ['SESSION_EXPIRED', 'SESSION_REVOKED', 'REFRESH_REUSED', 'USER_NOT_FOUND'];

/** Refresh this long before the access token expires. */
export const REFRESH_SKEW_MS = 60 * 1000;

const decodeBase64Url = (segment) => {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return decodeURIComponent(
        Array.from(atob(padded), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
};

/** JWT claims, or null for opaque / malformed tokens. Does not verify anything. */
export const decodeJwt = (token) => {
    try {
        const payload = String(token || '').split('.')[1];
        if (!payload) return null;
        return JSON.parse(decodeBase64Url(payload));
    } catch {
        return null;
    }
};

/** Access token `exp` in ms, or null when unknown. */
export const getTokenExpiryMs = (token) => {
    const exp = decodeJwt(token)?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
};

/** True when the token is missing, expired, or expires within `skewMs`. Unknown expiry counts as fresh. */
export const isTokenExpiring = (token, skewMs = REFRESH_SKEW_MS) => {
    if (!token) return true;
    const exp = getTokenExpiryMs(token);
    return exp !== null && Date.now() >= exp - skewMs;
};

// ---- session-ended event (api.js emits, App.js reacts with UI) ----

const listeners = new Set();

/** Subscribe to "the session is over" (refresh returned 401). Returns an unsubscribe function. */
export const onSessionEnded = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const emitSessionEnded = (reason) => {
    listeners.forEach((listener) => {
        try {
            listener(reason);
        } catch (error) {
            if (__DEV__) console.warn('[session] listener failed', error);
        }
    });
};
