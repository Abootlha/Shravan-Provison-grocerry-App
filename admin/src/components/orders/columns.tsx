import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader, DateTime, Money, StatusBadge } from '@/components/shared';
import { formatTime } from '@/lib/format';
import { customerOf, formatPhone, itemCount, LIVE_STATUSES, PAYMENT_METHOD_SHORT, riderOf } from './order-model';
import type { Order } from './types';

export interface ColumnOptions {
    onOpen: (order: Order) => void;
    /** Orders that arrived over the socket and have not been opened yet. */
    isNew: (id: string) => boolean;
}

export function orderColumns({ onOpen, isNew }: ColumnOptions): ColumnDef<Order>[] {
    return [
        {
            id: 'orderId',
            accessorKey: 'orderId',
            header: 'Order',
            enableSorting: false,
            enableHiding: false,
            meta: { label: 'Order', className: 'min-w-36' },
            cell: ({ row }) => {
                const order = row.original;
                const n = itemCount(order);
                return (
                    <div className="flex flex-col items-start">
                        <span className="flex items-center gap-1.5">
                            {/* The row is clickable with a mouse; this button is the keyboard path to the same sheet. */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpen(order);
                                }}
                                className="rounded-sm font-semibold text-foreground tabular-nums underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                            >
                                {order.orderId}
                            </button>
                            {isNew(order._id) ? <Badge variant="brand">New</Badge> : null}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {n} {n === 1 ? 'item' : 'items'}
                        </span>
                    </div>
                );
            },
        },
        {
            id: 'customer',
            header: 'Customer',
            enableSorting: false,
            meta: { label: 'Customer', className: 'min-w-40' },
            cell: ({ row }) => {
                const c = customerOf(row.original);
                return (
                    <div className="flex min-w-0 flex-col">
                        <span className="max-w-48 truncate">{c.name}</span>
                        {c.phone ? <span className="text-xs text-muted-foreground tabular-nums">{formatPhone(c.phone)}</span> : null}
                    </div>
                );
            },
        },
        {
            id: 'status',
            accessorKey: 'orderStatus',
            header: 'Status',
            enableSorting: false,
            meta: { label: 'Status' },
            cell: ({ row }) => (
                <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge kind="order" status={row.original.orderStatus} />
                    {row.original.requiresManualReview ? <Badge variant="warning">Review</Badge> : null}
                </div>
            ),
        },
        {
            id: 'rider',
            header: 'Rider',
            enableSorting: false,
            meta: { label: 'Rider', className: 'min-w-32' },
            cell: ({ row }) => {
                const order = row.original;
                const rider = riderOf(order);
                if (rider) return <span className="max-w-40 truncate">{rider.name ?? 'Assigned'}</span>;
                // Only a confirmed order without a rider is actually stuck.
                if (order.orderStatus === 'CONFIRMED') return <span className="font-medium text-warning">Needs a rider</span>;
                return <span className="text-muted-foreground">{LIVE_STATUSES.includes(order.orderStatus) ? 'Not yet' : '—'}</span>;
            },
        },
        {
            id: 'payment',
            header: 'Payment',
            enableSorting: false,
            meta: { label: 'Payment' },
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5">
                    <span className="w-11 text-xs text-muted-foreground">{PAYMENT_METHOD_SHORT[row.original.paymentMethod] ?? row.original.paymentMethod}</span>
                    <StatusBadge kind="payment" status={row.original.paymentStatus} />
                </div>
            ),
        },
        {
            id: 'totalAmount',
            accessorKey: 'totalAmount',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
            meta: { label: 'Total', align: 'right' },
            cell: ({ row }) => <Money value={row.original.totalAmount} className="font-medium" />,
        },
        {
            id: 'createdAt',
            accessorKey: 'createdAt',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Placed" />,
            meta: { label: 'Placed', className: 'min-w-28' },
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <DateTime value={row.original.createdAt} format="relative" />
                    <span className="text-xs text-muted-foreground tabular-nums">{formatTime(row.original.createdAt)}</span>
                </div>
            ),
        },
        {
            id: 'updatedAt',
            accessorKey: 'updatedAt',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Last update" />,
            meta: { label: 'Last update' },
            cell: ({ row }) => <DateTime value={row.original.updatedAt} format="relative" />,
        },
        {
            id: 'area',
            header: 'Area',
            enableSorting: false,
            meta: { label: 'Area', className: 'min-w-32' },
            cell: ({ row }) => {
                const a = row.original.deliveryAddress;
                const text = [a?.city, a?.pincode].filter(Boolean).join(' ');
                return text ? <span>{text}</span> : <span className="text-muted-foreground">—</span>;
            },
        },
    ];
}
