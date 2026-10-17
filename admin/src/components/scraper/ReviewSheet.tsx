import * as React from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Loader2, RotateCw, Sparkles, Star, Trash2, X } from 'lucide-react';
import { ErrorState, confirm } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';
import { HierarchyPicker, useHierarchyLabel, type HierarchyValue } from './HierarchyPicker';
import { invalidateScraper, scraperApi, useScrapedItem } from './api';
import { SITE_LABEL, type ScrapedEdits, type ScrapedItem } from './types';
import { ScrapeStatusBadge } from './ScrapeStatusBadge';

interface FormState {
    name: string;
    brand: string;
    price: string;
    mrp: string;
    unit: string;
    barcode: string;
    stock: string;
    description: string;
    highlights: string;
    hierarchy: HierarchyValue;
    imageUrls: string[];
}

const toForm = (item: ScrapedItem): FormState => ({
    name: item.name ?? '',
    brand: item.brand ?? '',
    price: item.price != null ? String(item.price) : '',
    mrp: item.mrp != null ? String(item.mrp) : '',
    unit: item.unit ?? '',
    barcode: item.barcode ?? '',
    stock: String(item.stock ?? 0),
    description: item.description ?? '',
    highlights: item.highlights ?? '',
    hierarchy: {
        categoryId: item.categoryId ?? null,
        subcategoryId: item.subcategoryId ?? null,
        itemGroupId: item.itemGroupId ?? null,
    },
    imageUrls: item.images.map((i) => i.url),
});

const num = (value: string) => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
};

/** Only the fields that differ from the stored item. */
function diff(item: ScrapedItem, form: FormState): ScrapedEdits {
    const out: ScrapedEdits = {};
    const before = toForm(item);
    for (const key of ['name', 'brand', 'unit', 'barcode', 'description', 'highlights'] as const) {
        if (form[key] !== before[key]) out[key] = form[key];
    }
    if (form.price !== before.price) out.price = num(form.price) ?? 0;
    if (form.mrp !== before.mrp) out.mrp = num(form.mrp) ?? 0;
    if (form.stock !== before.stock) out.stock = Math.max(0, Math.trunc(num(form.stock) ?? 0));
    const h = form.hierarchy;
    const bh = before.hierarchy;
    if (h.categoryId !== bh.categoryId || h.subcategoryId !== bh.subcategoryId || h.itemGroupId !== bh.itemGroupId) {
        out.categoryId = h.categoryId;
        out.subcategoryId = h.subcategoryId;
        out.itemGroupId = h.itemGroupId;
    }
    if (form.imageUrls.join('\n') !== before.imageUrls.join('\n')) out.imageUrls = form.imageUrls;
    return out;
}

/** Problems that block approval (the backend checks the same). */
function missing(form: FormState): string[] {
    const out: string[] = [];
    if (!form.name.trim()) out.push('name');
    if (!(num(form.price) && num(form.price)! > 0)) out.push('selling price');
    if (!form.unit.trim()) out.push('unit');
    if (!form.hierarchy.categoryId) out.push('category');
    return out;
}

export function ReviewSheet({
    id,
    onOpenChange,
    canEdit,
    onNext,
}: {
    id: string | null;
    onOpenChange: (open: boolean) => void;
    canEdit: boolean;
    /** Opens the next product waiting for review (after approve / decline). */
    onNext?: () => void;
}) {
    const query = useScrapedItem(id);
    const item = query.data;
    const [form, setForm] = React.useState<FormState | null>(null);
    const [busy, setBusy] = React.useState<null | 'save' | 'approve' | 'decline' | 'retry'>(null);
    const [publishAs, setPublishAs] = React.useState<'active' | 'draft'>('active');
    const [declining, setDeclining] = React.useState(false);
    const [reason, setReason] = React.useState('');
    const hierarchyLabel = useHierarchyLabel();

    React.useEffect(() => {
        setForm(item ? toForm(item) : null);
        setDeclining(false);
        setReason('');
    }, [item]);

    const editable = canEdit && item?.status === 'ready';
    const changes = item && form ? diff(item, form) : {};
    const dirty = Object.keys(changes).length > 0;
    const blockers = form ? missing(form) : [];

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => (f ? { ...f, [key]: value } : f));

    async function close() {
        if (dirty && editable) {
            const ok = await confirm({
                title: 'Discard your changes?',
                description: 'Your edits to this preview have not been saved.',
                confirmLabel: 'Discard',
                tone: 'destructive',
            });
            if (!ok) return;
        }
        onOpenChange(false);
    }

    async function run(kind: NonNullable<typeof busy>, action: () => Promise<unknown>, success: string, next = false) {
        setBusy(kind);
        try {
            await action();
            await invalidateScraper();
            toast.success(success);
            if (next && onNext) onNext();
            else if (next) onOpenChange(false);
        } catch (error) {
            toast.error('That did not work', { description: errorMessage(error) });
        } finally {
            setBusy(null);
        }
    }

    const save = () => item && run('save', () => scraperApi.update(item._id, changes), 'Changes saved');
    const approve = () =>
        item &&
        run(
            'approve',
            () => scraperApi.approve(item._id, { ...changes, publishAs }),
            publishAs === 'active' ? 'Added to the store' : 'Saved as a draft product',
            true,
        );
    const decline = () =>
        item && run('decline', () => scraperApi.decline(item._id, reason.trim() || undefined), 'Declined', true);
    const retry = () => item && run('retry', () => scraperApi.retry(item._id), 'Scraping again');

    const moveImage = (index: number, to: number) =>
        setForm((f) => {
            if (!f) return f;
            const urls = [...f.imageUrls];
            const [moved] = urls.splice(index, 1);
            urls.splice(to, 0, moved);
            return { ...f, imageUrls: urls };
        });

    return (
        <Sheet open={!!id} onOpenChange={(open) => (open ? onOpenChange(true) : void close())}>
            <SheetContent className="gap-0 p-0 sm:max-w-3xl" onInteractOutside={(e) => e.preventDefault()}>
                <SheetHeader className="border-b px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2 pr-8">
                        <SheetTitle className="text-lg">{item?.name || 'Scraped product'}</SheetTitle>
                        {item ? <ScrapeStatusBadge status={item.status} /> : null}
                    </div>
                    <SheetDescription asChild>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {item ? (
                                <>
                                    <span>{SITE_LABEL[item.sourceSite] ?? 'Web'}</span>
                                    <a
                                        href={item.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"
                                    >
                                        Open source page <ExternalLink className="size-3.5" aria-hidden />
                                    </a>
                                </>
                            ) : (
                                'Loading…'
                            )}
                        </div>
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                    {query.isError ? (
                        <ErrorState error={query.error} onRetry={() => query.refetch()} />
                    ) : !item || !form ? (
                        <div className="space-y-4">
                            <Skeleton className="h-40 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-2/3" />
                        </div>
                    ) : (
                        <>
                            <StatusNotes item={item} />

                            {/* A failed link has nothing to review: just the reason and its actions. */}
                            {item.status !== 'failed' ? (
                                <>
                                    {item.duplicateOf ? (
                                        <Notice tone="warning" icon={AlertTriangle}>
                                            A product with this name is already in the catalogue.{' '}
                                            <a className="font-medium underline" href={`/products?id=${item.duplicateOf}`}>
                                                Open it
                                            </a>{' '}
                                            before approving a second copy.
                                        </Notice>
                                    ) : null}

                                    <section className="space-y-2">
                                        <div className="flex items-baseline justify-between">
                                            <h3 className="text-sm font-semibold">Photos</h3>
                                            <span className="text-xs text-muted-foreground">
                                                {form.imageUrls.length} kept
                                                {item.imagesInR2 === false && item.images.some((img) => img.url?.startsWith('data:')) ? ' · stored in the database (R2 not set up)' : ''}
                                            </span>
                                        </div>
                                        {form.imageUrls.length ? (
                                            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                                                {form.imageUrls.map((url, index) => (
                                                    <li
                                                        key={url}
                                                        className={cn(
                                                            'group relative aspect-square overflow-hidden rounded-lg border bg-white',
                                                            index === 0 && 'ring-2 ring-primary',
                                                        )}
                                                    >
                                                        <img src={url} alt="" className="size-full object-contain" loading="lazy" />
                                                        {index === 0 ? (
                                                            <Badge variant="brand" className="absolute top-1.5 left-1.5">
                                                                Cover
                                                            </Badge>
                                                        ) : null}
                                                        {editable ? (
                                                            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                                                                {index > 0 ? (
                                                                    <>
                                                                        <Button
                                                                            type="button"
                                                                            size="icon-xs"
                                                                            variant="secondary"
                                                                            aria-label="Make cover photo"
                                                                            onClick={() => moveImage(index, 0)}
                                                                        >
                                                                            <Star aria-hidden />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            size="icon-xs"
                                                                            variant="secondary"
                                                                            aria-label="Move earlier"
                                                                            onClick={() => moveImage(index, index - 1)}
                                                                        >
                                                                            <ArrowLeft aria-hidden />
                                                                        </Button>
                                                                    </>
                                                                ) : null}
                                                                <Button
                                                                    type="button"
                                                                    size="icon-xs"
                                                                    variant="destructive"
                                                                    aria-label="Remove photo"
                                                                    onClick={() => set('imageUrls', form.imageUrls.filter((u) => u !== url))}
                                                                >
                                                                    <X aria-hidden />
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                                No photos. You can add them from the product editor after approving.
                                            </p>
                                        )}
                                    </section>

                                    <section className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Name" id="sp-name" className="sm:col-span-2">
                                            <Input id="sp-name" value={form.name} disabled={!editable} onChange={(e) => set('name', e.target.value)} />
                                        </Field>
                                        <Field label="Brand" id="sp-brand">
                                            <Input id="sp-brand" value={form.brand} disabled={!editable} onChange={(e) => set('brand', e.target.value)} />
                                        </Field>
                                        <Field label="Unit" id="sp-unit" hint="e.g. 500 g, 1 L, 6 pcs">
                                            <Input id="sp-unit" value={form.unit} disabled={!editable} onChange={(e) => set('unit', e.target.value)} />
                                        </Field>
                                        <Field label="Selling price (₹)" id="sp-price">
                                            <Input
                                                id="sp-price"
                                                inputMode="decimal"
                                                value={form.price}
                                                disabled={!editable}
                                                onChange={(e) => set('price', e.target.value)}
                                            />
                                        </Field>
                                        <Field label="MRP (₹)" id="sp-mrp" hint={num(form.mrp) && num(form.price) && num(form.mrp)! < num(form.price)! ? 'MRP is below the selling price; it will be set to the price.' : undefined}>
                                            <Input id="sp-mrp" inputMode="decimal" value={form.mrp} disabled={!editable} onChange={(e) => set('mrp', e.target.value)} />
                                        </Field>
                                        <Field label="Opening stock" id="sp-stock" hint="Units you have on the shelf now.">
                                            <Input
                                                id="sp-stock"
                                                inputMode="numeric"
                                                value={form.stock}
                                                disabled={!editable}
                                                onChange={(e) => set('stock', e.target.value)}
                                            />
                                        </Field>
                                        <Field label="Barcode" id="sp-barcode" hint="Optional (EAN/UPC).">
                                            <Input id="sp-barcode" value={form.barcode} disabled={!editable} onChange={(e) => set('barcode', e.target.value)} />
                                        </Field>
                                    </section>

                                    <section className="space-y-3 rounded-lg border p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="text-sm font-semibold">Category</h3>
                                            {item.suggestion?.categoryId ? (
                                                <SuggestionHint
                                                    item={item}
                                                    label={hierarchyLabel(item.suggestion)}
                                                    applied={
                                                        form.hierarchy.categoryId === (item.suggestion.categoryId ?? null) &&
                                                        form.hierarchy.subcategoryId === (item.suggestion.subcategoryId ?? null) &&
                                                        form.hierarchy.itemGroupId === (item.suggestion.itemGroupId ?? null)
                                                    }
                                                    onApply={
                                                        editable
                                                            ? () =>
                                                                  set('hierarchy', {
                                                                      categoryId: item.suggestion?.categoryId ?? null,
                                                                      subcategoryId: item.suggestion?.subcategoryId ?? null,
                                                                      itemGroupId: item.suggestion?.itemGroupId ?? null,
                                                                  })
                                                            : undefined
                                                    }
                                                />
                                            ) : null}
                                        </div>
                                        {item.sourceCategoryPath?.length ? (
                                            <p className="text-xs text-muted-foreground">
                                                On {SITE_LABEL[item.sourceSite] ?? 'the source site'}: {item.sourceCategoryPath.join(' › ')}
                                            </p>
                                        ) : null}
                                        <HierarchyPicker
                                            value={form.hierarchy}
                                            onChange={(h) => set('hierarchy', h)}
                                            disabled={!editable}
                                            idPrefix="review"
                                        />
                                    </section>

                                    <section className="space-y-4">
                                        <Field label="Highlights" id="sp-highlights" hint="One per line.">
                                            <Textarea
                                                id="sp-highlights"
                                                rows={3}
                                                value={form.highlights}
                                                disabled={!editable}
                                                onChange={(e) => set('highlights', e.target.value)}
                                            />
                                        </Field>
                                        <Field label="Description" id="sp-description">
                                            <Textarea
                                                id="sp-description"
                                                rows={8}
                                                value={form.description}
                                                disabled={!editable}
                                                onChange={(e) => set('description', e.target.value)}
                                            />
                                        </Field>
                                        <Facts item={item} />
                                    </section>
                                </>
                            ) : null}

                            {declining ? (
                                <section className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                                    <Label htmlFor="sp-reason">Why decline? (optional)</Label>
                                    <Textarea
                                        id="sp-reason"
                                        rows={2}
                                        value={reason}
                                        autoFocus
                                        maxLength={500}
                                        placeholder="Not stocked, wrong product, duplicate…"
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setDeclining(false)}>
                                            Keep it
                                        </Button>
                                        <Button type="button" variant="destructive" size="sm" disabled={!!busy} onClick={decline}>
                                            {busy === 'decline' ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                                            Decline and delete photos
                                        </Button>
                                    </div>
                                </section>
                            ) : null}
                        </>
                    )}
                </div>

                {item && canEdit ? (
                    <SheetFooter className="flex-row flex-wrap items-center justify-between gap-2 border-t px-6 py-3">
                        {item.status === 'ready' || item.status === 'failed' ? (
                            <Button type="button" variant="ghost" className="text-destructive" disabled={!!busy || declining} onClick={() => setDeclining(true)}>
                                <Trash2 aria-hidden /> Decline
                            </Button>
                        ) : (
                            <span />
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                            {item.status === 'failed' ? (
                                <Button type="button" disabled={!!busy} onClick={retry}>
                                    {busy === 'retry' ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
                                    Try again
                                </Button>
                            ) : null}
                            {item.status === 'ready' ? (
                                <>
                                    <Button type="button" variant="outline" disabled={!dirty || !!busy} onClick={save}>
                                        {busy === 'save' ? <Loader2 className="animate-spin" aria-hidden /> : null}
                                        Save
                                    </Button>
                                    <Select value={publishAs} onValueChange={(v) => setPublishAs(v as 'active' | 'draft')}>
                                        <SelectTrigger className="w-36" aria-label="Publish as">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Publish live</SelectItem>
                                            <SelectItem value="draft">As draft</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        disabled={!!busy || blockers.length > 0}
                                        title={blockers.length ? `Add ${blockers.join(', ')} first` : undefined}
                                        onClick={approve}
                                    >
                                        {busy === 'approve' ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                                        Approve
                                    </Button>
                                </>
                            ) : null}
                        </div>
                        {item.status === 'ready' && blockers.length ? (
                            <p className="w-full text-right text-xs text-muted-foreground">Add {blockers.join(', ')} to approve.</p>
                        ) : null}
                    </SheetFooter>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}

function StatusNotes({ item }: { item: ScrapedItem }) {
    if (item.status === 'failed') {
        return (
            <Notice tone="destructive" icon={AlertTriangle}>
                {item.error || 'Scraping failed.'}
            </Notice>
        );
    }
    if (item.status === 'approved') {
        return (
            <Notice tone="success" icon={Check}>
                Approved and added to the catalogue.{' '}
                {item.productId ? (
                    <a className="font-medium underline" href={`/products?id=${item.productId}`}>
                        Open the product
                    </a>
                ) : null}
            </Notice>
        );
    }
    if (item.status === 'declined') {
        return (
            <Notice tone="neutral" icon={X}>
                Declined{item.declineReason ? `: ${item.declineReason}` : '.'} Submit the link again to re-scrape it.
            </Notice>
        );
    }
    if (item.warnings?.length) {
        return (
            <Notice tone="warning" icon={AlertTriangle}>
                {item.warnings.join(' ')}
            </Notice>
        );
    }
    return null;
}

function SuggestionHint({
    item,
    label,
    applied,
    onApply,
}: {
    item: ScrapedItem;
    label: string;
    applied: boolean;
    onApply?: () => void;
}) {
    const confidence = item.suggestion?.confidence ?? 'low';
    return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            <span className="text-muted-foreground">Suggested:</span>
            <span className="font-medium">{label || 'a removed category'}</span>
            <Badge variant={confidence === 'high' ? 'success' : confidence === 'medium' ? 'brand' : 'neutral'}>
                {confidence} match
            </Badge>
            {!applied && onApply ? (
                <Button type="button" size="xs" variant="outline" onClick={onApply}>
                    Use this
                </Button>
            ) : null}
        </div>
    );
}

function Facts({ item }: { item: ScrapedItem }) {
    const facts = [
        item.mrp && item.price && item.mrp > item.price
            ? ['Source discount', `${Math.round(((item.mrp - item.price) / item.mrp) * 100)}% off`]
            : null,
        item.shelfLifeDays ? ['Shelf life', `${item.shelfLifeDays} days`] : null,
        item.dietary ? ['Diet', item.dietary] : null,
        item.storage ? ['Storage', item.storage] : null,
    ].filter(Boolean) as [string, string][];
    if (!facts.length) return null;
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-4">
            {facts.map(([k, v]) => (
                <div key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                </div>
            ))}
        </dl>
    );
}

function Field({
    label,
    id,
    hint,
    className,
    children,
}: {
    label: string;
    id: string;
    hint?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={id}>{label}</Label>
            {children}
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

const NOTICE_TONE = {
    warning: 'border-warning/30 bg-warning-tint text-warning',
    destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
    success: 'border-success/30 bg-success-tint text-success-text',
    neutral: 'border-border bg-muted text-muted-foreground',
};

function Notice({
    tone,
    icon: Icon,
    children,
}: {
    tone: keyof typeof NOTICE_TONE;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <div role="status" className={cn('flex gap-2 rounded-lg border px-3 py-2.5 text-sm', NOTICE_TONE[tone])}>
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div>{children}</div>
        </div>
    );
}

