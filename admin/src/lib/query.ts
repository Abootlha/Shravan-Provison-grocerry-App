import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './http';

/**
 * One QueryClient for the whole page. Astro hydrates every island as its own React root,
 * but they import this module from the same bundle, so they all share this cache: a
 * mutation in one island can invalidate a query rendered by another.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            // Client errors (bad input, no permission, not found) will not fix themselves.
            retry: (failureCount, error) => {
                if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
                return failureCount < 1;
            },
        },
        mutations: {
            retry: false,
        },
    },
});

/** Query-key factory roots. Page agents extend these instead of inventing ad-hoc keys. */
export const queryKeys = {
    me: ['me'] as const,
    orders: {
        all: ['orders'] as const,
        list: (params: object) => ['orders', 'list', params] as const,
        detail: (id: string) => ['orders', 'detail', id] as const,
    },
    products: {
        all: ['products'] as const,
        list: (params: object) => ['products', 'list', params] as const,
        detail: (id: string) => ['products', 'detail', id] as const,
    },
    categories: {
        all: ['categories'] as const,
        tree: ['categories', 'tree'] as const,
    },
    subcategories: { all: ['subcategories'] as const },
    itemGroups: { all: ['item-groups'] as const },
    riders: { all: ['riders'] as const, list: (params: object) => ['riders', 'list', params] as const },
    customers: { all: ['customers'] as const, list: (params: object) => ['customers', 'list', params] as const },
    banners: { all: ['banners'] as const },
    settings: { store: ['settings', 'store'] as const },
    analytics: { all: ['analytics'] as const },
};
