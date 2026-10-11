import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCategories, useItemGroups, useSubcategories } from './api';

const LEVELS = [
    { key: 'categories', label: 'Categories', href: '/categories' },
    { key: 'subcategories', label: 'Subcategories', href: '/subcategories' },
    { key: 'item-groups', label: 'Item groups', href: '/item-groups' },
] as const;

export type CatalogLevel = (typeof LEVELS)[number]['key'];

/**
 * The three catalogue levels as one strip, so the hierarchy reads left to right. Counts are the
 * real list lengths (all records, hidden included) from the shared query cache.
 */
export function CatalogNav({ current }: { current: CatalogLevel }) {
    const categories = useCategories();
    const subcategories = useSubcategories();
    const itemGroups = useItemGroups();
    const counts: Record<CatalogLevel, number | undefined> = {
        categories: categories.data?.length,
        subcategories: subcategories.data?.length,
        'item-groups': itemGroups.data?.length,
    };
    return (
        <nav aria-label="Catalogue levels" className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ol className="inline-flex min-w-max items-center gap-1 rounded-lg bg-muted p-[3px]">
                {LEVELS.map((level, i) => {
                    const active = level.key === current;
                    return (
                        <li key={level.key} className="flex items-center">
                            <a
                                href={level.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                                    active ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <span className="sr-only">Level {i + 1}: </span>
                                {level.label}
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {counts[level.key] === undefined ? '' : formatNumber(counts[level.key])}
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
