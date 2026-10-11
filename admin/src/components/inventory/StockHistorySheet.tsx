import { useInfiniteQuery } from '@tanstack/react-query';
import { History, Loader2, Plus } from 'lucide-react';
import { DateTime, EmptyState, ErrorState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { http } from '@/lib/http';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { productKeys } from '../products/data';
import { STOCK_REASONS, type StockAdjustment } from '../products/types';
import type { StockTarget } from './AdjustStockDialog';

interface AdjustmentsPage {
    adjustments: StockAdjustment[];
    total: number;
    page: number;
    totalPages: number;
}

const REASON_LABEL = Object.fromEntries(STOCK_REASONS.map((r) => [r.value, r.label]));

function actorName(a: StockAdjustment): string {
    if (a.actorId && typeof a.actorId === 'object') return a.actorId.name || (a.actorId.role ?? 'Staff');
    return a.actorRole ? a.actorRole.charAt(0).toUpperCase() + a.actorRole.slice(1) : 'System';
}

export function StockHistorySheet({
    product,
    open,
    onOpenChange,
    onAdjust,
}: {
    product: StockTarget | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdjust?: () => void;
}) {
    const id = product?._id ?? '';
    const query = useInfiniteQuery({
        queryKey: productKeys.adjustments(id),
        queryFn: ({ pageParam, signal }) =>
            http.get<AdjustmentsPage>(`/admin/products/${id}/stock-adjustments`, { params: { page: pageParam, limit: 20 }, signal }),
        initialPageParam: 1,
        getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
        enabled: open && !!id,
    });
    const rows = query.data?.pages.flatMap((p) => p.adjustments) ?? [];
    const total = query.data?.pages[0]?.total;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent size="md" className="gap-0 p-0">
                <SheetHeader className="border-b p-4 pr-12">
                    <SheetTitle>Stock history</SheetTitle>
                    <SheetDescription className="line-clamp-2">
                        {product?.name}
                        {product ? (
                            <span className="mt-1 block tabular-nums">
                                {formatNumber(product.stock)} in stock{total !== undefined ? ` · ${formatNumber(total)} adjustment${total === 1 ? '' : 's'}` : ''}
                            </span>
                        ) : null}
                    </SheetDescription>
                    {onAdjust ? (
                        <Button size="sm" variant="outline" className="mt-2 w-fit" onClick={onAdjust}>
                            <Plus aria-hidden /> Adjust stock
                        </Button>
                    ) : null}
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {query.isPending ? (
                        <ul className="divide-y" aria-busy>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <li key={i} className="flex items-center gap-3 p-4">
                                    <Skeleton className="h-5 w-12" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-4 w-1/2" />
                                        <Skeleton className="h-3 w-1/3" />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : query.isError ? (
                        <ErrorState title="Couldn't load the history" error={query.error} onRetry={() => query.refetch()} retrying={query.isRefetching} />
                    ) : rows.length === 0 ? (
                        <EmptyState
                            icon={History}
                            title="No adjustments yet"
                            description="Restocks, damage write-offs and count corrections made here are listed with who made them. Stock taken by orders is not listed."
                        />
                    ) : (
                        <ol className="divide-y">
                            {rows.map((a) => (
                                <li key={a._id} className="grid grid-cols-[4.5rem_1fr] gap-x-3 px-4 py-3">
                                    <span
                                        className={cn(
                                            'pt-0.5 text-right text-sm font-semibold tabular-nums',
                                            a.delta > 0 ? 'text-success-text' : 'text-destructive',
                                        )}
                                    >
                                        {a.delta > 0 ? '+' : '−'}
                                        {formatNumber(Math.abs(a.delta))}
                                    </span>
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="text-sm font-medium">
                                            {REASON_LABEL[a.reason] ?? a.reason}
                                            <span className="font-normal text-muted-foreground tabular-nums">
                                                {' '}
                                                · {formatNumber(a.previousStock)} → {formatNumber(a.newStock)}
                                            </span>
                                        </p>
                                        {a.note ? <p className="text-sm text-pretty break-words text-muted-foreground">{a.note}</p> : null}
                                        <p className="text-xs text-muted-foreground">
                                            {actorName(a)} · <DateTime value={a.createdAt} format="datetime" />
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                    {query.hasNextPage ? (
                        <div className="p-4">
                            <Button variant="outline" className="w-full" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                                {query.isFetchingNextPage ? <Loader2 className="animate-spin" aria-hidden /> : null}
                                Show older
                            </Button>
                        </div>
                    ) : null}
                </div>
            </SheetContent>
        </Sheet>
    );
}
