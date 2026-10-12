import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { Thumb } from '@/components/catalog/parts';
import type { AdminProductsResponse, ProductSummary } from '@/components/catalog/types';

export function useProduct(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.products.detail(id ?? ''),
        queryFn: () => http.get<{ product: ProductSummary | null }>(`/admin/products/${id}`).then((r) => r.product),
        enabled: !!id,
        staleTime: 5 * 60_000,
    });
}

function useDebounced<T>(value: T, ms: number) {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), ms);
        return () => window.clearTimeout(t);
    }, [value, ms]);
    return debounced;
}

/** Searches the live catalogue (admin product list) and returns one product id. */
export function ProductPicker({
    id,
    value,
    onChange,
    invalid,
    describedBy,
}: {
    id: string;
    value: string;
    onChange: (productId: string) => void;
    invalid?: boolean;
    describedBy?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const q = useDebounced(search.trim(), 250);
    const selected = useProduct(value || undefined);
    const results = useQuery({
        queryKey: queryKeys.products.list({ q, limit: 8, purpose: 'banner-picker' }),
        queryFn: ({ signal }) => http.get<AdminProductsResponse>('/admin/products', { params: { q, limit: 8, page: 1 }, signal }),
        enabled: open,
        placeholderData: (prev) => prev,
    });

    const label = value ? (selected.data?.name ?? (selected.isPending ? 'Loading product…' : 'Product not found')) : 'Choose a product';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className="w-full justify-between bg-card font-normal"
                >
                    <span className="flex min-w-0 items-center gap-2">
                        {value && selected.data ? <Thumb src={selected.data.image} name={selected.data.name} size="sm" className="size-6" /> : null}
                        <span className={cn('truncate', !value && 'text-muted-foreground')}>{label}</span>
                    </span>
                    <ChevronsUpDown className="opacity-50" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
                <Command shouldFilter={false}>
                    <CommandInput value={search} onValueChange={setSearch} placeholder="Search by name, brand or SKU" />
                    <CommandList>
                        {results.isFetching && !results.data ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                                Searching…
                            </div>
                        ) : (
                            <CommandEmpty>{results.isError ? 'Could not search products. Try again.' : 'No products match.'}</CommandEmpty>
                        )}
                        {results.data?.products.length ? (
                            <CommandGroup heading={q ? `Matches for “${q}”` : 'Recently updated'}>
                                {results.data.products.map((p) => (
                                    <CommandItem
                                        key={p._id}
                                        value={p._id}
                                        onSelect={() => {
                                            onChange(p._id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Thumb src={p.image} name={p.name} size="sm" />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate">{p.name}</span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {[p.brand, p.unit, p.status && p.status !== 'active' ? p.status : null].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                        <Check className={cn('ml-auto', value === p._id ? 'opacity-100' : 'opacity-0')} aria-hidden />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ) : null}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
