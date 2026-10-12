import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'destructive';

interface StatusDef {
    label: string;
    tone: StatusTone;
}

/** Order lifecycle (backend OrderStatus). Brand marks orders that are moving. */
export const ORDER_STATUS: Record<string, StatusDef> = {
    PENDING: { label: 'Pending', tone: 'warning' },
    CONFIRMED: { label: 'Confirmed', tone: 'neutral' },
    PACKED: { label: 'Packed', tone: 'neutral' },
    ASSIGNED: { label: 'Rider assigned', tone: 'brand' },
    PICKED_UP: { label: 'Picked up', tone: 'brand' },
    OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'brand' },
    DELIVERED: { label: 'Delivered', tone: 'success' },
    CANCELLED: { label: 'Cancelled', tone: 'destructive' },
};

/** Backend PaymentStatus. */
export const PAYMENT_STATUS: Record<string, StatusDef> = {
    PENDING: { label: 'Unpaid', tone: 'warning' },
    COMPLETED: { label: 'Paid', tone: 'success' },
    FAILED: { label: 'Failed', tone: 'destructive' },
    REFUNDED: { label: 'Refunded', tone: 'neutral' },
};

/** Product publishing state. */
export const PRODUCT_STATUS: Record<string, StatusDef> = {
    active: { label: 'Active', tone: 'success' },
    draft: { label: 'Draft', tone: 'warning' },
    archived: { label: 'Archived', tone: 'neutral' },
    inactive: { label: 'Hidden', tone: 'neutral' },
    unavailable: { label: 'Unavailable', tone: 'neutral' },
};

/** Stock level. Use `stockStatus(qty)` to derive it with the shared threshold. */
export const STOCK_STATUS: Record<string, StatusDef> = {
    in_stock: { label: 'In stock', tone: 'success' },
    low: { label: 'Low stock', tone: 'warning' },
    out: { label: 'Out of stock', tone: 'destructive' },
};

/** Rider availability. */
export const RIDER_STATUS: Record<string, StatusDef> = {
    available: { label: 'Available', tone: 'success' },
    busy: { label: 'On delivery', tone: 'brand' },
    offline: { label: 'Offline', tone: 'neutral' },
    inactive: { label: 'Deactivated', tone: 'neutral' },
};

const MAPS = {
    order: ORDER_STATUS,
    payment: PAYMENT_STATUS,
    product: PRODUCT_STATUS,
    stock: STOCK_STATUS,
    rider: RIDER_STATUS,
} as const;

export type StatusKind = keyof typeof MAPS;

/** One threshold for "low stock" everywhere (the audit found <10 and <=10 in different pages). */
export const LOW_STOCK_THRESHOLD = 10;

export function stockStatus(quantity: number | null | undefined, threshold = LOW_STOCK_THRESHOLD): 'in_stock' | 'low' | 'out' {
    const qty = Number(quantity ?? 0);
    if (qty <= 0) return 'out';
    if (qty <= threshold) return 'low';
    return 'in_stock';
}

function humanize(value: string) {
    const text = value.replace(/[_-]+/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusLabel(kind: StatusKind, status: string | null | undefined): string {
    if (!status) return '—';
    return MAPS[kind][status]?.label ?? MAPS[kind][status.toUpperCase()]?.label ?? humanize(status);
}

export interface StatusBadgeProps {
    kind: StatusKind;
    status: string | null | undefined;
    /** Override the label (e.g. add a count). */
    children?: React.ReactNode;
    className?: string;
}

/** Colour + text label, never colour alone. Unknown statuses render as a neutral, humanised label. */
export function StatusBadge({ kind, status, children, className }: StatusBadgeProps) {
    const def = status ? MAPS[kind][status] ?? MAPS[kind][status.toUpperCase()] ?? MAPS[kind][status.toLowerCase()] : undefined;
    const tone: StatusTone = def?.tone ?? 'neutral';
    return (
        <Badge variant={tone} className={cn('font-semibold', className)} data-status={status ?? undefined}>
            {children ?? def?.label ?? (status ? humanize(status) : '—')}
        </Badge>
    );
}
