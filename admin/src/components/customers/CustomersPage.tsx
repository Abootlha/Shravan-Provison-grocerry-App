import * as React from 'react';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import {
    DataTable,
    DataTableColumnHeader,
    DateTime,
    EmptyState,
    Money,
    PageContainer,
    PageHeader,
    withProviders,
} from '@/components/shared';
import { registerSearchProvider } from '@/components/shell/command-registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatNumber } from '@/lib/format';
import { http } from '@/lib/http';
import { queryKeys } from '@/lib/query';
import { formatPhone } from '@/components/riders/types';
import { CustomerDetailSheet } from './CustomerDetailSheet';
import { type Customer, type CustomersResponse, customerName } from './types';

function useDebounced<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/** ⌘K: search customers by name, phone or email on the server. */
function useCustomerSearchProvider() {
    React.useEffect(
        () =>
            registerSearchProvider({
                id: 'customers',
                group: 'Customers',
                minQueryLength: 3,
                search: async (q, signal) => {
                    const data = await http.get<CustomersResponse>('/admin/customers', { params: { q, limit: 6 }, signal });
                    return data.customers.map((c) => ({
                        id: `customer-${c._id}`,
                        label: customerName(c) ?? formatPhone(c.phone) ?? 'Customer',
                        group: 'Customers',
                        hint: customerName(c) ? formatPhone(c.phone) : `${formatNumber(c.orderCount)} orders`,
                        icon: Users,
                        href: `/customers?id=${c._id}`,
                    }));
                },
            }),
        [],
    );
}

const toSortParam = (sorting: SortingState) => {
    const s = sorting[0];
    return s ? `${s.desc ? '-' : ''}${s.id}` : undefined;
};

function CustomersPage() {
    const [search, setSearch] = React.useState('');
    const q = useDebounced(search.trim());
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [openId, setOpenId] = React.useState<string | null>(null);
    const mobile = useIsMobile();
    const columnVisibility = React.useMemo(() => ({ createdAt: !mobile }), [mobile]);

    useCustomerSearchProvider();

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id) {
            setOpenId(id);
            params.delete('id');
            const rest = params.toString();
            window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
        }
    }, []);

    // A new search or sort starts from the first page.
    React.useEffect(() => setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 })), [q, sorting]);

    const params = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        q: q || undefined,
        sort: toSortParam(sorting),
    };
    const customers = useQuery({
        queryKey: queryKeys.customers.list(params),
        queryFn: ({ signal }) => http.get<CustomersResponse>('/admin/customers', { params, signal }),
        placeholderData: (prev) => prev,
    });
    const preview = customers.data?.customers.find((c) => c._id === openId) ?? null;

    const columns = React.useMemo<ColumnDef<Customer>[]>(
        () => [
            {
                id: 'name',
                accessorFn: (c) => c.name,
                header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
                enableHiding: false,
                meta: { label: 'Customer', className: 'min-w-36 sm:min-w-48' },
                cell: ({ row }) => {
                    const c = row.original;
                    const name = customerName(c);
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenId(c._id);
                            }}
                            className="-mx-1 block max-w-full rounded-md px-1 text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            <span className="flex items-center gap-2">
                                <span className={name ? 'truncate font-medium text-foreground hover:underline' : 'truncate font-medium text-foreground tabular-nums hover:underline'}>
                                    {name ?? formatPhone(c.phone)}
                                </span>
                                {!c.isActive ? <Badge variant="neutral">Blocked</Badge> : null}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {name ? formatPhone(c.phone) : c.email || 'No name yet'}
                            </span>
                        </button>
                    );
                },
            },
            {
                accessorKey: 'orderCount',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Orders" />,
                meta: { label: 'Orders', align: 'right' },
                cell: ({ row }) => (
                    <span title={`${formatNumber(row.original.deliveredCount)} delivered`}>{formatNumber(row.original.orderCount)}</span>
                ),
            },
            {
                accessorKey: 'totalSpent',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Total spent" />,
                meta: { label: 'Total spent', align: 'right' },
                cell: ({ row }) => <Money value={row.original.totalSpent} />,
            },
            {
                accessorKey: 'lastOrderAt',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Last order" />,
                meta: { label: 'Last order', className: 'whitespace-nowrap' },
                cell: ({ row }) =>
                    row.original.lastOrderAt ? (
                        <DateTime value={row.original.lastOrderAt} format="relative" />
                    ) : (
                        <span className="text-muted-foreground">Never</span>
                    ),
            },
            {
                accessorKey: 'createdAt',
                header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
                meta: { label: 'Joined', className: 'whitespace-nowrap text-muted-foreground' },
                cell: ({ row }) => <DateTime value={row.original.createdAt} format="date" />,
            },
        ],
        [],
    );

    const total = customers.data?.total;

    return (
        <PageContainer>
            <PageHeader
                title="Customers"
                description={
                    total !== undefined && !q
                        ? `${formatNumber(total)} people have signed up. Total spent counts delivered orders only.`
                        : 'People who signed up in the app. Total spent counts delivered orders only.'
                }
            />

            <DataTable
                label="Customers"
                columns={columns}
                data={customers.data?.customers}
                loading={customers.isPending}
                fetching={customers.isFetching}
                error={customers.error ?? undefined}
                onRetry={() => customers.refetch()}
                pagination={pagination}
                onPaginationChange={setPagination}
                rowCount={total}
                sorting={sorting}
                onSortingChange={setSorting}
                onRowClick={(c) => setOpenId(c._id)}
                columnVisibility={mobile ? columnVisibility : undefined}
                toolbar={
                    <InputGroup className="h-8 w-full sm:w-72">
                        <InputGroupAddon>
                            <Search aria-hidden />
                        </InputGroupAddon>
                        <InputGroupInput
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Name, phone or email"
                            aria-label="Search customers"
                        />
                    </InputGroup>
                }
                empty={
                    q ? (
                        <EmptyState
                            icon={Search}
                            title={`No customers match "${q}"`}
                            description="Search by part of a name, a phone number or an email."
                            action={
                                <Button variant="outline" onClick={() => setSearch('')}>
                                    Clear search
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={Users}
                            title="No customers yet"
                            description="Customers appear here after they sign up in the app with their phone number."
                        />
                    )
                }
            />

            <CustomerDetailSheet customerId={openId} preview={preview} onOpenChange={(open) => !open && setOpenId(null)} />
        </PageContainer>
    );
}

export default withProviders(CustomersPage);
