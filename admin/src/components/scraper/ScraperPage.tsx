import * as React from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Copy, FileSpreadsheet, ImageOff, Link2, Loader2, RotateCw, ScanSearch, Search, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState, Money, PageContainer, PageHeader, confirm, withProviders } from '@/components/shared';
import { useCanEditCatalog } from '@/components/catalog/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/http';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHierarchyLabel } from './HierarchyPicker';
import { ImportCsvDialog } from './ImportCsvDialog';
import { ReviewSheet } from './ReviewSheet';
import { ScrapeStatusBadge } from './ScrapeStatusBadge';
import { SubmitLinksDialog } from './SubmitLinksDialog';
import { invalidateScraper, scraperApi, useScrapeCounts, useScrapedItems, useScraperStatus } from './api';
import { SITE_LABEL, type ScrapedItem, type ScrapeTab } from './types';

const TABS: { id: ScrapeTab; label: string; empty: string; hint: string }[] = [
    { id: 'ready', label: 'To review', empty: 'Nothing to review', hint: 'Scrape some product links and their previews land here.' },
    { id: 'in_progress', label: 'In progress', empty: 'Nothing is being scraped', hint: 'Links you submit show here while they are scraped.' },
    { id: 'failed', label: 'Failed', empty: 'No failed links', hint: 'Links that could not be scraped show here with the reason.' },
    { id: 'approved', label: 'Approved', empty: 'Nothing approved yet', hint: 'Approved previews become products in the catalogue.' },
    { id: 'declined', label: 'Declined', empty: 'Nothing declined', hint: 'Declined previews are kept here for the record.' },
];

const PAGE_SIZE = 24;

function useDebounced<T>(value: T, delay = 300) {
    const [v, setV] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
}

function ScraperPage() {
    const canEdit = useCanEditCatalog();
    const [tab, setTab] = React.useState<ScrapeTab>('ready');
    const [page, setPage] = React.useState(1);
    const [search, setSearch] = React.useState('');
    const q = useDebounced(search.trim());
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [openId, setOpenId] = React.useState<string | null>(null);
    const [submitOpen, setSubmitOpen] = React.useState(false);
    const [importCsvOpen, setImportCsvOpen] = React.useState(false);
    const [bulkBusy, setBulkBusy] = React.useState<null | 'approve' | 'draft' | 'decline' | 'retry'>(null);

    const counts = useScrapeCounts();
    const status = useScraperStatus();
    const working = (counts.data?.in_progress ?? 0) > 0;
    const list = useScrapedItems({ status: tab, page, limit: PAGE_SIZE, q: q || undefined }, working);
    const items = list.data?.items ?? [];
    const hierarchyLabel = useHierarchyLabel();

    // Keep the tab counts and the list in step while the queue is running.
    const wasWorking = React.useRef(working);
    React.useEffect(() => {
        if (wasWorking.current && !working) void invalidateScraper();
        wasWorking.current = working;
    }, [working]);

    React.useEffect(() => {
        setSelected(new Set());
        setPage(1);
    }, [tab, q]);

    const selectable = canEdit && (tab === 'ready' || tab === 'failed');
    const selectedIds = items.filter((i) => selected.has(i._id)).map((i) => i._id);
    const allSelected = items.length > 0 && selectedIds.length === items.length;

    const toggle = (id: string, on: boolean) =>
        setSelected((s) => {
            const next = new Set(s);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });

    async function bulk(kind: NonNullable<typeof bulkBusy>) {
        const ids = selectedIds;
        if (!ids.length) return;
        if (kind === 'decline') {
            const ok = await confirm({
                title: `Decline ${ids.length} ${ids.length === 1 ? 'preview' : 'previews'}?`,
                description: 'Their photos are deleted from storage. You can submit the links again later.',
                confirmLabel: 'Decline',
                tone: 'destructive',
            });
            if (!ok) return;
        }
        setBulkBusy(kind);
        try {
            if (kind === 'retry') {
                const results = await Promise.allSettled(ids.map((id) => scraperApi.retry(id)));
                const ok = results.filter((r) => r.status === 'fulfilled').length;
                toast.success(`Scraping ${ok} ${ok === 1 ? 'link' : 'links'} again`);
            } else if (kind === 'decline') {
                const res = await scraperApi.bulkDecline(ids);
                toast.success(`Declined ${res.declined ?? 0}`);
            } else {
                const res = await scraperApi.bulkApprove(ids, kind === 'draft' ? 'draft' : 'active');
                const failed = res.results.filter((r) => !r.ok);
                if (res.approved) toast.success(`Approved ${res.approved} ${res.approved === 1 ? 'product' : 'products'}`);
                if (failed.length) {
                    toast.warning(`${failed.length} need attention`, {
                        description: failed[0].message ?? 'Open them to fix the details.',
                    });
                }
            }
            setSelected(new Set());
            await invalidateScraper();
        } catch (error) {
            toast.error('That did not work', { description: errorMessage(error) });
        } finally {
            setBulkBusy(null);
        }
    }

    /** After approving/declining in the sheet, move on to the next preview in this list. */
    const openNext = React.useCallback(() => {
        const index = items.findIndex((i) => i._id === openId);
        const next = items.slice(index + 1).find((i) => i.status === 'ready') ?? items.find((i) => i.status === 'ready' && i._id !== openId);
        setOpenId(next?._id ?? null);
    }, [items, openId]);

    const current = TABS.find((t) => t.id === tab)!;

    return (
        <PageContainer>
            <PageHeader
                title="Product scraper"
                description="Paste product links from other stores. Each one is scraped into a preview with photos, prices and a suggested category. Approve a preview to add it to your catalogue, or decline it."
                actions={
                    canEdit ? (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setImportCsvOpen(true)}>
                                <FileSpreadsheet aria-hidden /> Import CSV
                            </Button>
                            <Button onClick={() => setSubmitOpen(true)}>
                                <Link2 aria-hidden /> Scrape links
                            </Button>
                        </div>
                    ) : null
                }
            >
                <Tabs value={tab} onValueChange={(v) => setTab(v as ScrapeTab)}>
                    <TabsList className="flex-wrap">
                        {TABS.map((t) => (
                            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                                {t.label}
                                {counts.data ? (
                                    <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                                        {formatNumber(counts.data[t.id] ?? 0)}
                                    </span>
                                ) : null}
                                {t.id === 'in_progress' && working ? <Loader2 className="size-3 animate-spin" aria-label="Running" /> : null}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </PageHeader>

            {status.data && !status.data.r2Configured ? (
                <div role="status" className="flex gap-2 rounded-lg border border-warning/30 bg-warning-tint px-3 py-2.5 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <p>
                        Cloudflare R2 is not set up on the server, so scraped photos are stored in the database (at most{' '}
                        {status.data.maxImages} per product). Set the R2_* variables in the backend environment to store them in R2.
                    </p>
                </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, brand or link"
                        aria-label="Search scraped products"
                        className="pl-8"
                    />
                </div>
                {selectable && items.length ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Checkbox
                                checked={allSelected ? true : selectedIds.length ? 'indeterminate' : false}
                                onCheckedChange={(on) => setSelected(on ? new Set(items.map((i) => i._id)) : new Set())}
                                aria-label="Select all on this page"
                            />
                            {selectedIds.length ? `${selectedIds.length} selected` : 'Select all'}
                        </label>
                        {selectedIds.length ? (
                            <>
                                {tab === 'ready' ? (
                                    <>
                                        <Button size="sm" disabled={!!bulkBusy} onClick={() => bulk('approve')}>
                                            {bulkBusy === 'approve' ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                                            Approve
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={!!bulkBusy} onClick={() => bulk('draft')}>
                                            {bulkBusy === 'draft' ? <Loader2 className="animate-spin" aria-hidden /> : null}
                                            Approve as draft
                                        </Button>
                                    </>
                                ) : (
                                    <Button size="sm" disabled={!!bulkBusy} onClick={() => bulk('retry')}>
                                        {bulkBusy === 'retry' ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
                                        Try again
                                    </Button>
                                )}
                                <Button size="sm" variant="ghost" className="text-destructive" disabled={!!bulkBusy} onClick={() => bulk('decline')}>
                                    <Trash2 aria-hidden /> Decline
                                </Button>
                            </>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {list.isError ? (
                <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : list.isLoading ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }, (_, i) => (
                        <li key={i}>
                            <Skeleton className="h-72 w-full rounded-xl" />
                        </li>
                    ))}
                </ul>
            ) : items.length === 0 ? (
                <div className="rounded-xl border">
                    <EmptyState
                        size="page"
                        icon={ScanSearch}
                        title={q ? 'No matches' : current.empty}
                        description={q ? 'Try a different search.' : current.hint}
                        action={
                            !q && canEdit && (tab === 'ready' || tab === 'in_progress') ? (
                                <div className="flex flex-wrap items-center justify-center gap-2">
                                    <Button variant="outline" onClick={() => setImportCsvOpen(true)}>
                                        <FileSpreadsheet aria-hidden /> Import CSV
                                    </Button>
                                    <Button onClick={() => setSubmitOpen(true)}>
                                        <Link2 aria-hidden /> Scrape links
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                </div>
            ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => (
                        <li key={item._id}>
                            <ScrapeCard
                                item={item}
                                categoryLabel={hierarchyLabel(item)}
                                selectable={selectable}
                                selected={selected.has(item._id)}
                                onSelect={(on) => toggle(item._id, on)}
                                onOpen={() => setOpenId(item._id)}
                            />
                        </li>
                    ))}
                </ul>
            )}

            {list.data && list.data.totalPages > 1 ? (
                <nav className="flex items-center justify-end gap-2" aria-label="Pages">
                    <span className="text-sm text-muted-foreground tabular-nums">
                        Page {list.data.page} of {list.data.totalPages}
                    </span>
                    <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        <ChevronLeft aria-hidden />
                    </Button>
                    <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label="Next page"
                        disabled={page >= list.data.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        <ChevronRight aria-hidden />
                    </Button>
                </nav>
            ) : null}

            <SubmitLinksDialog open={submitOpen} onOpenChange={setSubmitOpen} onSubmitted={() => setTab('in_progress')} />
            <ImportCsvDialog open={importCsvOpen} onOpenChange={setImportCsvOpen} onImported={() => { setTab('ready'); setPage(1); }} />
            <ReviewSheet id={openId} onOpenChange={(open) => !open && setOpenId(null)} canEdit={canEdit} onNext={openNext} />
        </PageContainer>
    );
}

function ScrapeCard({
    item,
    categoryLabel,
    selectable,
    selected,
    onSelect,
    onOpen,
}: {
    item: ScrapedItem;
    categoryLabel: string;
    selectable: boolean;
    selected: boolean;
    onSelect: (on: boolean) => void;
    onOpen: () => void;
}) {
    const cover = item.images[0]?.url;
    const busy = item.status === 'queued' || item.status === 'scraping' || item.status === 'approving';
    const discount = item.mrp && item.price && item.mrp > item.price ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0;

    return (
        <article
            className={cn(
                'group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md',
                selected && 'ring-2 ring-primary',
            )}
        >
            {selectable ? (
                <div className="absolute top-2 left-2 z-10 rounded-md bg-background/90 p-1 shadow-sm">
                    <Checkbox checked={selected} onCheckedChange={(on) => onSelect(on === true)} aria-label={`Select ${item.name || item.sourceUrl}`} />
                </div>
            ) : null}
            <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left focus-visible:outline-none" aria-label={`Open ${item.name || 'scraped product'}`}>
                <div className="relative flex aspect-[4/3] items-center justify-center bg-white">
                    {cover ? (
                        <img src={cover} alt="" loading="lazy" className="size-full object-contain p-3" />
                    ) : busy ? (
                        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                    ) : (
                        <ImageOff className="size-6 text-muted-foreground" aria-hidden />
                    )}
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                        <ScrapeStatusBadge status={item.status} />
                        {item.imageCount && item.imageCount > 1 ? (
                            <Badge variant="neutral" className="tabular-nums">
                                {item.imageCount} photos
                            </Badge>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 border-t p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{SITE_LABEL[item.sourceSite] ?? 'Web'}</span>
                        {item.brand ? <span className="truncate">· {item.brand}</span> : null}
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold text-balance">{item.name || <span className="break-all font-normal text-muted-foreground">{item.sourceUrl}</span>}</h3>
                    {item.status === 'failed' ? (
                        <p className="line-clamp-3 text-xs text-destructive">{item.error}</p>
                    ) : item.price ? (
                        <div className="flex items-baseline gap-2 text-sm">
                            <Money value={item.price} className="font-semibold" />
                            {discount ? (
                                <>
                                    <Money value={item.mrp} className="text-xs text-muted-foreground line-through" />
                                    <span className="text-xs font-medium text-success-text">{discount}% off</span>
                                </>
                            ) : null}
                            {item.unit ? <span className="ml-auto truncate text-xs text-muted-foreground">{item.unit}</span> : null}
                        </div>
                    ) : null}
                    {item.status === 'ready' || item.status === 'approved' ? (
                        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                            {categoryLabel ? (
                                <Badge variant="outline" className="max-w-full truncate">
                                    {categoryLabel}
                                </Badge>
                            ) : (
                                <Badge variant="warning">No category</Badge>
                            )}
                            {item.duplicateOf ? (
                                <Badge variant="destructive">
                                    <Copy aria-hidden /> Possible duplicate
                                </Badge>
                            ) : null}
                            {item.warnings?.length ? (
                                <Badge variant="warning" title={item.warnings.join(' ')}>
                                    <AlertTriangle aria-hidden /> Check
                                </Badge>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </button>
        </article>
    );
}

export default withProviders(ScraperPage);
