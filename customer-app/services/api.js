import axios from 'axios';
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

export const authApi = createClient(AUTH_URL);
export const userApi = createClient(USER_URL);
export const productApi = createClient(PRODUCT_URL);
export const cartApi = createClient(CART_URL);
export const orderApi = createClient(ORDER_URL);
export const locationApi = createClient(LOCATION_URL);

const api = authApi;

export default api;
