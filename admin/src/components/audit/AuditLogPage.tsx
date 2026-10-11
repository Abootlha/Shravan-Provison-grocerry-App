import * as React from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, History, Search, X } from 'lucide-react';
import {
    DataTable,
    DateTime,
    EmptyState,
    PageContainer,
    PageHeader,
    withProviders,
} from '@/components/shared';
import { DateRangePickerDropdown, type DateRange } from '@/components/motion/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { storeDayKey } from '@/lib/format';
import { http } from '@/lib/http';
import { AdminOnlyNotice, isAdminRole, useStaffUser } from '@/components/team/access';
import { ROLE_LABEL, type StaffMember, TEAM_KEY } from '@/components/team/types';
import { type AuditLog, type AuditLogResponse, describeAudit, ENTITIES } from './describe';
import { JsonViewer } from './JsonViewer';

const ALL = 'all';
const AUDIT_KEY = ['audit-log'] as const;

function useDebounced<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = React.useState(value);
    React.useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/** Store-local (IST) calendar days → ISO bounds the API filters on. */
const dayStart = (day: string) => `${day}T00:00:00.000+05:30`;
const dayEnd = (day: string) => `${day}T23:59:59.999+05:30`;

function shiftDay(day: string, by: number) {
    const d = new Date(`${day}T12:00:00+05:30`);
    d.setUTCDate(d.getUTCDate() + by);
    return storeDayKey(d);
}

function RoleBadge({ role }: { role?: string }) {
    if (!role) return null;
    return (
        <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-medium text-muted-foreground">
            {ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role}
        </Badge>
    );
}

function AuditDetailSheet({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
    const described = log ? describeAudit(log) : null;
    const changes = log?.diff?.changes;
    return (
        <Sheet open={!!log} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
                {log && described ? (
                    <>
                        <SheetHeader className="border-b p-4 pr-12">
                            <SheetTitle className="text-lg text-balance">{described.title}</SheetTitle>
                            <SheetDescription>
                                {log.actorName ?? 'Unknown staff member'} · <DateTime value={log.createdAt} format="datetime" />
                            </SheetDescription>
                        </SheetHeader>
                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
                            <section className="space-y-2">
                                <h3 className="text-sm font-semibold text-foreground">What was sent</h3>
                                {changes && Object.keys(changes).length > 0 ? (
                                    <JsonViewer value={changes} />
                                ) : log.diff?.truncated ? (
                                    <p className="text-sm text-muted-foreground">
                                        The request was too large to store in full. Fields changed: {described.fields.join(', ') || 'unknown'}.
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No values were sent with this action.</p>
                                )}
                                <p className="text-xs text-muted-foreground">Passwords and tokens are never stored; they show as hidden.</p>
                            </section>
                            <section className="space-y-2">
                                <h3 className="text-sm font-semibold text-foreground">Record</h3>
                                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                                    <dt className="text-muted-foreground">Area</dt>
                                    <dd>{ENTITIES[log.entity]?.label ?? log.entity}</dd>
                                    {log.entityId ? (
                                        <>
                                            <dt className="text-muted-foreground">Record id</dt>
                                            <dd className="truncate font-mono text-xs leading-5 select-all">{log.entityId}</dd>
                                        </>
                                    ) : null}
                                    <dt className="text-muted-foreground">Action</dt>
                                    <dd className="truncate font-mono text-xs leading-5">{log.action}</dd>
                                    <dt className="text-muted-foreground">By</dt>
                                    <dd className="flex items-center gap-2">
                                        {log.actorName ?? 'Unknown'} <RoleBadge role={log.role} />
                                    </dd>
                                    {log.method && log.path ? (
                                        <>
                                            <dt className="text-muted-foreground">Request</dt>
                                            <dd className="font-mono text-xs leading-5 break-all">
                                                {log.method} {log.path}
                                                {log.statusCode ? ` → ${log.statusCode}` : ''}
                                            </dd>
                                        </>
                                    ) : null}
                                    {log.ip ? (
                                        <>
                                            <dt className="text-muted-foreground">IP address</dt>
                                            <dd className="font-mono text-xs leading-5">{log.ip}</dd>
                                        </>
                                    ) : null}
                                </dl>
                            </section>
                        </div>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}

function AuditLogPage() {
    const { user, ready } = useStaffUser();
    const admin = isAdminRole(user);
    // Phones: the sentence is what matters; who and area fold into it.
    const mobile = useIsMobile();
    const columnVisibility = React.useMemo(() => (mobile ? { actor: false, area: false } : {}), [mobile]);

    const [actorId, setActorId] = React.useState<string>(ALL);
    const [entity, setEntity] = React.useState<string>(ALL);
    const [range, setRange] = React.useState<DateRange | null>(null);
    const [search, setSearch] = React.useState('');
    const q = useDebounced(search.trim());
    const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
    const [open, setOpen] = React.useState<AuditLog | null>(null);

    React.useEffect(
        () => setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 })),
        [actorId, entity, range?.from, range?.to, q],
    );

    const params = {
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        actorId: actorId === ALL ? undefined : actorId,
        entity: entity === ALL ? undefined : entity,
        from: range?.from ? dayStart(range.from) : undefined,
        to: range?.from ? dayEnd(range.to ?? range.from) : undefined,
        q: q || undefined,
    };

    const logs = useQuery({
        queryKey: [...AUDIT_KEY, params],
        queryFn: ({ signal }) => http.get<AuditLogResponse>('/admin/audit-log', { params, signal }),
        placeholderData: (prev) => prev,
        enabled: ready && admin,
    });
    const team = useQuery({
        queryKey: TEAM_KEY,
        queryFn: () => http.get<{ members: StaffMember[] }>('/admin/team'),
        enabled: ready && admin,
        select: (d) => d.members,
    });

    const columns = React.useMemo<ColumnDef<AuditLog>[]>(
        () => [
            {
                accessorKey: 'createdAt',
                header: 'When',
                meta: { label: 'When', className: 'w-24 whitespace-nowrap align-top py-3 sm:w-32' },
                cell: ({ row }) => (
                    <div className="leading-5">
                        <DateTime value={row.original.createdAt} format="relative" className="block text-foreground" />
                        <DateTime value={row.original.createdAt} format="time" className="block text-xs text-muted-foreground" />
                    </div>
                ),
            },
            {
                id: 'actor',
                header: 'Who',
                meta: { label: 'Who', className: 'w-40 align-top py-3' },
                cell: ({ row }) => (
                    <div className="leading-5">
                        <span className="block truncate font-medium text-foreground">{row.original.actorName ?? 'Unknown'}</span>
                        <RoleBadge role={row.original.role} />
                    </div>
                ),
            },
            {
                id: 'what',
                header: 'What happened',
                enableHiding: false,
                meta: { label: 'What happened', className: 'min-w-56 whitespace-normal align-top py-3' },
                cell: ({ row }) => {
                    const { title, fields } = describeAudit(row.original);
                    return (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(row.original);
                            }}
                            className="group -mx-1 flex w-full items-start gap-2 rounded-md px-1 text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                            aria-label={`${title}. Show details`}
                        >
                            <span className="min-w-0 flex-1 leading-5">
                                <span className="block font-medium text-foreground group-hover:underline">{title}</span>
                                {fields.length > 0 ? (
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {fields.length === 1 ? 'Field' : 'Fields'}: {fields.slice(0, 5).join(', ')}
                                        {fields.length > 5 ? ` and ${fields.length - 5} more` : ''}
                                    </span>
                                ) : null}
                                <span className="block truncate text-xs text-muted-foreground md:hidden">
                                    {row.original.actorName ?? 'Unknown'} · {ENTITIES[row.original.entity]?.label ?? row.original.entity}
                                </span>
                            </span>
                            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                    );
                },
            },
            {
                id: 'area',
                header: 'Area',
                meta: { label: 'Area', className: 'w-36 whitespace-nowrap align-top py-3 text-muted-foreground' },
                cell: ({ row }) => ENTITIES[row.original.entity]?.label ?? row.original.entity,
            },
        ],
        [],
    );

    if (!ready) {
        return (
            <PageContainer>
                <PageHeader title="Audit log" description="Every change made in this admin, newest first." />
                <Skeleton className="h-64 w-full rounded-xl" />
            </PageContainer>
        );
    }

    if (!admin) {
        return (
            <PageContainer>
                <PageHeader title="Audit log" description="Every change made in this admin, newest first." />
                <AdminOnlyNotice
                    title="Only admins can read the audit log"
                    reason="You're signed in as a manager. Your changes are still recorded here; ask an admin if you need to check who changed an order, a price or a setting."
                />
            </PageContainer>
        );
    }

    const filtered = actorId !== ALL || entity !== ALL || !!range || !!q;
    const clearFilters = () => {
        setActorId(ALL);
        setEntity(ALL);
        setRange(null);
        setSearch('');
    };
    const today = storeDayKey();

    return (
        <PageContainer>
            <PageHeader
                title="Audit log"
                description="Every change staff made in this admin, newest first. Viewing pages and signing in are not recorded."
            />

            <DataTable
                label="Audit log"
                columns={columns}
                data={logs.data?.logs}
                loading={logs.isPending}
                fetching={logs.isFetching}
                error={logs.error ?? undefined}
                onRetry={() => logs.refetch()}
                pagination={pagination}
                onPaginationChange={setPagination}
                rowCount={logs.data?.total}
                pageSizeOptions={[20, 50, 100]}
                onRowClick={setOpen}
                enableColumnToggle={false}
                columnVisibility={columnVisibility}
                toolbar={
                    <>
                        <InputGroup className="h-8 w-full sm:w-56">
                            <InputGroupAddon>
                                <Search aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search summaries"
                                aria-label="Search the audit log"
                            />
                        </InputGroup>
                        <Select value={actorId} onValueChange={setActorId}>
                            <SelectTrigger size="sm" className="w-[calc(50%-0.25rem)] sm:w-44" aria-label="Filter by staff member">
                                <SelectValue placeholder="Anyone" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Anyone</SelectItem>
                                {team.data?.map((m) => (
                                    <SelectItem key={m._id} value={m._id}>
                                        {m.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={entity} onValueChange={setEntity}>
                            <SelectTrigger size="sm" className="w-[calc(50%-0.25rem)] sm:w-40" aria-label="Filter by area">
                                <SelectValue placeholder="All areas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>All areas</SelectItem>
                                {Object.entries(ENTITIES).map(([id, e]) => (
                                    <SelectItem key={id} value={id}>
                                        {e.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DateRangePickerDropdown
                            value={range}
                            onValueChange={setRange}
                            max={today}
                            closeOnSelect
                            placeholder="Any date"
                            label="Filter by date"
                            triggerClassName="h-8 w-full sm:w-auto"
                            presets={[
                                { label: 'Today', value: { from: today, to: today } },
                                { label: 'Last 7 days', value: { from: shiftDay(today, -6), to: today } },
                                { label: 'Last 30 days', value: { from: shiftDay(today, -29), to: today } },
                            ]}
                        />
                        {filtered ? (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X aria-hidden />
                                Clear
                            </Button>
                        ) : null}
                    </>
                }
                empty={
                    filtered ? (
                        <EmptyState
                            icon={Search}
                            title="No changes match these filters"
                            description="Widen the date range or pick another person or area."
                            action={
                                <Button variant="outline" onClick={clearFilters}>
                                    Clear filters
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={History}
                            title="No changes recorded yet"
                            description="When an admin or manager edits an order, product, rider or setting, it shows up here with who did it."
                        />
                    )
                }
            />

            <AuditDetailSheet log={open} onClose={() => setOpen(null)} />
        </PageContainer>
    );
}

export default withProviders(AuditLogPage);
