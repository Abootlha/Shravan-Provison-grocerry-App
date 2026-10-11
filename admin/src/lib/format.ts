/**
 * Formatting for the store: Indian rupees and Asia/Kolkata time, regardless of the
 * browser's locale or timezone. Every function accepts null/undefined and returns "—".
 */
export const STORE_TIME_ZONE = 'Asia/Kolkata';
export const STORE_LOCALE = 'en-IN';
const EMPTY = '—';

const rupees = new Intl.NumberFormat(STORE_LOCALE, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesPaise = new Intl.NumberFormat(STORE_LOCALE, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const rupeesCompact = new Intl.NumberFormat(STORE_LOCALE, {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat(STORE_LOCALE, { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat(STORE_LOCALE, { maximumFractionDigits: 2 });

function toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}

export interface MoneyFormatOptions {
    /** Always show two decimals. Default: decimals only when the amount has paise. */
    paise?: boolean;
    /** ₹1.2L / ₹3.4Cr style for tight spaces such as chart axes. */
    compact?: boolean;
}

/** ₹1,23,456 (Indian digit grouping). Amounts are in rupees. */
export function formatMoney(value: unknown, options: MoneyFormatOptions = {}): string {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    if (options.compact) return rupeesCompact.format(n);
    if (options.paise || Math.round(n * 100) % 100 !== 0) return rupeesPaise.format(n);
    return rupees.format(n);
}

export function formatNumber(value: unknown, options: { decimals?: boolean } = {}): string {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    return (options.decimals ? decimal : integer).format(n);
}

export function formatPercent(value: unknown, fractionDigits = 0): string {
    const n = toNumber(value);
    if (n === null) return EMPTY;
    return `${n.toFixed(fractionDigits)}%`;
}

function toDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
}

const dateFmt = new Intl.DateTimeFormat(STORE_LOCALE, { timeZone: STORE_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(STORE_LOCALE, { timeZone: STORE_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true });
const dateTimeFmt = new Intl.DateTimeFormat(STORE_LOCALE, {
    timeZone: STORE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
});
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 12 Oct 2026 */
export function formatDate(value: unknown): string {
    const d = toDate(value);
    return d ? dateFmt.format(d) : EMPTY;
}

/** 4:05 pm */
export function formatTime(value: unknown): string {
    const d = toDate(value);
    return d ? timeFmt.format(d) : EMPTY;
}

/** 12 Oct 2026, 4:05 pm */
export function formatDateTime(value: unknown): string {
    const d = toDate(value);
    return d ? dateTimeFmt.format(d) : EMPTY;
}

/** YYYY-MM-DD of the store's calendar day (useful for API date filters). */
export function storeDayKey(value: unknown = new Date()): string {
    const d = toDate(value);
    return d ? dayKeyFmt.format(d) : '';
}

const relative = new Intl.RelativeTimeFormat(STORE_LOCALE, { numeric: 'auto' });

/** "5 min ago", "yesterday"; falls back to the date after a week. */
export function formatRelative(value: unknown, now: Date = new Date()): string {
    const d = toDate(value);
    if (!d) return EMPTY;
    const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
    const abs = Math.abs(seconds);
    if (abs < 45) return 'just now';
    if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
    if (abs < 7 * 86400) {
        const days = Math.round((Date.parse(storeDayKey(d)) - Date.parse(storeDayKey(now))) / 86400000);
        return relative.format(days, 'day');
    }
    return formatDate(d);
}
