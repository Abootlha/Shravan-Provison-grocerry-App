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

const IS_MICROSERVICES_MODE = Boolean(
    import.meta.env.PUBLIC_PRODUCT_SERVICE_URL ||
    import.meta.env.PUBLIC_ORDER_SERVICE_URL ||
    import.meta.env.PUBLIC_RIDER_SERVICE_URL ||
    import.meta.env.PUBLIC_AUTH_SERVICE_URL
);

function isTokenExpired(): boolean {
    const token = localStorage.getItem('adminToken');
    const loginTime = localStorage.getItem('adminLoginTime');
    if (!token) return true;
    if (!loginTime) return false;

    const twoHoursInMs = 2 * 60 * 60 * 1000;
    const elapsed = Date.now() - parseInt(loginTime, 10);
    return elapsed > twoHoursInMs;
}

function clearAdminSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminRefreshToken');
    localStorage.removeItem('adminLoginTime');
}

function checkTokenExpiry() {
    if (typeof window === 'undefined') return;

    if (isTokenExpired()) {
        clearAdminSession();
        window.location.href = '/login';
    }
}

async function apiRequest(
    baseUrl: string,
    endpoint: string,
    options: RequestInit = {}
): Promise<any> {
    if (typeof window !== 'undefined') {
        checkTokenExpiry();
    }

    const token = typeof window !== 'undefined'
        ? localStorage.getItem('adminToken')
        : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            if (typeof window !== 'undefined') {
                clearAdminSession();
                window.location.href = '/login';
            }
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

export const api = {
    login: (username: string, password: string) =>
        apiRequest(AUTH_SERVICE, '/auth/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    logout: async () => {
        try {
            await apiRequest(AUTH_SERVICE, '/auth/logout', { method: 'POST' });
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
    getSubcategories: (parentId: string) => apiRequest(PRODUCT_SERVICE, `/categories/${parentId}/subcategories`),
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
    getProduct: (id: string) => apiRequest(PRODUCT_SERVICE, `/products/${id}`),
    lookupBarcode: (barcode: string) => apiRequest(PRODUCT_SERVICE, `/products/barcode/${barcode}`),
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
