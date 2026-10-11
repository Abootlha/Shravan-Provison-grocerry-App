import * as React from 'react';
import type { ColumnDef, PaginationState, RowSelectionState, SortingState } from '@tanstack/react-table';
import { useMutation } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Copy, FilePen, MoreHorizontal, PackagePlus, Pencil, Search, SearchX, Send, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    DataTable,
    DataTableColumnHeader,
    DateTime,
    EmptyState,
    Money,
    PageContainer,
    PageHeader,
    selectColumn,
    StatusBadge,
    useConfirm,
    withProviders,
} from '@/components/shared';
import { registerCommands, registerSearchProvider } from '@/components/shell/command-registry';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { errorMessage, http } from '@/lib/http';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AdjustStockDialog, type StockTarget } from './inventory/AdjustStockDialog';
import {
    canEditCatalogue,
    fetchProducts,
    invalidateProducts,
    useCategories,
    useProductCounts,
    useProducts,
    useSubcategories,
    type ProductListParams,
} from './products/data';
import { duplicateToForm } from './products/editorSchema';
import { ImportWizard } from './products/ImportWizard';
import { IssueBadges, ProductThumb, StockCell } from './products/ProductBits';
import { ProductEditor, type EditorTarget } from './products/ProductEditor';
import {
    productImage,
    productMrp,
    productPrice,
    productStatus,
    productUnit,
    refId,
    refName,
    type AdminProduct,
    type ProductStatus,
} from './products/types';

type View = 'all' | ProductStatus;
type Flag = 'attention' | 'low' | 'out' | null;

const SORTABLE = new Set(['name', 'price', 'stock', 'updatedAt']);

/** Reads initial filters from the URL so links like /products?status=draft or ?attention=1 work. */
function readUrl() {
    if (typeof window === 'undefined') return { view: 'all' as View, flag: null as Flag, q: '', categoryId: '', subcategoryId: '' };
    const p = new URLSearchParams(window.location.search);
    const status = p.get('status');
    const stock = p.get('stock') ?? p.get('filter');
    return {
        view: (status === 'active' || status === 'draft' || status === 'archived' ? status : 'all') as View,
        flag: (p.get('attention') === '1' ? 'attention' : stock === 'low' || stock === 'out' ? stock : null) as Flag,
        q: p.get('q') ?? '',
        categoryId: p.get('category') ?? '',
        subcategoryId: p.get('subcategory') ?? '',
    };
}

function useDebounced<T>(value: T, delay = 300) {
    const [v, setV] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
}

function ProductsManager() {
    const initial = React.useMemo(readUrl, []);
    const [view, setView] = React.useState<View>(initial.view);
    const [flag, setFlag] = React.useState<Flag>(initial.flag);
    const [search, setSearch] = React.useState(initial.q);
    const [categoryId, setCategoryId] = React.useState(initial.categoryId);
    const [subcategoryId, setSubcategoryId] = React.useState(initial.subcategoryId);
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [selection, setSelection] = React.useState<RowSelectionState>({});
    const [editor, setEditor] = React.useState<EditorTarget | null>(null);
    const [importOpen, setImportOpen] = React.useState(false);
    const [stockTarget, setStockTarget] = React.useState<StockTarget | null>(null);
    const confirm = useConfirm();
    const editable = canEditCatalogue();
    const q = useDebounced(search.trim());

    const sort = sorting[0] && SORTABLE.has(sorting[0].id) ? `${sorting[0].desc ? '-' : ''}${sorting[0].id}` : undefined;
    const params: ProductListParams = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        q: q || undefined,
        status: view === 'all' ? undefined : view,
        categoryId: categoryId || undefined,
        subcategoryId: subcategoryId || undefined,
        stock: flag === 'low' || flag === 'out' ? flag : undefined,
        needsAttention: flag === 'attention' || undefined,
        sort,
    };
    const products = useProducts(params);
    const counts = useProductCounts();
    const categories = useCategories();
    const subcategories = useSubcategories();

    // Back to page 1 and a clean selection whenever the filters change.
    const filterKey = JSON.stringify([view, flag, q, categoryId, subcategoryId, sort]);
    const firstFilter = React.useRef(true);
    React.useEffect(() => {
        if (firstFilter.current) {
            firstFilter.current = false;
            return;
        }
        setPagination((p) => ({ ...p, pageIndex: 0 }));
        setSelection({});
    }, [filterKey]);

    // Mirror filters into the URL (replaceState: no history spam) so a view can be shared.
    React.useEffect(() => {
        const url = new URL(window.location.href);
        const set = (k: string, v: string | null) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
        set('status', view === 'all' ? null : view);
        set('attention', flag === 'attention' ? '1' : null);
        set('stock', flag === 'low' || flag === 'out' ? flag : null);
        set('filter', null);
        set('q', q || null);
        set('category', categoryId || null);
        set('subcategory', subcategoryId || null);
        window.history.replaceState(window.history.state, '', url);
    }, [view, flag, q, categoryId, subcategoryId]);

    // Deep links: ?action=new (⌘K "New product"), ?action=import, ?id=<product>.
    React.useEffect(() => {
        const url = new URL(window.location.href);
        const action = url.searchParams.get('action');
        const id = url.searchParams.get('id');
        if (action === 'new') setEditor({ mode: 'create', key: Date.now() });
        else if (action === 'import' || action === 'add-import') setImportOpen(true);
        else if (id && /^[a-f0-9]{24}$/i.test(id)) setEditor({ mode: 'edit', id });
        if (action) {
            url.searchParams.delete('action');
            window.history.replaceState(window.history.state, '', url);
        }
    }, []);

    const openEditor = (target: EditorTarget | null) => {
        setEditor(target);
        const url = new URL(window.location.href);
        if (target?.mode === 'edit') url.searchParams.set('id', target.id);
        else url.searchParams.delete('id');
        window.history.replaceState(window.history.state, '', url);
    };

    // ⌘K: live product search plus page actions while this page is open.
    React.useEffect(() => {
        const offSearch = registerSearchProvider({
            id: 'products',
            group: 'Products',
            minQueryLength: 2,
            search: async (query, signal) => {
                const res = await fetchProducts({ page: 1, limit: 8, q: query }, signal);
                return res.products.map((p) => ({
                    id: `product-${p._id}`,
                    label: p.name,
                    group: 'Products',
                    hint: [productUnit(p), productStatus(p) !== 'active' ? productStatus(p) : ''].filter(Boolean).join(' · '),
                    run: () => openEditor({ mode: 'edit', id: p._id }),
                }));
            },
        });
        const offCommands = editable
            ? registerCommands([
                  { id: 'products-import', label: 'Import products from CSV', group: 'Actions', icon: Upload, keywords: ['csv', 'bulk', 'upload'], run: () => setImportOpen(true) },
                  { id: 'products-attention', label: 'Products that need attention', group: 'Actions', keywords: ['missing', 'issues', 'fix'], run: () => setFlag('attention') },
              ])
            : () => {};
        return () => {
            offSearch();
            offCommands();
        };
    }, [editable]);

    const setStatus = useMutation({
        mutationFn: (v: { product: AdminProduct; status: ProductStatus }) => http.patch(`/admin/products/${v.product._id}/status`, { status: v.status }),
        onSuccess: (_d, v) => {
            const verb = v.status === 'archived' ? 'Archived' : v.status === 'draft' ? 'Moved to drafts' : 'Published';
            toast.success(verb, { description: v.product.name });
            invalidateProducts();
        },
        onError: (e) => toast.error('Status not changed', { description: errorMessage(e) }),
    });

    const changeStatus = async (product: AdminProduct, status: ProductStatus) => {
        if (status === 'archived') {
            const ok = await confirm({
                title: `Archive “${product.name}”?`,
                description: 'It disappears from the app and search. Past orders keep their copy, and you can restore it from the Archived tab.',
                confirmLabel: 'Archive',
                tone: 'destructive',
                onConfirm: () => setStatus.mutateAsync({ product, status }),
            });
            return ok;
        }
        if (status === 'active' && product.issues?.length) {
            return confirm({
                title: `Publish “${product.name}” with problems?`,
                description: `Customers will see it although it has: ${product.issues.map((i) => i.replace(/_/g, ' ')).join(', ')}. Fixing it first is better.`,
                confirmLabel: 'Publish anyway',
                onConfirm: () => setStatus.mutateAsync({ product, status }),
            });
        }
        setStatus.mutate({ product, status });
    };

    const bulkStatus = async (rows: AdminProduct[], status: ProductStatus, clear: () => void) => {
        const ids = rows.map((r) => r._id);
        const label = status === 'archived' ? 'Archive' : status === 'draft' ? 'Move to drafts' : 'Publish';
        const withIssues = status === 'active' ? rows.filter((r) => r.issues?.length).length : 0;
        const ok = await confirm({
            title: `${label} ${formatNumber(ids.length)} product${ids.length === 1 ? '' : 's'}?`,
            description:
                status === 'archived'
                    ? 'They disappear from the app. You can restore them from the Archived tab.'
                    : status === 'draft'
                      ? 'They are hidden from the app until published again.'
                      : withIssues
                        ? `${formatNumber(withIssues)} of them still need attention (missing price, image or unit) and will go live as they are.`
                        : 'They become visible in the app.',
            confirmLabel: label,
            tone: status === 'archived' ? 'destructive' : 'default',
            onConfirm: async () => {
                for (let i = 0; i < ids.length; i += 200) {
                    await http.post('/admin/products/bulk-status', { ids: ids.slice(i, i + 200), status });
                }
            },
        });
        if (ok) {
            const done = status === 'archived' ? 'Archived' : status === 'draft' ? 'Moved to drafts:' : 'Published';
            toast.success(`${done} ${formatNumber(ids.length)} product${ids.length === 1 ? '' : 's'}`);
            clear();
            invalidateProducts();
        }
    };

    const columns = React.useMemo<ColumnDef<AdminProduct>[]>(() => {
        const cols: ColumnDef<AdminProduct>[] = [
            {
                id: 'name',
                accessorKey: 'name',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
                enableHiding: false,
                meta: { className: 'min-w-[13rem] max-w-[26rem] whitespace-normal py-2', label: 'Product' },
                cell: ({ row }) => {
                    const p = row.original;
                    const unit = productUnit(p).replace(/\s+/g, ' ');
                    return (
                        <div className="flex items-center gap-3">
                            <ProductThumb src={productImage(p)} alt="" size={44} />
                            <div className="min-w-0 space-y-0.5">
                                <p className="line-clamp-2 leading-snug font-medium text-foreground">{p.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{[p.brand, unit].filter(Boolean).join(' · ') || '—'}</p>
                                <IssueBadges product={p} className="pt-0.5" />
                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-xs text-muted-foreground tabular-nums sm:hidden">
                                    {productPrice(p) ? <Money value={productPrice(p)} className="font-semibold text-foreground" /> : <span className="text-warning">No price</span>}
                                    <span>{formatNumber(p.stock)} in stock</span>
                                    <StatusBadge kind="product" status={productStatus(p)} />
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
                meta: { label: 'Category', className: 'hidden max-w-[14rem] md:table-cell', headerClassName: 'hidden md:table-cell' },
                cell: ({ row }) => {
                    const cat = refName(row.original.categoryId);
                    const sub = refName(row.original.subcategoryId);
                    return (
                        <div className="min-w-0 text-sm">
                            <p className="truncate">{cat || <span className="text-muted-foreground">—</span>}</p>
                            {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
                        </div>
                    );
                },
            },
            {
                id: 'price',
                accessorFn: (p) => productPrice(p),
                header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
                meta: { align: 'right', label: 'Price', className: 'hidden sm:table-cell', headerClassName: 'hidden sm:table-cell' },
                cell: ({ row }) => {
                    const price = productPrice(row.original);
                    const mrp = productMrp(row.original);
                    if (!price) return <span className="font-medium text-warning">Not set</span>;
                    return (
                        <div className="leading-tight">
                            <Money value={price} className="font-semibold" />
                            {mrp && mrp > price ? <Money value={mrp} className="block text-xs text-muted-foreground line-through" /> : null}
                        </div>
                    );
                },
            },
            {
                id: 'stock',
                accessorKey: 'stock',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
                meta: { align: 'right', label: 'Stock', className: 'hidden sm:table-cell', headerClassName: 'hidden sm:table-cell' },
                cell: ({ row }) => <StockCell stock={row.original.stock} reorderLevel={row.original.reorderLevel} state={row.original.stockState} />,
            },
            {
                id: 'status',
                header: 'Status',
                enableSorting: false,
                meta: { label: 'Status', className: 'hidden sm:table-cell', headerClassName: 'hidden sm:table-cell' },
                cell: ({ row }) => {
                    const p = row.original;
                    return (
                        <div className="flex flex-col items-start gap-1">
                            <StatusBadge kind="product" status={productStatus(p)} />
                            {p.isAvailable === false && productStatus(p) === 'active' ? <span className="text-xs text-muted-foreground">Sales paused</span> : null}
                        </div>
                    );
                },
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
                meta: { className: 'w-12', align: 'right' },
                cell: ({ row }) => <RowActions product={row.original} editable={editable} onEdit={() => openEditor({ mode: 'edit', id: row.original._id })} onDuplicate={() => openEditor({ mode: 'create', key: Date.now(), initial: duplicateToForm(row.original) })} onStatus={(s) => changeStatus(row.original, s)} onAdjust={() => setStockTarget(toStockTarget(row.original))} />,
            },
        ];
        return editable ? [rowSelectColumn(), ...cols] : cols;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editable]);

    const c = counts.data;
    const subOptions = (subcategories.data ?? []).filter((s) => refId(s.parentId) === categoryId);
    const filtered = !!(q || categoryId || subcategoryId || flag || view !== 'all');
    const clearFilters = () => {
        setSearch('');
        setCategoryId('');
        setSubcategoryId('');
        setFlag(null);
        setView('all');
    };

    const views: { id: View; label: string; count?: number }[] = [
        { id: 'all', label: 'All', count: c?.all },
        { id: 'active', label: 'Active', count: c?.active },
        { id: 'draft', label: 'Drafts', count: c?.draft },
        { id: 'archived', label: 'Archived', count: c?.archived },
    ];
    const flags: { id: Exclude<Flag, null>; label: string; count?: number; tone: 'warning' | 'destructive' }[] = [
        { id: 'attention', label: 'Needs attention', count: c?.needsAttention, tone: 'warning' },
        { id: 'low', label: 'Low stock', count: c?.lowStock, tone: 'warning' },
        { id: 'out', label: 'Out of stock', count: c?.outOfStock, tone: 'destructive' },
    ];

    return (
        <PageContainer>
            <PageHeader
                title="Products"
                description="The whole catalogue, including drafts and archived items. Click a row to edit."
                actions={
                    editable ? (
                        <>
                            <Button variant="outline" onClick={() => setImportOpen(true)}>
                                <Upload aria-hidden /> Import CSV
                            </Button>
                            <Button onClick={() => openEditor({ mode: 'create', key: Date.now() })}>
                                <PackagePlus aria-hidden /> New product
                            </Button>
                        </>
                    ) : null
                }
            >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div role="tablist" aria-label="Product status" className="flex w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:w-fit [scrollbar-width:none]">
                        {views.map((v) => (
                            <button
                                key={v.id}
                                role="tab"
                                type="button"
                                aria-selected={view === v.id}
                                onClick={() => setView(v.id)}
                                className={cn(
                                    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-none',
                                    view === v.id ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {v.label}
                                <span className="text-xs text-muted-foreground tabular-nums">{v.count === undefined ? '' : formatNumber(v.count)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2" aria-label="Quick filters">
                        {flags.map((f) => {
                            const on = flag === f.id;
                            const has = (f.count ?? 0) > 0;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => setFlag(on ? null : f.id)}
                                    className={cn(
                                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                                        on ? 'border-transparent bg-brand-tint text-brand-text' : 'bg-card hover:bg-muted',
                                    )}
                                >
                                    {f.label}
                                    <span
                                        className={cn(
                                            'rounded-md px-1.5 text-xs tabular-nums',
                                            !has ? 'text-muted-foreground' : f.tone === 'destructive' ? 'bg-destructive-tint text-destructive' : 'bg-warning-tint text-warning',
                                        )}
                                    >
                                        {f.count === undefined ? '…' : formatNumber(f.count)}
                                    </span>
                                    {on ? <X className="size-3.5" aria-hidden /> : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </PageHeader>

            {flag === 'attention' ? (
                <p className="-mt-2 max-w-[80ch] text-sm text-pretty text-muted-foreground">
                    Products missing a price, an image or a unit, or with a barcode typed into the unit. Open each one to fix it; nothing is corrected automatically.
                </p>
            ) : null}

            <DataTable
                label="Products"
                columns={columns}
                data={products.data?.products}
                loading={products.isPending}
                fetching={products.isFetching}
                error={products.error ?? undefined}
                onRetry={() => products.refetch()}
                pagination={pagination}
                onPaginationChange={setPagination}
                rowCount={products.data?.total}
                sorting={sorting}
                onSortingChange={setSorting}
                enableRowSelection={editable}
                rowSelection={selection}
                onRowSelectionChange={setSelection}
                onRowClick={(p) => openEditor({ mode: 'edit', id: p._id })}
                bulkActions={(rows, clear) => (
                    <>
                        {view !== 'active' ? (
                            <Button size="sm" variant="outline" onClick={() => bulkStatus(rows, 'active', clear)}>
                                <Send aria-hidden /> Publish
                            </Button>
                        ) : null}
                        {view !== 'draft' ? (
                            <Button size="sm" variant="outline" onClick={() => bulkStatus(rows, 'draft', clear)}>
                                <FilePen aria-hidden /> Move to drafts
                            </Button>
                        ) : null}
                        {view !== 'archived' ? (
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => bulkStatus(rows, 'archived', clear)}>
                                <Archive aria-hidden /> Archive
                            </Button>
                        ) : null}
                    </>
                )}
                toolbar={
                    <>
                        <div className="relative w-full sm:w-64">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <Input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Name, brand, barcode or SKU"
                                aria-label="Search products"
                                className="pl-8"
                            />
                        </div>
                        <Select
                            value={categoryId || 'all'}
                            onValueChange={(v) => {
                                setCategoryId(v === 'all' ? '' : v);
                                setSubcategoryId('');
                            }}
                        >
                            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-44" aria-label="Category">
                                <SelectValue placeholder="Category" />
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
                        <Select value={subcategoryId || 'all'} onValueChange={(v) => setSubcategoryId(v === 'all' ? '' : v)} disabled={!categoryId || subOptions.length === 0}>
                            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-44" aria-label="Subcategory">
                                <SelectValue placeholder="Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{categoryId ? 'All subcategories' : 'Subcategory'}</SelectItem>
                                {subOptions.map((s) => (
                                    <SelectItem key={s._id} value={s._id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {filtered ? (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X aria-hidden /> Clear
                            </Button>
                        ) : null}
                    </>
                }
                empty={
                    filtered ? (
                        <EmptyState
                            icon={SearchX}
                            title={flag === 'attention' ? 'Nothing needs attention here' : 'No products match these filters'}
                            description={flag === 'attention' ? 'Every product in this view has a price, an image and a proper unit.' : 'Try a shorter search or clear the filters.'}
                            action={
                                <Button variant="outline" onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={PackagePlus}
                            title="No products yet"
                            description="Add your first product, or import a spreadsheet of them."
                            action={
                                editable ? (
                                    <>
                                        <Button onClick={() => openEditor({ mode: 'create', key: Date.now() })}>New product</Button>
                                        <Button variant="outline" onClick={() => setImportOpen(true)}>
                                            Import CSV
                                        </Button>
                                    </>
                                ) : null
                            }
                        />
                    )
                }
            />

            <ProductEditor target={editor} onClose={() => openEditor(null)} onAdjustStock={(p) => setStockTarget(toStockTarget(p))} />
            <ImportWizard open={importOpen} onOpenChange={setImportOpen} />
            <AdjustStockDialog product={stockTarget} open={!!stockTarget} onOpenChange={(o) => !o && setStockTarget(null)} />
        </PageContainer>
    );
}

/** Shared select column, with the whole cell as the hit area so a near-miss doesn't open the editor. */
function rowSelectColumn(): ColumnDef<AdminProduct> {
    const base = selectColumn<AdminProduct>();
    return {
        ...base,
        cell: ({ row }) => (
            <label className="-m-3 flex cursor-pointer items-center p-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label={`Select ${row.original.name}`} />
            </label>
        ),
    };
}

function toStockTarget(p: AdminProduct): StockTarget {
    return { _id: p._id, name: p.name, stock: p.stock, reorderLevel: p.reorderLevel, unit: productUnit(p) };
}

function RowActions({
    product,
    editable,
    onEdit,
    onDuplicate,
    onStatus,
    onAdjust,
}: {
    product: AdminProduct;
    editable: boolean;
    onEdit: () => void;
    onDuplicate: () => void;
    onStatus: (status: ProductStatus) => void;
    onAdjust: () => void;
}) {
    const status = productStatus(product);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()} aria-label={`Actions for ${product.name}`}>
                    <MoreHorizontal aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onSelect={onEdit}>
                    <Pencil aria-hidden /> {editable ? 'Edit' : 'View'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onAdjust}>
                    <PackagePlus aria-hidden /> Adjust stock
                </DropdownMenuItem>
                {editable ? (
                    <>
                        <DropdownMenuItem onSelect={onDuplicate}>
                            <Copy aria-hidden /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {status !== 'active' ? (
                            <DropdownMenuItem onSelect={() => onStatus('active')}>
                                {status === 'archived' ? <ArchiveRestore aria-hidden /> : <Send aria-hidden />}
                                {status === 'archived' ? 'Restore and publish' : 'Publish'}
                            </DropdownMenuItem>
                        ) : null}
                        {status !== 'draft' ? (
                            <DropdownMenuItem onSelect={() => onStatus('draft')}>
                                {status === 'archived' ? <ArchiveRestore aria-hidden /> : <FilePen aria-hidden />}
                                {status === 'archived' ? 'Restore as draft' : 'Move to drafts'}
                            </DropdownMenuItem>
                        ) : null}
                        {status !== 'archived' ? (
                            <DropdownMenuItem variant="destructive" onSelect={() => onStatus('archived')}>
                                <Archive aria-hidden /> Archive
                            </DropdownMenuItem>
                        ) : null}
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default withProviders(ProductsManager);
