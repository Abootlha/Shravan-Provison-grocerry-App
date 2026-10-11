import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { Bike, Eye, MoreHorizontal, Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import {
    DataTable,
    DataTableColumnHeader,
    DateTime,
    EmptyState,
    PageContainer,
    PageHeader,
    StatusBadge,
    useConfirm,
    withProviders,
} from '@/components/shared';
import { registerSearchProvider } from '@/components/shell/command-registry';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { formatNumber } from '@/lib/format';
import { http, isApiError } from '@/lib/http';
import { queryClient } from '@/lib/query';
import { cn } from '@/lib/utils';
import { RiderDetailSheet } from './RiderDetailSheet';
import { RiderFormSheet } from './RiderFormSheet';
import {
    displayStatus,
    fetchRiders,
    formatPhone,
    hasRealRating,
    invalidateRiders,
    type Rider,
    ridersListKey,
    type RidersSummary,
} from './types';

type Filter = 'all' | 'available' | 'busy' | 'offline' | 'inactive';

const FILTERS: { id: Filter; label: string; count: (s: RidersSummary) => number }[] = [
    { id: 'all', label: 'All', count: (s) => s.total },
    { id: 'available', label: 'Available', count: (s) => s.available },
    { id: 'busy', label: 'On delivery', count: (s) => s.busy },
    { id: 'offline', label: 'Offline', count: (s) => Math.max(0, s.active - s.available - s.busy) },
    { id: 'inactive', label: 'Deactivated', count: (s) => s.inactive },
];

const matchesFilter = (rider: Rider, filter: Filter) =>
    filter === 'all' ? true : filter === 'inactive' ? !rider.isActive : rider.isActive && rider.status === filter;

const matchesQuery = (rider: Rider, q: string) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const digits = q.replace(/\D/g, '');
    return (
        rider.name.toLowerCase().includes(needle) ||
        rider.username.toLowerCase().includes(needle) ||
        (digits.length >= 3 && rider.phone.replace(/\D/g, '').includes(digits))
    );
};

/** ⌘K: find a rider by name, username or phone. Uses the cached roster. */
function useRiderSearchProvider() {
    React.useEffect(
        () =>
            registerSearchProvider({
                id: 'riders',
                group: 'Riders',
                minQueryLength: 2,
                search: async (q) => {
                    const data = await queryClient.fetchQuery({ queryKey: ridersListKey, queryFn: fetchRiders, staleTime: 30_000 });
                    return data.riders
                        .filter((r) => matchesQuery(r, q))
                        .slice(0, 6)
                        .map((r) => ({
                            id: `rider-${r._id}`,
                            label: r.name,
                            group: 'Riders',
                            hint: r.isActive ? formatPhone(r.phone) : 'Deactivated',
                            icon: Bike,
                            href: `/riders?id=${r._id}`,
                        }));
                },
            }),
        [],
    );
}

function RidersPage() {
    const confirm = useConfirm();
    const riders = useQuery({ queryKey: ridersListKey, queryFn: fetchRiders });
    const [filter, setFilter] = React.useState<Filter>('all');
    const [query, setQuery] = React.useState('');
    const [formOpen, setFormOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Rider | null>(null);
    const [detailId, setDetailId] = React.useState<string | null>(null);

    useRiderSearchProvider();

    // Deep links: /riders?id=<riderId> opens the detail, /riders?action=new opens the form.
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const action = params.get('action');
        if (id) setDetailId(id);
        if (action === 'new') setFormOpen(true);
        if (id || action) {
            params.delete('id');
            params.delete('action');
            const rest = params.toString();
            window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
        }
    }, []);

    const all = riders.data?.riders;
    const summary = riders.data?.summary;
    const rows = React.useMemo(
        () => all?.filter((r) => matchesFilter(r, filter) && matchesQuery(r, query.trim())),
        [all, filter, query],
    );
    const detail = all?.find((r) => r._id === detailId) ?? null;
    const showRating = !!all?.some(hasRealRating);

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const openEdit = (rider: Rider) => {
        setEditing(rider);
        setFormOpen(true);
    };

    const toggleActive = React.useCallback(
        async (rider: Rider) => {
            const deactivating = rider.isActive;
            await confirm({
                title: deactivating ? `Deactivate ${rider.name}?` : `Reactivate ${rider.name}?`,
                description: deactivating ? (
                    <>
                        {rider.name} is signed out of the rider app on every device, can't sign in with a password or OTP, and
                        won't be offered or assigned orders. Their delivery history stays. You can reactivate them later.
                    </>
                ) : (
                    <>
                        {rider.name} can sign in to the rider app again and will be offered orders once they go available.
                    </>
                ),
                confirmLabel: deactivating ? 'Deactivate rider' : 'Reactivate rider',
                tone: deactivating ? 'destructive' : 'default',
                onConfirm: async () => {
                    try {
                        await http.patch(`/admin/riders/${rider._id}/status`, { isActive: !deactivating });
                    } catch (error) {
                        if (isApiError(error) && error.status === 409) {
                            throw new Error(
                                `${rider.name} still has an order in progress. Reassign or finish it, then deactivate.`,
                            );
                        }
                        throw error;
                    }
                    await invalidateRiders();
                    toast.success(deactivating ? `${rider.name} was deactivated` : `${rider.name} was reactivated`);
                },
            });
        },
        [confirm],
    );

    const columns = React.useMemo<ColumnDef<Rider>[]>(() => {
        const cols: ColumnDef<Rider>[] = [
            {
                id: 'rider',
                accessorFn: (r) => r.name,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Rider" />,
                enableHiding: false,
                meta: { label: 'Rider', className: 'min-w-48' },
                cell: ({ row }) => {
                    const r = row.original;
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setDetailId(r._id);
                            }}
                            className="-mx-1 block max-w-full rounded-md px-1 text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            <span className="block truncate font-medium text-foreground hover:underline">{r.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{formatPhone(r.phone)}</span>
                        </button>
                    );
                },
            },
            {
                id: 'status',
                accessorFn: (r) => displayStatus(r),
                header: 'Status',
                meta: { label: 'Status' },
                cell: ({ row }) => <StatusBadge kind="rider" status={displayStatus(row.original)} />,
            },
            {
                id: 'active',
                accessorFn: (r) => r.stats?.activeOrderCount ?? 0,
                header: ({ column }) => <DataTableColumnHeader column={column} title="In hand" />,
                meta: { label: 'Orders in hand', align: 'right' },
                cell: ({ getValue }) => {
                    const n = getValue<number>();
                    return <span className={cn(n > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{formatNumber(n)}</span>;
                },
            },
            {
                id: 'today',
                accessorFn: (r) => r.stats?.deliveredToday ?? 0,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Today" />,
                meta: { label: 'Delivered today', align: 'right' },
                cell: ({ getValue }) => formatNumber(getValue<number>()),
            },
            {
                id: 'delivered',
                accessorFn: (r) => r.stats?.deliveredCount ?? 0,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Delivered" />,
                meta: { label: 'Delivered, all time', align: 'right' },
                cell: ({ getValue }) => formatNumber(getValue<number>()),
            },
        ];
        if (showRating) {
            cols.push({
                id: 'rating',
                accessorFn: (r) => (hasRealRating(r) ? r.rating : -1),
                header: ({ column }) => <DataTableColumnHeader column={column} title="Rating" />,
                meta: { label: 'Rating', align: 'right' },
                cell: ({ row }) =>
                    hasRealRating(row.original) ? (
                        <span title={`${formatNumber(row.original.totalRatings)} ratings`}>{row.original.rating!.toFixed(1)}</span>
                    ) : (
                        <span className="text-muted-foreground" title="No ratings yet">
                            —
                        </span>
                    ),
            });
        }
        cols.push(
            {
                accessorKey: 'vehicleType',
                header: 'Vehicle',
                meta: { label: 'Vehicle', className: 'whitespace-nowrap text-muted-foreground' },
            },
            {
                id: 'lastActive',
                accessorFn: (r) => r.lastActiveAt ?? r.lastLocationUpdate ?? '',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Last active" />,
                meta: { label: 'Last active', className: 'whitespace-nowrap text-muted-foreground' },
                cell: ({ getValue }) => {
                    const v = getValue<string>();
                    return v ? <DateTime value={v} format="relative" /> : 'Never';
                },
            },
            {
                id: 'actions',
                enableHiding: false,
                header: () => <span className="sr-only">Actions</span>,
                meta: { align: 'right', className: 'w-12' },
                cell: ({ row }) => {
                    const r = row.original;
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Actions for ${r.name}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onSelect={() => setDetailId(r._id)}>
                                    <Eye aria-hidden />
                                    View details
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => openEdit(r)}>
                                    <Pencil aria-hidden />
                                    Edit details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant={r.isActive ? 'destructive' : 'default'} onSelect={() => toggleActive(r)}>
                                    {r.isActive ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                                    {r.isActive ? 'Deactivate' : 'Reactivate'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                },
            },
        );
        return cols;
    }, [showRating, toggleActive]);

    const filtered = filter !== 'all' || query.trim() !== '';
    const firstRun = summary?.total === 0;

    return (
        <PageContainer>
            <PageHeader
                title="Riders"
                description="Who is on shift, who is carrying orders, and how many each rider delivered today."
                actions={
                    <Button onClick={openCreate}>
                        <Plus aria-hidden />
                        Add rider
                    </Button>
                }
            />

            <DataTable
                label="Riders"
                columns={columns}
                data={rows}
                loading={riders.isPending}
                fetching={riders.isFetching}
                error={riders.error ?? undefined}
                onRetry={() => riders.refetch()}
                onRowClick={(r) => setDetailId(r._id)}
                toolbar={
                    <>
                        <div role="group" aria-label="Filter riders by status" className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 py-0.5">
                            {FILTERS.map((f) => {
                                const active = filter === f.id;
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setFilter(f.id)}
                                        className={cn(
                                            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97]',
                                            active ? 'bg-brand-tint text-brand-text' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                        )}
                                    >
                                        {f.label}
                                        <span className={cn('tabular-nums', active ? 'text-brand-text' : 'text-foreground')}>
                                            {summary ? formatNumber(f.count(summary)) : '–'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <InputGroup className="h-8 w-full sm:w-60">
                            <InputGroupAddon>
                                <Search aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Name, username or phone"
                                aria-label="Search riders"
                            />
                        </InputGroup>
                    </>
                }
                empty={
                    firstRun ? (
                        <EmptyState
                            icon={Bike}
                            title="No riders yet"
                            description="Add your first rider so orders can be assigned for delivery."
                            action={
                                <Button onClick={openCreate}>
                                    <Plus aria-hidden />
                                    Add rider
                                </Button>
                            }
                        />
                    ) : filtered ? (
                        <EmptyState
                            icon={Search}
                            title={query.trim() ? `No riders match "${query.trim()}"` : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} riders`}
                            description={
                                filter === 'available'
                                    ? 'Riders show as available once they start a shift in the rider app.'
                                    : 'Try another status or clear the search.'
                            }
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setFilter('all');
                                        setQuery('');
                                    }}
                                >
                                    Show all riders
                                </Button>
                            }
                        />
                    ) : undefined
                }
            />

            <RiderFormSheet
                open={formOpen}
                onOpenChange={(open) => {
                    setFormOpen(open);
                    if (!open) setEditing(null);
                }}
                rider={editing}
            />
            <RiderDetailSheet
                rider={detail}
                open={!!detail}
                onOpenChange={(open) => !open && setDetailId(null)}
                onEdit={(r) => {
                    setDetailId(null);
                    openEdit(r);
                }}
                onToggleActive={toggleActive}
            />
        </PageContainer>
    );
}

export default withProviders(RidersPage);
