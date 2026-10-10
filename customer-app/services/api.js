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

const endSession = async () => {
    await clearSession().catch(() => undefined);
    store.dispatch(logout());
};

/**
 * Single-flight refresh: every request that hits a 401 while a refresh is in
 * progress waits on the same promise and is retried with the new token.
 * Resolves to the new access token, or null if the session could not be renewed.
 */
const refreshAccessToken = () => {
    if (!refreshPromise) {
        refreshPromise = (async () => {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) {
                await endSession();
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
                    throw new Error('Refresh response did not include an access token');
                }

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
                // Network/5xx failures are not proof the session is dead; keep tokens.
                if (!error.response || error.response.status >= 500) {
                    return null;
                }
                await endSession();
                return null;
            }
        })().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
};

const attachAuthInterceptor = (client) => {
    client.interceptors.request.use(async (config) => {
        const token = await getAccessToken();
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
