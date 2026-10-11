import * as React from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginationState, SortingState, VisibilityState } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Bell, BellOff, Inbox, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable, EmptyState, PageContainer, PageHeader, statusLabel, withProviders } from '@/components/shared';
import { registerSearchProvider } from '@/components/shell/command-registry';
import { formatMoney, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import {
    buildOrderParams,
    EMPTY_FILTERS,
    isOrdersTab,
    LIVE_STATUSES,
    ordersApi,
    TABS,
    type OrderFilters,
    type OrderSort,
    type OrdersTab,
} from './order-model';
import { orderColumns } from './columns';
import { OrdersToolbar, activeFilterCount } from './OrdersToolbar';
import { OrderDetailSheet } from './OrderDetailSheet';
import { playNewOrderChime, useOrdersLive, type LiveConnection } from './useOrdersLive';
import type { Order, OrderEvent } from './types';

const SOUND_KEY = 'admin-orders-sound';
const COLUMNS_KEY = 'admin-orders-columns';
const DEFAULT_VISIBILITY: VisibilityState = { updatedAt: false, area: false };

function readStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
        return fallback;
    }
}

function writeStorage(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private mode or blocked storage: the preference just won't persist.
    }
}

function sortParam(sorting: SortingState): OrderSort {
    const s = sorting[0];
    if (!s) return '-createdAt';
    if (s.id !== 'createdAt' && s.id !== 'updatedAt' && s.id !== 'totalAmount') return '-createdAt';
    return `${s.desc ? '-' : ''}${s.id}` as OrderSort;
}

/**
 * The tab lives in ?status= so the sidebar links (/orders?status=completed, ?status=cancelled)
 * open the matching tab and stay highlighted. ?status=returns is the old name for Cancelled and
 * still opens it. ?id= opens an order (used by links and ⌘K).
 */
const TAB_PARAM: Record<OrdersTab, string | null> = { live: null, completed: 'completed', cancelled: 'cancelled', all: 'all' };
const PARAM_TAB: Record<string, OrdersTab> = { completed: 'completed', delivered: 'completed', returns: 'cancelled', cancelled: 'cancelled', all: 'all', live: 'live' };

function initialUrlState(): { tab: OrdersTab; id: string | null } {
    if (typeof window === 'undefined') return { tab: 'live', id: null };
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('status') ?? params.get('tab') ?? '';
    return { tab: PARAM_TAB[raw] ?? 'live', id: params.get('id') };
}

function syncUrl(tab: OrdersTab, id: string | null) {
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    const status = TAB_PARAM[tab];
    if (status) url.searchParams.set('status', status);
    else url.searchParams.delete('status');
    if (id) url.searchParams.set('id', id);
    else url.searchParams.delete('id');
    if (url.href === window.location.href) return;
    window.history.replaceState(window.history.state, '', url);
    // The shell reads the location on popstate; this keeps the sidebar and breadcrumb in step.
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

function OrdersPage() {
    const client = useQueryClient();
    // Server markup is always the Live tab; the URL is applied after hydration so the two match.
    const [filters, setFilters] = React.useState<OrderFilters>({ tab: 'live', ...EMPTY_FILTERS });
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
    const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }]);
    const [visibility, setVisibility] = React.useState<VisibilityState>(DEFAULT_VISIBILITY);
    const [openId, setOpenId] = React.useState<string | null>(null);
    const [urlRead, setUrlRead] = React.useState(false);
    const [sound, setSound] = React.useState(false);
    const [fresh, setFresh] = React.useState<Set<string>>(() => new Set());

    // Client-only preferences load after hydration so server and client markup match.
    React.useEffect(() => {
        setSound(readStorage(SOUND_KEY, false));
        setVisibility(readStorage(COLUMNS_KEY, DEFAULT_VISIBILITY));
    }, []);

    React.useEffect(() => {
        const { tab, id } = initialUrlState();
        setFilters((prev) => ({ ...prev, tab }));
        setOpenId(id);
        setUrlRead(true);
    }, []);

    React.useEffect(() => {
        if (urlRead) syncUrl(filters.tab, openId);
    }, [urlRead, filters.tab, openId]);

    const updateFilters = React.useCallback((patch: Partial<OrderFilters>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, []);

    const params = buildOrderParams(filters, pagination.pageIndex + 1, pagination.pageSize, sortParam(sorting));
    const list = useQuery({
        queryKey: queryKeys.orders.list(params),
        queryFn: ({ signal }) => ordersApi.list(params, signal),
        placeholderData: keepPreviousData,
        // Rider-driven changes also arrive over the socket; this keeps Live honest if it is down.
        refetchInterval: filters.tab === 'live' ? 30_000 : false,
    });

    // Live count for the header and the Live tab; one row is enough to read `total`.
    const liveParams = { page: 1, limit: 1, sort: '-createdAt', status: LIVE_STATUSES.join(',') };
    const liveCount = useQuery({
        queryKey: queryKeys.orders.list({ ...liveParams, count: true }),
        queryFn: ({ signal }) => ordersApi.list(liveParams as ReturnType<typeof buildOrderParams>, signal),
        select: (data) => data.total,
    });

    const openOrder = React.useCallback((id: string) => {
        setOpenId(id);
        setFresh((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const soundRef = React.useRef(sound);
    soundRef.current = sound;

    const onNewOrder = React.useCallback(
        (event: OrderEvent) => {
            setFresh((prev) => new Set(prev).add(event._id));
            if (soundRef.current) playNewOrderChime();
            toast(`New order ${event.orderId}`, {
                description: `${formatMoney(event.totalAmount)} · ${event.paymentMethod === 'COD' ? 'Cash on delivery' : event.paymentMethod}${event.itemCount ? ` · ${event.itemCount} items` : ''}`,
                action: { label: 'Open', onClick: () => openOrder(event._id) },
                duration: 8000,
            });
        },
        [openOrder],
    );

    /** Order ids already toasted (from the socket or the poll), so each new order is announced once. */
    const announced = React.useRef<Set<string>>(new Set());
    const { connection } = useOrdersLive({
        onNewOrder: (event) => {
            announced.current.add(event._id);
            onNewOrder(event);
        },
    });

    // Newest pending orders, polled as a safety net: if the socket drops or misses an event,
    // new orders still surface (toast + list refresh) within one interval.
    const pendingParams = { page: 1, limit: 10, sort: '-createdAt', status: 'PENDING' };
    const pending = useQuery({
        queryKey: queryKeys.orders.list({ ...pendingParams, watch: true }),
        queryFn: ({ signal }) => ordersApi.list(pendingParams as ReturnType<typeof buildOrderParams>, signal),
        refetchInterval: connection === 'live' ? 30_000 : 15_000,
        refetchIntervalInBackground: true,
    });
    const pendingCount = pending.data?.total;
    const baselined = React.useRef(false);
    React.useEffect(() => {
        const rows = pending.data?.orders;
        if (!rows) return;
        if (!baselined.current) {
            // Orders already waiting when the page opened are not "new".
            rows.forEach((o) => announced.current.add(o._id));
            baselined.current = true;
            return;
        }
        const unseen = rows.filter((o) => !announced.current.has(o._id));
        if (unseen.length === 0) return;
        unseen.forEach((o) => {
            announced.current.add(o._id);
            onNewOrder({
                _id: o._id,
                orderId: o.orderId,
                orderStatus: o.orderStatus,
                paymentStatus: o.paymentStatus,
                paymentMethod: o.paymentMethod,
                totalAmount: o.totalAmount,
                itemCount: o.items?.length,
                createdAt: o.createdAt,
            });
        });
        void client.invalidateQueries({ queryKey: queryKeys.orders.all });
    }, [pending.data, onNewOrder, client]);

    // ⌘K: jump to an order by its ID (or customer name/phone) while this page is open.
    React.useEffect(
        () =>
            registerSearchProvider({
                id: 'orders',
                group: 'Orders',
                minQueryLength: 3,
                search: async (q, signal) => {
                    const data = await ordersApi.list({ page: 1, limit: 6, sort: '-createdAt', q: q.slice(0, 100) } as ReturnType<typeof buildOrderParams>, signal);
                    return data.orders.map((o) => ({
                        id: `order-${o._id}`,
                        label: o.orderId,
                        group: 'Orders',
                        hint: `${statusLabel('order', o.orderStatus)} · ${formatMoney(o.totalAmount)}`,
                        keywords: [o.orderId, typeof o.userId === 'object' && o.userId?.name ? o.userId.name : ''].filter(Boolean),
                        run: () => openOrder(o._id),
                    }));
                },
            }),
        [openOrder],
    );

    const columns = React.useMemo(() => orderColumns({ onOpen: (o) => openOrder(o._id), isNew: (id) => fresh.has(id) }), [openOrder, fresh]);

    const filtered = activeFilterCount(filters) > 0;
    const empty = filtered ? (
        <EmptyState
            icon={SearchX}
            title="No orders match these filters"
            description="Try a wider date range or clear a filter."
            action={
                <Button variant="outline" size="sm" onClick={() => updateFilters({ ...EMPTY_FILTERS })}>
                    Clear filters
                </Button>
            }
        />
    ) : filters.tab === 'live' ? (
        <EmptyState
            icon={Inbox}
            title="No orders need attention"
            description="New orders appear here the moment a customer places them."
        />
    ) : filters.tab === 'completed' ? (
        <EmptyState icon={Inbox} title="No delivered orders yet" description="Orders land here once the rider confirms delivery." />
    ) : filters.tab === 'cancelled' ? (
        <EmptyState icon={Inbox} title="No cancelled orders" description="Orders cancelled by staff, customers or riders are listed here." />
    ) : (
        <EmptyState icon={Inbox} title="No orders yet" description="Orders appear here once customers start ordering." />
    );

    return (
        <PageContainer>
            <PageHeader
                title={
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        Orders
                        {liveCount.data !== undefined ? (
                            <span className="rounded-md bg-brand-tint px-2 py-0.5 text-sm font-semibold text-brand-text tabular-nums">
                                {formatNumber(liveCount.data)} live
                            </span>
                        ) : null}
                    </span>
                }
                description={
                    pendingCount
                        ? `${formatNumber(pendingCount)} waiting for confirmation. Open an order to confirm, assign a rider or cancel it.`
                        : 'Open an order to confirm it, assign a rider, follow the delivery or cancel it.'
                }
                actions={
                    <>
                        <ConnectionStatus connection={connection} />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    aria-pressed={sound}
                                    onClick={() => {
                                        const next = !sound;
                                        setSound(next);
                                        writeStorage(SOUND_KEY, next);
                                        if (next) playNewOrderChime();
                                    }}
                                >
                                    {sound ? <Bell aria-hidden /> : <BellOff aria-hidden />}
                                    {sound ? 'Sound on' : 'Sound off'}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Play a chime when a new order arrives</TooltipContent>
                        </Tooltip>
                    </>
                }
            >
                <Tabs value={filters.tab} onValueChange={(v) => isOrdersTab(v) && updateFilters({ tab: v, statuses: [] })}>
                    <TabsList>
                        {TABS.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value} className="px-3" aria-controls="orders-panel">
                                {tab.label}
                                {tab.value === 'live' && liveCount.data ? (
                                    <span className="rounded bg-muted-foreground/15 px-1.5 text-xs tabular-nums">{formatNumber(liveCount.data)}</span>
                                ) : null}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </PageHeader>

            {/* One panel serves every tab: the tabs only change the query. */}
            <div id="orders-panel" role="tabpanel" aria-label={`${TABS.find((t) => t.value === filters.tab)?.label ?? 'Live'} orders`}>
            <DataTable<Order>
                label="Orders"
                columns={columns}
                data={list.data?.orders}
                loading={list.isPending}
                fetching={list.isFetching && !list.isPending}
                error={list.error ?? undefined}
                onRetry={() => list.refetch()}
                pagination={pagination}
                onPaginationChange={setPagination}
                rowCount={list.data?.total}
                sorting={sorting}
                onSortingChange={(updater) => {
                    setSorting(updater);
                    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
                columnVisibility={visibility}
                onColumnVisibilityChange={(updater) =>
                    setVisibility((prev) => {
                        const next = typeof updater === 'function' ? updater(prev) : updater;
                        writeStorage(COLUMNS_KEY, next);
                        return next;
                    })
                }
                toolbar={<OrdersToolbar filters={filters} onChange={updateFilters} />}
                empty={empty}
                onRowClick={(order) => openOrder(order._id)}
            />
            </div>

            <OrderDetailSheet orderId={openId} onOpenChange={(open) => !open && setOpenId(null)} />
        </PageContainer>
    );
}

function ConnectionStatus({ connection }: { connection: LiveConnection }) {
    const text =
        connection === 'live' ? 'Live updates on' : connection === 'connecting' ? 'Connecting' : 'Live updates paused, retrying';
    return (
        <span role="status" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span
                aria-hidden
                className={cn(
                    'size-2 rounded-full',
                    connection === 'live' ? 'bg-success' : connection === 'connecting' ? 'bg-muted-foreground/50' : 'bg-warning',
                )}
            />
            {text}
        </span>
    );
}

export default withProviders(OrdersPage);
