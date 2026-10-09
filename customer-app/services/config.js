import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};
const PUBLIC_NODE_ENV = extra.PUBLIC_NODE_ENV || 'development';
const IS_PRODUCTION = PUBLIC_NODE_ENV === 'production';

// Development-only defaults. Production URLs must come from the build env
// (eas.json profile env -> app.config.js -> extra); there is no silent fallback.
const DEV_API_BASE_URL = 'http://localhost:3000/api/v1';
const DEV_TRACKING_URL = 'http://localhost:3000/tracking';

const resolveLocalhost = (url) => {
    if (IS_PRODUCTION || !url || !url.includes('localhost')) return url;
    
    let host = 'localhost';
    if (Constants.expoConfig?.hostUri) {
        host = Constants.expoConfig.hostUri.split(':')[0];
    } else if (typeof window !== 'undefined' && window.location?.hostname) {
        host = window.location.hostname;
    }
    
    return url.replace('localhost', host);
};

export const API_BASE_URL = resolveLocalhost(extra.API_BASE_URL || (IS_PRODUCTION ? '' : DEV_API_BASE_URL));
export const AUTH_URL = resolveLocalhost(extra.AUTH_SERVICE_URL) || API_BASE_URL;
export const USER_URL = resolveLocalhost(extra.USER_SERVICE_URL) || API_BASE_URL;
export const RIDER_URL = resolveLocalhost(extra.RIDER_SERVICE_URL) || API_BASE_URL;
export const ORDER_URL = resolveLocalhost(extra.ORDER_SERVICE_URL) || API_BASE_URL;
export const PRODUCT_URL = resolveLocalhost(extra.PRODUCT_SERVICE_URL) || API_BASE_URL;
export const CART_URL = resolveLocalhost(extra.CART_SERVICE_URL) || API_BASE_URL;
export const LOCATION_URL = resolveLocalhost(extra.LOCATION_SERVICE_URL) || API_BASE_URL;

export const TRACKING_URL = resolveLocalhost(extra.TRACKING_URL || (IS_PRODUCTION ? '' : DEV_TRACKING_URL));

if (IS_PRODUCTION) {
    const urls = { API_BASE_URL, AUTH_URL, USER_URL, ORDER_URL, PRODUCT_URL, LOCATION_URL, TRACKING_URL };
    const bad = Object.entries(urls).filter(([, url]) => !url || /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(url));
    if (bad.length > 0) {
        const message = '[config] Production build resolved an empty/localhost API URL ('
            + bad.map(([key]) => key).join(', ')
            + '). Set API_BASE_URL and TRACKING_URL in the EAS build profile env.';
        console.error(message);
        throw new Error(message);
    }
}

export const API_URL = ORDER_URL;

export const API_CONFIG = {
    timeout: 30000,
};

export const MAPMYINDIA_CONFIG = {
    apiKey: extra.MAPMYINDIA_API_KEY || '',
    baseUrl: 'https://apis.mappls.com/advancedmaps/v1',
    directionsUrl: 'https://route.mappls.com/route/direction/route_adv/driving',
    geocodeUrl: 'https://atlas.mappls.com/api/places/geocode',
};

export const ENDPOINTS = {
    auth: {
        SEND_OTP: '/auth/send-otp',
        VERIFY_OTP: '/auth/verify-otp',
        REFRESH_TOKEN: '/auth/refresh',
        LOGOUT: '/auth/logout',
    },
    user: {
        PROFILE: '/users/me',
        ADDRESSES: '/users/addresses',
        UPDATE_ADDRESS: (addressIndex) => `/users/addresses/${addressIndex}`,
        REMOVE_ADDRESS: (addressIndex) => `/users/addresses/${addressIndex}`,
    },
    categories: {
        LIST: '/categories',
        SUBCATEGORIES: (categoryId) => `/subcategories?parentId=${categoryId}`,
    },
    products: {
        LIST: '/products',
        DETAIL: (id) => `/products/${id}`,
    },
    cart: {
        GET: '/cart',
        ADD: '/cart/add',
        UPDATE: '/cart/update',
        REMOVE: (id) => `/cart/remove/${id}`,
        CLEAR: '/cart/clear',
    },
    orders: {
        LIST: '/orders',
        DETAIL: (id) => `/orders/${id}`,
        USER: (userId) => `/orders/user/${userId}`,
        STATUS: '/orders/status',
    },
    location: {
        GEOCODE: '/settings/store',
        REVERSE_GEOCODE: '/settings/store',
        ROUTE: '/settings/store',
        ETA: '/settings/store',
    },
};

export default API_CONFIG;
