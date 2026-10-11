import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Pause, Play, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/http';
import { queryClient, queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { fetchStoreSettings, saveStoreSettings, useCanEditSettings } from '../settings/api';
import { computeOpenState, formatClock } from '../settings/logic';
import { describeMoment } from '../settings/previews';

/** Open/closed right now (server's isOpen/nextOpenAt), the hours, and the pause switch. */
export function StoreStatusCard({ className }: { className?: string }) {
    const confirm = useConfirm();
    const canEdit = useCanEditSettings();
    const settings = useQuery({
        queryKey: queryKeys.settings.store,
        queryFn: ({ signal }) => fetchStoreSettings(signal),
        refetchInterval: 60_000,
    });
    const s = settings.data;
    const now = new Date();

    async function setActive(isActive: boolean) {
        const ok = await confirm(
            isActive
                ? {
                      title: 'Resume taking orders?',
                      description: 'Customers can order again whenever the store is within its opening hours.',
                      confirmLabel: 'Resume orders',
                      onConfirm: () => saveStoreSettings({ isActive: true }).then((r) => queryClient.setQueryData(queryKeys.settings.store, r.settings)),
                  }
                : {
                      title: 'Pause the store?',
                      description: 'Customers cannot place new orders until you resume. Orders already placed are not affected.',
                      confirmLabel: 'Pause orders',
                      tone: 'destructive',
                      onConfirm: () => saveStoreSettings({ isActive: false }).then((r) => queryClient.setQueryData(queryKeys.settings.store, r.settings)),
                  },
        );
        if (ok) toast.success(isActive ? 'Store resumed' : 'Store paused', { description: isActive ? undefined : 'New orders are blocked until you resume.' });
    }

    let title = '—';
    let detail: React.ReactNode = null;
    let tone: 'success' | 'warning' | 'neutral' = 'neutral';
    if (s) {
        const local = computeOpenState({
            isActive: s.isActive,
            openTime: s.storeTimings?.openTime,
            closeTime: s.storeTimings?.closeTime,
            timezone: s.timezone,
        });
        if (!s.isActive) {
            title = 'Paused';
            tone = 'warning';
            detail = 'New orders are blocked until someone resumes the store.';
        } else if (s.isOpen) {
            title = 'Open';
            tone = 'success';
            detail = local.closesAt ? `Taking orders until ${describeMoment(local.closesAt, now, s.timezone)}` : 'Open 24 hours';
        } else {
            title = 'Closed';
            detail = s.nextOpenAt ? `Opens at ${describeMoment(s.nextOpenAt, now, s.timezone)}` : 'Outside opening hours';
        }
    }

    return (
        <section
            aria-labelledby="store-status-heading"
            className={cn('flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-border sm:flex-row sm:items-center sm:justify-between sm:p-5', className)}
        >
            <div className="flex min-w-0 items-start gap-3">
                <span
                    aria-hidden
                    className={cn(
                        'mt-1.5 size-2.5 shrink-0 rounded-full',
                        tone === 'success' && 'bg-success',
                        tone === 'warning' && 'bg-warning',
                        tone === 'neutral' && 'bg-muted-foreground',
                    )}
                />
                <div className="min-w-0">
                    <h2 id="store-status-heading" className="text-sm font-medium text-muted-foreground">
                        Store
                    </h2>
                    {settings.isPending ? (
                        <Skeleton className="mt-1 h-6 w-48" />
                    ) : settings.isError ? (
                        <p className="text-sm text-foreground">
                            Couldn't load the store status. {errorMessage(settings.error)}{' '}
                            <button type="button" className="font-medium text-brand-text underline-offset-4 hover:underline" onClick={() => settings.refetch()}>
                                Retry
                            </button>
                        </p>
                    ) : (
                        <>
                            <p className="text-lg leading-tight font-semibold text-foreground">
                                {title}
                                <span className="font-normal text-muted-foreground"> · {detail}</span>
                            </p>
                            {s?.storeTimings ? (
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                                    <Clock className="size-3.5" aria-hidden />
                                    {s.storeTimings.openTime === s.storeTimings.closeTime
                                        ? 'Open 24 hours'
                                        : `Daily ${formatClock(s.storeTimings.openTime)} – ${formatClock(s.storeTimings.closeTime)}`}
                                </p>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="ghost" size="sm" asChild>
                    <a href="/settings#hours">
                        <Settings2 aria-hidden />
                        Hours
                    </a>
                </Button>
                {s && canEdit ? (
                    s.isActive ? (
                        <Button variant="outline" size="sm" onClick={() => setActive(false)}>
                            <Pause aria-hidden />
                            Pause orders
                        </Button>
                    ) : (
                        <Button size="sm" onClick={() => setActive(true)}>
                            <Play aria-hidden />
                            Resume orders
                        </Button>
                    )
                ) : null}
            </div>
        </section>
    );
}
