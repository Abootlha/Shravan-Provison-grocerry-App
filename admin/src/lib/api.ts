import { request, type RequestOptions } from './http';
import { clearSession, getAccessToken, SESSION_KEYS } from './session';

export { ApiError, errorMessage, http, isApiError, request } from './http';
export {
    getAdminUser,
    getTokenExpiry,
    isTokenExpired,
    SESSION_END_MESSAGES,
    SessionRefreshUnavailableError,
    type AdminUser,
} from './session';

interface LegacyRequestOptions extends Omit<RequestInit, 'body'> {
    body?: BodyInit | null;
    skipAuth?: boolean;
}

/** Legacy shape used by the older page managers: `body` is a pre-serialised JSON string. */
function apiRequest(endpoint: string, options: LegacyRequestOptions = {}): Promise<any> {
    const { body, ...rest } = options;
    return request<any>(endpoint, { ...(rest as RequestOptions), body: body ?? undefined });
}

/** Authenticated request against the main API (attaches token, refreshes on 401). */
export function authRequest(endpoint: string, options: LegacyRequestOptions = {}): Promise<any> {
    return apiRequest(endpoint, options);
}

function normalizeOrder(order: any) {
    return {
        ...order,
        _id: order._id || order.id || order.orderId,
        id: order.id || order._id || order.orderId,
    };
}

function normalizeRider(rider: any) {
    return {
        ...rider,
        _id: rider._id || rider.id,
        id: rider.id || rider._id,
        status: rider.status || (rider.isOnline ? (rider.isAvailable ? 'available' : 'busy') : 'offline'),
        name: rider.name || rider.userId?.name || rider.fullName || 'Rider',
        phone: rider.phone || rider.userId?.phone || '',
        username: rider.username || '',
        vehicleType: rider.vehicleType || 'Two Wheeler',
        isActive: rider.isActive !== undefined ? rider.isActive : true,
        totalRatings: rider.totalRatings || 0,
        rating: rider.rating || rider.stats?.avgRating || 0,
        totalDeliveries: rider.totalDeliveries || rider.stats?.totalDeliveries || 0,
        acceptanceRate: rider.acceptanceRate || rider.stats?.acceptanceRate || 0,
        createdAt: rider.createdAt || rider.joinedAt || new Date().toISOString(),
        updatedAt: rider.updatedAt || new Date().toISOString(),
    };
}

// Backend caps GET /products `limit` at 100.
const PRODUCTS_PAGE_LIMIT = 100;
// Safety stop for getAllProducts (50 x 100 = 5000 products).
const MAX_PRODUCT_PAGES = 50;

export const api = {
    login: (username: string, password: string) =>
        apiRequest('/auth/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            skipAuth: true,
        }),

    /** Revokes the refresh token server-side (best effort), clears the session, opens /login. */
    logout: async () => {
        const token = getAccessToken();
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEYS.refreshToken) : null;
        try {
            if (token) {
                await request('/auth/logout', {
                    method: 'POST',
                    body: refreshToken ? { refreshToken } : {},
                    skipAuth: true,
                    headers: { Authorization: `Bearer ${token}` },
                });
            }
        } catch {
            // An expired or revoked session must never keep the user signed in locally.
        } finally {
            if (typeof window !== 'undefined') {
                clearSession();
                window.location.href = '/login';
            }
        }
    },

    getCategories: () => apiRequest('/categories'),
    getCategoryTree: () => apiRequest('/categories/nested'),
    getCategory: (id: string) => apiRequest(`/categories/${id}`),
    getSubcategories: (parentId: string) => apiRequest(`/subcategories?parentId=${parentId}`),
    getAllSubcategories: () => apiRequest('/subcategories'),
    createCategory: (data: any) =>
        apiRequest('/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string, data: any) =>
        apiRequest(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id: string) =>
        apiRequest(`/categories/${id}`, { method: 'DELETE' }),
    createSubcategory: (data: any) =>
        apiRequest('/subcategories', { method: 'POST', body: JSON.stringify(data) }),
    updateSubcategory: (id: string, data: any) =>
        apiRequest(`/subcategories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSubcategory: (id: string) =>
        apiRequest(`/subcategories/${id}`, { method: 'DELETE' }),

    getItemGroups: (subcategoryId?: string) => {
        const query = new URLSearchParams();
        if (subcategoryId) query.append('subcategoryId', subcategoryId);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(`/item-groups${suffix}`);
    },
    createItemGroup: (data: any) =>
        apiRequest('/item-groups', { method: 'POST', body: JSON.stringify(data) }),
    updateItemGroup: (id: string, data: any) =>
        apiRequest(`/item-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteItemGroup: (id: string) =>
        apiRequest(`/item-groups/${id}`, { method: 'DELETE' }),

    getProducts: (params?: { categoryId?: string; subcategoryId?: string; page?: number; limit?: number; search?: string }) => {
        const query = new URLSearchParams();
        if (params?.categoryId) query.append('categoryId', params.categoryId);
        if (params?.subcategoryId) query.append('subcategoryId', params.subcategoryId);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));
        if (params?.search) query.append('search', params.search);
        return apiRequest(`/products?${query.toString()}`);
    },
    /**
     * Fetches every product by walking the paginated endpoint (the backend caps
     * `limit` at PRODUCTS_PAGE_LIMIT). Returns the same shape as getProducts.
     */
    getAllProducts: async (params?: { categoryId?: string; subcategoryId?: string; search?: string }) => {
        const products: any[] = [];
        for (let page = 1; page <= MAX_PRODUCT_PAGES; page++) {
            const data = await api.getProducts({ ...params, page, limit: PRODUCTS_PAGE_LIMIT });
            const batch = data.products || [];
            products.push(...batch);
            const totalPages = data.totalPages ?? (batch.length < PRODUCTS_PAGE_LIMIT ? page : page + 1);
            if (page >= totalPages || batch.length === 0) break;
        }
        return { products, total: products.length };
    },
    getProduct: (id: string) => apiRequest(`/products/${id}`),
    lookupBarcode: (barcode: string) => apiRequest(`/products/barcode/${barcode}`),
    getImageProcessingConfig: (): Promise<{ provider: 'none' | 'removebg' | 'local'; enabled: boolean }> =>
        apiRequest('/products/image/processing-config'),
    previewProductImage: (image: string, removeBackground = true): Promise<{
        image: string; width: number; height: number; bytes: number;
        provider: string; backgroundRemoved: boolean; warnings: string[];
    }> =>
        apiRequest('/products/image/preview', { method: 'POST', body: JSON.stringify({ image, removeBackground }) }),
    createProduct: (data: any) =>
        apiRequest('/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id: string, data: any) =>
        apiRequest(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProduct: (id: string) =>
        apiRequest(`/products/${id}`, { method: 'DELETE' }),
    updateStock: (id: string, quantity: number) =>
        apiRequest(`/products/${id}/stock`, { method: 'PUT', body: JSON.stringify({ quantity }) }),

    getOrders: (params?: { status?: string; page?: number }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.page) query.append('page', String(params.page));

        const endpoint = `/admin/orders?${query.toString()}`;
        return apiRequest(endpoint).then((data) => {
            const orders = Array.isArray(data) ? data : data.orders || [];
            return {
                ...data,
                orders: orders.map(normalizeOrder),
                pagination: data.pagination || { pages: data.totalPages || 1 },
            };
        });
    },
    updateOrderStatus: (id: string, status: string) =>
        apiRequest(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    assignRider: (orderId: string, riderId: string) =>
        apiRequest(`/orders/${orderId}/assign-rider`, { method: 'PATCH', body: JSON.stringify({ riderId }) }),

    getRiders: (status?: string) => {
        const endpoint = status ? `/riders?status=${encodeURIComponent(status)}` : '/riders';

        return apiRequest(endpoint).then((data) => ({
            riders: (data.riders || []).map(normalizeRider),
        }));
    },
    getAvailableRiders: () => {
        const endpoint = '/riders/available';
        return apiRequest(endpoint).then((data) => ({
            riders: (data.riders || []).map(normalizeRider),
        }));
    },
    getRiderLocation: (riderId: string) =>
        apiRequest(`/riders/${riderId}`).then((data) => data.rider || data),

    createRider: (data: any) =>
        apiRequest('/riders', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getDailyAnalytics: (date?: string) => {
        const query = new URLSearchParams();
        if (date) query.append('date', date);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(`/admin/analytics/daily${suffix}`);
    },
    getWeeklyAnalytics: (startDate?: string) => {
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(`/admin/analytics/weekly${suffix}`);
    },
    getTopProducts: (limit?: number) => {
        const query = new URLSearchParams();
        if (limit) query.append('limit', String(limit));
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(`/admin/analytics/top-products${suffix}`);
    },

    getStoreSettings: () => apiRequest('/settings/store'),
    updateStoreSettings: (data: any) =>
        apiRequest('/settings/store', { method: 'POST', body: JSON.stringify(data) }),
};