import api from './api';
import { ENDPOINTS } from './config';

export const AuthService = {
    sendOtp: async (phone) => {
        const response = await api.post(ENDPOINTS.SEND_OTP, { phone });
        return response.data;
    },

    verifyOtp: async (phone, otp, name) => {
        const response = await api.post(ENDPOINTS.VERIFY_OTP, { phone, otp, name });
        // Tokens are now stored in HTTP-only cookies by the backend
        return response.data;
    },

    logout: async () => {
        // Backend clears cookies
        await api.post(ENDPOINTS.LOGOUT);
    },

    getStoredUser: async () => {
        // User is fetched from API, not localStorage
        try {
            const response = await api.get(ENDPOINTS.PROFILE);
            return response.data;
        } catch {
            return null;
        }
    },

    isAuthenticated: async () => {
        // Check by calling profile endpoint - cookies sent automatically
        try {
            await api.get(ENDPOINTS.PROFILE);
            return true;
        } catch {
            return false;
        }
    },
};

export const ProductService = {
    getCategories: async () => {
        const response = await api.get(ENDPOINTS.CATEGORIES);
        return response.data.categories;
    },

    getSubcategories: async (params = {}) => {
        const response = await api.get(ENDPOINTS.SUBCATEGORIES, { params });
        return response.data;
    },

    getProducts: async (params = {}) => {
        const response = await api.get(ENDPOINTS.PRODUCTS, { params });
        return response.data;
    },

    getProductById: async (id) => {
        const response = await api.get(ENDPOINTS.PRODUCT_DETAIL(id));
        return response.data.product;
    },

    searchProducts: async (query) => {
        const response = await api.get(ENDPOINTS.PRODUCTS, { params: { search: query } });
        return response.data;
    },
};

export const CartService = {
    getCart: async () => {
        const response = await api.get(ENDPOINTS.CART);
        return response.data;
    },

    addToCart: async (productId, quantity = 1) => {
        const response = await api.post(ENDPOINTS.CART_ADD, { productId, quantity });
        return response.data;
    },

    updateQuantity: async (productId, quantity) => {
        const response = await api.put(ENDPOINTS.CART_UPDATE, { productId, quantity });
        return response.data;
    },

    removeFromCart: async (productId) => {
        const response = await api.delete(ENDPOINTS.CART_REMOVE(productId));
        return response.data;
    },

    clearCart: async () => {
        const response = await api.delete(ENDPOINTS.CART_CLEAR);
        return response.data;
    },
};

export const OrderService = {
    createOrder: async (orderData) => {
        const response = await api.post(ENDPOINTS.ORDERS, orderData);
        return response.data;
    },

    getOrders: async (page = 1, limit = 10) => {
        const response = await api.get(ENDPOINTS.ORDERS, { params: { page, limit } });
        return response.data;
    },

    getOrderById: async (id) => {
        const response = await api.get(ENDPOINTS.ORDER_DETAIL(id));
        return response.data.order;
    },

    getOrderStatus: async (orderId) => {
        const response = await api.get(ENDPOINTS.ORDER_STATUS(orderId));
        return response.data;
    },
};

export const UserService = {
    getProfile: async () => {
        const response = await api.get(ENDPOINTS.PROFILE);
        return response.data;
    },

    addAddress: async (address) => {
        const response = await api.post(ENDPOINTS.ADDRESSES, address);
        return response.data;
    },

    removeAddress: async (index) => {
        const response = await api.delete(`${ENDPOINTS.ADDRESSES}/${index}`);
        return response.data;
    },
};

export const SettingsService = {
    getStoreSettings: async () => {
        const response = await api.get(ENDPOINTS.STORE_SETTINGS);
        return response.data;
    },

    checkServiceability: async (latitude, longitude) => {
        const response = await api.get(ENDPOINTS.CHECK_SERVICEABILITY, {
            params: { latitude, longitude },
        });
        return response.data;
    },
};
