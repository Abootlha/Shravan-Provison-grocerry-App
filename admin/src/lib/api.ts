import { appConfig } from './config';

const API_BASE = appConfig.apiBaseUrl;

const AUTH_SERVICE = appConfig.authServiceUrl;
const PRODUCT_SERVICE = appConfig.productServiceUrl;
const ORDER_SERVICE = appConfig.orderServiceUrl;
const RIDER_SERVICE = appConfig.riderServiceUrl;
const ANALYTICS_SERVICE = appConfig.analyticsServiceUrl;
const SETTINGS_SERVICE = appConfig.settingsServiceUrl;
const SUBCATEGORY_SERVICE = appConfig.subcategoryServiceUrl || PRODUCT_SERVICE;
const ITEM_GROUP_SERVICE = appConfig.itemGroupServiceUrl || PRODUCT_SERVICE;

const IS_MICROSERVICES_MODE = [
    PRODUCT_SERVICE,
    ORDER_SERVICE,
    RIDER_SERVICE,
    AUTH_SERVICE,
].some((serviceUrl) => serviceUrl !== API_BASE
);

// Session tokens live in localStorage. Accepted risk: the admin is a static Astro build with
// no server of its own, so httpOnly cookies are not an option; an XSS bug would expose tokens.
// Keep third-party scripts out of the admin and keep access tokens short-lived.
const TOKEN_KEY = 'adminToken';
const REFRESH_TOKEN_KEY = 'adminRefreshToken';
const USER_KEY = 'adminUser';
const LOGIN_TIME_KEY = 'adminLoginTime';
const LEGACY_SESSION_MS = 2 * 60 * 60 * 1000;
const EXPIRY_SKEW_MS = 5_000;

/** Returns the JWT `exp` claim in milliseconds, or null if the token can't be decoded. */
export function getTokenExpiry(token: string): number | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const claims = JSON.parse(atob(padded));
        return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
    } catch {
        return null;
    }
}

export function isTokenExpired(token: string | null = localStorage.getItem(TOKEN_KEY)): boolean {
    if (!token) return true;

    const exp = getTokenExpiry(token);
    if (exp !== null) return Date.now() >= exp - EXPIRY_SKEW_MS;

    // Opaque token: fall back to login time; no login time means we can't vouch for it.
    const loginTime = parseInt(localStorage.getItem(LOGIN_TIME_KEY) || '', 10);
    if (!Number.isFinite(loginTime)) return true;
    return Date.now() - loginTime > LEGACY_SESSION_MS;
}

function clearAdminSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(LOGIN_TIME_KEY);
}

function redirectToLogin() {
    if (typeof window === 'undefined') return;
    clearAdminSession();
    if (window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchanges the refresh token for a new token pair. Concurrent callers share one request
 * so a burst of 401s triggers a single refresh.
 */
function refreshAccessToken(): Promise<string | null> {
    if (refreshInFlight) return refreshInFlight;

    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return Promise.resolve(null);

    refreshInFlight = (async () => {
        try {
            const response = await fetch(`${AUTH_SERVICE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });
            if (!response.ok) return null;

            const data = await response.json();
            if (!data?.accessToken) return null;

            localStorage.setItem(TOKEN_KEY, data.accessToken);
            if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
            localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
            return data.accessToken as string;
        } catch {
            return null;
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

/** Returns a usable access token, refreshing it first if it has expired. */
async function getValidAccessToken(): Promise<string | null> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !isTokenExpired(token)) return token;
    return refreshAccessToken();
}

interface RequestOptions extends RequestInit {
    /** Skip attaching/refreshing the access token (login, refresh). */
    skipAuth?: boolean;
}

async function apiRequest(
    baseUrl: string,
    endpoint: string,
    options: RequestOptions = {}
): Promise<any> {
    const { skipAuth = false, ...init } = options;
    const inBrowser = typeof window !== 'undefined';

    let token: string | null = null;
    if (inBrowser && !skipAuth) {
        token = await getValidAccessToken();
        if (!token) {
            redirectToLogin();
            throw new Error('Session expired');
        }
    }

    const send = (accessToken: string | null) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(init.headers as Record<string, string>),
        };
        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }
        return fetch(`${baseUrl}${endpoint}`, { ...init, headers });
    };

    let response = await send(token);

    if (response.status === 401 && inBrowser && !skipAuth) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            response = await send(refreshed);
        }
    }

    if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && inBrowser && !skipAuth) {
            redirectToLogin();
        }

        let detail = '';
        try {
            detail = await response.text();
        } catch {
            detail = '';
        }
        throw new Error(`API Error: ${response.status}${detail ? ` ${detail}` : ''}`);
    }

    return response.json();
}

/** Authenticated request against the main API (attaches token, refreshes on 401). */
export function authRequest(endpoint: string, options: RequestOptions = {}): Promise<any> {
    return apiRequest(API_BASE, endpoint, options);
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
        apiRequest(AUTH_SERVICE, '/auth/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            skipAuth: true,
        }),

    logout: async () => {
        // Best effort: revoke the refresh token server-side, but never let a failure
        // (or an expired session) keep the user logged in locally.
        const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
        try {
            if (token) {
                await fetch(`${AUTH_SERVICE}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            if (typeof window !== 'undefined') {
                clearAdminSession();
                window.location.href = '/login';
            }
        }
    },

    getCategories: () => apiRequest(PRODUCT_SERVICE, '/categories'),
    getCategoryTree: () => apiRequest(PRODUCT_SERVICE, IS_MICROSERVICES_MODE ? '/categories/tree' : '/categories/nested'),
    getCategory: (id: string) => apiRequest(PRODUCT_SERVICE, `/categories/${id}`),
    getSubcategories: (parentId: string) => apiRequest(SUBCATEGORY_SERVICE, `/subcategories?parentId=${parentId}`),
    getAllSubcategories: () => apiRequest(SUBCATEGORY_SERVICE, '/subcategories'),
    createCategory: (data: any) =>
        apiRequest(PRODUCT_SERVICE, '/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string, data: any) =>
        apiRequest(PRODUCT_SERVICE, `/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id: string) =>
        apiRequest(PRODUCT_SERVICE, `/categories/${id}`, { method: 'DELETE' }),
    createSubcategory: (data: any) =>
        apiRequest(SUBCATEGORY_SERVICE, '/subcategories', { method: 'POST', body: JSON.stringify(data) }),
    updateSubcategory: (id: string, data: any) =>
        apiRequest(SUBCATEGORY_SERVICE, `/subcategories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSubcategory: (id: string) =>
        apiRequest(SUBCATEGORY_SERVICE, `/subcategories/${id}`, { method: 'DELETE' }),

    getItemGroups: (subcategoryId?: string) => {
        const query = new URLSearchParams();
        if (subcategoryId) query.append('subcategoryId', subcategoryId);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(ITEM_GROUP_SERVICE, `/item-groups${suffix}`);
    },
    createItemGroup: (data: any) =>
        apiRequest(ITEM_GROUP_SERVICE, '/item-groups', { method: 'POST', body: JSON.stringify(data) }),
    updateItemGroup: (id: string, data: any) =>
        apiRequest(ITEM_GROUP_SERVICE, `/item-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteItemGroup: (id: string) =>
        apiRequest(ITEM_GROUP_SERVICE, `/item-groups/${id}`, { method: 'DELETE' }),

    getProducts: (params?: { categoryId?: string; subcategoryId?: string; page?: number; limit?: number; search?: string }) => {
        const query = new URLSearchParams();
        if (params?.categoryId) query.append('categoryId', params.categoryId);
        if (params?.subcategoryId) query.append('subcategoryId', params.subcategoryId);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));
        if (params?.search) query.append('search', params.search);
        return apiRequest(PRODUCT_SERVICE, `/products?${query.toString()}`);
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
    getProduct: (id: string) => apiRequest(PRODUCT_SERVICE, `/products/${id}`),
    lookupBarcode: (barcode: string) => apiRequest(PRODUCT_SERVICE, `/products/barcode/${barcode}`),
    getImageProcessingConfig: (): Promise<{ provider: 'none' | 'removebg' | 'local'; enabled: boolean }> =>
        apiRequest(PRODUCT_SERVICE, '/products/image/processing-config'),
    previewProductImage: (image: string, removeBackground = true): Promise<{
        image: string; width: number; height: number; bytes: number;
        provider: string; backgroundRemoved: boolean; warnings: string[];
    }> =>
        apiRequest(PRODUCT_SERVICE, '/products/image/preview', { method: 'POST', body: JSON.stringify({ image, removeBackground }) }),
    createProduct: (data: any) =>
        apiRequest(PRODUCT_SERVICE, '/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id: string, data: any) =>
        apiRequest(PRODUCT_SERVICE, `/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProduct: (id: string) =>
        apiRequest(PRODUCT_SERVICE, `/products/${id}`, { method: 'DELETE' }),
    updateStock: (id: string, quantity: number) =>
        apiRequest(PRODUCT_SERVICE, `/products/${id}/stock`, { method: 'PUT', body: JSON.stringify({ quantity }) }),

    getOrders: (params?: { status?: string; page?: number }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.page) query.append('page', String(params.page));

        const endpoint = IS_MICROSERVICES_MODE ? `/orders?${query.toString()}` : `/admin/orders?${query.toString()}`;
        return apiRequest(ORDER_SERVICE, endpoint).then((data) => {
            const orders = Array.isArray(data) ? data : data.orders || [];
            return {
                ...data,
                orders: orders.map(normalizeOrder),
                pagination: data.pagination || { pages: data.totalPages || 1 },
            };
        });
    },
    updateOrderStatus: (id: string, status: string) =>
        apiRequest(
            ORDER_SERVICE,
            IS_MICROSERVICES_MODE ? '/orders/status' : `/admin/orders/${id}/status`,
            {
                method: 'PATCH',
                body: JSON.stringify(IS_MICROSERVICES_MODE ? { orderId: id, newStatus: status } : { status }),
            }
        ),
    assignRider: (orderId: string, riderId: string) =>
        apiRequest(
            ORDER_SERVICE,
            IS_MICROSERVICES_MODE ? '/orders/assign-rider' : `/orders/${orderId}/assign-rider`,
            {
                method: 'PATCH',
                body: JSON.stringify(IS_MICROSERVICES_MODE ? { orderId, riderId } : { riderId }),
            }
        ),

    getRiders: (status?: string) => {
        const endpoint = IS_MICROSERVICES_MODE
            ? (status ? `/riders?status=${encodeURIComponent(status)}` : '/riders')
            : (status ? `/riders?status=${encodeURIComponent(status)}` : '/riders');

        return apiRequest(RIDER_SERVICE, endpoint).then((data) => ({
            riders: (data.riders || []).map(normalizeRider),
        }));
    },
    getAvailableRiders: () => {
        const endpoint = IS_MICROSERVICES_MODE ? '/riders?status=available' : '/riders/available';
        return apiRequest(RIDER_SERVICE, endpoint).then((data) => ({
            riders: (data.riders || []).map(normalizeRider),
        }));
    },
    getRiderLocation: (riderId: string) =>
        apiRequest(RIDER_SERVICE, `/riders/${riderId}`).then((data) => data.rider || data),

    createRider: (data: any) =>
        apiRequest(RIDER_SERVICE, '/riders', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getDailyAnalytics: (date?: string) => {
        const query = new URLSearchParams();
        if (date) query.append('date', date);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(ANALYTICS_SERVICE, `/admin/analytics/daily${suffix}`);
    },
    getWeeklyAnalytics: (startDate?: string) => {
        const query = new URLSearchParams();
        if (startDate) query.append('startDate', startDate);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(ANALYTICS_SERVICE, `/admin/analytics/weekly${suffix}`);
    },
    getTopProducts: (limit?: number) => {
        const query = new URLSearchParams();
        if (limit) query.append('limit', String(limit));
        const suffix = query.toString() ? `?${query.toString()}` : '';
        return apiRequest(ANALYTICS_SERVICE, `/admin/analytics/top-products${suffix}`);
    },

    getStoreSettings: () => apiRequest(SETTINGS_SERVICE, '/settings/store'),
    updateStoreSettings: (data: any) =>
        apiRequest(SETTINGS_SERVICE, '/settings/store', { method: 'POST', body: JSON.stringify(data) }),
};