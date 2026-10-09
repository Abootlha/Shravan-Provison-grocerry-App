import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    API_CONFIG,
    AUTH_URL,
    USER_URL,
    PRODUCT_URL,
    CART_URL,
    ORDER_URL,
    LOCATION_URL,
} from './config';

const createClient = (baseURL) =>
    axios.create({
        baseURL,
        timeout: API_CONFIG.timeout,
        headers: {
            'Content-Type': 'application/json',
        },
        withCredentials: true,
    });

const attachAuthInterceptor = (client) => {
    client.interceptors.request.use(async (config) => {
        const token = await AsyncStorage.getItem('customerAccessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            if (error.response?.status === 401) {
                await AsyncStorage.multiRemove([
                    'customerAccessToken',
                    'customerRefreshToken',
                    'customerUser',
                ]);
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

const api = authApi;

export default api;
