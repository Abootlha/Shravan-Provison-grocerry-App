import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface StatDelta {
    /** Percentage change, e.g. 12.5 or -4. */
    value: number;
    /** The real comparison period, e.g. "vs yesterday". Required: a delta without a period is meaningless. */
    period: string;
    /** Set when a decrease is good (e.g. cancellations). */
    invert?: boolean;
}

export interface StatCardProps {
    label: string;
    /** A real number from the API. null/undefined renders "—" (never a made-up fallback). */
    value: number | null | undefined;
    /** "money" → ₹ with Indian grouping; "number" (default); or a custom formatter. */
    format?: 'number' | 'money' | ((n: number) => string);
    /** Optional; rendered only when provided. */
    delta?: StatDelta;
    /** One short line of context under the value, e.g. "12 waiting for a rider". */
    hint?: React.ReactNode;
    icon?: LucideIcon;
    loading?: boolean;
    /** Makes the whole card a link to the detailed view. */
    href?: string;
    className?: string;
}

function toFormatter(format: StatCardProps['format']): (n: number) => string {
    if (typeof format === 'function') return format;
    if (format === 'money') return (n) => formatMoney(Math.round(n));
    return (n) => formatNumber(n);
}

export function StatCard({ label, value, format = 'number', delta, hint, icon: Icon, loading, href, className }: StatCardProps) {
    const formatter = toFormatter(format);
    const hasValue = typeof value === 'number' && Number.isFinite(value);

    const body = (
        <>
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
                {loading ? (
                    <Skeleton className="h-8 w-24" />
                ) : hasValue ? (
                    <AnimatedNumber
                        value={value}
                        format={formatter}
                        duration={0.6}
                        className="text-[1.75rem] leading-none font-bold tracking-tight text-foreground"
                    />
                ) : (
                    <span className="text-[1.75rem] leading-none font-bold text-muted-foreground">—</span>
                )}
                {!loading && delta ? <Delta {...delta} /> : null}
            </div>
            {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
        </>
    );

    const classes = cn('gap-0 p-4 shadow-none sm:p-5', href && 'transition-colors hover:border-input hover:bg-accent/40', className);

    if (href) {
        return (
            <Card className={cn(classes, 'relative')}>
                <a href={href} className="absolute inset-0 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-ring" aria-label={label} />
                {body}
            </Card>
        );
    }
    return <Card className={classes}>{body}</Card>;
}

function Delta({ value, period, invert }: StatDelta) {
    const up = value > 0;
    const flat = value === 0;
    const good = flat ? null : invert ? !up : up;
    const DeltaIcon = up ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
                good === null ? 'text-muted-foreground' : good ? 'text-success-text' : 'text-destructive',
            )}
        >
            {!flat ? <DeltaIcon className="size-3.5" aria-hidden /> : null}
            {!flat ? <span className="sr-only">{up ? "Up" : "Down"}</span> : null}
            {flat ? '0%' : `${Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%`}
            <span className="font-normal text-muted-foreground">{period}</span>
        </span>
    );
}
