import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, Loader2, MapPin, Package, Phone, UserMinus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DateTime, ErrorState, Money, StatusBadge, statusLabel, useConfirm } from '@/components/shared';
import { errorMessage } from '@/lib/http';
import { formatMoney } from '@/lib/format';
import { queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import {
    customerOf,
    deliveryPoint,
    formatPhone,
    itemCount,
    LIVE_STATUSES,
    mapsLink,
    nextStep,
    ordersApi,
    PAYMENT_METHOD_LABEL,
    riderOf,
    telHref,
} from './order-model';
import { CancelOrderDialog } from './CancelOrderDialog';
import { RiderPicker } from './RiderPicker';
import { LiveTracking } from './LiveTracking';
import type { AdminRider, OrderDetail, OrderItem, StatusTimelineEntry } from './types';
import type { LiveConnection } from './useOrdersLive';

export interface OrderDetailSheetProps {
    /** Mongo _id or ORD- id of the open order; null closes the sheet. */
    orderId: string | null;
    onOpenChange: (open: boolean) => void;
    /**
     * State of the orders socket. Socket events refresh the open order instantly; while it is
     * down the sheet polls faster so the status, rider and history never go stale.
     */
    connection?: LiveConnection;
}

/** Fallback refresh of an open, in-progress order (ms). Socket events usually win. */
export const DETAIL_POLL_LIVE_MS = 30_000;
export const DETAIL_POLL_OFFLINE_MS = 8_000;

/** How often an open order refreshes by itself: never once it is delivered or cancelled. */
export function detailRefetchInterval(status: OrderDetail['orderStatus'] | undefined, connection: LiveConnection): number | false {
    if (!status || !LIVE_STATUSES.includes(status)) return false;
    return connection === 'live' ? DETAIL_POLL_LIVE_MS : DETAIL_POLL_OFFLINE_MS;
}

export function OrderDetailSheet({ orderId, onOpenChange, connection = 'live' }: OrderDetailSheetProps) {
    // Keep the last id while the sheet animates closed so the content doesn't blank out.
    const [shownId, setShownId] = React.useState(orderId);
    React.useEffect(() => {
        if (orderId) setShownId(orderId);
    }, [orderId]);

    return (
        <Sheet open={Boolean(orderId)} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                size="xl"
                className="gap-0 p-0"
                aria-describedby={undefined}
            >
                {shownId ? <OrderDetailBody id={shownId} connection={connection} /> : null}
            </SheetContent>
        </Sheet>
    );
}

function OrderDetailBody({ id, connection }: { id: string; connection: LiveConnection }) {
    const query = useQuery({
        queryKey: queryKeys.orders.detail(id),
        queryFn: ({ signal }) => ordersApi.detail(id, signal),
        staleTime: 5_000,
        // Delivered and cancelled orders do not change; in-progress ones are rider-driven.
        refetchInterval: (q) => detailRefetchInterval(q.state.data?.orderStatus, connection),
        refetchOnWindowFocus: 'always',
    });

    if (query.isPending) {
        return (
            <>
                <SheetHeader className="border-b pr-12">
                    <SheetTitle className="text-lg">Loading order</SheetTitle>
                    <SheetDescription className="sr-only">Order details are loading.</SheetDescription>
                </SheetHeader>
                <div className="space-y-6 p-4" aria-busy>
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </>
        );
    }

    if (query.isError || !query.data) {
        return (
            <>
                <SheetHeader className="border-b pr-12">
                    <SheetTitle className="text-lg">Order</SheetTitle>
                    <SheetDescription className="sr-only">The order could not be loaded.</SheetDescription>
                </SheetHeader>
                <ErrorState
                    title="Couldn't load this order"
                    error={query.error}
                    onRetry={() => query.refetch()}
                    retrying={query.isFetching}
                />
            </>
        );
    }

    return <OrderDetailView order={query.data} refreshing={query.isFetching} />;
}

function OrderDetailView({ order, refreshing }: { order: OrderDetail; refreshing: boolean }) {
    const client = useQueryClient();
    const confirm = useConfirm();
    const [cancelOpen, setCancelOpen] = React.useState(false);
    const step = nextStep(order);
    const customer = customerOf(order);
    const rider = riderOf(order);
    const point = deliveryPoint(order);
    const count = itemCount(order);
    const tracking = order.orderStatus === 'PICKED_UP' || order.orderStatus === 'OUT_FOR_DELIVERY';

    const settle = (updated?: Partial<OrderDetail>) => {
        if (updated && updated._id) {
            client.setQueryData<OrderDetail>(queryKeys.orders.detail(order._id), (prev) => (prev ? { ...prev, ...updated } : prev));
        }
        return client.invalidateQueries({ queryKey: queryKeys.orders.all });
    };

    const advance = useMutation({
        mutationFn: (status: 'CONFIRMED' | 'PACKED') => ordersApi.setStatus(order._id, status),
        onSuccess: (updated, status) => {
            if (status === 'CONFIRMED') {
                if (updated?.riderAssignmentPending) {
                    toast.warning(`${order.orderId} confirmed`, { description: 'No rider was free. Assign one to send it out.' });
                } else {
                    toast.success(`${order.orderId} confirmed`, { description: 'The nearest available rider has been assigned.' });
                }
            } else {
                toast.success(`${order.orderId} marked packed`, { description: 'The rider has been told it is ready for pickup.' });
            }
            void settle();
        },
        onError: (e) => {
            toast.error('Could not update the order', { description: errorMessage(e) });
            void settle();
        },
    });

    const assign = useMutation({
        mutationFn: async (next: AdminRider) => {
            if (rider && rider.id !== next._id) await ordersApi.unassignRider(order._id);
            return ordersApi.assignRider(order._id, next._id);
        },
        onSuccess: (_o, next) => {
            toast.success(`${next.name} assigned to ${order.orderId}`, { description: 'They need to accept it in the rider app.' });
            void settle();
            void client.invalidateQueries({ queryKey: ['riders'] });
        },
        onError: (e) => {
            toast.error('Could not assign the rider', { description: errorMessage(e) });
            void settle();
            void client.invalidateQueries({ queryKey: ['riders'] });
        },
    });

    const unassign = async () => {
        await confirm({
            title: `Remove ${rider?.name ?? 'the rider'} from ${order.orderId}?`,
            description: 'The rider is freed for other orders. The order stays confirmed until you assign someone else.',
            confirmLabel: 'Remove rider',
            tone: 'destructive',
            onConfirm: async () => {
                await ordersApi.unassignRider(order._id);
                toast.success(`Rider removed from ${order.orderId}`);
                await settle();
                void client.invalidateQueries({ queryKey: ['riders'] });
            },
        });
    };

    const cancel = async (reason: string) => {
        await ordersApi.setStatus(order._id, 'CANCELLED', reason);
        toast.success(`${order.orderId} cancelled`);
        await settle();
    };

    const busy = advance.isPending || assign.isPending;

    return (
        <>
            <SheetHeader className="gap-2 border-b pr-12">
                <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle className="text-lg font-semibold tabular-nums">{order.orderId}</SheetTitle>
                    <StatusBadge kind="order" status={order.orderStatus} />
                    {refreshing ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Refreshing" /> : null}
                </div>
                <SheetDescription>
                    Placed <DateTime value={order.createdAt} /> · {count} {count === 1 ? 'item' : 'items'} · {formatMoney(order.totalAmount)}
                </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {order.requiresManualReview ? (
                    <Callout tone="warning" title="Needs manual review">
                        {order.manualReviewReason || 'This order was cancelled after pickup. Reconcile the stock and cash with the rider.'}
                    </Callout>
                ) : null}
                {order.orderStatus === 'CANCELLED' && order.cancellationReason ? (
                    <Callout tone="destructive" title="Cancelled">
                        {order.cancellationReason}
                    </Callout>
                ) : null}

                {tracking ? (
                    <Section title="Live location">
                        <LiveTracking order={order} />
                    </Section>
                ) : null}

                <Section title="Customer">
                    <dl className="grid gap-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <dt className="sr-only">Name</dt>
                            <dd className="font-medium">{customer.name}</dd>
                            {customer.phone ? (
                                <dd>
                                    <a
                                        href={telHref(customer.phone)}
                                        className="inline-flex items-center gap-1.5 rounded-md text-brand-text tabular-nums underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                                    >
                                        <Phone className="size-3.5" aria-hidden />
                                        {formatPhone(customer.phone)}
                                    </a>
                                </dd>
                            ) : null}
                        </div>
                        <div>
                            <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <MapPin className="size-3.5" aria-hidden />
                                Deliver to{order.deliveryAddress?.type ? ` (${order.deliveryAddress.type})` : ''}
                            </dt>
                            <dd className="text-pretty">
                                {[order.deliveryAddress?.address, order.deliveryAddress?.landmark, order.deliveryAddress?.city, order.deliveryAddress?.pincode]
                                    .filter(Boolean)
                                    .join(', ') || 'No address on this order'}
                            </dd>
                            {point ? (
                                <dd className="mt-1.5">
                                    <a
                                        href={mapsLink(point)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-brand-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                                    >
                                        Open in Google Maps
                                        <ExternalLink className="size-3.5" aria-hidden />
                                        <span className="sr-only">(opens in a new tab)</span>
                                    </a>
                                </dd>
                            ) : null}
                        </div>
                        {order.deliveryInstructions ? (
                            <div>
                                <dt className="mb-1 text-xs font-medium text-muted-foreground">Instructions</dt>
                                <dd className="text-pretty">{order.deliveryInstructions}</dd>
                            </div>
                        ) : null}
                    </dl>
                </Section>

                <Section title="Items">
                    <ul className="divide-y">
                        {order.items.map((item, i) => (
                            <ItemRow key={`${typeof item.productId === 'object' ? item.productId?._id : item.productId}-${i}`} item={item} />
                        ))}
                    </ul>
                    <Bill order={order} />
                </Section>

                <Section title="Payment">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>{PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
                        <StatusBadge kind="payment" status={order.paymentStatus} />
                    </div>
                    {order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING' && order.orderStatus !== 'CANCELLED' ? (
                        <p className="mt-1 text-xs text-muted-foreground">Rider collects {formatMoney(order.totalAmount)} in cash at delivery.</p>
                    ) : null}
                </Section>

                <Section title="Rider">
                    {rider ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                                <p className="font-medium">{rider.name ?? 'Assigned rider'}</p>
                                <p className="text-xs text-muted-foreground">
                                    {[order.rider?.vehicleType ?? rider.vehicleType, order.rider?.totalDeliveries != null ? `${order.rider.totalDeliveries} deliveries` : null, order.rider?.rating ? `${order.rider.rating.toFixed(1)} rating` : null]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {rider.status ? <StatusBadge kind="rider" status={rider.status} /> : null}
                                {rider.phone ? (
                                    <Button asChild size="sm" variant="outline">
                                        <a href={telHref(rider.phone)}>
                                            <Phone aria-hidden />
                                            <span className="tabular-nums">{formatPhone(rider.phone)}</span>
                                        </a>
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {order.orderStatus === 'CANCELLED' || order.orderStatus === 'DELIVERED'
                                ? 'No rider on this order.'
                                : order.orderStatus === 'PENDING'
                                    ? 'A rider is assigned automatically when you confirm the order.'
                                    : 'No rider yet. Assign an available rider below.'}
                        </p>
                    )}
                </Section>

                <Section title="Status history" last>
                    <Timeline order={order} />
                </Section>
            </div>

            {step.advance || step.canAssignRider || step.canUnassignRider || step.canCancel ? (
                <div className="border-t bg-popover p-4">
                    {step.advance?.disabledReason ? (
                        <p className="mb-2 text-xs text-warning">{step.advance.disabledReason}.</p>
                    ) : step.waitingOn ? (
                        <p className="mb-2 text-xs text-muted-foreground">{step.waitingOn}.</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                        {step.advance ? (
                            <Button
                                onClick={() => advance.mutate(step.advance!.status)}
                                disabled={busy || Boolean(step.advance.disabledReason)}
                                className="max-sm:flex-1"
                            >
                                {advance.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Package aria-hidden />}
                                {step.advance.label}
                            </Button>
                        ) : null}
                        {step.canAssignRider ? (
                            <RiderPicker
                                value={rider?.id}
                                label={rider ? 'Reassign rider' : 'Assign rider'}
                                busy={assign.isPending}
                                disabled={busy}
                                onSelect={(r) => assign.mutate(r)}
                                className="max-sm:flex-1"
                            />
                        ) : null}
                        {step.canUnassignRider && rider ? (
                            <Button variant="ghost" onClick={unassign} disabled={busy}>
                                <UserMinus aria-hidden />
                                Remove rider
                            </Button>
                        ) : null}
                        {step.canCancel ? (
                            <Button
                                variant="ghost"
                                className="text-destructive hover:bg-destructive-tint hover:text-destructive sm:ml-auto"
                                onClick={() => setCancelOpen(true)}
                                disabled={busy}
                            >
                                Cancel order
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <CancelOrderDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                orderId={order.orderId}
                flagsReview={step.cancelFlagsReview}
                onConfirm={cancel}
            />
        </>
    );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
    const id = React.useId();
    return (
        <section aria-labelledby={id} className={cn('px-4 py-4', !last && 'border-b')}>
            <h3 id={id} className="mb-3 text-sm font-semibold text-foreground">
                {title}
            </h3>
            {children}
        </section>
    );
}

function Callout({ tone, title, children }: { tone: 'warning' | 'destructive'; title: string; children: React.ReactNode }) {
    return (
        <div
            role="note"
            className={cn(
                'mx-4 mt-4 flex gap-2.5 rounded-lg px-3 py-2.5 text-sm',
                tone === 'warning' ? 'bg-warning-tint text-warning' : 'bg-destructive-tint text-destructive',
            )}
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
                <p className="font-semibold">{title}</p>
                <p className="text-pretty text-foreground/80">{children}</p>
            </div>
        </div>
    );
}

function ItemRow({ item }: { item: OrderItem }) {
    const [broken, setBroken] = React.useState(false);
    const image = item.image || (typeof item.productId === 'object' ? item.productId?.image : undefined);
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return (
        <li className="flex items-center gap-3 py-2.5 text-sm first:pt-0">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {image && !broken ? (
                    <img src={image} alt="" loading="lazy" className="size-full object-contain p-1" onError={() => setBroken(true)} />
                ) : (
                    <Package className="size-4 text-muted-foreground" aria-hidden />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={item.name}>
                    {item.name}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                    {item.unit ? `${item.unit} · ` : ''}
                    {qty} × {formatMoney(price)}
                    {item.sku ? <span className="ml-1.5">SKU {item.sku}</span> : null}
                </p>
            </div>
            <Money value={qty * price} className="font-medium" />
        </li>
    );
}

function Bill({ order }: { order: OrderDetail }) {
    const rows: { label: string; value: React.ReactNode; muted?: boolean }[] = [];
    const itemTotal = order.itemTotal ?? order.items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
    rows.push({ label: 'Item total', value: <Money value={itemTotal} /> });
    if (order.deliveryFee !== undefined)
        rows.push({
            label: 'Delivery fee',
            value: order.deliveryFee > 0 ? <Money value={order.deliveryFee} /> : <span className="text-success-text">Free</span>,
        });
    if (order.packagingFee) rows.push({ label: 'Packaging', value: <Money value={order.packagingFee} /> });
    if (order.discount) rows.push({ label: 'Discount', value: <span className="text-success-text tabular-nums">−{formatMoney(order.discount)}</span> });
    return (
        <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
            {rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd>{row.value}</dd>
                </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>
                    <Money value={order.totalAmount} />
                </dd>
            </div>
        </dl>
    );
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Manager', customer: 'Customer', rider: 'Rider' };

function Timeline({ order }: { order: OrderDetail }) {
    const entries: StatusTimelineEntry[] = order.statusTimeline?.length
        ? order.statusTimeline
        : [{ previousStatus: null, status: 'PENDING', at: order.createdAt, changedByRole: 'customer' }];
    // Oldest first, like a delivery timeline: each new step is added at the end and the
    // highlighted "current" dot moves down. Entries in the same second keep server order.
    const ordered = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => new Date(a.entry.at).getTime() - new Date(b.entry.at).getTime() || a.index - b.index)
        .map(({ entry }) => entry);
    const lastIndex = ordered.length - 1;
    return (
        <ol className="relative space-y-4 border-l pl-5">
            {ordered.map((entry, i) => {
                const current = i === lastIndex;
                const who = entry.changedByName
                    ? `${entry.changedByName}${entry.changedByRole ? ` (${ROLE_LABEL[entry.changedByRole] ?? entry.changedByRole})` : ''}`
                    : entry.changedByRole
                        ? ROLE_LABEL[entry.changedByRole] ?? entry.changedByRole
                        : entry.previousStatus === null
                            ? 'Customer'
                            : 'System';
                return (
                    <li key={`${entry.status}-${entry.at}-${i}`} className="relative text-sm" aria-current={current ? 'step' : undefined}>
                        <span
                            aria-hidden
                            className={cn(
                                'absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-popover',
                                current ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground/40',
                            )}
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className={cn('font-medium', !current && 'text-foreground/80')}>
                                {entry.previousStatus === null && entry.status === 'PENDING' ? 'Order placed' : statusLabel('order', entry.status)}
                            </p>
                            <DateTime value={entry.at} className="text-xs text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">{who}</p>
                        {entry.note ? <p className="mt-1 text-pretty text-foreground/80">“{entry.note}”</p> : null}
                    </li>
                );
            })}
        </ol>
    );
}
