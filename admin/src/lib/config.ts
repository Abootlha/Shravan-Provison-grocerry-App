const ENV_DEFAULTS = {
    production: {
        apiBaseUrl: 'https://api.lumioui.com/api/v1',
        trackingUrl: 'https://api.lumioui.com/tracking',
    },
    development: {
        apiBaseUrl: 'http://localhost:3000/api/v1',
        trackingUrl: 'http://localhost:3000/tracking',
    },
} as const;

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, '');
}

function readEnvValue(value: string | undefined, fallback: string) {
    const normalized = value?.trim();
    return normalized ? trimTrailingSlash(normalized) : fallback;
}

function getNodeEnv(): 'production' | 'development' {
    const requestedEnv = (import.meta.env.PUBLIC_NODE_ENV || '').trim().toLowerCase();
    return requestedEnv === 'production' ? 'production' : 'development';
}

function selectServiceUrl(value: string | undefined, fallback: string) {
    return nodeEnv === 'production' ? fallback : readEnvValue(value, fallback);
}

const nodeEnv = getNodeEnv();
const envDefaults = ENV_DEFAULTS[nodeEnv];
const configuredApiBaseUrl = readEnvValue(import.meta.env.PUBLIC_API_BASE_URL, envDefaults.apiBaseUrl);
const configuredTrackingUrl = readEnvValue(import.meta.env.PUBLIC_TRACKING_SERVICE_URL, envDefaults.trackingUrl);
const configuredSocketUrl = readEnvValue(import.meta.env.PUBLIC_SOCKET_URL, configuredTrackingUrl);

const apiBaseUrl = nodeEnv === 'production' ? envDefaults.apiBaseUrl : configuredApiBaseUrl;
const trackingServiceUrl = nodeEnv === 'production' ? envDefaults.trackingUrl : configuredTrackingUrl;
const socketUrl = nodeEnv === 'production' ? envDefaults.trackingUrl : configuredSocketUrl;

export const appConfig = {
    mode: import.meta.env.MODE,
    nodeEnv,
    isProduction: import.meta.env.PROD,
    apiBaseUrl,
    authServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_AUTH_SERVICE_URL, apiBaseUrl),
    productServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_PRODUCT_SERVICE_URL, apiBaseUrl),
    orderServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_ORDER_SERVICE_URL, apiBaseUrl),
    riderServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_RIDER_SERVICE_URL, apiBaseUrl),
    analyticsServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_ANALYTICS_SERVICE_URL, apiBaseUrl),
    settingsServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_SETTINGS_SERVICE_URL, apiBaseUrl),
    subcategoryServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_SUBCATEGORY_SERVICE_URL, apiBaseUrl),
    itemGroupServiceUrl: selectServiceUrl(import.meta.env.PUBLIC_ITEM_GROUP_SERVICE_URL, apiBaseUrl),
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
