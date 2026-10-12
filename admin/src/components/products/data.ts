import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryClient, queryKeys } from '@/lib/query';
import { getAdminUser } from '@/lib/session';
import type { AdminProduct, Category, ItemGroup, ProductCounts, ProductStatus, ProductsResponse, Subcategory } from './types';

export interface ProductListParams {
    page: number;
    limit: number;
    q?: string;
    status?: ProductStatus;
    categoryId?: string;
    subcategoryId?: string;
    stock?: 'low' | 'out';
    needsAttention?: boolean;
    sort?: string;
}

export const productKeys = {
    all: queryKeys.products.all,
    list: (params: ProductListParams) => queryKeys.products.list(params),
    counts: [...queryKeys.products.all, 'counts'] as const,
    detail: (id: string) => queryKeys.products.detail(id),
    adjustments: (id: string) => [...queryKeys.products.all, 'adjustments', id] as const,
};

export function fetchProducts(params: ProductListParams, signal?: AbortSignal) {
    return http.get<ProductsResponse>('/admin/products', {
        params: { ...params, needsAttention: params.needsAttention ? true : undefined },
        signal,
    });
}

export function useProducts(params: ProductListParams) {
    return useQuery({
        queryKey: productKeys.list(params),
        queryFn: ({ signal }) => fetchProducts(params, signal),
        placeholderData: (prev) => prev,
    });
}

export function useProductCounts() {
    return useQuery({
        queryKey: productKeys.counts,
        queryFn: ({ signal }) => http.get<ProductCounts>('/admin/products/counts', { signal }),
    });
}

export function useProduct(id: string | null) {
    return useQuery({
        queryKey: productKeys.detail(id ?? ''),
        queryFn: ({ signal }) => http.get<{ product: AdminProduct }>(`/admin/products/${id}`, { signal }).then((r) => r.product),
        enabled: !!id,
        staleTime: 0,
    });
}

/** Admin lists (include inactive so existing products keep their labels). Cached for 5 minutes. */
export function useCategories() {
    return useQuery({
        queryKey: [...queryKeys.categories.all, 'admin-list'],
        queryFn: ({ signal }) => http.get<{ categories: Category[] }>('/admin/categories', { params: { includeInactive: true }, signal }).then((r) => r.categories),
        staleTime: 5 * 60_000,
    });
}

export function useSubcategories() {
    return useQuery({
        queryKey: [...queryKeys.subcategories.all, 'admin-list'],
        queryFn: ({ signal }) =>
            http.get<{ subcategories: Subcategory[] }>('/admin/subcategories', { params: { includeInactive: true }, signal }).then((r) => r.subcategories),
        staleTime: 5 * 60_000,
    });
}

export function useItemGroups() {
    return useQuery({
        queryKey: [...queryKeys.itemGroups.all, 'admin-list'],
        queryFn: ({ signal }) =>
            http.get<{ itemGroups: ItemGroup[] }>('/admin/item-groups', { params: { includeInactive: true }, signal }).then((r) => r.itemGroups),
        staleTime: 5 * 60_000,
    });
}

export function invalidateProducts() {
    return queryClient.invalidateQueries({ queryKey: productKeys.all });
}

/** Catalogue writes (create, edit, status) are admin-only; managers can still adjust stock. */
export function canEditCatalogue() {
    if (typeof window === 'undefined') return true;
    const role = getAdminUser()?.role;
    return !role || role === 'admin';
}
