import { Platform } from 'react-native';
import Constants from 'expo-constants';

const LOCAL_IP = Constants.expoConfig?.extra?.LOCAL_IP || '192.168.1.7';

const getServiceBaseUrl = (port) => {
    if (!__DEV__) {
        return `https://api.shravankirana.com`;
    }

    if (Platform.OS === 'web') {
        return `http://localhost:${port}`;
    }

    return `http://${LOCAL_IP}:${port}`;
};

export const AUTH_URL = Constants.expoConfig?.extra?.AUTH_SERVICE_URL || getServiceBaseUrl(8001);
export const USER_URL = Constants.expoConfig?.extra?.USER_SERVICE_URL || getServiceBaseUrl(8002);
export const RIDER_URL = Constants.expoConfig?.extra?.RIDER_SERVICE_URL || getServiceBaseUrl(8003);
export const ORDER_URL = Constants.expoConfig?.extra?.ORDER_SERVICE_URL || getServiceBaseUrl(8004);
export const PRODUCT_URL = Constants.expoConfig?.extra?.PRODUCT_SERVICE_URL || `${getServiceBaseUrl(8005)}/api/v1`;
export const CART_URL = Constants.expoConfig?.extra?.CART_SERVICE_URL || `${getServiceBaseUrl(8006)}/api/v1`;
export const LOCATION_URL = Constants.expoConfig?.extra?.LOCATION_SERVICE_URL || getServiceBaseUrl(8009);

export const TRACKING_URL = __DEV__
    ? (Platform.OS === 'web' ? 'ws://localhost:8010' : `ws://${LOCAL_IP}:8010`)
    : 'wss://api.shravankirana.com';

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
        PROFILE: (userId) => `/users/${userId}`,
        ADDRESSES: (userId) => `/users/${userId}/addresses`,
        REMOVE_ADDRESS: (userId, addressIndex) => `/users/${userId}/addresses/${addressIndex}`,
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
        GEOCODE: '/geocode',
        REVERSE_GEOCODE: '/reverse-geocode',
        ROUTE: '/route/calculate',
        ETA: '/eta/calculate',
    },
};

export default API_CONFIG;
