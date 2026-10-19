import * as React from 'react';
import { ListFilter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DateRangePickerDropdown, type DateRange } from '@/components/motion/date-range-picker';
import { statusLabel } from '@/components/shared';
import { storeDayKey } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EMPTY_FILTERS, tabStatuses, type OrderFilters } from './order-model';
import { useActiveRiders } from './RiderPicker';
import type { OrderStatus } from './types';

const ANY = 'any';

function daysAgo(n: number) {
    return storeDayKey(new Date(Date.now() - n * 86_400_000));
}

function presets() {
    const today = storeDayKey();
    return [
        { label: 'Today', value: { from: today, to: today } },
        { label: 'Yesterday', value: { from: daysAgo(1), to: daysAgo(1) } },
        { label: 'Last 7 days', value: { from: daysAgo(6), to: today } },
        { label: 'Last 30 days', value: { from: daysAgo(29), to: today } },
    ];
}

export function activeFilterCount(filters: OrderFilters) {
    return (
        (filters.statuses.length ? 1 : 0) +
        (filters.paymentStatus ? 1 : 0) +
        (filters.paymentMethod ? 1 : 0) +
        (filters.rider ? 1 : 0) +
        (filters.dateFrom ? 1 : 0) +
        (filters.q.trim() ? 1 : 0)
    );
}

export interface OrdersToolbarProps {
    filters: OrderFilters;
    onChange: (patch: Partial<OrderFilters>) => void;
}

export function OrdersToolbar({ filters, onChange }: OrdersToolbarProps) {
    const [search, setSearch] = React.useState(filters.q);
    const riders = useActiveRiders();
    const tabOptions = tabStatuses(filters.tab);
    const showStatus = tabOptions.length > 1;

    // Keep the box in sync when filters are reset elsewhere.
    React.useEffect(() => setSearch(filters.q), [filters.q]);

    React.useEffect(() => {
        if (search === filters.q) return;
        const id = setTimeout(() => onChange({ q: search }), 300);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const range: DateRange | null = filters.dateFrom ? { from: filters.dateFrom, to: filters.dateTo || undefined } : null;
    const statuses = filters.statuses.filter((s) => tabOptions.includes(s));
    const count = activeFilterCount(filters);

    const toggleStatus = (status: OrderStatus, on: boolean) =>
        onChange({ statuses: on ? [...statuses, status] : statuses.filter((s) => s !== status) });

    return (
        <>
            <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onChange({ q: search });
                        if (e.key === 'Escape' && search) {
                            e.preventDefault();
                            setSearch('');
                            onChange({ q: '' });
                        }
                    }}
                    placeholder="Order ID, name or phone"
                    aria-label="Search orders by order ID, customer name or phone"
                    maxLength={100}
                    className="h-8 pl-8"
                />
            </div>

            {showStatus ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={cn(statuses.length && 'border-primary/40 bg-brand-tint text-brand-text')}>
                            <ListFilter aria-hidden />
                            Status
                            {statuses.length ? <span className="tabular-nums">· {statuses.length}</span> : null}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52">
                        <DropdownMenuLabel>Show statuses</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {tabOptions.map((status) => (
                            <DropdownMenuCheckboxItem
                                key={status}
                                checked={statuses.includes(status)}
                                onCheckedChange={(on) => toggleStatus(status, Boolean(on))}
                                onSelect={(e) => e.preventDefault()}
                            >
                                {statusLabel('order', status)}
                            </DropdownMenuCheckboxItem>
                        ))}
                        {statuses.length ? (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => onChange({ statuses: [] })}>Show all</DropdownMenuItem>
                            </>
                        ) : null}
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}

            <Select value={filters.paymentStatus || ANY} onValueChange={(v) => onChange({ paymentStatus: v === ANY ? '' : v })}>
                <SelectTrigger size="sm" aria-label="Payment status" className={cn(filters.paymentStatus && 'border-primary/40 bg-brand-tint text-brand-text')}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ANY}>Any payment</SelectItem>
                    <SelectSeparator />
                    <SelectItem value="PENDING">Unpaid</SelectItem>
                    <SelectItem value="COMPLETED">Paid</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
            </Select>

            <Select value={filters.paymentMethod || ANY} onValueChange={(v) => onChange({ paymentMethod: v === ANY ? '' : v })}>
                <SelectTrigger size="sm" aria-label="Payment method" className={cn(filters.paymentMethod && 'border-primary/40 bg-brand-tint text-brand-text')}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ANY}>Any method</SelectItem>
                    <SelectSeparator />
                    <SelectItem value="COD">Cash on delivery</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="NETBANKING">Net banking</SelectItem>
                    <SelectItem value="WALLET">Wallet</SelectItem>
                </SelectContent>
            </Select>

            <Select value={filters.rider || ANY} onValueChange={(v) => onChange({ rider: v === ANY ? '' : v })}>
                <SelectTrigger size="sm" aria-label="Rider" className={cn('max-w-44', filters.rider && 'border-primary/40 bg-brand-tint text-brand-text')}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ANY}>Any rider</SelectItem>
                    <SelectItem value="unassigned">No rider yet</SelectItem>
                    {riders.data?.length ? <SelectSeparator /> : null}
                    {riders.data?.map((rider) => (
                        <SelectItem key={rider._id} value={rider._id}>
                            {rider.name}
                        </SelectItem>
                    ))}
                    {filters.rider && filters.rider !== 'unassigned' && !riders.data?.some((r) => r._id === filters.rider) ? (
                        <SelectItem value={filters.rider}>Selected rider</SelectItem>
                    ) : null}
                </SelectContent>
            </Select>

            <DateRangePickerDropdown
                label="Placed between"
                placeholder="Any date"
                value={range}
                onValueChange={(next) => onChange({ dateFrom: next?.from ?? '', dateTo: next?.to ?? '' })}
                presets={presets()}
                max={storeDayKey()}
                closeOnSelect
                triggerClassName={cn('h-8 rounded-lg', filters.dateFrom && 'border-primary/40 bg-brand-tint text-brand-text')}
            />

            {count > 0 ? (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setSearch('');
                        onChange({ ...EMPTY_FILTERS });
                    }}
                >
                    <X aria-hidden />
                    Clear filters
                </Button>
            ) : null}
        </>
    );
}
