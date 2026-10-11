import { http } from '@/lib/http';
import { appConfig } from '@/lib/config';
import type { AdminRidersResponse, Order, OrderDetail, OrderStatus, OrdersResponse } from './types';

/* Tabs ---------------------------------------------------------------------------------- */

export const LIVE_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY'];
export const ALL_STATUSES: OrderStatus[] = [...LIVE_STATUSES, 'DELIVERED', 'CANCELLED'];

export type OrdersTab = 'live' | 'completed' | 'cancelled' | 'all';

export const TABS: { value: OrdersTab; label: string; statuses: OrderStatus[] }[] = [
    { value: 'live', label: 'Live', statuses: LIVE_STATUSES },
    { value: 'completed', label: 'Delivered', statuses: ['DELIVERED'] },
    { value: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
    { value: 'all', label: 'All', statuses: ALL_STATUSES },
];

export function tabStatuses(tab: OrdersTab): OrderStatus[] {
    return TABS.find((t) => t.value === tab)?.statuses ?? LIVE_STATUSES;
}

export function isOrdersTab(value: unknown): value is OrdersTab {
    return TABS.some((t) => t.value === value);
}

/* Filters -> query ---------------------------------------------------------------------- */

export interface OrderFilters {
    tab: OrdersTab;
    statuses: OrderStatus[];
    paymentStatus: string;
    paymentMethod: string;
    /** '' = any, 'unassigned', or a rider id. */
    rider: string;
    dateFrom: string;
    dateTo: string;
    q: string;
}

export const EMPTY_FILTERS: Omit<OrderFilters, 'tab'> = {
    statuses: [],
    paymentStatus: '',
    paymentMethod: '',
    rider: '',
    dateFrom: '',
    dateTo: '',
    q: '',
};

export type OrderSort = '-createdAt' | 'createdAt' | '-updatedAt' | 'updatedAt' | '-totalAmount' | 'totalAmount';

export function buildOrderParams(filters: OrderFilters, page: number, limit: number, sort: OrderSort) {
    const allowed = tabStatuses(filters.tab);
    const statuses = filters.statuses.filter((s) => allowed.includes(s));
    return {
        page,
        limit,
        sort,
        status: (statuses.length ? statuses : allowed).join(','),
        paymentStatus: filters.paymentStatus || undefined,
        paymentMethod: filters.paymentMethod || undefined,
        riderId: filters.rider && filters.rider !== 'unassigned' ? filters.rider : undefined,
        unassigned: filters.rider === 'unassigned' ? 'true' : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || filters.dateFrom || undefined,
        q: filters.q.trim().slice(0, 100) || undefined,
    };
}

/* API ----------------------------------------------------------------------------------- */

export const ordersApi = {
    list: (params: ReturnType<typeof buildOrderParams>, signal?: AbortSignal) =>
        http.get<OrdersResponse>('/admin/orders', { params, signal }),
    detail: (id: string, signal?: AbortSignal) =>
        http.get<{ order: OrderDetail }>(`/admin/orders/${encodeURIComponent(id)}`, { signal }).then((r) => r.order),
    setStatus: (id: string, status: 'CONFIRMED' | 'PACKED' | 'CANCELLED', note?: string) =>
        http.patch<{ order: OrderDetail }>(`/admin/orders/${id}/status`, note ? { status, note } : { status }).then((r) => r.order),
    assignRider: (id: string, riderId: string) =>
        http.patch<{ order: Order }>(`/admin/orders/${id}/assign-rider`, { riderId }).then((r) => r.order),
    unassignRider: (id: string) => http.patch<{ order: Order }>(`/admin/orders/${id}/unassign-rider`).then((r) => r.order),
    riders: (signal?: AbortSignal) =>
        http.get<AdminRidersResponse>('/admin/riders', { params: { isActive: 'true' }, signal }),
};

/* Socket URLs --------------------------------------------------------------------------- */

/** The /orders namespace lives next to /tracking on the same origin. */
export function ordersSocketUrl(): string {
    return appConfig.trackingServiceUrl.replace(/\/tracking\/?$/, '') + '/orders';
}

export function trackingSocketUrl(): string {
    return appConfig.trackingServiceUrl;
}

/* What staff can do next ---------------------------------------------------------------- */

const GOODS_LEFT_STORE: OrderStatus[] = ['PICKED_UP', 'OUT_FOR_DELIVERY'];

export function paymentSettled(order: Pick<Order, 'paymentMethod' | 'paymentStatus'>): boolean {
    return order.paymentMethod === 'COD' || order.paymentStatus === 'COMPLETED';
}

export function hasRider(order: Pick<Order, 'riderId'>): boolean {
    return Boolean(order.riderId);
}

export interface NextStep {
    /** The status the backend accepts from staff, if any. */
    advance?: { status: 'CONFIRMED' | 'PACKED'; label: string; disabledReason?: string };
    canCancel: boolean;
    /** Cancelling after pickup flags the order for manual review. */
    cancelFlagsReview: boolean;
    canAssignRider: boolean;
    canUnassignRider: boolean;
    /** Plain-language note on who acts next when staff cannot. */
    waitingOn?: string;
}

/**
 * Staff transitions per backend ORDER_STATUS_TRANSITIONS + PATCH /admin/orders/:id/status:
 * PENDING → CONFIRMED, ASSIGNED → PACKED, anything open → CANCELLED. Rider-controlled steps
 * (ASSIGNED via accept, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED) are read-only here.
 */
export function nextStep(order: Pick<Order, 'orderStatus' | 'paymentMethod' | 'paymentStatus' | 'riderId'>): NextStep {
    const settled = paymentSettled(order);
    const unpaidReason = settled ? undefined : 'Waiting for the online payment to complete';
    switch (order.orderStatus) {
        case 'PENDING':
            return {
                advance: { status: 'CONFIRMED', label: 'Confirm order', disabledReason: unpaidReason },
                canCancel: true,
                cancelFlagsReview: false,
                canAssignRider: false,
                canUnassignRider: false,
            };
        case 'CONFIRMED':
            return {
                canCancel: true,
                cancelFlagsReview: false,
                canAssignRider: settled,
                canUnassignRider: hasRider(order),
                waitingOn: hasRider(order) ? 'Waiting for the rider to accept' : 'Assign a rider to continue',
            };
        case 'ASSIGNED':
            return {
                advance: { status: 'PACKED', label: 'Mark packed' },
                canCancel: true,
                cancelFlagsReview: false,
                canAssignRider: false,
                canUnassignRider: false,
            };
        case 'PACKED':
            return { canCancel: true, cancelFlagsReview: false, canAssignRider: false, canUnassignRider: false, waitingOn: 'Waiting for the rider to pick up' };
        case 'PICKED_UP':
        case 'OUT_FOR_DELIVERY':
            return {
                canCancel: true,
                cancelFlagsReview: GOODS_LEFT_STORE.includes(order.orderStatus),
                canAssignRider: false,
                canUnassignRider: false,
                waitingOn: 'The rider updates this order until delivery',
            };
        default:
            return { canCancel: false, cancelFlagsReview: false, canAssignRider: false, canUnassignRider: false };
    }
}

/* Display helpers ----------------------------------------------------------------------- */

export function customerOf(order: Order | OrderDetail): { name: string; phone?: string } {
    const user = typeof order.userId === 'object' && order.userId ? order.userId : undefined;
    const detail = order as OrderDetail;
    return {
        name: detail.customerName || user?.name || 'Customer',
        phone: detail.customerPhone || user?.phone || undefined,
    };
}

export function riderOf(order: Order | OrderDetail): { id: string; name?: string; phone?: string; vehicleType?: string; status?: string } | null {
    const detail = order as OrderDetail;
    if (detail.rider) return { ...detail.rider, id: detail.rider.id };
    if (!order.riderId) return null;
    if (typeof order.riderId === 'string') return { id: order.riderId };
    return { id: order.riderId._id, name: order.riderId.name, phone: order.riderId.phone, vehicleType: order.riderId.vehicleType, status: order.riderId.status };
}

export function itemCount(order: Pick<Order, 'items'>): number {
    return (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

/** [lat, lng] of the delivery point; GeoJSON stores [lng, lat]. */
export function deliveryPoint(order: Order): [number, number] | null {
    const c = order.deliveryAddress?.coordinates?.coordinates;
    if (!Array.isArray(c) || c.length < 2) return null;
    const [lng, lat] = c;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
    return [lat, lng];
}

export function mapsLink(point: [number, number]): string {
    return `https://www.google.com/maps/search/?api=1&query=${point[0]},${point[1]}`;
}

export function formatPhone(phone?: string | null): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '');
    const local = digits.length > 10 ? digits.slice(-10) : digits;
    if (local.length !== 10) return phone;
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function telHref(phone?: string | null): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : undefined;
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
    COD: 'Cash on delivery',
    UPI: 'UPI',
    CARD: 'Card',
    WALLET: 'Wallet',
};

export const PAYMENT_METHOD_SHORT: Record<string, string> = { COD: 'COD', UPI: 'UPI', CARD: 'Card', WALLET: 'Wallet' };
