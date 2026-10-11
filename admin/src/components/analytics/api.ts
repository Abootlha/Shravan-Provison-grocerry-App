import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query';
import { storeDayKey } from '@/lib/format';

/** Backend OrderStatus, in lifecycle order. */
export const ORDER_STATUSES = [
    'PENDING',
    'CONFIRMED',
    'ASSIGNED',
    'PACKED',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface TimeseriesPoint {
    date: string;
    orders: number;
    revenue: number;
}

/** GET /admin/analytics/summary */
export interface AnalyticsSummary {
    range: { from: string; to: string; timezone: string };
    revenue: number;
    orders: number;
    cancelledOrders: number;
    averageOrderValue: number;
    ordersByStatus: Partial<Record<OrderStatus, number>>;
    activeProducts: number;
    outOfStock: number;
    lowStock: number;
    newCustomers: number;
    timeseries: TimeseriesPoint[];
}

/** GET /admin/analytics/revenue-by-category row. */
export interface CategoryRevenue {
    _id: string;
    categoryName: string;
    revenue: number;
    itemsSold: number;
}

export interface TopProduct {
    productId: string;
    name: string;
    units: number;
    revenue: number;
}

export interface OrderSummaryRow {
    _id: string;
    orderId: string;
    orderStatus: string;
    paymentStatus?: string;
    paymentMethod?: string;
    totalAmount: number;
    items?: { productId?: string | { _id?: string }; name?: string; quantity?: number; price?: number }[];
    userId?: { _id?: string; name?: string; phone?: string } | null;
    createdAt: string;
}

export interface OrdersPage {
    orders: OrderSummaryRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/* ---------------------------------------------------------------- dates (store calendar days) */

/** Today's YYYY-MM-DD in the store timezone. */
export function todayKey(now: Date = new Date()): string {
    return storeDayKey(now);
}

/** YYYY-MM-DD shifted by `days` calendar days (timezone independent). */
export function addDays(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Inclusive number of calendar days in a range. */
export function daysInRange(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** The equally long range that ends the day before `from`. */
export function previousRange(from: string, to: string): { from: string; to: string } {
    const length = daysInRange(from, to);
    return { from: addDays(from, -length), to: addDays(from, -1) };
}

/** UTC instants of the start and end of a store-local (Asia/Kolkata, UTC+5:30) date range. */
export function rangeInstants(from: string, to: string): { start: string; end: string } {
    return {
        start: new Date(`${from}T00:00:00.000+05:30`).toISOString(),
        end: new Date(`${to}T23:59:59.999+05:30`).toISOString(),
    };
}

/**
 * Percentage change from `previous` to `current`. Undefined when there is no meaningful base
 * (missing data or a previous value of 0), so callers never show an invented delta.
 */
export function percentChange(current: number | null | undefined, previous: number | null | undefined): number | undefined {
    if (typeof current !== 'number' || typeof previous !== 'number') return undefined;
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
}

/* ---------------------------------------------------------------- fetchers + keys */

export const analyticsKeys = {
    summary: (from: string, to: string) => [...queryKeys.analytics.all, 'summary', from, to] as const,
    categories: (from: string, to: string) => [...queryKeys.analytics.all, 'categories', from, to] as const,
    topProducts: (from: string, to: string) => [...queryKeys.analytics.all, 'top-products', from, to] as const,
};

export function fetchSummary(from: string, to: string, signal?: AbortSignal) {
    return http.get<AnalyticsSummary>('/admin/analytics/summary', { params: { from, to }, signal });
}

export async function fetchRevenueByCategory(from: string, to: string, signal?: AbortSignal) {
    const { start, end } = rangeInstants(from, to);
    const rows = await http.get<CategoryRevenue[]>('/admin/analytics/revenue-by-category', {
        params: { startDate: start, endDate: end },
        signal,
    });
    return Array.isArray(rows) ? rows : [];
}

const NOT_CANCELLED = ORDER_STATUSES.filter((s) => s !== 'CANCELLED').join(',');
const TOP_PRODUCTS_PAGE_LIMIT = 100;
const TOP_PRODUCTS_MAX_PAGES = 20;

/**
 * Best sellers for a date range, computed from the orders themselves (the top-products
 * endpoint is all-time only). Cancelled orders are excluded, matching the summary revenue.
 * `truncated` is true when the range had more orders than were read.
 */
export async function fetchTopProducts(
    from: string,
    to: string,
    signal?: AbortSignal,
): Promise<{ products: TopProduct[]; ordersRead: number; truncated: boolean }> {
    const { start, end } = rangeInstants(from, to);
    const byProduct = new Map<string, TopProduct>();
    let page = 1;
    let totalPages = 1;
    let ordersRead = 0;
    do {
        const data = await http.get<OrdersPage>('/admin/orders', {
            params: { page, limit: TOP_PRODUCTS_PAGE_LIMIT, status: NOT_CANCELLED, dateFrom: start, dateTo: end },
            signal,
        });
        totalPages = data.totalPages || 0;
        for (const order of data.orders ?? []) {
            ordersRead += 1;
            for (const item of order.items ?? []) {
                const rawId = typeof item.productId === 'object' ? item.productId?._id : item.productId;
                const key = rawId || item.name || 'unknown';
                const quantity = Number(item.quantity) || 0;
                const price = Number(item.price) || 0;
                const row = byProduct.get(key) ?? { productId: key, name: item.name || 'Unnamed product', units: 0, revenue: 0 };
                row.units += quantity;
                row.revenue += price * quantity;
                byProduct.set(key, row);
            }
        }
        page += 1;
    } while (page <= totalPages && page <= TOP_PRODUCTS_MAX_PAGES);

    const products = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
    return { products, ordersRead, truncated: totalPages > TOP_PRODUCTS_MAX_PAGES };
}

/** Rows of a CSV file; values are quoted when needed. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
    return rows
        .map((row) =>
            row
                .map((cell) => {
                    const text = cell === null || cell === undefined ? '' : String(cell);
                    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
                })
                .join(','),
        )
        .join('\r\n');
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
    // BOM so Excel opens ₹ and Hindi names correctly.
    const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
