import {
    authApi,
    userApi,
    productApi,
    cartApi,
    orderApi,
    locationApi,
} from './api';
import { ENDPOINTS } from './config';

const getCurrentUser = async () => {
    const profile = await UserService.getProfile();
    return {
        phone: profile?.phone,
        userId: profile?.id,
    };
};

export const AuthService = {
    sendOtp: async (phone) => {
        const response = await authApi.post(ENDPOINTS.auth.SEND_OTP, { phone });
        return response.data;
    },

    verifyOtp: async (phone, otp) => {
        const response = await authApi.post(ENDPOINTS.auth.VERIFY_OTP, { phone, otp });
        return response.data;
    },

    logout: async (refreshToken) => {
        await authApi.post(ENDPOINTS.auth.LOGOUT, { refreshToken });
    },
};

export const ProductService = {
    getCategories: async () => {
        const response = await productApi.get(ENDPOINTS.categories.LIST);
        return response.data.categories || [];
    },

    getSubcategories: async ({ parentId }) => {
        const response = await productApi.get(ENDPOINTS.categories.SUBCATEGORIES(parentId));
        return response.data;
    },

    getProducts: async (params = {}) => {
        const response = await productApi.get(ENDPOINTS.products.LIST, { params });
        return response.data;
    },

    getProductById: async (id) => {
        const response = await productApi.get(ENDPOINTS.products.DETAIL(id));
        return response.data.product;
    },

    searchProducts: async (query) => {
        const response = await productApi.get(ENDPOINTS.products.LIST, { params: { search: query } });
        return response.data;
    },
};

export const CartService = {
    getCart: async () => {
        const response = await cartApi.get(ENDPOINTS.cart.GET);
        return response.data;
    },

    addToCart: async (productId, quantity = 1) => {
        const response = await cartApi.post(ENDPOINTS.cart.ADD, { productId, quantity });
        return response.data;
    },

    updateQuantity: async (productId, quantity) => {
        const response = await cartApi.put(ENDPOINTS.cart.UPDATE, { productId, quantity });
        return response.data;
    },

    removeFromCart: async (productId) => {
        const response = await cartApi.delete(ENDPOINTS.cart.REMOVE(productId));
        return response.data;
    },

    clearCart: async () => {
        const response = await cartApi.delete(ENDPOINTS.cart.CLEAR);
        return response.data;
    },
};

export const OrderService = {
    createOrder: async (orderData) => {
        const response = await orderApi.post(ENDPOINTS.orders.LIST, orderData);
        return response.data;
    },

    getOrders: async (userId) => {
        if (!userId) {
            return [];
        }
        const response = await orderApi.get(ENDPOINTS.orders.USER(userId));
        return response.data;
    },

    getOrderById: async (id) => {
        const response = await orderApi.get(ENDPOINTS.orders.DETAIL(id));
        return response.data;
    },

    getOrderStatus: async (orderId) => {
        const response = await orderApi.get(ENDPOINTS.orders.DETAIL(orderId));
        return response.data;
    },
};

export const UserService = {
    getProfile: async (userId) => {
        const response = await userApi.get(ENDPOINTS.user.PROFILE);
        return response.data;
    },

    addAddress: async (address) => {
        const response = await userApi.post(ENDPOINTS.user.ADDRESSES, address);
        return response.data;
    },

    removeAddress: async (_userId, index) => {
        const response = await userApi.delete(ENDPOINTS.user.REMOVE_ADDRESS(index));
        return response.data;
    },
};

export const SettingsService = {
    getStoreSettings: async () => ({
        serviceable: true,
    }),

    checkServiceability: async (latitude, longitude) => {
        const response = await locationApi.get('/settings/store');
        const settings = response.data?.settings || response.data || {};
        return {
            serviceable: settings.isOpen !== false,
            location: { latitude, longitude, settings },
        };
    },
};

export { getCurrentUser };
