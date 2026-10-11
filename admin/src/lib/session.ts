import { appConfig } from './config';

// Session tokens live in localStorage. Accepted risk: the admin is a static Astro build with
// no server of its own, so httpOnly cookies are not an option; an XSS bug would expose tokens.
// Keep third-party scripts out of the admin and keep access tokens short-lived.
export const SESSION_KEYS = {
    token: 'adminToken',
    refreshToken: 'adminRefreshToken',
    user: 'adminUser',
    loginTime: 'adminLoginTime',
} as const;

const LEGACY_SESSION_MS = 2 * 60 * 60 * 1000;
const EXPIRY_SKEW_MS = 5_000;

export type StaffRole = 'admin' | 'manager' | string;

export interface AdminUser {
    id: string;
    name?: string;
    username?: string;
    role: StaffRole;
}

/** Messages for the 401 codes /auth/refresh returns when a session is over. */
export const SESSION_END_MESSAGES: Record<string, string> = {
    SESSION_EXPIRED: 'Your session has ended. Please log in again.',
    SESSION_REVOKED: 'You were signed out. Please log in again.',
    REFRESH_REUSED: 'For your security you were signed out because this session was used elsewhere. Please log in again.',
    USER_NOT_FOUND: 'This account no longer exists.',
};

const inBrowser = () => typeof window !== 'undefined';

/** Returns the JWT `exp` claim in milliseconds, or null if the token can't be decoded. */
export function getTokenExpiry(token: string): number | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const claims = JSON.parse(atob(padded));
        return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
    } catch {
        return null;
    }
}

export function getAccessToken(): string | null {
    return inBrowser() ? localStorage.getItem(SESSION_KEYS.token) : null;
}

export function isTokenExpired(token: string | null = getAccessToken()): boolean {
    if (!token) return true;

    const exp = getTokenExpiry(token);
    if (exp !== null) return Date.now() >= exp - EXPIRY_SKEW_MS;

    // Opaque token: fall back to login time; no login time means we can't vouch for it.
    const loginTime = parseInt(localStorage.getItem(SESSION_KEYS.loginTime) || '', 10);
    if (!Number.isFinite(loginTime)) return true;
    return Date.now() - loginTime > LEGACY_SESSION_MS;
}

/** The signed-in staff member, as stored at login. Null when signed out or unreadable. */
export function getAdminUser(): AdminUser | null {
    if (!inBrowser()) return null;
    try {
        const raw = localStorage.getItem(SESSION_KEYS.user);
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (!user || typeof user !== 'object') return null;
        return {
            id: String(user.id ?? user._id ?? ''),
            name: typeof user.name === 'string' && user.name.trim() ? user.name.trim() : undefined,
            username: typeof user.username === 'string' ? user.username : undefined,
            role: typeof user.role === 'string' ? user.role : 'admin',
        };
    } catch {
        return null;
    }
}

export function saveSession(data: { accessToken: string; refreshToken?: string; user?: unknown }) {
    localStorage.setItem(SESSION_KEYS.token, data.accessToken);
    if (data.refreshToken) localStorage.setItem(SESSION_KEYS.refreshToken, data.refreshToken);
    if (data.user) localStorage.setItem(SESSION_KEYS.user, JSON.stringify(data.user));
    localStorage.setItem(SESSION_KEYS.loginTime, Date.now().toString());
}

export function clearSession() {
    if (!inBrowser()) return;
    Object.values(SESSION_KEYS).forEach((key) => localStorage.removeItem(key));
}

/** Clears the session and opens /login?reason=CODE so the login page can explain why. */
export function redirectToLogin(reason: string = 'SESSION_EXPIRED') {
    if (!inBrowser()) return;
    clearSession();
    if (window.location.pathname !== '/login') {
        window.location.href = '/login?reason=' + encodeURIComponent(reason);
    }
}

/** Thrown when the session could not be renewed for a transient reason (offline, 5xx). */
export class SessionRefreshUnavailableError extends Error {
    constructor() {
        super('Could not reach the server to renew your session. Please retry.');
        this.name = 'SessionRefreshUnavailableError';
    }
}

export type RefreshOutcome =
    | { status: 'ok'; token: string }
    | { status: 'ended'; reason: string }
    | { status: 'unavailable' };

declare global {
    interface Window {
        /** Set by the pre-render guard in AdminLayout when it starts a refresh. */
        __adminSessionRefresh?: Promise<RefreshOutcome>;
    }
}

let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function performRefresh(): Promise<RefreshOutcome> {
    const refreshToken = localStorage.getItem(SESSION_KEYS.refreshToken);
    if (!refreshToken) return { status: 'ended', reason: 'SESSION_EXPIRED' };
    try {
        const response = await fetch(appConfig.apiBaseUrl + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });
        if (response.status === 401) {
            const body = await response.json().catch(() => ({}));
            return { status: 'ended', reason: typeof body?.code === 'string' ? body.code : 'SESSION_EXPIRED' };
        }
        if (!response.ok) return { status: 'unavailable' };
        const data = await response.json();
        if (!data?.accessToken) return { status: 'unavailable' };
        saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return { status: 'ok', token: data.accessToken };
    } catch {
        return { status: 'unavailable' };
    }
}

/**
 * Exchanges the refresh token for a new pair. Single-flight: concurrent callers share one
 * request, and a refresh the pre-render guard already started is reused instead of
 * firing a second /auth/refresh (refresh tokens rotate, so two calls would race).
 */
export function refreshSession(): Promise<RefreshOutcome> {
    if (refreshInFlight) return refreshInFlight;

    const guardRefresh = inBrowser() ? window.__adminSessionRefresh : undefined;
    if (guardRefresh) {
        window.__adminSessionRefresh = undefined;
        refreshInFlight = guardRefresh.finally(() => {
            refreshInFlight = null;
        });
        return refreshInFlight;
    }

    refreshInFlight = performRefresh().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

/** Returns a usable access token, refreshing first if needed. Redirects when the session is over. */
export async function getValidAccessToken(): Promise<string> {
    // Let a guard refresh that is still running finish before deciding anything.
    if (inBrowser() && window.__adminSessionRefresh) {
        const outcome = await refreshSession();
        if (outcome.status === 'ok') return outcome.token;
    }

    const token = getAccessToken();
    if (token && !isTokenExpired(token)) return token;

    const outcome = await refreshSession();
    if (outcome.status === 'ok') return outcome.token;
    if (outcome.status === 'unavailable') throw new SessionRefreshUnavailableError();
    redirectToLogin(outcome.reason);
    throw new Error('Session expired');
}
