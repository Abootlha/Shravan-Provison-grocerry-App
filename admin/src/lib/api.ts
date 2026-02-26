const API_BASE_URL = 'http://localhost:3000/api/v1';

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
    if (isTokenExpired()) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        localStorage.removeItem('adminRefreshToken');
        localStorage.removeItem('adminLoginTime');
        window.location.href = '/login';
    }
}

export async function apiRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<any> {
    // Check token expiry before making request
    checkTokenExpiry();
    
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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        // Log auth errors and redirect to login
        if (response.status === 401 || response.status === 403) {
            console.error('Auth error:', response.status, 'for', endpoint);
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            localStorage.removeItem('adminRefreshToken');
            localStorage.removeItem('adminLoginTime');
            window.location.href = '/login';
        }
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}

export const api = {
    // Auth
    login: (phone: string, otp: string) =>
        apiRequest('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ phone, otp }),
        }),
    
    logout: async () => {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage regardless of API call result
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            localStorage.removeItem('adminRefreshToken');
            localStorage.removeItem('adminLoginTime');
            window.location.href = '/login';
        }
    },

    // Categories (with subcategories support)
    getCategories: (type?: string) => {
        const query = type ? `?type=${type}` : '';
        return apiRequest(`/categories${query}`);
    },
    getNestedCategories: () => apiRequest('/categories/nested'),
    getSubcategories: (parentId: string) => apiRequest(`/subcategories?parentId=${parentId}`),
    createCategory: (data: any) =>
        apiRequest('/categories', { method: 'POST', body: JSON.stringify(data) }),
    updateCategory: (id: string, data: any) =>
        apiRequest(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteCategory: (id: string) =>
        apiRequest(`/categories/${id}`, { method: 'DELETE' }),

    // Subcategories
    getAllSubcategories: (parentId?: string) => {
        const query = parentId ? `?parentId=${parentId}` : '';
        return apiRequest(`/subcategories${query}`);
    },
    createSubcategory: (data: any) =>
        apiRequest('/subcategories', { method: 'POST', body: JSON.stringify(data) }),
    updateSubcategory: (id: string, data: any) =>
        apiRequest(`/subcategories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSubcategory: (id: string) =>
        apiRequest(`/subcategories/${id}`, { method: 'DELETE' }),

    // Item Groups
    getItemGroups: (subcategoryId?: string) => {
        const query = subcategoryId ? `?subcategoryId=${subcategoryId}` : '';
        return apiRequest(`/item-groups${query}`);
    },
    createItemGroup: (data: any) =>
        apiRequest('/item-groups', { method: 'POST', body: JSON.stringify(data) }),
    updateItemGroup: (id: string, data: any) =>
        apiRequest(`/item-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteItemGroup: (id: string) =>
        apiRequest(`/item-groups/${id}`, { method: 'DELETE' }),

    // Brands
    getBrands: () => apiRequest('/brands'),
    createBrand: (data: { name: string; logo?: string }) =>
        apiRequest('/brands', { method: 'POST', body: JSON.stringify(data) }),
    updateBrand: (id: string, data: any) =>
        apiRequest(`/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBrand: (id: string) =>
        apiRequest(`/brands/${id}`, { method: 'DELETE' }),

    // Products
    getProducts: (params?: { categoryId?: string; subcategoryId?: string; itemGroupId?: string; page?: number; limit?: number }) => {
        const query = new URLSearchParams();
        if (params?.categoryId) query.append('categoryId', params.categoryId);
        if (params?.subcategoryId) query.append('subcategoryId', params.subcategoryId);
        if (params?.itemGroupId) query.append('itemGroupId', params.itemGroupId);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));
        return apiRequest(`/products?${query}`);
    },
    lookupBarcode: (barcode: string) => apiRequest(`/products/barcode/${barcode}`),
    createProduct: (data: any) =>
        apiRequest('/products', { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (id: string, data: any) =>
        apiRequest(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Orders
    getOrders: (params?: { status?: string; page?: number }) => {
        const query = new URLSearchParams();
        if (params?.status) query.append('status', params.status);
        if (params?.page) query.append('page', String(params.page));
        return apiRequest(`/admin/orders?${query}`);
    },
    updateOrderStatus: (id: string, status: string) =>
        apiRequest(`/admin/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),

    // Analytics
    getDailyAnalytics: (date?: string) =>
        apiRequest(`/admin/analytics/daily${date ? `?date=${date}` : ''}`),
    getWeeklyAnalytics: () => apiRequest('/admin/analytics/weekly'),
    getTopProducts: () => apiRequest('/admin/analytics/top-products'),
};

