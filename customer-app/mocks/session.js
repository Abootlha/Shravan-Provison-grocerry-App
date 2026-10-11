// Mock login sessions with the backend's semantics (backend/src/modules/auth):
// short-lived access tokens, one session per device, refresh-token rotation with
// a sliding expiry, reuse detection, and 401 { code } errors from /auth/refresh.
//
// Tokens are JWT-shaped (header.payload.signature) so the app can read `exp`,
// but the signature is fake. State is kept in localStorage on web so a reload
// keeps the session, like a real backend would.
//
// Dev controls (web), to try the session flows without a backend:
//   ?mockSession=expired   access token rejected -> the app refreshes silently
//   ?mockSession=revoked   session revoked -> refresh 401 SESSION_REVOKED -> Login
//   ?mockSession=ended     session idle-expired -> refresh 401 SESSION_EXPIRED -> Login
//   ?mockSession=offline   refresh fails with a network error (stays until =online)
//   ?mockSession=online    undo offline
// or from the console: __mockSession.expireAccess() / .revoke() / .end() / .offline(true|false) / .state()

const STORAGE_KEY = 'shravan.mockAuth.v1';
const ACCESS_TTL_S = 15 * 60;
const REFRESH_IDLE_S = 365 * 24 * 60 * 60;
const REUSE_GRACE_MS = 5 * 60 * 1000;

const storage = (() => {
    try {
        if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } catch {
        // blocked storage
    }
    return null;
})();

const load = () => {
    try {
        return JSON.parse(storage?.getItem(STORAGE_KEY) || 'null') || {};
    } catch {
        return {};
    }
};

const state = {
    sessions: {}, // sid -> { current, prev, rotatedAt }
    revoked: [], // sids revoked on purpose (vs. idle-expired)
    accessNotBefore: 0, // ms; access tokens issued before this are rejected
    refreshOffline: false,
    ...load(),
};

const save = () => {
    try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
};

const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const decode = (token) => {
    try {
        const part = String(token || '').split('.')[1];
        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)));
    } catch {
        return null;
    }
};

const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const sign = (claims, ttlSeconds) => {
    const iat = Math.floor(Date.now() / 1000);
    return `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ ...claims, iat, iatMs: Date.now(), exp: iat + ttlSeconds, jti: randomId() })}.mock`;
};

const tokensFor = (userId, sid) => ({
    accessToken: sign({ sub: userId, role: 'customer', sid }, ACCESS_TTL_S),
    refreshToken: sign({ sub: userId, role: 'customer', sid, type: 'refresh' }, REFRESH_IDLE_S),
});

const sessionError = (code, message) => ({
    status: 401,
    body: { statusCode: 401, message, error: 'Unauthorized', code },
});

/** New session for a login. */
export const issueSession = (userId) => {
    const sid = randomId();
    const tokens = tokensFor(userId, sid);
    state.sessions[sid] = { current: tokens.refreshToken, prev: null, rotatedAt: null };
    save();
    return tokens;
};

/** POST /auth/refresh. Returns { status, body } or { networkError: true }. */
export const refreshSession = (refreshToken, userId) => {
    if (state.refreshOffline) return { networkError: true };
    if (!refreshToken) return sessionError('SESSION_EXPIRED', 'Refresh token is required');

    const claims = decode(refreshToken);
    if (!claims) {
        // Opaque token from an older mock build: move it onto a real session once.
        return { status: 200, body: { ...issueSession(userId), message: 'Tokens refreshed' } };
    }
    if (claims.type !== 'refresh' || !claims.sid) return sessionError('SESSION_REVOKED', 'Invalid session. Please login again.');
    if (claims.exp * 1000 < Date.now()) return sessionError('SESSION_EXPIRED', 'Session expired. Please login again.');

    const session = state.sessions[claims.sid];
    if (!session) {
        return state.revoked.includes(claims.sid)
            ? sessionError('SESSION_REVOKED', 'This session was signed out. Please login again.')
            : sessionError('SESSION_EXPIRED', 'Session expired. Please login again.');
    }

    const isCurrent = session.current === refreshToken;
    const inGrace = session.prev === refreshToken && Date.now() - (session.rotatedAt || 0) <= REUSE_GRACE_MS;
    if (!isCurrent && !inGrace) {
        delete state.sessions[claims.sid];
        state.revoked.push(claims.sid);
        save();
        return sessionError('REFRESH_REUSED', 'This sign-in was used again from another device. Please login again.');
    }

    const tokens = tokensFor(claims.sub || userId, claims.sid);
    state.sessions[claims.sid] = {
        current: tokens.refreshToken,
        prev: isCurrent ? refreshToken : session.prev,
        rotatedAt: isCurrent ? Date.now() : session.rotatedAt,
    };
    save();
    return { status: 200, body: { ...tokens, message: 'Tokens refreshed' } };
};

const bearer = (authorization) => String(authorization || '').replace(/^Bearer\s+/i, '');

/** True if the access token would pass the backend's JwtStrategy. Opaque legacy mock tokens pass. */
export const isAccessTokenValid = (token) => {
    if (!token) return false;
    const claims = decode(token);
    if (!claims) return true;
    if (claims.type === 'refresh') return false;
    if (claims.exp * 1000 < Date.now()) return false;
    return (claims.iatMs || claims.iat * 1000) >= state.accessNotBefore;
};

/** Auth check for protected routes: null when allowed, else a 401 result. */
export const checkAccess = (authorization) => (
    isAccessTokenValid(bearer(authorization)) ? null : { status: 401, body: { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' } }
);

/** POST /auth/logout: ends only this device's session. */
export const logoutSession = (authorization) => {
    const sid = decode(bearer(authorization))?.sid;
    if (sid) {
        delete state.sessions[sid];
        save();
    }
};

/** POST /auth/logout-all. */
export const logoutAllSessions = () => {
    const count = Object.keys(state.sessions).length;
    state.revoked.push(...Object.keys(state.sessions));
    state.sessions = {};
    state.accessNotBefore = Date.now();
    save();
    return count;
};

// ---- dev controls ----

const controls = {
    /** Reject current access tokens (as if they expired). The app should refresh silently. */
    expireAccess() {
        state.accessNotBefore = Date.now();
        save();
    },
    /** Revoke every session (like logout-all from another device). */
    revoke() {
        logoutAllSessions();
    },
    /** Let every session idle-expire. */
    end() {
        state.sessions = {};
        state.accessNotBefore = Date.now();
        save();
    },
    /** Make /auth/refresh fail with a network error (true) or work again (false). */
    offline(on = true) {
        state.refreshOffline = !!on;
        if (on) state.accessNotBefore = Date.now();
        save();
    },
    state: () => JSON.parse(JSON.stringify(state)),
};

const URL_FLAGS = {
    expired: () => controls.expireAccess(),
    revoked: () => controls.revoke(),
    ended: () => controls.end(),
    offline: () => controls.offline(true),
    online: () => controls.offline(false),
};

/** Expose __mockSession and apply a ?mockSession= flag (then drop it from the URL). */
export const installSessionControls = () => {
    const g = typeof globalThis !== 'undefined' ? globalThis : global;
    g.__mockSession = controls;
    if (typeof window === 'undefined' || !window.location?.search) return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('mockSession');
    if (!flag || !URL_FLAGS[flag]) return;
    URL_FLAGS[flag]();
    console.log(`[mock api] mockSession=${flag} applied`);
    params.delete('mockSession');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
};
