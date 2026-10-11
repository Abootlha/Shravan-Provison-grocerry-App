import * as React from 'react';
import { registerSearchProvider } from '@/components/shell/command-registry';
import { queryClient } from '@/lib/query';
import { catalogKeys, fetchCategories, fetchItemGroups, fetchSubcategories } from './api';
import { refName } from './types';

function matches(query: string, ...values: (string | undefined)[]) {
    const q = query.trim().toLowerCase();
    return values.some((v) => v?.toLowerCase().includes(q));
}

/**
 * ⌘K search over the catalogue while a catalogue page is open. Uses the same cached lists the
 * page shows, so typing never fires extra requests once the page has loaded.
 */
export function useCatalogSearch() {
    React.useEffect(() => {
        const offCategories = registerSearchProvider({
            id: 'catalog-categories',
            group: 'Categories',
            minQueryLength: 1,
            search: async (q) => {
                const list = await queryClient.fetchQuery({ queryKey: catalogKeys.categories, queryFn: fetchCategories });
                return list
                    .filter((c) => matches(q, c.name, c.nameHi, c.group))
                    .slice(0, 6)
                    .map((c) => ({
                        id: `category-${c._id}`,
                        label: c.name,
                        group: 'Categories',
                        hint: c.isActive ? c.group || undefined : 'Hidden',
                        href: `/categories?id=${c._id}`,
                    }));
            },
        });
        const offSubcategories = registerSearchProvider({
            id: 'catalog-subcategories',
            group: 'Subcategories',
            minQueryLength: 2,
            search: async (q) => {
                const list = await queryClient.fetchQuery({ queryKey: catalogKeys.subcategories, queryFn: fetchSubcategories });
                return list
                    .filter((s) => matches(q, s.name, s.nameHi))
                    .slice(0, 6)
                    .map((s) => ({
                        id: `subcategory-${s._id}`,
                        label: s.name,
                        group: 'Subcategories',
                        hint: s.isActive ? refName(s.parentId) : 'Hidden',
                        href: `/subcategories?id=${s._id}`,
                    }));
            },
        });
        const offItemGroups = registerSearchProvider({
            id: 'catalog-item-groups',
            group: 'Item groups',
            minQueryLength: 2,
            search: async (q) => {
                const list = await queryClient.fetchQuery({ queryKey: catalogKeys.itemGroups, queryFn: fetchItemGroups });
                return list
                    .filter((g) => matches(q, g.name, ...(g.tags ?? [])))
                    .slice(0, 6)
                    .map((g) => ({
                        id: `item-group-${g._id}`,
                        label: g.name,
                        group: 'Item groups',
                        hint: g.isActive ? refName(g.subcategoryId) : 'Hidden',
                        href: `/item-groups?id=${g._id}`,
                    }));
            },
        });
        return () => {
            offCategories();
            offSubcategories();
            offItemGroups();
        };
    }, []);
}
