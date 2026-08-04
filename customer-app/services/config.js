import Constants from 'expo-constants';

const PUBLIC_NODE_ENV = Constants.expoConfig?.extra?.PUBLIC_NODE_ENV || 'development';
const IS_PRODUCTION = PUBLIC_NODE_ENV === 'production';

const getMonolithBaseUrl = () => {
    if (IS_PRODUCTION) {
        return 'https://api.lumioui.com/api/v1';
    }

    return 'http://localhost:3000/api/v1';
};

export const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || getMonolithBaseUrl();
export const AUTH_URL = Constants.expoConfig?.extra?.AUTH_SERVICE_URL || API_BASE_URL;
export const USER_URL = Constants.expoConfig?.extra?.USER_SERVICE_URL || API_BASE_URL;
export const RIDER_URL = Constants.expoConfig?.extra?.RIDER_SERVICE_URL || API_BASE_URL;
export const ORDER_URL = Constants.expoConfig?.extra?.ORDER_SERVICE_URL || API_BASE_URL;
export const PRODUCT_URL = Constants.expoConfig?.extra?.PRODUCT_SERVICE_URL || API_BASE_URL;
export const CART_URL = Constants.expoConfig?.extra?.CART_SERVICE_URL || API_BASE_URL;
export const LOCATION_URL = Constants.expoConfig?.extra?.LOCATION_SERVICE_URL || API_BASE_URL;

export const TRACKING_URL = Constants.expoConfig?.extra?.TRACKING_URL || (
    IS_PRODUCTION
        ? 'https://api.lumioui.com/tracking'
        : 'http://localhost:3000/tracking'
);

export const API_URL = ORDER_URL;

export const API_CONFIG = {
    timeout: 30000,
};

export const MAPMYINDIA_CONFIG = {
    apiKey: Constants.expoConfig?.extra?.MAPMYINDIA_API_KEY || process.env.MAPMYINDIA_API_KEY || '',
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
