import * as React from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { queryClient, queryKeys } from '@/lib/query';
import { getAdminUser } from '@/lib/session';
import type { AdminProductsResponse, Category, ItemGroup, Subcategory } from './types';

/**
 * Catalogue data. The admin lists always ask for inactive records too and the pages filter
 * locally, so a deactivated record never vanishes and the counts stay honest.
 */

export const catalogKeys = {
    categories: [...queryKeys.categories.all, 'admin'] as const,
    subcategories: [...queryKeys.subcategories.all, 'admin'] as const,
    itemGroups: [...queryKeys.itemGroups.all, 'admin'] as const,
    productCount: (field: ProductCountField, id: string) => [...queryKeys.products.all, 'count', field, id] as const,
};

export const fetchCategories = () =>
    http.get<{ categories: Category[] }>('/admin/categories', { params: { includeInactive: true } }).then((r) => r.categories);

export const fetchSubcategories = () =>
    http.get<{ subcategories: Subcategory[] }>('/admin/subcategories', { params: { includeInactive: true } }).then((r) => r.subcategories);

export const fetchItemGroups = () =>
    http.get<{ itemGroups: ItemGroup[] }>('/admin/item-groups', { params: { includeInactive: true } }).then((r) => r.itemGroups);

export function useCategories() {
    return useQuery({ queryKey: catalogKeys.categories, queryFn: fetchCategories });
}

export function useSubcategories() {
    return useQuery({ queryKey: catalogKeys.subcategories, queryFn: fetchSubcategories });
}

export function useItemGroups() {
    return useQuery({ queryKey: catalogKeys.itemGroups, queryFn: fetchItemGroups });
}

export type ProductCountField = 'categoryId' | 'subcategoryId' | 'itemGroupId';

/** Number of products (any status) filed under a catalogue record, from the admin product list total. */
export function fetchProductCount(field: ProductCountField, id: string) {
    return http
        .get<AdminProductsResponse>('/admin/products', { params: { [field]: id, limit: 1, page: 1 } })
        .then((r) => r.total ?? 0);
}

/** Product counts for a handful of records (categories, subcategories). Not used for item groups. */
export function useProductCounts(field: ProductCountField, ids: string[]) {
    const results = useQueries({
        queries: ids.map((id) => ({
            queryKey: catalogKeys.productCount(field, id),
            queryFn: () => fetchProductCount(field, id),
            staleTime: 60_000,
        })),
    });
    const counts: Record<string, number | undefined> = {};
    ids.forEach((id, i) => {
        counts[id] = results[i]?.data;
    });
    return counts;
}

export function productCountQuery(field: ProductCountField, id: string) {
    return queryClient.fetchQuery({
        queryKey: catalogKeys.productCount(field, id),
        queryFn: () => fetchProductCount(field, id),
        staleTime: 30_000,
    });
}

/** Invalidate every catalogue list (a change to one level can change labels in another). */
export function invalidateCatalog() {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.subcategories.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.itemGroups.all }),
    ]);
}

/** Reads `?action=new` / `?id=` once and strips them from the address bar. */
export function takeUrlIntent(): { action: string | null; id: string | null } {
    if (typeof window === 'undefined') return { action: null, id: null };
    const url = new URL(window.location.href);
    const action = url.searchParams.get('action');
    const id = url.searchParams.get('id');
    if (action || id) {
        url.searchParams.delete('action');
        url.searchParams.delete('id');
        window.history.replaceState(window.history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
    return { action, id };
}

/** Optimistically patches one record in a cached list; returns a function that undoes it. */
export function patchCachedRecord<T extends { _id: string }>(queryKey: readonly unknown[], id: string, patch: Partial<T>) {
    const previous = queryClient.getQueryData<T[]>(queryKey);
    queryClient.setQueryData<T[]>(queryKey, (list) => list?.map((item) => (item._id === id ? { ...item, ...patch } : item)));
    return () => queryClient.setQueryData(queryKey, previous);
}

/**
 * Only admins can change the catalogue (managers can read it). Read after mount so the server
 * render and the first client render agree.
 */
export function useCanEditCatalog() {
    const [canEdit, setCanEdit] = React.useState(true);
    React.useEffect(() => {
        const role = getAdminUser()?.role;
        if (role && role !== 'admin') setCanEdit(false);
    }, []);
    return canEdit;
}

/**
 * Applies a new order of the visible rows to the full list: hidden rows keep their slots, the
 * visible rows fill the remaining slots in their new order. Returns ids in final order.
 */
export function mergeVisibleOrder(fullIds: string[], visibleIds: string[]) {
    const visible = new Set(visibleIds);
    const queue = [...visibleIds];
    return fullIds.map((id) => (visible.has(id) ? queue.shift()! : id));
}
