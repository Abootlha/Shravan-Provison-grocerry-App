import { Platform } from 'react-native';
import Constants from 'expo-constants';

const LOCAL_IP = '192.168.1.7';

const getApiUrl = () => {
    if (!__DEV__) {
        return 'https://api.shravankirana.com/api/v1';
    }

    if (Platform.OS === 'web') {
        return 'http://localhost:3000/api/v1';
    } else if (Platform.OS === 'ios') {
        return `http://${LOCAL_IP}:3000/api/v1`;
    } else {
        return `http://${LOCAL_IP}:3000/api/v1`;
    }
};

const getTrackingWsUrl = () => {
    if (!__DEV__) {
        return 'wss://api.shravankirana.com/tracking';
    }

    if (Platform.OS === 'web') {
        return 'ws://localhost:3008/tracking';
    } else if (Platform.OS === 'ios') {
        return `ws://${LOCAL_IP}:3008/tracking`;
    } else {
        return `ws://${LOCAL_IP}:3008/tracking`;
    }
};

const getLocationSvcUrl = () => {
    if (!__DEV__) {
        return 'https://api.shravankirana.com/location';
    }

    if (Platform.OS === 'web') {
        return 'http://localhost:3005';
    } else if (Platform.OS === 'ios') {
        return `http://${LOCAL_IP}:3005`;
    } else {
        return `http://${LOCAL_IP}:3005`;
    }
};

const API_BASE_URL = getApiUrl();
const TRACKING_WS_URL = getTrackingWsUrl();
const LOCATION_SVC_URL = getLocationSvcUrl();

export const API_URL = API_BASE_URL;
export const TRACKING_URL = TRACKING_WS_URL;
export const LOCATION_URL = LOCATION_SVC_URL;

export const API_CONFIG = {
    baseURL: API_BASE_URL,
    timeout: 30000,
};

export const MAPMYINDIA_CONFIG = {
    apiKey: Constants.expoConfig?.extra?.MAPMYINDIA_API_KEY || process.env.MAPMYINDIA_API_KEY || '',
    baseUrl: 'https://apis.mapmyindia.com/advancedmaps/v1',
    directionsUrl: 'https://apis.mapmyindia.com/routing/v1/driving',
    geocodeUrl: 'https://apis.mapmyindia.com/advancedmaps/v1/geocode',
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
    },
    categories: {
        LIST: '/categories',
        SUBCATEGORIES: '/subcategories',
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
        STATUS: (orderId) => `/orders/${orderId}/status`,
        HISTORY: (orderId) => `/orders/${orderId}/history`,
    },
    location: {
        GEOCODE: '/geocode',
        REVERSE_GEOCODE: '/reverse-geocode',
        SEARCH: '/search',
    },
    settings: {
        STORE: '/settings/store',
        CHECK_SERVICEABILITY: '/settings/check-serviceability',
    },
};

export default API_CONFIG;
