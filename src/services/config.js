import { Platform } from 'react-native';

// API Configuration - detect platform for correct URL
// Replace with your laptop's IP address for physical device testing
const LOCAL_IP = '192.168.1.7'; // Your laptop's IP address

const getApiUrl = () => {
    if (!__DEV__) {
        return 'https://api.shravankirana.com/api/v1';
    }

    // Development mode
    if (Platform.OS === 'web') {
        return 'http://localhost:3000/api/v1';
    } else if (Platform.OS === 'ios') {
        // iOS physical device needs the actual IP of your laptop
        return `http://${LOCAL_IP}:3000/api/v1`;
    } else {
        // Android: Use LOCAL_IP for physical devices
        // Note: For Android Emulator, use 10.0.2.2 instead
        return `http://${LOCAL_IP}:3000/api/v1`;
    }
};

const API_BASE_URL = getApiUrl();

export const API_CONFIG = {
    baseURL: API_BASE_URL,
    timeout: 30000, // Increased to 30 seconds to handle large responses
};

export const ENDPOINTS = {
    // Auth
    SEND_OTP: '/auth/send-otp',
    VERIFY_OTP: '/auth/verify-otp',
    REFRESH_TOKEN: '/auth/refresh',
    LOGOUT: '/auth/logout',

    // User
    PROFILE: '/users/me',
    ADDRESSES: '/users/addresses',

    // Categories
    CATEGORIES: '/categories',
    SUBCATEGORIES: '/subcategories',

    // Products
    PRODUCTS: '/products',
    PRODUCT_DETAIL: (id) => `/products/${id}`,

    // Cart
    CART: '/cart',
    CART_ADD: '/cart/add',
    CART_UPDATE: '/cart/update',
    CART_REMOVE: (id) => `/cart/remove/${id}`,
    CART_CLEAR: '/cart/clear',

    // Orders
    ORDERS: '/orders',
    ORDER_DETAIL: (id) => `/orders/${id}`,
    ORDER_STATUS: (orderId) => `/orders/${orderId}/status`,
    ORDER_HISTORY: (orderId) => `/orders/${orderId}/history`,

    // Settings
    STORE_SETTINGS: '/settings/store',
    CHECK_SERVICEABILITY: '/settings/check-serviceability',
};

export default API_CONFIG;
