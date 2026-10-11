import axios from 'axios';
import {
    API_CONFIG,
    AUTH_URL,
    USER_URL,
    PRODUCT_URL,
    CART_URL,
    ORDER_URL,
    LOCATION_URL,
    ENDPOINTS,
} from './config';
import {
    getAccessToken,
    getRefreshToken,
    setTokens,
    clearSession,
} from './tokenStorage';
import { store } from '../store';
import { logout, refreshTokenSuccess } from '../store/slices/authSlice';
import { emitSessionEnded, isTokenExpiring } from './session';

const createClient = (baseURL) =>
    axios.create({
        baseURL,
        timeout: API_CONFIG.timeout,
        headers: {
            'Content-Type': 'application/json',
        },
        withCredentials: true,
    });

// Requests that must never trigger a refresh-and-retry.
const AUTH_ROUTES = [
    ENDPOINTS.auth.REFRESH_TOKEN,
    ENDPOINTS.auth.SEND_OTP,
    ENDPOINTS.auth.VERIFY_OTP,
    ENDPOINTS.auth.LOGOUT,
];

const isAuthRoute = (url = '') => AUTH_ROUTES.some((route) => url.includes(route));

let refreshPromise = null;
let sessionEnding = false;

/**
 * The server said the session is over (refresh returned 401): forget the tokens
 * and tell the app shell, which disconnects sockets, shows a message and opens
 * Login. The cart is local and survives. Guests (never signed in) are left alone.
 */
const endSession = async (code) => {
    const wasSignedIn = store.getState().auth.isAuthenticated;
    await clearSession().catch(() => undefined);
    store.dispatch(logout());
    if (wasSignedIn && !sessionEnding) {
        sessionEnding = true;
        try {
            emitSessionEnded(code || 'SESSION_EXPIRED');
        } finally {
            sessionEnding = false;
        }
    }
};

/**
 * Single-flight refresh: every caller that needs a new access token while a
 * refresh is in progress waits on the same promise.
 * Resolves to the new access token, or null when it could not be renewed.
 * Only a 401 from /auth/refresh ends the session. Network errors, timeouts,
 * 5xx and rate limits keep the stored tokens so the next attempt can succeed.
 */
export const refreshAccessToken = () => {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) {
                if (store.getState().auth.isAuthenticated) await endSession('SESSION_EXPIRED');
                return null;
            }

            try {
                // Bare axios call (no interceptors) - /auth/refresh needs no access token.
                const response = await axios.post(
                    `${AUTH_URL}${ENDPOINTS.auth.REFRESH_TOKEN}`,
                    { refreshToken },
                    { timeout: API_CONFIG.timeout, withCredentials: true },
                );
                const data = response.data || {};
                const accessToken = data.accessToken || data.tokens?.accessToken || null;
                const nextRefreshToken = data.refreshToken || data.tokens?.refreshToken || null;
                if (!accessToken) {
                    return null;
                }

                // Refresh tokens rotate on every call: always store the new one.
                await setTokens({
                    accessToken,
                    refreshToken: nextRefreshToken || undefined,
                });
                store.dispatch(refreshTokenSuccess({
                    token: accessToken,
                    refreshToken: nextRefreshToken || undefined,
                }));
                return accessToken;
            } catch (error) {
                if (error?.response?.status === 401) {
                    await endSession(error.response.data?.code);
                } else if (__DEV__) {
                    console.log('[session] refresh failed, keeping session:', error?.message);
                }
                return null;
            }
        })().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
};

/**
 * Renew the access token if it is expired or about to expire (no-op otherwise,
 * and for guests). Safe to call often: app start, app foreground, before sockets.
 * Resolves to a usable access token or null.
 */
export const ensureFreshAccessToken = async () => {
    const [accessToken, refreshToken] = await Promise.all([getAccessToken(), getRefreshToken()]);
    if (!refreshToken) return accessToken;
    if (accessToken && !isTokenExpiring(accessToken)) return accessToken;
    return (await refreshAccessToken()) || null;
};

const attachAuthInterceptor = (client) => {
    client.interceptors.request.use(async (config) => {
        let token = await getAccessToken();
        // Expired access token: renew first instead of earning a 401 round-trip.
        if (token && !isAuthRoute(config.url) && isTokenExpiring(token, 0)) {
            token = (await refreshAccessToken()) || token;
        }
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            const original = error.config;
            if (
                error.response?.status === 401
                && original
                && !original._retry
                && !isAuthRoute(original.url)
            ) {
                original._retry = true;
                const token = await refreshAccessToken();
                if (token) {
                    original.headers = original.headers || {};
                    original.headers.Authorization = `Bearer ${token}`;
                    return client(original);
                }
            }
            return Promise.reject(error);
        },
    );
};

export const authApi = createClient(AUTH_URL);
export const userApi = createClient(USER_URL);
export const productApi = createClient(PRODUCT_URL);
export const cartApi = createClient(CART_URL);
export const orderApi = createClient(ORDER_URL);
export const locationApi = createClient(LOCATION_URL);

[authApi, userApi, productApi, cartApi, orderApi, locationApi].forEach(attachAuthInterceptor);

// Mock backend (see mocks/README.md): dev builds with EXPO_PUBLIC_MOCK_API=1, or
// profiling release builds with EXPO_PUBLIC_PERF_MOCK=1. Both env vars are inlined
// at bundle time; in a production bundle (neither set, `__DEV__` false) the condition
// folds to `false`, so this branch and the mocks/ folder are stripped. Keep the
// condition inline here (not in a helper) or Metro can no longer drop the require.
if ((__DEV__ && process.env.EXPO_PUBLIC_MOCK_API === '1') || process.env.EXPO_PUBLIC_PERF_MOCK === '1') {
    require('../mocks').installMockApi(
        [authApi, userApi, productApi, cartApi, orderApi, locationApi],
        { apiBaseUrl: require('./config').API_BASE_URL },
    );
}

const api = authApi;

export default api;
