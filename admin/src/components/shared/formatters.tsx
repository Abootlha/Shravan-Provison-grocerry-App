import { formatDate, formatDateTime, formatMoney, formatRelative, formatTime, type MoneyFormatOptions } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface MoneyProps extends MoneyFormatOptions {
    value: number | string | null | undefined;
    className?: string;
}

/** Rupee amount in tabular figures: <Money value={order.totalAmount} /> */
export function Money({ value, className, ...options }: MoneyProps) {
    return <span className={cn('tabular-nums', className)}>{formatMoney(value, options)}</span>;
}

export interface DateTimeProps {
    value: string | number | Date | null | undefined;
    /** date: 12 Oct 2026 · time: 4:05 pm · datetime (default) · relative: 5 min ago (full date in the tooltip). */
    format?: 'date' | 'time' | 'datetime' | 'relative';
    className?: string;
}

/** A <time> element in Asia/Kolkata, whatever the viewer's timezone. */
export function DateTime({ value, format = 'datetime', className }: DateTimeProps) {
    if (value === null || value === undefined || value === '') {
        return <span className={cn('text-muted-foreground', className)}>—</span>;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return <span className={cn('text-muted-foreground', className)}>—</span>;
    const text =
        format === 'date'
            ? formatDate(date)
            : format === 'time'
                ? formatTime(date)
                : format === 'relative'
                    ? formatRelative(date)
                    : formatDateTime(date);
    return (
        <time dateTime={date.toISOString()} title={formatDateTime(date)} className={cn('tabular-nums', className)}>
            {text}
        </time>
    );
}
