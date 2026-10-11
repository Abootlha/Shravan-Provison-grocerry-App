import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, FolderTree, GalleryHorizontalEnd, Link2, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState, PageContainer, PageHeader, confirm, withProviders } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage, http } from '@/lib/http';
import { queryClient, queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { takeUrlIntent, useCanEditCatalog, useCategories } from '@/components/catalog/api';
import { ActiveSwitch } from '@/components/catalog/ActiveSwitch';
import { pluralize } from '@/components/catalog/parts';
import { RowActions } from '@/components/catalog/RowActions';
import { SortableList } from '@/components/catalog/SortableList';
import type { Banner, Category } from '@/components/catalog/types';
import { BannerForm, toBannerBody, type BannerFormValues } from './BannerForm';
import { BannerPreview } from './BannerPreview';
import { useProduct } from './ProductPicker';
import { bannerState, scheduleLabel, type BannerState } from './schedule';

const bannersKey = [...queryKeys.banners.all, 'admin'] as const;

const fetchBanners = () => http.get<{ banners: Banner[] }>('/admin/banners').then((r) => r.banners);

const STATE: Record<BannerState, { label: string; variant: 'success' | 'brand' | 'neutral' | 'outline' }> = {
    live: { label: 'Live', variant: 'success' },
    scheduled: { label: 'Scheduled', variant: 'brand' },
    ended: { label: 'Ended', variant: 'neutral' },
    off: { label: 'Off', variant: 'outline' },
};

function BannersPage() {
    const canEdit = useCanEditCatalog();
    const query = useQuery({ queryKey: bannersKey, queryFn: fetchBanners });
    const categories = useCategories();
    const [editing, setEditing] = React.useState<Banner | null>(null);
    const [formOpen, setFormOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [now, setNow] = React.useState(() => Date.now());

    // Live/Scheduled/Ended flip on their own; re-evaluate once a minute.
    React.useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(t);
    }, []);

    const banners = query.data;
    const live = React.useMemo(() => (banners ?? []).filter((b) => bannerState(b, now) === 'live'), [banners, now]);
    const categoryById = React.useMemo(() => new Map((categories.data ?? []).map((c) => [c._id, c])), [categories.data]);

    const openCreate = React.useCallback(() => {
        setEditing(null);
        setFormOpen(true);
    }, []);
    const openEdit = React.useCallback((b: Banner) => {
        setEditing(b);
        setFormOpen(true);
    }, []);

    const intent = React.useRef<{ action: string | null; id: string | null } | null>(null);
    React.useEffect(() => {
        intent.current = takeUrlIntent();
        if (intent.current.action === 'new') {
            intent.current = null;
            openCreate();
        }
    }, [openCreate]);
    React.useEffect(() => {
        const id = intent.current?.id;
        if (!id || !banners) return;
        intent.current = null;
        const found = banners.find((b) => b._id === id);
        if (found) openEdit(found);
    }, [banners, openEdit]);

    const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.banners.all });

    const setActive = async (b: Banner, isActive: boolean) => {
        const previous = queryClient.getQueryData<Banner[]>(bannersKey);
        queryClient.setQueryData<Banner[]>(bannersKey, (list) => list?.map((x) => (x._id === b._id ? { ...x, isActive } : x)));
        try {
            await http.patch(`/admin/banners/${b._id}`, { isActive });
            const state = bannerState({ ...b, isActive });
            toast.success(isActive ? `“${b.title}” turned on` : `“${b.title}” turned off`, {
                description:
                    !isActive
                        ? 'Customers stop seeing it within a minute.'
                        : state === 'live'
                          ? 'Customers see it within a minute.'
                          : state === 'scheduled'
                            ? 'It will appear when its dates start.'
                            : 'Its dates have passed, so customers will not see it. Change the dates to run it again.',
            });
        } catch (error) {
            queryClient.setQueryData(bannersKey, previous);
            toast.error('Could not update the banner', { description: errorMessage(error) });
        } finally {
            void refresh();
        }
    };

    const saveOrder = async (ids: string[]) => {
        const previous = queryClient.getQueryData<Banner[]>(bannersKey);
        if (!previous) return;
        queryClient.setQueryData<Banner[]>(bannersKey, ids.map((id, i) => ({ ...previous.find((b) => b._id === id)!, sortOrder: i })));
        setSaving(true);
        try {
            const res = await http.post<{ banners: Banner[] }>('/admin/banners/reorder', { ids });
            if (res?.banners) queryClient.setQueryData(bannersKey, res.banners);
            toast.success('Banner order saved', { description: 'The carousel uses this order within a minute.' });
        } catch (error) {
            queryClient.setQueryData(bannersKey, previous);
            toast.error('Could not save the new order', { description: errorMessage(error) });
        } finally {
            setSaving(false);
            void refresh();
        }
    };

    const moveBy = (b: Banner, delta: number) => {
        if (!banners) return;
        const ids = banners.map((x) => x._id);
        const from = ids.indexOf(b._id);
        const to = from + delta;
        if (to < 0 || to >= ids.length) return;
        ids.splice(to, 0, ...ids.splice(from, 1));
        void saveOrder(ids);
    };

    const remove = (b: Banner) =>
        confirm({
            title: `Delete “${b.title}”?`,
            description:
                bannerState(b, now) === 'live'
                    ? 'It is live now; customers stop seeing it within a minute. This cannot be undone. Turning it off instead keeps it for later.'
                    : 'This cannot be undone. Turning it off instead keeps it for later.',
            confirmLabel: 'Delete banner',
            tone: 'destructive',
            onConfirm: async () => {
                await http.del(`/admin/banners/${b._id}`);
                toast.success('Banner deleted');
                await refresh();
            },
        });

    const onSubmit = async (values: BannerFormValues) => {
        const body = toBannerBody(values);
        if (editing) {
            await http.patch(`/admin/banners/${editing._id}`, body);
            toast.success('Banner saved');
        } else {
            await http.post('/admin/banners', body);
            toast.success('Banner created', { description: 'It is last in the carousel. Drag it to move it.' });
        }
        await refresh();
    };

    return (
        <PageContainer>
            <PageHeader
                title="Banners"
                description="The carousel at the top of the customer app’s home screen. Customers see live banners in this order."
                actions={
                    canEdit ? (
                        <Button onClick={openCreate}>
                            <Plus aria-hidden />
                            New banner
                        </Button>
                    ) : null
                }
            />

            <div className={cn('grid gap-6 xl:items-start', banners?.length !== 0 && 'xl:grid-cols-[minmax(0,1fr)_22rem]')}>
                <section aria-labelledby="banners-list-title" className="@container min-w-0 overflow-hidden rounded-xl border bg-card">
                    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-3', banners && !banners.length && 'hidden')}>
                        <div className="min-w-0">
                            <h2 id="banners-list-title" className="text-sm font-semibold text-foreground">
                                {banners ? `${pluralize(live.length, 'banner')} live of ${banners.length}` : 'Banners'}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {canEdit ? 'Drag the handle, or focus it and use the arrow keys, to change the order.' : 'Only admins can change banners.'}
                            </p>
                        </div>
                    </div>

                    {query.isPending ? (
                        <ListSkeleton />
                    ) : query.isError ? (
                        <ErrorState title="Couldn't load banners" error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />
                    ) : !banners?.length ? (
                        <EmptyState
                            icon={GalleryHorizontalEnd}
                            title="No banners yet"
                            description="Until you add one, the app hides the carousel. A banner links to a category, a product or a web page, and can run for set dates."
                            action={canEdit ? <Button onClick={openCreate}><Plus aria-hidden />New banner</Button> : undefined}
                            size="page"
                        />
                    ) : (
                        <SortableList
                            label="Banners in carousel order"
                            items={banners}
                            getId={getId}
                            getLabel={getTitle}
                            disabled={!canEdit || saving}
                            onReorder={(ids) => void saveOrder(ids)}
                            renderItem={(b, { handle, index }) => {
                                const state = bannerState(b, now);
                                return (
                                    <div className="grid grid-cols-[2rem_4.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 pr-3 pl-2 @xl:grid-cols-[2rem_8rem_minmax(0,1fr)_auto_2rem] @xl:px-4">
                                        {handle}
                                        <button
                                            type="button"
                                            onClick={() => canEdit && openEdit(b)}
                                            disabled={!canEdit}
                                            aria-label={`Edit ${b.title}`}
                                            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
                                        >
                                            <BannerPreview image={b.image} title={b.title} size="sm" className={cn(state !== 'live' && 'opacity-60')} />
                                        </button>
                                        <div className="min-w-0 space-y-1">
                                            <p className={cn('line-clamp-2 font-medium @xl:truncate', state === 'live' ? 'text-foreground' : 'text-muted-foreground')}>{b.title}</p>
                                            {b.titleHi ? (
                                                <p lang="hi" className="hidden truncate text-xs text-muted-foreground @xl:block">
                                                    {b.titleHi}
                                                </p>
                                            ) : null}
                                            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                <Badge variant={STATE[state].variant}>{STATE[state].label}</Badge>
                                                <span className="tabular-nums">{scheduleLabel(b.startsAt, b.endsAt)}</span>
                                            </p>
                                            <p className="flex min-w-0 text-xs text-muted-foreground">
                                                <TargetLabel banner={b} categoryById={categoryById} />
                                            </p>
                                        </div>
                                        <span className="flex flex-col items-center gap-1 @xl:contents">
                                            <span className="flex justify-center">
                                                <ActiveSwitch name={b.title} checked={b.isActive} disabled={!canEdit} onCheckedChange={(next) => void setActive(b, next)} />
                                            </span>
                                            <RowActions
                                                label={b.title}
                                                actions={
                                                    canEdit
                                                        ? [
                                                              { label: 'Edit', icon: Pencil, onSelect: () => openEdit(b) },
                                                              { label: 'Move up', icon: ArrowUp, onSelect: () => moveBy(b, -1), disabled: index === 0 || saving },
                                                              { label: 'Move down', icon: ArrowDown, onSelect: () => moveBy(b, 1), disabled: index === banners.length - 1 || saving },
                                                              { label: 'Delete…', icon: Trash2, destructive: true, onSelect: () => void remove(b), separated: true },
                                                          ]
                                                        : []
                                                }
                                            />
                                        </span>
                                    </div>
                                );
                            }}
                        />
                    )}
                </section>

                {banners?.length === 0 ? null : (
                <aside aria-labelledby="in-app-title" className="rounded-xl border bg-card p-4 xl:sticky xl:top-20">
                    <h2 id="in-app-title" className="text-sm font-semibold text-foreground">
                        First in the app now
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {live.length > 1 ? `Then ${pluralize(live.length - 1, 'more')} in the order on the left.` : live.length === 1 ? 'The only live banner.' : 'Nothing is live, so the app hides the carousel.'}
                    </p>
                    <div className="mt-3">
                        {query.isPending ? (
                            <Skeleton className="aspect-[2/1] w-full rounded-xl" />
                        ) : live[0] ? (
                            <BannerPreview image={live[0].image} title={live[0].title} titleHi={live[0].titleHi} />
                        ) : (
                            <div className="flex aspect-[2/1] w-full items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm text-muted-foreground">
                                No live banner
                            </div>
                        )}
                    </div>
                    {live.length > 1 ? (
                        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
                            {live.map((b, i) => (
                                <span key={b._id} className={cn('h-1 rounded-full', i === 0 ? 'w-5 bg-primary' : 'w-2.5 bg-border')} />
                            ))}
                        </div>
                    ) : null}
                </aside>
                )}
            </div>

            <BannerForm open={formOpen} onOpenChange={setFormOpen} banner={editing} categories={categories.data ?? []} onSubmit={onSubmit} />
        </PageContainer>
    );
}

const getId = (b: Banner) => b._id;
const getTitle = (b: Banner) => b.title;

function TargetLabel({ banner, categoryById }: { banner: Banner; categoryById: Map<string, Category> }) {
    const { target } = banner;
    const product = useProduct(target.type === 'product' ? target.id : undefined);
    if (target.type === 'category') {
        const c = target.id ? categoryById.get(target.id) : undefined;
        return (
            <span className="inline-flex min-w-0 items-center gap-1">
                <FolderTree className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Opens category </span>
                <span className={cn('truncate', !c && categoryById.size > 0 && 'text-destructive')}>
                    {c ? c.name + (c.isActive ? '' : ' (hidden)') : categoryById.size ? 'Missing category' : '…'}
                </span>
            </span>
        );
    }
    if (target.type === 'product') {
        return (
            <span className="inline-flex min-w-0 items-center gap-1">
                <Package className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Opens product </span>
                <span className={cn('truncate', product.data === null && 'text-destructive')}>
                    {product.data ? product.data.name : product.isPending ? '…' : 'Product not found'}
                </span>
            </span>
        );
    }
    let host = target.url ?? '';
    try {
        host = new URL(target.url ?? '').host;
    } catch {
        /* keep raw */
    }
    return (
        <span className="inline-flex min-w-0 items-center gap-1">
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Opens link </span>
            <span className="truncate">{host}</span>
        </span>
    );
}

function ListSkeleton() {
    return (
        <ul aria-hidden className="divide-y">
            {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-6" />
                    <Skeleton className="aspect-[2/1] w-24 rounded-md sm:w-32" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-48" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </li>
            ))}
        </ul>
    );
}

export default withProviders(BannersPage);
