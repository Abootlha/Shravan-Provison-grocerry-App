import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { DateTime, ErrorState, Money, StatusBadge } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/format';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query';
import { formatPhone } from '@/components/riders/types';
import { type Customer, type CustomerDetailResponse, customerName } from './types';

const PAYMENT_METHOD: Record<string, string> = { COD: 'Cash on delivery', UPI: 'UPI', CARD: 'Card', NETBANKING: 'Net banking', WALLET: 'Wallet' };

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 truncate text-lg font-semibold text-foreground tabular-nums">{children}</dd>
        </div>
    );
}

export function CustomerDetailSheet({
    customerId,
    preview,
    onOpenChange,
}: {
    customerId: string | null;
    /** The row the user clicked, shown while the full profile loads. */
    preview?: Customer | null;
    onOpenChange: (open: boolean) => void;
}) {
    const detail = useQuery({
        queryKey: [...queryKeys.customers.all, 'detail', customerId],
        queryFn: () => http.get<CustomerDetailResponse>(`/admin/customers/${customerId}`),
        enabled: !!customerId,
    });

    const c = detail.data?.customer ?? preview ?? null;
    const name = c ? customerName(c) : null;
    const addresses = detail.data?.addresses ?? [];
    const orders = detail.data?.recentOrders ?? [];

    return (
        <Sheet open={!!customerId} onOpenChange={onOpenChange}>
            <SheetContent size="md" className="gap-0 p-0">
                <SheetHeader className="border-b p-4 pr-12">
                    <div className="flex flex-wrap items-center gap-2">
                        <SheetTitle className="text-lg">{c ? (name ?? formatPhone(c.phone)) : 'Customer'}</SheetTitle>
                        {c && !c.isActive ? <Badge variant="neutral">Blocked</Badge> : null}
                    </div>
                    <SheetDescription>
                        {c ? (
                            <>
                                Customer since <DateTime value={c.createdAt} format="date" />
                                {name ? null : ' · No name on the account'}
                            </>
                        ) : (
                            'Loading profile'
                        )}
                    </SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
                    {detail.isError && !c ? (
                        <ErrorState title="Couldn't load this customer" error={detail.error} onRetry={() => detail.refetch()} />
                    ) : null}

                    {c ? (
                        <div className="flex flex-wrap gap-2">
                            {c.phone ? (
                                <Button asChild variant="outline" size="sm">
                                    <a href={`tel:${c.phone}`}>
                                        <Phone aria-hidden />
                                        {formatPhone(c.phone)}
                                    </a>
                                </Button>
                            ) : null}
                            {c.email ? (
                                <Button asChild variant="outline" size="sm" className="max-w-full">
                                    <a href={`mailto:${c.email}`}>
                                        <Mail aria-hidden />
                                        <span className="truncate">{c.email}</span>
                                    </a>
                                </Button>
                            ) : null}
                        </div>
                    ) : null}

                    {c ? (
                        <dl className="grid grid-cols-2 gap-2">
                            <Figure label="Orders">{formatNumber(c.orderCount)}</Figure>
                            <Figure label="Delivered">{formatNumber(c.deliveredCount)}</Figure>
                            <Figure label="Spent on delivered orders">
                                <Money value={c.totalSpent} />
                            </Figure>
                            <Figure label="Last order">
                                {c.lastOrderAt ? <DateTime value={c.lastOrderAt} format="relative" /> : 'Never'}
                            </Figure>
                        </dl>
                    ) : null}

                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">Recent orders</h3>
                        {detail.isPending ? (
                            <div className="space-y-2">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        ) : detail.isError ? (
                            c ? <ErrorState title="Couldn't load orders" error={detail.error} onRetry={() => detail.refetch()} /> : null
                        ) : orders.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No orders yet.</p>
                        ) : (
                            <ul className="-mx-2">
                                {orders.map((o) => (
                                    <li key={o._id}>
                                        <a
                                            href={`/orders?id=${encodeURIComponent(o._id)}`}
                                            className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-foreground">{o.orderId}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    <DateTime value={o.createdAt} format="datetime" /> · {formatNumber(o.itemCount)}{' '}
                                                    {o.itemCount === 1 ? 'item' : 'items'} · {PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod}
                                                </span>
                                            </div>
                                            <StatusBadge kind="order" status={o.orderStatus} />
                                            <Money value={o.totalAmount} className="text-sm font-medium tabular-nums" />
                                            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {orders.length === 10 ? (
                            <p className="text-xs text-muted-foreground">Showing the latest 10 orders.</p>
                        ) : null}
                    </section>

                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">Saved addresses</h3>
                        {detail.isPending ? (
                            <Skeleton className="h-14 w-full" />
                        ) : addresses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No saved addresses.</p>
                        ) : (
                            <ul className="space-y-2">
                                {addresses.map((a, i) => (
                                    <li key={i} className="flex gap-3 rounded-lg border px-3 py-2.5">
                                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                                        <div className="min-w-0 text-sm">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-foreground capitalize">{a.type || 'Address'}</span>
                                                {a.isDefault ? <Badge variant="neutral">Default</Badge> : null}
                                            </div>
                                            <p className="text-pretty text-muted-foreground">
                                                {a.address}
                                                {a.city ? `, ${a.city}` : ''}
                                                {a.pincode ? ` ${a.pincode}` : ''}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
