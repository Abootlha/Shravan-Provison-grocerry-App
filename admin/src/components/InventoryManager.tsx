import * as React from 'react';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { Boxes, History, Plus, Search, SearchX, X } from 'lucide-react';
import { DataTable, DataTableColumnHeader, DateTime, EmptyState, PageContainer, PageHeader, withProviders } from '@/components/shared';
import { registerSearchProvider } from '@/components/shell/command-registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AdjustStockDialog, type StockTarget } from './inventory/AdjustStockDialog';
import { ReorderLevelCell } from './inventory/ReorderLevelCell';
import { StockHistorySheet } from './inventory/StockHistorySheet';
import { fetchProducts, useCategories, useProductCounts, useProducts, type ProductListParams } from './products/data';
import { ProductThumb, StockCell } from './products/ProductBits';
import { productImage, productStatus, productUnit, refName, type AdminProduct, type ProductStatus } from './products/types';

type StockFilter = 'all' | 'low' | 'out';
type StatusFilter = 'active' | 'draft' | 'all';

const SORTABLE = new Set(['name', 'stock', 'soldCount', 'updatedAt']);

function readUrl(): { stock: StockFilter; q: string } {
    if (typeof window === 'undefined') return { stock: 'all', q: '' };
    const p = new URLSearchParams(window.location.search);
    const f = p.get('filter') ?? p.get('stock');
    return { stock: f === 'low' || f === 'out' ? f : 'all', q: p.get('q') ?? '' };
}

function toTarget(p: AdminProduct): StockTarget {
    return { _id: p._id, name: p.name, stock: p.stock, reorderLevel: p.reorderLevel, unit: productUnit(p) };
}

function InventoryManager() {
    const initial = React.useMemo(readUrl, []);
    const [stock, setStock] = React.useState<StockFilter>(initial.stock);
    const [status, setStatus] = React.useState<StatusFilter>('active');
    const [search, setSearch] = React.useState(initial.q);
    const [q, setQ] = React.useState(initial.q);
    const [categoryId, setCategoryId] = React.useState('');
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
    const [sorting, setSorting] = React.useState<SortingState>([{ id: 'stock', desc: false }]);
    const [adjusting, setAdjusting] = React.useState<StockTarget | null>(null);
    const [history, setHistory] = React.useState<StockTarget | null>(null);

    React.useEffect(() => {
        const t = setTimeout(() => setQ(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    const sort = sorting[0] && SORTABLE.has(sorting[0].id) ? `${sorting[0].desc ? '-' : ''}${sorting[0].id}` : undefined;
    const params: ProductListParams = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        q: q || undefined,
        status: status === 'all' ? undefined : (status as ProductStatus),
        categoryId: categoryId || undefined,
        stock: stock === 'all' ? undefined : stock,
        sort,
    };
    const products = useProducts(params);
    const counts = useProductCounts();
    const categories = useCategories();

    const filterKey = JSON.stringify([stock, status, q, categoryId, sort]);
    const first = React.useRef(true);
    React.useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, [filterKey]);

    React.useEffect(() => {
        const url = new URL(window.location.href);
        if (stock === 'all') url.searchParams.delete('filter');
        else url.searchParams.set('filter', stock);
        url.searchParams.delete('stock');
        if (q) url.searchParams.set('q', q);
        else url.searchParams.delete('q');
        window.history.replaceState(window.history.state, '', url);
    }, [stock, q]);

    React.useEffect(
        () =>
            registerSearchProvider({
                id: 'products',
                group: 'Products',
                minQueryLength: 2,
                search: async (query, signal) =>
                    (await fetchProducts({ page: 1, limit: 8, q: query }, signal)).products.map((p) => ({
                        id: `product-${p._id}`,
                        label: p.name,
                        group: 'Products',
                        hint: `${formatNumber(p.stock)} in stock`,
                        href: `/products?id=${p._id}`,
                    })),
            }),
        [],
    );

    // Keep the open dialogs in sync with the refreshed row (stock changes after an adjustment).
    const rows = products.data?.products;
    React.useEffect(() => {
        if (!rows) return;
        setHistory((h) => {
            const fresh = h && rows.find((r) => r._id === h._id);
            return fresh ? toTarget(fresh) : h;
        });
    }, [rows]);

    const columns = React.useMemo<ColumnDef<AdminProduct>[]>(
        () => [
            {
                id: 'name',
                accessorKey: 'name',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
                enableHiding: false,
                meta: { className: 'min-w-[11rem] max-w-[24rem] whitespace-normal py-2', label: 'Product' },
                cell: ({ row }) => {
                    const p = row.original;
                    return (
                        <div className="flex items-center gap-3">
                            <ProductThumb src={productImage(p)} alt="" size={40} />
                            <div className="min-w-0">
                                <p className="line-clamp-2 leading-snug font-medium">{p.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {[productUnit(p).replace(/\s+/g, ' '), productStatus(p) !== 'active' ? (productStatus(p) === 'draft' ? 'Draft' : 'Archived') : ''].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        </div>
                    );
                },
            },
            {
                id: 'category',
                header: 'Category',
                enableSorting: false,
                meta: { label: 'Category', className: 'hidden max-w-[12rem] truncate text-muted-foreground lg:table-cell', headerClassName: 'hidden lg:table-cell' },
                cell: ({ row }) => refName(row.original.categoryId) || '—',
            },
            {
                id: 'stock',
                accessorKey: 'stock',
                header: ({ column }) => <DataTableColumnHeader column={column} title="In stock" />,
                meta: { align: 'right', label: 'In stock' },
                cell: ({ row }) => <StockCell stock={row.original.stock} reorderLevel={row.original.reorderLevel} state={row.original.stockState} />,
            },
            {
                id: 'reorderLevel',
                header: 'Reorder at',
                enableSorting: false,
                meta: { align: 'right', label: 'Reorder at' },
                cell: ({ row }) => <ReorderLevelCell productId={row.original._id} name={row.original.name} value={row.original.reorderLevel ?? 10} />,
            },
            {
                id: 'soldCount',
                accessorKey: 'soldCount',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Sold" />,
                meta: { align: 'right', label: 'Sold', className: 'hidden text-muted-foreground md:table-cell', headerClassName: 'hidden md:table-cell' },
                cell: ({ row }) => formatNumber(row.original.soldCount ?? 0),
            },
            {
                id: 'updatedAt',
                accessorKey: 'updatedAt',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Updated" />,
                meta: { label: 'Updated', className: 'hidden whitespace-nowrap text-muted-foreground xl:table-cell', headerClassName: 'hidden xl:table-cell' },
                cell: ({ row }) => <DateTime value={row.original.updatedAt} format="relative" />,
            },
            {
                id: 'actions',
                enableHiding: false,
                enableSorting: false,
                meta: { align: 'right' },
                cell: ({ row }) => (
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" onClick={() => setAdjusting(toTarget(row.original))} aria-label={`Adjust stock for ${row.original.name}`}>
                            <Plus aria-hidden /> <span className="hidden sm:inline">Adjust</span>
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setHistory(toTarget(row.original))} aria-label={`Stock history for ${row.original.name}`}>
                            <History aria-hidden />
                        </Button>
                    </div>
                ),
            },
        ],
        [],
    );

    const c = counts.data;
    const tabs: { id: StockFilter; label: string; count?: number; tone?: 'warning' | 'destructive' }[] = [
        { id: 'all', label: 'All stock' },
        { id: 'low', label: 'Low', count: c?.lowStock, tone: 'warning' },
        { id: 'out', label: 'Out', count: c?.outOfStock, tone: 'destructive' },
    ];
    const filtered = !!(q || categoryId || stock !== 'all' || status !== 'active');
    const clear = () => {
        setSearch('');
        setCategoryId('');
        setStock('all');
        setStatus('active');
    };

    return (
        <PageContainer>
            <PageHeader title="Inventory" description="Stock on hand for active products. Every adjustment is logged with a reason and who made it.">
                <div role="tablist" aria-label="Stock level" className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-fit">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            role="tab"
                            type="button"
                            aria-selected={stock === t.id}
                            onClick={() => setStock(t.id)}
                            className={cn(
                                'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-none',
                                stock === t.id ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {t.label}
                            {t.count !== undefined ? (
                                <span
                                    className={cn(
                                        'rounded-md px-1.5 text-xs tabular-nums',
                                        t.count === 0 ? 'text-muted-foreground' : t.tone === 'destructive' ? 'bg-destructive-tint text-destructive' : 'bg-warning-tint text-warning',
                                    )}
                                >
                                    {formatNumber(t.count)}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </PageHeader>

            <DataTable
                label="Inventory"
                columns={columns}
                data={rows}
                loading={products.isPending}
                fetching={products.isFetching}
                error={products.error ?? undefined}
                onRetry={() => products.refetch()}
                pagination={pagination}
                onPaginationChange={setPagination}
                rowCount={products.data?.total}
                sorting={sorting}
                onSortingChange={setSorting}
                onRowClick={(p) => setHistory(toTarget(p))}
                toolbar={
                    <>
                        <div className="relative w-full sm:w-64">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, brand, barcode or SKU" aria-label="Search stock" className="pl-8" />
                        </div>
                        <Select value={categoryId || 'all'} onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}>
                            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-44" aria-label="Category">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All categories</SelectItem>
                                {(categories.data ?? []).map((cat) => (
                                    <SelectItem key={cat._id} value={cat._id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-40" aria-label="Product status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active products</SelectItem>
                                <SelectItem value="draft">Drafts</SelectItem>
                                <SelectItem value="all">All, incl. archived</SelectItem>
                            </SelectContent>
                        </Select>
                        {filtered ? (
                            <Button variant="ghost" size="sm" onClick={clear}>
                                <X aria-hidden /> Clear
                            </Button>
                        ) : null}
                    </>
                }
                empty={
                    filtered ? (
                        <EmptyState
                            icon={stock === 'all' ? SearchX : Boxes}
                            title={stock === 'low' ? 'Nothing is running low' : stock === 'out' ? 'Nothing is out of stock' : 'No products match these filters'}
                            description={stock !== 'all' ? 'Every product here is above its reorder level.' : 'Try a shorter search or clear the filters.'}
                            action={
                                <Button variant="outline" onClick={clear}>
                                    Show all stock
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState icon={Boxes} title="No active products" description="Products appear here once they are published from the Products page." />
                    )
                }
            />

            <AdjustStockDialog product={adjusting} open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)} />
            <StockHistorySheet
                product={history}
                open={!!history}
                onOpenChange={(o) => !o && setHistory(null)}
                onAdjust={() => history && setAdjusting(history)}
            />
        </PageContainer>
    );
}

export default withProviders(InventoryManager);
