const AUTH_SERVICE = 'http://localhost:8001';
const PRODUCT_SERVICE = 'http://localhost:8005/api/v1';
const ORDER_SERVICE = 'http://localhost:9004';
const RIDER_SERVICE = 'http://localhost:8003';

// Check if token is expired (2 hours)
function isTokenExpired(): boolean {
    const loginTime = localStorage.getItem('adminLoginTime');
    if (!loginTime) return true;
    
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    const elapsed = Date.now() - parseInt(loginTime);
    return elapsed > twoHoursInMs;
}

// Auto logout if token expired
function checkTokenExpiry() {
    if (typeof window === 'undefined') return;
    
    if (isTokenExpired()) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        localStorage.removeItem('adminRefreshToken');
        localStorage.removeItem('adminLoginTime');
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
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminRefreshToken');
                localStorage.removeItem('adminLoginTime');
                window.location.href = '/login';
            }
        }
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}

export const api = {
    // Auth
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
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                localStorage.removeItem('adminRefreshToken');
                localStorage.removeItem('adminLoginTime');
                window.location.href = '/login';
            }
        }
    },

    // Categories - product-svc returns { categories: [...] }
    getCategories: () => apiRequest(PRODUCT_SERVICE, '/categories'),
    getCategoryTree: () => apiRequest(PRODUCT_SERVICE, '/categories/tree'),
    getCategory: (id: string) => apiRequest(PRODUCT_SERVICE, `/categories/${id}`),
    getSubcategories: (parentId: string) => apiRequest(PRODUCT_SERVICE, `/categories/${parentId}/subcategories`),
    createCategory: (data: any) =>
        apiRequest(PRODUCT_SERVICE, '/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string, data: any) =>
        apiRequest(PRODUCT_SERVICE, `/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id: string) =>
        apiRequest(PRODUCT_SERVICE, `/categories/${id}`, { method: 'DELETE' }),

    // Products - product-svc returns { products: [...], total, page, limit, totalPages }
    getProducts: (params?: { categoryId?: string; subcategoryId?: string; page?: number; limit?: number; search?: string }) => {
        const query = new URLSearchParams();
        if (params?.categoryId) query.append('categoryId', params.categoryId);
        if (params?.subcategoryId) query.append('subcategoryId', params.subcategoryId);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));
        if (params?.search) query.append('search', params.search);
        return apiRequest(PRODUCT_SERVICE, `/products?${query}`);
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

    // Orders
    getOrders: (params?: { status?: string; page?: number }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.page) query.append('page', String(params.page));
        return apiRequest(ORDER_SERVICE, `/orders?${query}`);
    },
    updateOrderStatus: (id: string, status: string) =>
        apiRequest(ORDER_SERVICE, `/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),
    assignRider: (orderId: string, riderId: string) =>
        apiRequest(ORDER_SERVICE, `/orders/${orderId}/assign-rider`, {
            method: 'PATCH',
            body: JSON.stringify({ riderId }),
        }),

    // Riders
    getRiders: () => Promise.resolve({ riders: [] }), // Endpoint not implemented
    getAvailableRiders: () => Promise.resolve({ riders: [] }),
    getRiderLocation: (riderId: string) => Promise.resolve({ riderId, location: null }),
};
