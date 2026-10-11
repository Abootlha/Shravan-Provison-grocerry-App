// Runtime URLs are baked in at build time from PUBLIC_* env vars (see admin/.env.example).
// Dev falls back to the local NestJS backend; production builds fail if the URLs are missing
// so a misconfigured build can never silently point at the wrong API.

const DEV_DEFAULTS = {
    apiBaseUrl: 'http://localhost:3000/api/v1',
    trackingUrl: 'http://localhost:3000/tracking',
} as const;

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, '');
}

function readEnv(...values: (string | undefined)[]): string | undefined {
    for (const value of values) {
        const normalized = value?.trim();
        if (normalized) return trimTrailingSlash(normalized);
    }
    return undefined;
}

function requireEnv(name: string, value: string | undefined, devFallback: string): string {
    if (value) return value;
    if (import.meta.env.PROD) {
        throw new Error(
            `[admin config] ${name} must be set for production builds (see admin/.env.example).`
        );
    }
    return devFallback;
}

const apiBaseUrl = requireEnv(
    'PUBLIC_API_URL',
    // PUBLIC_API_BASE_URL is the legacy name; still honoured.
    readEnv(import.meta.env.PUBLIC_API_URL, import.meta.env.PUBLIC_API_BASE_URL),
    DEV_DEFAULTS.apiBaseUrl,
);

const trackingServiceUrl = requireEnv(
    'PUBLIC_TRACKING_URL',
    readEnv(import.meta.env.PUBLIC_TRACKING_URL, import.meta.env.PUBLIC_TRACKING_SERVICE_URL),
    DEV_DEFAULTS.trackingUrl,
);

const socketUrl = readEnv(import.meta.env.PUBLIC_SOCKET_URL) || trackingServiceUrl;

export const appConfig = {
    mode: import.meta.env.MODE,
    isProduction: import.meta.env.PROD,
    apiBaseUrl,
    // All admin traffic goes to the single NestJS backend.
    authServiceUrl: apiBaseUrl,
    productServiceUrl: apiBaseUrl,
    orderServiceUrl: apiBaseUrl,
    riderServiceUrl: apiBaseUrl,
    analyticsServiceUrl: apiBaseUrl,
    settingsServiceUrl: apiBaseUrl,
    subcategoryServiceUrl: apiBaseUrl,
    itemGroupServiceUrl: apiBaseUrl,
    trackingServiceUrl,
    socketUrl,
};

export function getApiBaseUrl() {
    return appConfig.apiBaseUrl;
}

export function getTrackingServiceUrl() {
    return appConfig.trackingServiceUrl;
}

export function getSocketUrl() {
    return appConfig.socketUrl;
}
