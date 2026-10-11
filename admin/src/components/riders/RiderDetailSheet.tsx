import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Pencil, Phone, UserCheck, UserX } from 'lucide-react';
import { DateTime, ErrorState, Money, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/format';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query';
import { displayStatus, formatPhone, hasRealRating, type Rider, type RiderStatsResponse } from './types';

interface DeliveredOrder {
    _id: string;
    orderId: string;
    orderStatus: string;
    totalAmount: number;
    actualDeliveryTime?: string | null;
    updatedAt: string;
    deliveryAddress?: { address?: string; city?: string };
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">{value}</dd>
        </div>
    );
}

function OrderRow({ href, orderId, meta, amount, status }: { href: string; orderId: string; meta: React.ReactNode; amount: number; status?: string }) {
    return (
        <li>
            <a
                href={href}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
                <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{orderId}</span>
                    <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                </div>
                {status ? <StatusBadge kind="order" status={status} /> : null}
                <Money value={amount} className="text-sm font-medium tabular-nums" />
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
            </a>
        </li>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

export function RiderDetailSheet({
    rider,
    open,
    onOpenChange,
    onEdit,
    onToggleActive,
}: {
    rider: Rider | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEdit: (rider: Rider) => void;
    onToggleActive: (rider: Rider) => void;
}) {
    const id = rider?._id;
    const stats = useQuery({
        queryKey: [...queryKeys.riders.all, 'stats', id],
        queryFn: () => http.get<RiderStatsResponse>(`/admin/riders/${id}/stats`),
        enabled: open && !!id,
    });
    const delivered = useQuery({
        queryKey: [...queryKeys.orders.all, 'by-rider', id, 'delivered'],
        queryFn: () =>
            http.get<{ orders: DeliveredOrder[]; total: number }>('/admin/orders', {
                params: { riderId: id, status: 'DELIVERED', limit: 8, sort: '-updatedAt' },
            }),
        enabled: open && !!id,
    });

    const s = stats.data ?? rider?.stats;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
                {rider ? (
                    <>
                        <SheetHeader className="border-b p-4 pr-12">
                            <div className="flex flex-wrap items-center gap-2">
                                <SheetTitle className="text-lg">{rider.name}</SheetTitle>
                                <StatusBadge kind="rider" status={displayStatus(rider)} />
                            </div>
                            <SheetDescription>
                                @{rider.username} · {rider.vehicleType}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
                            <div className="flex flex-wrap gap-2">
                                <Button asChild variant="outline" size="sm">
                                    <a href={`tel:${rider.phone}`}>
                                        <Phone aria-hidden />
                                        {formatPhone(rider.phone)}
                                    </a>
                                </Button>
                            </div>

                            {!rider.isActive ? (
                                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                                    Deactivated. {rider.name} can't sign in to the rider app and won't be offered orders.
                                </p>
                            ) : null}

                            <section aria-label="Delivery numbers" className="space-y-2">
                                <dl className="grid grid-cols-2 gap-2">
                                    <Stat label="Active orders" value={s ? formatNumber(s.activeOrderCount) : <Skeleton className="h-6 w-8" />} />
                                    <Stat label="Delivered today" value={s ? formatNumber(s.deliveredToday) : <Skeleton className="h-6 w-8" />} />
                                    <Stat label="Delivered, all time" value={s ? formatNumber(s.deliveredCount) : <Skeleton className="h-6 w-8" />} />
                                    <Stat label="Cancelled while assigned" value={s ? formatNumber(s.cancelledCount) : <Skeleton className="h-6 w-8" />} />
                                </dl>
                                <p className="text-xs text-muted-foreground">
                                    {s?.lastDeliveredAt ? (
                                        <>
                                            Last delivery <DateTime value={s.lastDeliveredAt} format="relative" />
                                        </>
                                    ) : s ? (
                                        'No deliveries yet'
                                    ) : null}
                                    {hasRealRating(rider) ? (
                                        <>
                                            {' · '}Rated {rider.rating!.toFixed(1)} by {formatNumber(rider.totalRatings)} customers
                                        </>
                                    ) : null}
                                </p>
                            </section>

                            <section className="space-y-2">
                                <SectionTitle>Orders in hand</SectionTitle>
                                {stats.isPending ? (
                                    <Skeleton className="h-12 w-full" />
                                ) : stats.isError ? (
                                    <ErrorState title="Couldn't load active orders" error={stats.error} onRetry={() => stats.refetch()} />
                                ) : stats.data.activeOrders.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {rider.isActive ? 'No orders assigned right now.' : 'No orders assigned.'}
                                    </p>
                                ) : (
                                    <ul className="-mx-2">
                                        {stats.data.activeOrders.map((o) => (
                                            <OrderRow
                                                key={o._id}
                                                href={`/orders?id=${encodeURIComponent(o._id)}`}
                                                orderId={o.orderId}
                                                status={o.orderStatus}
                                                amount={o.totalAmount}
                                                meta={<>Placed <DateTime value={o.createdAt} format="relative" /></>}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section className="space-y-2">
                                <SectionTitle>Recent deliveries</SectionTitle>
                                {delivered.isPending ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-10 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : delivered.isError ? (
                                    <ErrorState title="Couldn't load deliveries" error={delivered.error} onRetry={() => delivered.refetch()} />
                                ) : delivered.data.orders.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No completed deliveries yet.</p>
                                ) : (
                                    <>
                                        <ul className="-mx-2">
                                            {delivered.data.orders.map((o) => (
                                                <OrderRow
                                                    key={o._id}
                                                    href={`/orders?id=${encodeURIComponent(o._id)}`}
                                                    orderId={o.orderId}
                                                    amount={o.totalAmount}
                                                    meta={
                                                        <>
                                                            <DateTime value={o.actualDeliveryTime ?? o.updatedAt} format="datetime" />
                                                            {o.deliveryAddress?.city ? ` · ${o.deliveryAddress.city}` : ''}
                                                        </>
                                                    }
                                                />
                                            ))}
                                        </ul>
                                        {delivered.data.total > delivered.data.orders.length ? (
                                            <p className="text-xs text-muted-foreground">
                                                Showing the latest {delivered.data.orders.length} of {formatNumber(delivered.data.total)}.
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </section>

                            <p className="text-xs text-muted-foreground">
                                Joined <DateTime value={rider.createdAt} format="date" />
                                {rider.lastActiveAt ? (
                                    <>
                                        {' · '}Last active <DateTime value={rider.lastActiveAt} format="relative" />
                                    </>
                                ) : null}
                            </p>
                        </div>

                        <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t p-4">
                            <Button variant={rider.isActive ? 'destructive' : 'outline'} onClick={() => onToggleActive(rider)}>
                                {rider.isActive ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                                {rider.isActive ? 'Deactivate' : 'Reactivate'}
                            </Button>
                            <Button onClick={() => onEdit(rider)}>
                                <Pencil aria-hidden />
                                Edit details
                            </Button>
                        </SheetFooter>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
