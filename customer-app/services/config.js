import { Platform } from 'react-native';
import Constants from 'expo-constants';

const LOCAL_IP = Constants.expoConfig?.extra?.LOCAL_IP || '192.168.1.7';

const getMonolithBaseUrl = () => {
    if (!__DEV__) {
        return 'https://api.shravankirana.com/api/v1';
    }

    if (Platform.OS === 'web') {
        return 'http://localhost:3000/api/v1';
    }

    return `http://${LOCAL_IP}:3000/api/v1`;
};

export const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || getMonolithBaseUrl();
export const AUTH_URL = Constants.expoConfig?.extra?.AUTH_SERVICE_URL || API_BASE_URL;
export const USER_URL = Constants.expoConfig?.extra?.USER_SERVICE_URL || API_BASE_URL;
export const RIDER_URL = Constants.expoConfig?.extra?.RIDER_SERVICE_URL || API_BASE_URL;
export const ORDER_URL = Constants.expoConfig?.extra?.ORDER_SERVICE_URL || API_BASE_URL;
export const PRODUCT_URL = Constants.expoConfig?.extra?.PRODUCT_SERVICE_URL || API_BASE_URL;
export const CART_URL = Constants.expoConfig?.extra?.CART_SERVICE_URL || API_BASE_URL;
export const LOCATION_URL = Constants.expoConfig?.extra?.LOCATION_SERVICE_URL || API_BASE_URL;

export const TRACKING_URL = __DEV__
    ? (Platform.OS === 'web' ? 'ws://localhost:3000/tracking' : `ws://${LOCAL_IP}:3000/tracking`)
    : 'wss://api.shravankirana.com/tracking';

export const API_URL = ORDER_URL;

export const API_CONFIG = {
    timeout: 30000,
};

export const MAPMYINDIA_CONFIG = {
    apiKey: Constants.expoConfig?.extra?.MAPMYINDIA_API_KEY || process.env.MAPMYINDIA_API_KEY || '',
    baseUrl: 'https://apis.mappls.com/advancedmaps/v1',
    directionsUrl: 'https://apis.mappls.com/advancedmaps/v1/route_adv/driving',
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
        REMOVE_ADDRESS: (addressIndex) => `/users/addresses/${addressIndex}`,
    },
    categories: {
        LIST: '/categories',
        SUBCATEGORIES: (categoryId) => `/categories/${categoryId}/subcategories`,
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
