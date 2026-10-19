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
    normalizeHomeFeed,
    normalizeProduct,
    normalizeProductPage,
    normalizeSubcategories,
    UnexpectedResponseError,
} from './normalize';
import { cachedRequest, invalidate, paramsKey } from './requestCache';

// How long a GET answer is reused before the next caller refetches (in-flight calls are always shared).
const TTL = {
    settings: 60 * 1000,
    profile: 30 * 1000,
    orders: 10 * 1000,
};

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
        invalidate(); // a new account may be signing in: drop the previous user's cached answers
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
            invalidate();
            await clearSession();
        }
    },
};

export const ProductService = {
    getCategories: () =>
        cachedRequest('categories', async () => {
            const response = await productApi.get(ENDPOINTS.categories.LIST);
            return normalizeCategories(listFrom(response.data, 'categories', 'GET /categories'));
        }),

    getSubcategories: ({ parentId }) =>
        cachedRequest(`subcategories:${parentId}`, async () => {
            const response = await productApi.get(ENDPOINTS.categories.SUBCATEGORIES(parentId));
            return { subcategories: normalizeSubcategories(listFrom(response.data, 'subcategories', 'GET /subcategories')) };
        }),

    getProducts: (params = {}) =>
        cachedRequest(`products:${paramsKey(params)}`, async () => {
            const response = await productApi.get(ENDPOINTS.products.LIST, { params });
            return normalizeProductPage(response.data);
        }),

    /** Home shelves: every category with in-stock products, top `perCategory` each (GET /products/home). */
    getHome: ({ perCategory = 12 } = {}) =>
        cachedRequest(`home:${perCategory}`, async () => {
            const response = await productApi.get(ENDPOINTS.products.HOME, { params: { perCategory } });
            return normalizeHomeFeed(response.data);
        }),

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
    /** POST /orders/quote: the exact bill POST /orders would charge for these lines (no stock lock). */
    quoteOrder: async (items) => {
        const response = await orderApi.post(ENDPOINTS.orders.QUOTE, { items });
        const body = response.data;
        if (!body || typeof body !== 'object' || !Number.isFinite(Number(body.totalAmount))) {
            throw new UnexpectedResponseError('POST /orders/quote', body);
        }
        return body;
    },

    createOrder: async (orderData) => {
        const response = await orderApi.post(ENDPOINTS.orders.LIST, orderData);
        invalidate('orders:');
        return response.data;
    },

    /** `{ fresh: true }` skips the short reuse window (pull-to-refresh). */
    getOrders: async (userId, { fresh = false } = {}) => {
        if (!userId) {
            return [];
        }
        return cachedRequest(
            `orders:${userId}`,
            async () => {
                const response = await orderApi.get(ENDPOINTS.orders.USER(userId));
                return response.data;
            },
            { ttl: TTL.orders, fresh },
        );
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

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Route reference for a saved address: its server `_id` when it has one, otherwise its
 * array index (mock data or a backend that predates address ids).
 */
export const addressRef = (target) => {
    if (typeof target === 'number') return target;
    if (typeof target === 'string') return OBJECT_ID.test(target) ? target : Number(target);
    const id = target?._id || target?.id;
    if (id && OBJECT_ID.test(String(id))) return String(id);
    const index = target?.originalIndex ?? target?.listIndex;
    if (Number.isInteger(index)) return index;
    throw new Error('Address has no server id or index');
};

// Client-only keys never sent to the address routes.
const CLIENT_ADDRESS_KEYS = ['id', '_id', 'originalIndex', 'listIndex', 'coords'];
const stripClientKeys = (address) => {
    if (!address || typeof address !== 'object') return address;
    const body = { ...address };
    CLIENT_ADDRESS_KEYS.forEach((k) => delete body[k]);
    return body;
};

export const UserService = {
    // eslint-disable-next-line no-unused-vars -- legacy signature
    getProfile: (userId, { fresh = false } = {}) =>
        cachedRequest(
            'users/me',
            async () => {
                const response = await userApi.get(ENDPOINTS.user.PROFILE);
                return response.data;
            },
            { ttl: TTL.profile, fresh },
        ),

    updateProfile: async (data) => {
        const response = await userApi.put(ENDPOINTS.user.PROFILE, data);
        invalidate('users/me');
        return response.data;
    },

    addAddress: async (address) => {
        const response = await userApi.post(ENDPOINTS.user.ADDRESSES, stripClientKeys(address));
        invalidate('users/me');
        return response.data;
    },

    /** `target`: a client address (from toClientAddresses), its _id, or a legacy index. */
    updateAddress: async (target, address) => {
        const response = await userApi.put(ENDPOINTS.user.UPDATE_ADDRESS(addressRef(target)), stripClientKeys(address));
        invalidate('users/me');
        return response.data;
    },

    removeAddress: async (target) => {
        const response = await userApi.delete(ENDPOINTS.user.REMOVE_ADDRESS(addressRef(target)));
        invalidate('users/me');
        return response.data;
    },

    /** PATCH .../:id/default; addresses without a server id (older backend) fall back to PUT by index. */
    setDefaultAddress: async (target) => {
        const ref = addressRef(target);
        const response = typeof ref === 'string'
            ? await userApi.patch(ENDPOINTS.user.SET_DEFAULT_ADDRESS(ref))
            : await userApi.put(ENDPOINTS.user.UPDATE_ADDRESS(ref), { isDefault: true });
        invalidate('users/me');
        return response.data;
    },
};

export const SettingsService = {
    /** GET /settings/store, shared by every screen (one request per minute at most). */
    getStoreSettings: ({ fresh = false } = {}) =>
        cachedRequest(
            'settings/store',
            async () => {
                const response = await locationApi.get('/settings/store');
                const body = response.data;
                if (!body || typeof body !== 'object' || Array.isArray(body)) throw new UnexpectedResponseError('GET /settings/store', body);
                return body;
            },
            { ttl: TTL.settings, fresh },
        ),

    checkServiceability: async (latitude, longitude) => {
        const data = await SettingsService.getStoreSettings();
        const settings = data?.settings || data || {};
        return {
            serviceable: settings.isOpen !== false,
            location: { latitude, longitude, settings },
        };
    },
};

export { getCurrentUser };
