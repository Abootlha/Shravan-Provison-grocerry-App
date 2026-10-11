import {
    authApi,
    userApi,
    productApi,
    cartApi,
    orderApi,
    locationApi,
    ensureFreshAccessToken,
} from './api';
import { ENDPOINTS } from './config';
import { getRefreshToken, clearSession } from './tokenStorage';
import {
    listFrom,
    normalizeCategories,
    normalizeProduct,
    normalizeProductPage,
    normalizeSubcategories,
    UnexpectedResponseError,
} from './normalize';

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

    // Revokes the session server-side (best effort), then always clears local tokens.
    logout: async () => {
        try {
            // /auth/logout needs a live access token to find this device's session;
            // renew a stale one first so the server-side session really ends.
            await ensureFreshAccessToken().catch(() => undefined);
            const refreshToken = await getRefreshToken();
            await authApi.post(ENDPOINTS.auth.LOGOUT, { refreshToken: refreshToken || undefined });
        } finally {
            await clearSession();
        }
    },
};

export const ProductService = {
    getCategories: async () => {
        const response = await productApi.get(ENDPOINTS.categories.LIST);
        return normalizeCategories(listFrom(response.data, 'categories', 'GET /categories'));
    },

    getSubcategories: async ({ parentId }) => {
        const response = await productApi.get(ENDPOINTS.categories.SUBCATEGORIES(parentId));
        return { subcategories: normalizeSubcategories(listFrom(response.data, 'subcategories', 'GET /subcategories')) };
    },

    getProducts: async (params = {}) => {
        const response = await productApi.get(ENDPOINTS.products.LIST, { params });
        return normalizeProductPage(response.data);
    },

    getProductById: async (id) => {
        const response = await productApi.get(ENDPOINTS.products.DETAIL(id));
        const body = response.data;
        const product = normalizeProduct(body?.product || body);
        if (!product) throw new UnexpectedResponseError(`GET /products/${id}`, body);
        return product;
    },

    searchProducts: async (query, params = {}) => {
        const response = await productApi.get(ENDPOINTS.products.LIST, { params: { search: query, ...params } });
        return normalizeProductPage(response.data, 'GET /products?search');
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

    updateProfile: async (data) => {
        const response = await userApi.put(ENDPOINTS.user.PROFILE, data);
        return response.data;
    },

    addAddress: async (address) => {
        const response = await userApi.post(ENDPOINTS.user.ADDRESSES, address);
        return response.data;
    },

    updateAddress: async (index, address) => {
        const response = await userApi.put(ENDPOINTS.user.UPDATE_ADDRESS(index), address);
        return response.data;
    },

    removeAddress: async (index) => {
        const response = await userApi.delete(ENDPOINTS.user.REMOVE_ADDRESS(index));
        return response.data;
    },
};

export const SettingsService = {
    getStoreSettings: async () => {
        const response = await locationApi.get('/settings/store');
        const body = response.data;
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new UnexpectedResponseError('GET /settings/store', body);
        return body;
    },

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
