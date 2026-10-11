import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Download, ShoppingBag, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { DateRangePickerDropdown, type DateRange, type DateRangePreset } from '@/components/motion/date-range-picker';
import { EmptyState, ErrorState, PageContainer, PageHeader, statusLabel, withProviders, type StatDelta } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    addDays,
    analyticsKeys,
    daysInRange,
    downloadCsv,
    fetchRevenueByCategory,
    fetchSummary,
    fetchTopProducts,
    ORDER_STATUSES,
    percentChange,
    previousRange,
    todayKey,
    type AnalyticsSummary,
} from './api';
import { CategoryRevenueChart, StatusBreakdownChart, TrendChart, longDay, shortDay } from './charts';
import { KpiCard } from './KpiCard';

const MAX_DAYS = 366;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function monthStart(ymd: string) {
    return `${ymd.slice(0, 7)}-01`;
}

function buildPresets(today: string): DateRangePreset[] {
    const thisMonth = monthStart(today);
    const lastMonthEnd = addDays(thisMonth, -1);
    return [
        { label: 'Today', value: { from: today, to: today } },
        { label: '7 days', value: { from: addDays(today, -6), to: today } },
        { label: '30 days', value: { from: addDays(today, -29), to: today } },
        { label: '90 days', value: { from: addDays(today, -89), to: today } },
        { label: 'This month', value: { from: thisMonth, to: today } },
        { label: 'Last month', value: { from: monthStart(lastMonthEnd), to: lastMonthEnd } },
    ];
}

/** Range from ?from&to so a view can be bookmarked or shared; falls back to the last 30 days. */
function readRange(today: string): { from: string; to: string } {
    const fallback = { from: addDays(today, -29), to: today };
    if (typeof window === 'undefined') return fallback;
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    if (!YMD.test(from) || !YMD.test(to) || from > to || to > today || daysInRange(from, to) > MAX_DAYS) return fallback;
    return { from, to };
}

function useRange(today: string) {
    const [range, setRange] = React.useState(() => ({ from: addDays(today, -29), to: today }));
    React.useEffect(() => setRange(readRange(today)), [today]);
    const update = React.useCallback((next: { from: string; to: string }) => {
        setRange(next);
        const url = new URL(window.location.href);
        url.searchParams.set('from', next.from);
        url.searchParams.set('to', next.to);
        window.history.replaceState(null, '', url);
    }, []);
    return [range, update] as const;
}

function delta(current: number | undefined, previous: number | undefined, period: string, invert = false): StatDelta | undefined {
    const value = percentChange(current, previous);
    return value === undefined ? undefined : { value, period, invert };
}

function AnalyticsPage() {
    const today = todayKey();
    const [range, setRange] = useRange(today);
    const { from, to } = range;
    const length = daysInRange(from, to);
    const prev = previousRange(from, to);
    const presets = React.useMemo(() => buildPresets(today), [today]);
    const periodLabel = `vs previous ${length === 1 ? 'day' : `${length} days`}`;

    const summary = useQuery({
        queryKey: analyticsKeys.summary(from, to),
        queryFn: ({ signal }) => fetchSummary(from, to, signal),
        placeholderData: (p) => p,
    });
    const previous = useQuery({ queryKey: analyticsKeys.summary(prev.from, prev.to), queryFn: ({ signal }) => fetchSummary(prev.from, prev.to, signal) });
    const categories = useQuery({
        queryKey: analyticsKeys.categories(from, to),
        queryFn: ({ signal }) => fetchRevenueByCategory(from, to, signal),
        placeholderData: (p) => p,
    });
    const top = useQuery({
        queryKey: analyticsKeys.topProducts(from, to),
        queryFn: ({ signal }) => fetchTopProducts(from, to, signal),
        placeholderData: (p) => p,
        staleTime: 5 * 60_000,
    });

    const s = summary.data;
    const p = previous.data;
    const stale = summary.isPlaceholderData;
    const includesToday = to === today;

    const onRangeChange = (value: DateRange | null) => {
        if (!value?.from) return;
        const next = { from: value.from, to: value.to ?? value.from };
        if (daysInRange(next.from, next.to) > MAX_DAYS) {
            toast.error('Pick a range of one year or less');
            return;
        }
        setRange(next);
    };

    const file = (name: string) => `${name}_${from}_to_${to}.csv`;
    const exports = {
        daily: () =>
            s &&
            downloadCsv(file('daily-sales'), [['Date', 'Orders', 'Revenue (INR)'], ...s.timeseries.map((d) => [d.date, d.orders, d.revenue])]),
        status: () =>
            s && downloadCsv(file('orders-by-status'), [['Status', 'Orders'], ...ORDER_STATUSES.map((st) => [statusLabel('order', st), s.ordersByStatus[st] ?? 0])]),
        categories: () =>
            categories.data &&
            downloadCsv(file('revenue-by-category'), [
                ['Category', 'Revenue (INR)', 'Items sold'],
                ...categories.data.map((c) => [c.categoryName, c.revenue, c.itemsSold]),
            ]),
        products: () =>
            top.data &&
            downloadCsv(file('top-products'), [['Product', 'Units sold', 'Revenue (INR)'], ...top.data.products.map((r) => [r.name, r.units, r.revenue])]),
        summary: () =>
            s &&
            downloadCsv(file('summary'), [
                ['Metric', 'Value'],
                ['From', s.range.from],
                ['To', s.range.to],
                ['Revenue (INR)', s.revenue],
                ['Orders', s.orders],
                ['Average order value (INR)', Math.round(s.averageOrderValue * 100) / 100],
                ['Cancelled orders', s.cancelledOrders],
                ['New customers', s.newCustomers],
            ]),
    };

    return (
        <PageContainer>
            <PageHeader
                title="Analytics"
                description="Sales, orders and best sellers for any period. Revenue counts every order that was not cancelled, by the day it was placed."
                actions={
                    <>
                        <DateRangePickerDropdown
                            label="Report period"
                            value={{ from, to }}
                            onValueChange={onRangeChange}
                            presets={presets}
                            max={today}
                            min={addDays(today, -730)}
                            closeOnSelect
                            locale="en-IN"
                            triggerClassName="h-8 rounded-lg"
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={!s}>
                                    <Download aria-hidden />
                                    Export CSV
                                    <ChevronDown aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                    {shortDay(from)} – {shortDay(to)}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={exports.summary}>Summary</DropdownMenuItem>
                                <DropdownMenuItem onSelect={exports.daily}>Daily sales</DropdownMenuItem>
                                <DropdownMenuItem onSelect={exports.status}>Orders by status</DropdownMenuItem>
                                <DropdownMenuItem onSelect={exports.categories} disabled={!categories.data}>
                                    Revenue by category
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={exports.products} disabled={!top.data}>
                                    Top products
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                }
            />

            {summary.isError && !s ? (
                <div className="rounded-xl bg-card ring-1 ring-border">
                    <ErrorState title="Couldn't load analytics" error={summary.error} onRetry={() => summary.refetch()} retrying={summary.isFetching} />
                </div>
            ) : (
                <>
                    <section aria-label="Totals for the period" className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5', stale && 'opacity-70')}>
                        <KpiCard label="Revenue" value={s?.revenue} format="money" loading={summary.isPending} delta={delta(s?.revenue, p?.revenue, periodLabel)} />
                        <KpiCard label="Orders" value={s?.orders} loading={summary.isPending} delta={delta(s?.orders, p?.orders, periodLabel)} />
                        <KpiCard
                            label="Average order"
                            value={s?.averageOrderValue}
                            format="money"
                            loading={summary.isPending}
                            delta={delta(s?.averageOrderValue, p?.averageOrderValue, periodLabel)}
                        />
                        <KpiCard
                            label="New customers"
                            value={s?.newCustomers}
                            loading={summary.isPending}
                            delta={delta(s?.newCustomers, p?.newCustomers, periodLabel)}
                            hint="Accounts created in the period"
                        />
                        <KpiCard
                            label="Cancelled"
                            value={s?.cancelledOrders}
                            loading={summary.isPending}
                            delta={delta(s?.cancelledOrders, p?.cancelledOrders, periodLabel, true)}
                            hint="Not included in revenue"
                            className="col-span-2 md:col-span-1"
                        />
                    </section>
                    <p className="-mt-3 text-xs text-muted-foreground">
                        {longDay(from)} – {longDay(to)} ({length} {length === 1 ? 'day' : 'days'}). Changes compare with {shortDay(prev.from)} – {shortDay(prev.to)}.
                        {includesToday ? ' Today is still in progress.' : ''}
                    </p>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <Card title="Revenue per day" id="rev">
                            {s ? (
                                <TrendChart data={s.timeseries} metric="revenue" label={`Revenue per day, ${from} to ${to}`} className={cn('h-60', stale && 'opacity-60')} />
                            ) : (
                                <Skeleton className="h-60" />
                            )}
                        </Card>
                        <Card title="Orders per day" id="ord">
                            {s ? (
                                <TrendChart data={s.timeseries} metric="orders" label={`Orders per day, ${from} to ${to}`} className={cn('h-60', stale && 'opacity-60')} />
                            ) : (
                                <Skeleton className="h-60" />
                            )}
                        </Card>
                    </div>
                    {s ? <DailyTable summary={s} /> : null}

                    <div className="grid gap-4 lg:grid-cols-5">
                        <Card title="Orders by status" id="status" description="Orders placed in the period, by where they are now." className="lg:col-span-2">
                            {s ? (
                                <StatusBreakdownChart counts={s.ordersByStatus} label="Orders by status" className={cn('h-72', stale && 'opacity-60')} />
                            ) : (
                                <Skeleton className="h-72" />
                            )}
                        </Card>
                        <Card title="Revenue by category" id="cat" description="Item value only; delivery and packaging fees are not split by category." className="lg:col-span-3">
                            {categories.isPending ? (
                                <Skeleton className="h-72" />
                            ) : categories.isError ? (
                                <ErrorState title="Couldn't load categories" error={categories.error} onRetry={() => categories.refetch()} />
                            ) : !categories.data.length ? (
                                s && s.orders > 0 ? (
                                    <EmptyState
                                        icon={Tags}
                                        title="No category breakdown for these sales"
                                        description="There were orders in this period, but none of their products could be matched to a category. Check that products have a category set."
                                    />
                                ) : (
                                    <EmptyState icon={Tags} title="No sales in this period" description="Pick a longer period, or check back after orders come in." />
                                )
                            ) : (
                                <CategoryRevenueChart rows={categories.data} label="Revenue by category" className={cn(categories.isPlaceholderData && 'opacity-60')} />
                            )}
                        </Card>
                    </div>

                    <Card
                        title="Top products"
                        id="top"
                        description={
                            top.data?.truncated
                                ? `Based on the latest ${formatNumber(top.data.ordersRead)} orders in the period. Narrow the range for exact totals.`
                                : 'By revenue from orders that were not cancelled.'
                        }
                    >
                        {top.isPending ? (
                            <div className="grid gap-2">
                                {Array.from({ length: 6 }, (_, i) => (
                                    <Skeleton key={i} className="h-9" />
                                ))}
                            </div>
                        ) : top.isError ? (
                            <ErrorState title="Couldn't load top products" error={top.error} onRetry={() => top.refetch()} />
                        ) : !top.data.products.length ? (
                            <EmptyState icon={ShoppingBag} title="No products sold in this period" description="Pick a longer period to see best sellers." />
                        ) : (
                            <TopProductsTable rows={top.data.products} total={top.data.products.reduce((n, r) => n + r.revenue, 0)} dim={top.isPlaceholderData} />
                        )}
                    </Card>
                </>
            )}
        </PageContainer>
    );
}

function Card({ title, id, description, children, className }: { title: string; id: string; description?: string; children: React.ReactNode; className?: string }) {
    return (
        <section aria-labelledby={`${id}-title`} className={cn('min-w-0 rounded-xl bg-card p-4 ring-1 ring-border sm:p-5', className)}>
            <h2 id={`${id}-title`} className="text-sm font-semibold text-foreground">
                {title}
            </h2>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
            <div className="mt-4">{children}</div>
        </section>
    );
}

function DailyTable({ summary }: { summary: AnalyticsSummary }) {
    return (
        <details className="group -mt-2 rounded-xl bg-card ring-1 ring-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground select-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-5">
                Daily numbers as a table
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="max-h-80 overflow-auto border-t">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                        <tr>
                            <th scope="col" className="px-4 py-2 font-medium sm:px-5">Date</th>
                            <th scope="col" className="px-4 py-2 text-right font-medium">Orders</th>
                            <th scope="col" className="px-4 py-2 text-right font-medium sm:px-5">Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {[...summary.timeseries].reverse().map((d) => (
                            <tr key={d.date}>
                                <th scope="row" className="px-4 py-2 text-left font-normal text-foreground sm:px-5">{longDay(d.date)}</th>
                                <td className="px-4 py-2 text-right tabular-nums">{formatNumber(d.orders)}</td>
                                <td className="px-4 py-2 text-right tabular-nums sm:px-5">{formatMoney(d.revenue)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

const PAGE = 10;

function TopProductsTable({ rows, total, dim }: { rows: { productId: string; name: string; units: number; revenue: number }[]; total: number; dim?: boolean }) {
    const [expanded, setExpanded] = React.useState(false);
    const shown = expanded ? rows : rows.slice(0, PAGE);
    return (
        <div className={cn('transition-opacity', dim && 'opacity-60')}>
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                        <tr className="border-b">
                            <th scope="col" className="hidden w-10 py-2 pl-5 font-medium sm:table-cell">#</th>
                            <th scope="col" className="py-2 pr-2 pl-4 font-medium sm:pl-2">Product</th>
                            <th scope="col" className="px-2 py-2 text-right font-medium">Units</th>
                            <th scope="col" className="py-2 pr-4 pl-2 text-right font-medium sm:pr-2">Revenue</th>
                            <th scope="col" className="hidden py-2 pr-5 pl-2 text-right font-medium sm:table-cell">Share</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {shown.map((r, i) => (
                            <tr key={r.productId}>
                                <td className="hidden py-2.5 pl-5 text-muted-foreground tabular-nums sm:table-cell">{i + 1}</td>
                                <th scope="row" className="w-full max-w-0 truncate py-2.5 pr-2 pl-4 text-left font-normal text-foreground sm:pl-2" title={r.name}>{r.name}</th>
                                <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(r.units)}</td>
                                <td className="py-2.5 pr-4 pl-2 text-right font-medium tabular-nums sm:pr-2">{formatMoney(Math.round(r.revenue))}</td>
                                <td className="hidden py-2.5 pr-5 pl-2 text-right text-muted-foreground tabular-nums sm:table-cell">
                                    {total > 0 ? `${((r.revenue / total) * 100).toFixed(1)}%` : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length > PAGE ? (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpanded((v) => !v)}>
                    {expanded ? 'Show top 10' : `Show all ${rows.length}`}
                </Button>
            ) : null}
        </div>
    );
}

export default withProviders(AnalyticsPage);
