import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { statusLabel } from '@/components/shared';
import { formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ORDER_STATUSES, type AnalyticsSummary, type CategoryRevenue, type TimeseriesPoint } from './api';

const dayLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLabelLong = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "6 Oct" for a YYYY-MM-DD calendar day. */
export function shortDay(ymd: string) {
    return dayLabel.format(new Date(`${ymd}T00:00:00Z`));
}
export function longDay(ymd: string) {
    return dayLabelLong.format(new Date(`${ymd}T00:00:00Z`));
}

type Metric = 'revenue' | 'orders';

const METRIC_FORMAT: Record<Metric, (n: number) => string> = {
    revenue: (n) => formatMoney(n),
    orders: (n) => `${formatNumber(n)} ${n === 1 ? 'order' : 'orders'}`,
};

function TooltipCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
    return (
        <div className="grid min-w-36 gap-1 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-float">
            <p className="font-medium">{title}</p>
            {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold tabular-nums">{row.value}</span>
                </div>
            ))}
        </div>
    );
}

/** Daily revenue or orders as a single-series area. The title around it names the series. */
export function TrendChart({
    data,
    metric,
    className,
    label,
}: {
    data: TimeseriesPoint[];
    metric: Metric;
    className?: string;
    /** Accessible name of the chart, e.g. "Revenue per day, last 7 days". */
    label: string;
}) {
    const config = { [metric]: { label: metric === 'revenue' ? 'Revenue' : 'Orders', color: 'var(--chart-1)' } } satisfies ChartConfig;
    const empty = data.every((p) => !p[metric]);
    const dense = data.length > 14;
    return (
        <div className={cn('relative', className)}>
            <ChartContainer config={config} className="aspect-auto h-full w-full" role="img" aria-label={label}>
                <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={dense ? 24 : 8}
                        tickFormatter={shortDay}
                    />
                    <YAxis
                        width={metric === 'revenue' ? 56 : 32}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        tickFormatter={(v: number) => (metric === 'revenue' ? formatMoney(v, { compact: true }) : formatNumber(v))}
                    />
                    <ChartTooltip
                        cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                        content={({ active, payload }) => {
                            const point = active && payload?.[0]?.payload as TimeseriesPoint | undefined;
                            if (!point) return null;
                            return (
                                <TooltipCard
                                    title={longDay(point.date)}
                                    rows={[
                                        { label: 'Revenue', value: formatMoney(point.revenue) },
                                        { label: 'Orders', value: formatNumber(point.orders) },
                                    ]}
                                />
                            );
                        }}
                    />
                    <Area
                        dataKey={metric}
                        type="monotone"
                        stroke={`var(--color-${metric})`}
                        strokeWidth={2}
                        fill={`var(--color-${metric})`}
                        fillOpacity={0.1}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ChartContainer>
            {empty ? (
                <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">
                    No {metric === 'revenue' ? 'sales' : 'orders'} in this period yet
                </p>
            ) : null}
        </div>
    );
}

/** One horizontal bar per order status (lifecycle order), count at the bar tip. */
export function StatusBreakdownChart({
    counts,
    className,
    label,
}: {
    counts: AnalyticsSummary['ordersByStatus'];
    className?: string;
    label: string;
}) {
    const data = ORDER_STATUSES.map((status) => ({ status, label: statusLabel('order', status), count: counts?.[status] ?? 0 }));
    const config = { count: { label: 'Orders', color: 'var(--chart-1)' } } satisfies ChartConfig;
    return (
        <ChartContainer config={config} className={cn('aspect-auto w-full', className)} role="img" aria-label={label}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={6}>
                <XAxis type="number" hide allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} />
                <YAxis type="category" dataKey="label" width={118} tickLine={false} axisLine={false} interval={0} tick={<SingleLineTick />} />
                <ChartTooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={({ active, payload }) => {
                        const row = active && (payload?.[0]?.payload as (typeof data)[number] | undefined);
                        if (!row) return null;
                        return <TooltipCard title={row.label} rows={[{ label: 'Orders', value: formatNumber(row.count) }]} />;
                    }}
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={18} minPointSize={0} isAnimationActive={false}>
                    <LabelList dataKey="count" position="right" offset={8} className="fill-foreground text-xs tabular-nums" formatter={(v: unknown) => formatNumber(v)} />
                </Bar>
            </BarChart>
        </ChartContainer>
    );
}

/** Category-axis label on one line (Recharts wraps long ticks into overlapping lines). */
function SingleLineTick({ x, y, payload, maxChars = 20 }: { x?: number | string; y?: number | string; payload?: { value: string }; maxChars?: number }) {
    const text = String(payload?.value ?? '');
    const shown = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
    return (
        <text x={Number(x) - 8} y={Number(y)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-xs">
            <title>{text}</title>
            {shown}
        </text>
    );
}

const MAX_CATEGORY_BARS = 8;

/** Top categories by revenue; the remainder folds into "Other" so the chart never needs a 9th bar. */
export function foldCategories(rows: CategoryRevenue[]) {
    const sorted = [...rows].sort((a, b) => b.revenue - a.revenue);
    if (sorted.length <= MAX_CATEGORY_BARS) return sorted.map((r) => ({ name: r.categoryName || 'Uncategorised', revenue: r.revenue, itemsSold: r.itemsSold }));
    const head = sorted.slice(0, MAX_CATEGORY_BARS - 1);
    const tail = sorted.slice(MAX_CATEGORY_BARS - 1);
    return [
        ...head.map((r) => ({ name: r.categoryName || 'Uncategorised', revenue: r.revenue, itemsSold: r.itemsSold })),
        {
            name: `Other (${tail.length})`,
            revenue: tail.reduce((s, r) => s + r.revenue, 0),
            itemsSold: tail.reduce((s, r) => s + r.itemsSold, 0),
        },
    ];
}

export function CategoryRevenueChart({ rows, className, label }: { rows: CategoryRevenue[]; className?: string; label: string }) {
    const data = foldCategories(rows);
    const config = { revenue: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig;
    return (
        <ChartContainer
            config={config}
            className={cn('aspect-auto w-full', className)}
            style={{ height: Math.max(data.length * 36, 72) }}
            role="img"
            aria-label={label}
        >
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barCategoryGap={8}>
                <XAxis type="number" hide domain={[0, (max: number) => Math.max(max, 1)]} />
                <YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={false} interval={0} tick={<SingleLineTick maxChars={18} />} />
                <ChartTooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={({ active, payload }) => {
                        const row = active && (payload?.[0]?.payload as (typeof data)[number] | undefined);
                        if (!row) return null;
                        return (
                            <TooltipCard
                                title={row.name}
                                rows={[
                                    { label: 'Revenue', value: formatMoney(row.revenue) },
                                    { label: 'Items sold', value: formatNumber(row.itemsSold) },
                                ]}
                            />
                        );
                    }}
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
                    <LabelList dataKey="revenue" position="right" offset={8} className="fill-foreground text-xs tabular-nums" formatter={(v: unknown) => formatMoney(v)} />
                </Bar>
            </BarChart>
        </ChartContainer>
    );
}
