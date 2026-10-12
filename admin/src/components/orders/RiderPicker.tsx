import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusBadge } from '@/components/shared';
import { errorMessage } from '@/lib/http';
import { queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { formatPhone, ordersApi } from './order-model';
import type { AdminRider } from './types';

/** Active riders, refreshed while a picker is open so availability is current. */
export function useActiveRiders(enabled = true, live = false) {
    return useQuery({
        queryKey: queryKeys.riders.list({ isActive: true, scope: 'orders' }),
        queryFn: ({ signal }) => ordersApi.riders(signal),
        enabled,
        staleTime: live ? 0 : 30_000,
        refetchInterval: live ? 10_000 : false,
        select: (data) => data.riders,
    });
}

const ORDER: Record<string, number> = { available: 0, busy: 1, offline: 2 };

export interface RiderPickerProps {
    /** Currently assigned rider id, if any. */
    value?: string | null;
    onSelect: (rider: AdminRider) => void;
    busy?: boolean;
    disabled?: boolean;
    label: string;
    className?: string;
}

/** Combobox of active riders with their live status; only available riders can be chosen. */
export function RiderPicker({ value, onSelect, busy, disabled, label, className }: RiderPickerProps) {
    const [open, setOpen] = React.useState(false);
    const riders = useActiveRiders(true, open);
    const { refetch } = riders;
    // Availability changes minute to minute; read it fresh every time the list opens.
    React.useEffect(() => {
        if (open) void refetch();
    }, [open, refetch]);
    const list = React.useMemo(
        () => [...(riders.data ?? [])].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3) || a.name.localeCompare(b.name)),
        [riders.data],
    );
    const available = list.filter((r) => r.status === 'available' && r._id !== value).length;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={value ? 'outline' : 'default'}
                    role="combobox"
                    aria-expanded={open}
                    aria-label={label}
                    disabled={disabled || busy}
                    className={cn('justify-between', className)}
                >
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    {label}
                    <ChevronsUpDown className="opacity-60" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
                <Command
                    filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
                >
                    <CommandInput placeholder="Search riders by name or phone" />
                    <CommandList className="max-h-72">
                        {riders.isPending ? (
                            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading riders
                            </div>
                        ) : riders.isError ? (
                            <div className="space-y-2 px-3 py-4 text-sm">
                                <p className="text-destructive">{errorMessage(riders.error)}</p>
                                <Button size="sm" variant="outline" onClick={() => riders.refetch()}>
                                    <RotateCw aria-hidden /> Retry
                                </Button>
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>
                                    {list.length === 0 ? 'No active riders. Add one on the Riders page.' : 'No rider matches.'}
                                </CommandEmpty>
                                <CommandGroup heading={`${available} available now`}>
                                    {list.map((rider) => {
                                        const current = rider._id === value;
                                        const selectable = rider.status === 'available' && !current;
                                        return (
                                            <CommandItem
                                                key={rider._id}
                                                value={`${rider.name} ${rider.phone ?? ''} ${rider._id}`}
                                                disabled={!selectable}
                                                onSelect={() => {
                                                    if (!selectable) return;
                                                    setOpen(false);
                                                    onSelect(rider);
                                                }}
                                                className="items-start gap-3 py-2"
                                            >
                                                <Check className={cn('mt-0.5 size-4 shrink-0', current ? 'opacity-100' : 'opacity-0')} aria-hidden />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-medium">{rider.name}</span>
                                                    <span className="block truncate text-xs text-muted-foreground">
                                                        {[formatPhone(rider.phone), rider.vehicleType].filter(Boolean).join(' · ')}
                                                        {rider.stats?.activeOrderCount ? ` · ${rider.stats.activeOrderCount} active` : ''}
                                                    </span>
                                                </span>
                                                {current ? (
                                                    <span className="text-xs font-medium text-muted-foreground">Assigned</span>
                                                ) : (
                                                    <StatusBadge kind="rider" status={rider.status} />
                                                )}
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
