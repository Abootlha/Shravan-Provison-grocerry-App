import * as React from 'react';
import { useIsFetching, useQuery } from '@tanstack/react-query';
import { ArrowRight, Inbox, RotateCw, ShoppingBag } from 'lucide-react';
import { DateTime, EmptyState, ErrorState, Money, PageContainer, PageHeader, StatusBadge, withProviders } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatMoney, formatNumber } from '@/lib/format';
import { http } from '@/lib/http';
import { queryClient, queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import {
    addDays,
    analyticsKeys,
    fetchSummary,
    fetchTopProducts,
    percentChange,
    previousRange,
    todayKey,
    type OrdersPage,
} from '../analytics/api';
import { StatusBreakdownChart, TrendChart, longDay } from '../analytics/charts';
import { KpiCard } from '../analytics/KpiCard';
import { StoreStatusCard } from './StoreStatusCard';

const LIVE = 60_000;

function useToday() {
    // Re-evaluated on each render; the minute refetch rolls the day over at midnight.
    return todayKey();
}

function DashboardPage() {
    const today = useToday();
    const yesterday = addDays(today, -1);
    const [days, setDays] = React.useState<7 | 30>(7);
    const from = addDays(today, -(days - 1));
    const prev = previousRange(from, today);

    const todaySummary = useQuery({ queryKey: analyticsKeys.summary(today, today), queryFn: ({ signal }) => fetchSummary(today, today, signal), refetchInterval: LIVE });
    const yesterdaySummary = useQuery({ queryKey: analyticsKeys.summary(yesterday, yesterday), queryFn: ({ signal }) => fetchSummary(yesterday, yesterday, signal) });
    const pending = useQuery({
        queryKey: queryKeys.orders.list({ status: 'PENDING', limit: 1, purpose: 'count' }),
        queryFn: ({ signal }) => http.get<OrdersPage>('/admin/orders', { params: { status: 'PENDING', limit: 1 }, signal }),
        refetchInterval: 30_000,
    });
    const range = useQuery({
        queryKey: analyticsKeys.summary(from, today),
        queryFn: ({ signal }) => fetchSummary(from, today, signal),
        placeholderData: (p) => p,
        refetchInterval: LIVE,
    });
    const previous = useQuery({ queryKey: analyticsKeys.summary(prev.from, prev.to), queryFn: ({ signal }) => fetchSummary(prev.from, prev.to, signal) });

    const t = todaySummary.data;
    const y = yesterdaySummary.data;
    const loadingToday = todaySummary.isPending;
    const fetching = useIsFetching();

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.settings.store });
    };

    const yesterdayHint = (value: number | undefined, kind: 'money' | 'number') =>
        typeof value === 'number' ? `Yesterday ${kind === 'money' ? formatMoney(Math.round(value)) : formatNumber(value)}` : undefined;

    return (
        <PageContainer>
            <PageHeader
                title="Today"
                description={`${longDay(today)}. Figures refresh every minute; revenue excludes cancelled orders.`}
                actions={
                    <>
                        <Button variant="outline" size="sm" onClick={refresh} disabled={fetching > 0} aria-label="Refresh dashboard">
                            <RotateCw className={cn(fetching > 0 && 'animate-spin')} aria-hidden />
                            Refresh
                        </Button>
                        <Button size="sm" asChild>
                            <a href="/orders">
                                Live orders
                                <ArrowRight aria-hidden />
                            </a>
                        </Button>
                    </>
                }
            />

            <StoreStatusCard />

            <section aria-label="Today's numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard
                    label="Revenue today"
                    value={t?.revenue}
                    format="money"
                    loading={loadingToday}
                    error={todaySummary.error}
                    hint={yesterdayHint(y?.revenue, 'money')}
                    href="/analytics"
                />
                <KpiCard
                    label="Orders today"
                    value={t?.orders}
                    loading={loadingToday}
                    error={todaySummary.error}
                    hint={t?.cancelledOrders ? `${formatNumber(t.cancelledOrders)} cancelled, not counted` : yesterdayHint(y?.orders, 'number')}
                />
                <KpiCard
                    label="Average order"
                    value={t?.averageOrderValue}
                    format="money"
                    loading={loadingToday}
                    error={todaySummary.error}
                    hint={t && t.orders === 0 ? 'No orders yet today' : yesterdayHint(y?.averageOrderValue, 'money')}
                />
                <KpiCard
                    label="Pending orders"
                    value={pending.data?.total}
                    loading={pending.isPending}
                    error={pending.error}
                    hint={pending.data?.total ? 'Placed, not yet confirmed' : 'Nothing waiting to confirm'}
                    href="/orders"
                />
                <KpiCard
                    label="Out of stock"
                    value={t?.outOfStock}
                    loading={loadingToday}
                    error={todaySummary.error}
                    hint={t ? `of ${formatNumber(t.activeProducts)} active products` : undefined}
                    href="/inventory"
                />
                <KpiCard
                    label="Low stock"
                    value={t?.lowStock}
                    loading={loadingToday}
                    error={todaySummary.error}
                    hint="At or below reorder level"
                    href="/inventory"
                />
            </section>

            <section aria-labelledby="trend-heading" className="grid grid-cols-1 gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="trend-heading" className="text-base font-semibold text-foreground">
                        Last {days} days
                    </h2>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={String(days)}
                        onValueChange={(v) => v && setDays(Number(v) as 7 | 30)}
                        aria-label="Period"
                    >
                        <ToggleGroupItem value="7" className="px-3 data-[state=on]:bg-brand-tint data-[state=on]:text-brand-text">
                            7 days
                        </ToggleGroupItem>
                        <ToggleGroupItem value="30" className="px-3 data-[state=on]:bg-brand-tint data-[state=on]:text-brand-text">
                            30 days
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Panel className="lg:col-span-2" title="Revenue per day" titleId="revenue-title">
                        {range.isPending ? (
                            <Skeleton className="h-64" />
                        ) : range.isError ? (
                            <ErrorState title="Couldn't load revenue" error={range.error} onRetry={() => range.refetch()} retrying={range.isFetching} />
                        ) : (
                            <>
                                <RangeTotal
                                    value={range.data.revenue}
                                    previous={previous.data?.revenue}
                                    orders={range.data.orders}
                                    days={days}
                                />
                                <TrendChart
                                    data={range.data.timeseries}
                                    metric="revenue"
                                    label={`Revenue per day, last ${days} days`}
                                    className={cn('mt-4 h-56 transition-opacity', range.isPlaceholderData && 'opacity-60')}
                                />
                            </>
                        )}
                    </Panel>

                    <Panel title="Orders by status" titleId="status-title" description={`Orders placed in the last ${days} days, by where they are now.`}>
                        {range.isPending ? (
                            <Skeleton className="h-64" />
                        ) : range.isError ? (
                            <ErrorState title="Couldn't load orders" error={range.error} onRetry={() => range.refetch()} />
                        ) : (
                            <StatusBreakdownChart
                                counts={range.data.ordersByStatus}
                                label={`Orders by status, last ${days} days`}
                                className={cn('h-64 transition-opacity', range.isPlaceholderData && 'opacity-60')}
                            />
                        )}
                    </Panel>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <RecentOrders className="lg:col-span-2" />
                    <BestSellers from={from} to={today} days={days} />
                </div>
            </section>
        </PageContainer>
    );
}

function Panel({
    title,
    titleId,
    description,
    action,
    children,
    className,
}: {
    title: string;
    titleId: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section aria-labelledby={titleId} className={cn('flex min-w-0 flex-col rounded-xl bg-card p-4 ring-1 ring-border sm:p-5', className)}>
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 id={titleId} className="text-sm font-semibold text-foreground">
                        {title}
                    </h3>
                    {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function RangeTotal({ value, previous, orders, days }: { value: number; previous?: number; orders: number; days: number }) {
    const change = percentChange(value, previous);
    return (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{formatMoney(Math.round(value))}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
                {formatNumber(orders)} {orders === 1 ? 'order' : 'orders'}
            </p>
            {change !== undefined ? (
                <p className={cn('text-xs font-semibold tabular-nums', change > 0 ? 'text-success-text' : change < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {change > 0 ? '+' : change < 0 ? '−' : ''}
                    {Math.abs(change).toFixed(Math.abs(change) < 10 ? 1 : 0)}%{' '}
                    <span className="font-normal text-muted-foreground">vs previous {days} days</span>
                </p>
            ) : typeof previous === 'number' ? (
                <p className="text-xs text-muted-foreground">No sales in the previous {days} days to compare with</p>
            ) : null}
        </div>
    );
}

function RecentOrders({ className }: { className?: string }) {
    const orders = useQuery({
        queryKey: queryKeys.orders.list({ limit: 6, purpose: 'dashboard-recent' }),
        queryFn: ({ signal }) => http.get<OrdersPage>('/admin/orders', { params: { limit: 6 }, signal }),
        refetchInterval: 30_000,
    });
    return (
        <Panel
            className={className}
            title="Latest orders"
            titleId="recent-title"
            action={
                <Button variant="ghost" size="sm" asChild className="-mt-1 -mr-2">
                    <a href="/orders">
                        All orders
                        <ArrowRight aria-hidden />
                    </a>
                </Button>
            }
        >
            {orders.isPending ? (
                <div className="grid gap-2">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-12" />
                    ))}
                </div>
            ) : orders.isError ? (
                <ErrorState title="Couldn't load orders" error={orders.error} onRetry={() => orders.refetch()} retrying={orders.isFetching} />
            ) : !orders.data.orders.length ? (
                <EmptyState icon={Inbox} title="No orders yet" description="New orders from the app show up here within half a minute." />
            ) : (
                <ul className="-mx-2 grid grid-cols-[minmax(0,1fr)] divide-y">
                    {orders.data.orders.map((order) => {
                        const items = order.items?.reduce((n, i) => n + (Number(i.quantity) || 0), 0) ?? 0;
                        return (
                            <li key={order._id}>
                                <a
                                    href={`/orders?id=${encodeURIComponent(order._id)}`}
                                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_auto_auto_5.5rem]"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{order.userId?.name || order.userId?.phone || 'Customer'}</p>
                                        <p className="truncate text-xs text-muted-foreground tabular-nums">
                                            {order.orderId} · {items} {items === 1 ? 'item' : 'items'}
                                        </p>
                                    </div>
                                    <StatusBadge kind="order" status={order.orderStatus} className="justify-self-end" />
                                    <Money value={order.totalAmount} className="hidden text-right text-sm font-semibold text-foreground sm:block" />
                                    <DateTime value={order.createdAt} format="relative" className="hidden text-right text-xs text-muted-foreground sm:block" />
                                    <p className="col-span-2 flex justify-between text-xs text-muted-foreground sm:hidden">
                                        <Money value={order.totalAmount} className="font-semibold text-foreground" />
                                        <DateTime value={order.createdAt} format="relative" />
                                    </p>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}

function BestSellers({ from, to, days }: { from: string; to: string; days: number }) {
    const top = useQuery({
        queryKey: analyticsKeys.topProducts(from, to),
        queryFn: ({ signal }) => fetchTopProducts(from, to, signal),
        placeholderData: (p) => p,
        staleTime: 5 * 60_000,
    });
    const rows = top.data?.products.slice(0, 5) ?? [];
    const max = rows[0]?.revenue || 1;
    return (
        <Panel
            title="Best sellers"
            titleId="best-title"
            description={`By revenue, last ${days} days.`}
            action={
                <Button variant="ghost" size="sm" asChild className="-mt-1 -mr-2">
                    <a href="/analytics">
                        Analytics
                        <ArrowRight aria-hidden />
                    </a>
                </Button>
            }
        >
            {top.isPending ? (
                <div className="grid gap-3">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-9" />
                    ))}
                </div>
            ) : top.isError ? (
                <ErrorState title="Couldn't load best sellers" error={top.error} onRetry={() => top.refetch()} />
            ) : !rows.length ? (
                <EmptyState icon={ShoppingBag} title="No sales in this period" description="Products appear here once customers order them." />
            ) : (
                <ol className={cn('grid grid-cols-[minmax(0,1fr)] gap-3 transition-opacity', top.isPlaceholderData && 'opacity-60')}>
                    {rows.map((p) => (
                        <li key={p.productId} className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="min-w-0 truncate text-foreground">{p.name}</span>
                                <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatMoney(Math.round(p.revenue))}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(2, (p.revenue / max) * 100)}%` }} />
                                </div>
                                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{formatNumber(p.units)} sold</span>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </Panel>
    );
}

export default withProviders(DashboardPage);
