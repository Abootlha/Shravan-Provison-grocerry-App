import * as React from 'react';
import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { AlertTriangle, Loader2, PackagePlus, ScanBarcode, Search } from 'lucide-react';
import { toast } from 'sonner';
import { confirm, ErrorState, Money, StatusBadge, TextareaField, TextField, useZodForm } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ApiError, errorMessage, http } from '@/lib/http';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BarcodeScanner } from './BarcodeScanner';
import { canEditCatalogue, invalidateProducts, useCategories, useItemGroups, useProduct, useSubcategories } from './data';
import {
    emptyProductForm,
    FIELD_SECTION,
    looksFreshCategory,
    MAX_VARIANTS,
    mapServerMessage,
    productSchema,
    productToForm,
    toProductPayload,
    unitLooksLikeBarcode,
    type ProductFormInput,
    type ProductFormValues,
    type SectionId,
} from './editorSchema';
import { ImageManager } from './ImageManager';
import { issueText, StockCell } from './ProductBits';
import { refId, type AdminProduct } from './types';

export type EditorTarget = { mode: 'create'; initial?: ProductFormInput; key: number } | { mode: 'edit'; id: string };

type Form = UseFormReturn<ProductFormInput, unknown, ProductFormValues>;

const SECTIONS: { id: SectionId; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'media', label: 'Media' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'organisation', label: 'Organisation' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'variants', label: 'Pack sizes' },
];

const NONE = '__none__';

export function ProductEditor({
    target,
    onClose,
    onAdjustStock,
}: {
    target: EditorTarget | null;
    onClose: () => void;
    onAdjustStock: (product: AdminProduct) => void;
}) {
    const guard = React.useRef<() => Promise<boolean>>(async () => true);
    const requestClose = async () => {
        if (await guard.current()) onClose();
    };
    const bodyKey = target ? (target.mode === 'edit' ? `edit-${target.id}` : `create-${target.key}`) : 'closed';
    return (
        <Sheet open={!!target} onOpenChange={(open) => !open && requestClose()}>
            <SheetContent
                size="xl"
                className="gap-0 p-0 sm:max-w-3xl xl:max-w-4xl"
                onInteractOutside={(e) => e.preventDefault()}
                onOpenAutoFocus={(e) => {
                    // Focus the first field instead of the first section link.
                    e.preventDefault();
                    requestAnimationFrame(() => document.getElementById('name-field')?.focus({ preventScroll: true }));
                }}
            >
                {target ? <EditorBody key={bodyKey} target={target} onClose={onClose} guardRef={guard} onAdjustStock={onAdjustStock} /> : null}
            </SheetContent>
        </Sheet>
    );
}

function EditorBody({
    target,
    onClose,
    guardRef,
    onAdjustStock,
}: {
    target: EditorTarget;
    onClose: () => void;
    guardRef: React.MutableRefObject<() => Promise<boolean>>;
    onAdjustStock: (product: AdminProduct) => void;
}) {
    const isCreate = target.mode === 'create';
    const productQuery = useProduct(target.mode === 'edit' ? target.id : null);
    const product = productQuery.data;
    const initial = React.useMemo<ProductFormInput>(
        () => (target.mode === 'create' ? (target.initial ?? emptyProductForm()) : product ? productToForm(product) : emptyProductForm()),
        [target, product],
    );
    const form = useZodForm(productSchema, initial) as Form;
    const initialRef = React.useRef(initial);
    // Fields mount only after the form holds the product's values, so the editor never flashes an
    // empty form (or lets Save run) between the product arriving and form.reset().
    const [ready, setReady] = React.useState(isCreate);

    React.useEffect(() => {
        if (target.mode === 'edit' && product && !ready) {
            initialRef.current = productToForm(product);
            form.reset(initialRef.current);
            setReady(true);
        }
    }, [product, target.mode, form, ready]);

    guardRef.current = async () => {
        if (!form.formState.isDirty || form.formState.isSubmitSuccessful) return true;
        return confirm({
            title: 'Discard unsaved changes?',
            description: 'Your edits to this product will be lost.',
            confirmLabel: 'Discard changes',
            cancelLabel: 'Keep editing',
            tone: 'destructive',
        });
    };

    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [active, setActive] = React.useState<SectionId>('basics');
    const sections = SECTIONS;

    React.useEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id.replace('section-', '') as SectionId);
            },
            { root, rootMargin: '0px 0px -65% 0px' },
        );
        root.querySelectorAll('section[id^="section-"]').forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [ready]);

    const goTo = (id: SectionId) => {
        const el = scrollRef.current?.querySelector(`#section-${id}`);
        el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        setActive(id);
    };

    const errors = form.formState.errors;
    const sectionErrors = React.useMemo(() => {
        const counts: Partial<Record<SectionId, number>> = {};
        for (const key of Object.keys(errors)) {
            if (key === 'root') continue;
            const section = FIELD_SECTION[key];
            if (section) counts[section] = (counts[section] ?? 0) + 1;
        }
        return counts;
        // formState proxies need the submit count to recompute reliably.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errors, form.formState.submitCount, form.formState.isValidating]);

    const focusFirstError = () => {
        const first = sections.find((s) => sectionErrors[s.id]);
        if (first) goTo(first.id);
    };

    const save = async (values: ProductFormValues) => {
        const dirty: Partial<Record<keyof ProductFormValues, boolean>> = {};
        if (!isCreate) {
            const init = initialRef.current as Record<string, unknown>;
            for (const key of Object.keys(values) as (keyof ProductFormValues)[]) {
                if (JSON.stringify(values[key] ?? null) !== JSON.stringify(init[key] ?? null)) dirty[key] = true;
            }
        }
        const body = isCreate ? toProductPayload(values) : toProductPayload(values, dirty);
        if (!isCreate && Object.keys(body).length === 0) {
            toast.message('No changes to save');
            onClose();
            return;
        }
        try {
            const res = isCreate
                ? await http.post<{ product: AdminProduct }>('/products', body)
                : await http.put<{ product: AdminProduct }>(`/products/${(target as { id: string }).id}`, body);
            invalidateProducts();
            toast.success(isCreate ? (values.status === 'draft' ? 'Draft saved' : 'Product created') : 'Changes saved', {
                description: res?.product?.name ?? values.name,
            });
            form.reset(values as ProductFormInput);
            onClose();
        } catch (error) {
            let matched = false;
            if (error instanceof ApiError && error.status === 400) {
                const unplaced: string[] = [];
                for (const message of error.messages) {
                    const mapped = mapServerMessage(message);
                    if (mapped.field) {
                        form.setError(mapped.field, { type: 'server', message: mapped.message });
                        matched = true;
                    } else unplaced.push(message);
                }
                if (unplaced.length) form.setError('root.server', { type: 'server', message: unplaced.join('. ') });
            } else {
                form.setError('root.server', { type: 'server', message: errorMessage(error) });
            }
            if (matched) requestAnimationFrame(focusFirstError);
        }
    };

    const onInvalid = (invalid: Record<string, unknown>) => {
        const count = Object.keys(invalid).length;
        toast.error(count === 1 ? 'One field needs attention' : `${count} fields need attention`);
        requestAnimationFrame(focusFirstError);
    };

    const submitWithStatus = (status?: 'draft' | 'active') => {
        if (status) form.setValue('status', status, { shouldDirty: true });
        return form.handleSubmit(save, onInvalid)();
    };

    const busy = form.formState.isSubmitting;
    const rootError = (errors.root as { server?: { message?: string } } | undefined)?.server?.message;
    const editable = canEditCatalogue();
    const status = form.watch('status');
    const title = isCreate ? (target.initial ? 'Duplicate product' : 'New product') : (product?.name ?? 'Edit product');

    return (
        <form
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                submitWithStatus();
            }}
            className="flex h-full min-h-0 flex-col"
        >
            <SheetHeader className="gap-1 border-b px-4 py-3 pr-12 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                    <SheetTitle className="truncate text-base">{title}</SheetTitle>
                    {!isCreate && product ? <StatusBadge kind="product" status={product.status ?? 'active'} /> : null}
                </div>
                <SheetDescription className="truncate">
                    {isCreate
                        ? 'Required: name, price, unit and category. Publishing also needs an image.'
                        : product
                          ? [product.sku, product.barcode].filter(Boolean).join(' · ') || 'Edit any section; only changed fields are saved.'
                          : 'Loading…'}
                </SheetDescription>
            </SheetHeader>

            <nav aria-label="Form sections" className="border-b md:hidden">
                <ul className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
                    {sections.map((s) => (
                        <li key={s.id}>
                            <SectionLink section={s} active={active === s.id} errors={sectionErrors[s.id]} onClick={() => goTo(s.id)} />
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="flex min-h-0 flex-1">
                <nav aria-label="Form sections" className="hidden w-44 shrink-0 border-r p-3 md:block">
                    <ul className="grid gap-0.5">
                        {sections.map((s) => (
                            <li key={s.id}>
                                <SectionLink section={s} active={active === s.id} errors={sectionErrors[s.id]} onClick={() => goTo(s.id)} block />
                            </li>
                        ))}
                    </ul>
                </nav>

                <div ref={scrollRef} className="min-w-0 flex-1 scroll-pt-4 overflow-y-auto overscroll-contain">
                    {!isCreate && (productQuery.isPending || (productQuery.isSuccess && !ready)) ? (
                        <EditorSkeleton />
                    ) : !isCreate && productQuery.isError ? (
                        <ErrorState title="Couldn't load this product" error={productQuery.error} onRetry={() => productQuery.refetch()} retrying={productQuery.isRefetching} />
                    ) : (
                        <div className="grid gap-10 px-4 py-5 pb-16 sm:px-6">
                            {product?.issues?.length ? (
                                <div role="note" className="flex gap-3 rounded-xl bg-warning-tint p-3 text-sm text-warning">
                                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                                    <div>
                                        <p className="font-semibold">Needs attention</p>
                                        <p className="text-pretty">{product.issues.map((i) => issueText(i, product)).join(' · ')}. Fix the fields below; nothing is changed automatically.</p>
                                    </div>
                                </div>
                            ) : null}
                            <BasicsSection form={form} />
                            <PricingSection form={form} />
                            <MediaSection form={form} />
                            <InventorySection form={form} product={product} isCreate={isCreate} onAdjustStock={onAdjustStock} />
                            <OrganisationSection form={form} isCreate={isCreate} />
                            <NutritionSection form={form} />
                            <VariantsSection form={form} />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-3 border-t bg-background px-4 py-3 sm:px-6">
                {rootError ? (
                    <p role="alert" className="rounded-lg bg-destructive-tint px-3 py-2 text-sm text-destructive">
                        {rootError}
                    </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {!editable ? <p className="mr-auto text-sm text-muted-foreground">Only admins can change catalogue details.</p> : null}
                    <Button type="button" variant="ghost" onClick={async () => (await guardRef.current()) && onClose()} disabled={busy}>
                        Cancel
                    </Button>
                    {isCreate ? (
                        <>
                            <Button type="button" variant="outline" disabled={busy || !editable} onClick={() => submitWithStatus('draft')}>
                                Save as draft
                            </Button>
                            <Button type="button" disabled={busy || !editable} onClick={() => submitWithStatus('active')}>
                                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PackagePlus aria-hidden />}
                                Publish
                            </Button>
                        </>
                    ) : (
                        <Button type="submit" disabled={busy || !editable || !ready}>
                            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                            {product && status === 'active' && product.status !== 'active' ? 'Save and publish' : 'Save changes'}
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
}

function SectionLink({
    section,
    active,
    errors,
    onClick,
    block,
}: {
    section: { id: SectionId; label: string };
    active: boolean;
    errors?: number;
    onClick: () => void;
    block?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'true' : undefined}
            className={cn(
                'flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                block && 'w-full',
                active ? 'bg-brand-tint font-semibold text-brand-text' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            {section.label}
            {errors ? (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-destructive px-1 text-[11px] font-semibold text-white tabular-nums">
                    <span className="sr-only">errors: </span>
                    {errors}
                </span>
            ) : null}
        </button>
    );
}

function Section({ id, title, description, children }: { id: SectionId; title: string; description?: string; children: React.ReactNode }) {
    return (
        <section id={`section-${id}`} aria-labelledby={`heading-${id}`} className="grid scroll-mt-4 gap-4">
            <div className="space-y-0.5">
                <h2 id={`heading-${id}`} className="text-base font-semibold">
                    {title}
                </h2>
                {description ? <p className="text-sm text-pretty text-muted-foreground">{description}</p> : null}
            </div>
            {children}
        </section>
    );
}

/* ---------------------------------------------------------------- Basics */

function BasicsSection({ form }: { form: Form }) {
    const [scanning, setScanning] = React.useState(false);
    const [looking, setLooking] = React.useState(false);

    const lookup = async (code: string) => {
        if (!/^[0-9]{8,14}$/.test(code)) {
            form.setError('barcode', { type: 'manual', message: 'Look-up needs an 8–14 digit EAN/UPC barcode' });
            return;
        }
        setLooking(true);
        try {
            const res = await http.get<{ found: boolean; name?: string; brand?: string; unit?: string; image?: string }>(`/products/barcode/${code}`);
            if (!res.found) {
                toast.message('No public listing for this barcode', { description: 'Fill in the details by hand.' });
                return;
            }
            const filled: string[] = [];
            const fill = (key: 'name' | 'brand' | 'unit', value?: string) => {
                if (value && !form.getValues(key)?.trim()) {
                    form.setValue(key, value.slice(0, key === 'name' ? 200 : key === 'brand' ? 100 : 50), { shouldDirty: true, shouldValidate: true });
                    filled.push(key);
                }
            };
            fill('name', res.name);
            fill('brand', res.brand);
            fill('unit', res.unit);
            if (res.image && form.getValues('images').length === 0) {
                form.setValue('images', [res.image], { shouldDirty: true, shouldValidate: true });
                filled.push('image');
            }
            if (filled.length) toast.success(`Filled ${filled.join(', ')} from Open Food Facts`, { description: 'Check them before saving.' });
            else toast.message('Found a listing, but your fields are already filled in');
        } catch (e) {
            toast.error('Barcode look-up failed', { description: errorMessage(e) });
        } finally {
            setLooking(false);
        }
    };

    return (
        <Section id="basics" title="Basics" description="What customers search for and read.">
            <TextField form={form} name="name" label="Name" placeholder="Name as printed on the pack" autoComplete="off" />
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField form={form} name="brand" label="Brand" placeholder="Brand name" autoComplete="off" />
                <Controller
                    control={form.control}
                    name="barcode"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid || undefined}>
                            <FieldLabel htmlFor="barcode-field">Barcode</FieldLabel>
                            <div className="flex gap-2">
                                <Input
                                    id="barcode-field"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="EAN / UPC digits"
                                    {...field}
                                    value={field.value ?? ''}
                                    aria-invalid={fieldState.invalid || undefined}
                                    aria-describedby="barcode-field-help"
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => setScanning(true)} aria-label="Scan barcode with camera">
                                    <ScanBarcode aria-hidden />
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => lookup((field.value ?? '').trim())}
                                    disabled={looking || !(field.value ?? '').trim()}
                                    aria-label="Look up barcode details"
                                >
                                    {looking ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
                                </Button>
                            </div>
                            <div id="barcode-field-help" className="contents">
                                {fieldState.error ? <FieldError errors={[fieldState.error]} /> : <FieldDescription>Scan or type it; look-up fills empty fields only.</FieldDescription>}
                            </div>
                        </Field>
                    )}
                />
            </div>
            <TextareaField form={form} name="description" label="Description" rows={4} placeholder="What it is, ingredients, how to use" className="[&_textarea]:max-h-60 [&_textarea]:overflow-y-auto" />
            <TextareaField form={form} name="highlights" label="Highlights" rows={2} placeholder="One short line per highlight" className="[&_textarea]:max-h-40 [&_textarea]:overflow-y-auto" />
            <BarcodeScanner
                open={scanning}
                onOpenChange={setScanning}
                onDetected={(code) => {
                    form.setValue('barcode', code, { shouldDirty: true, shouldValidate: true });
                    toast.success(`Scanned ${code}`);
                }}
            />
        </Section>
    );
}

/* ---------------------------------------------------------------- Pricing */

function PricingSection({ form }: { form: Form }) {
    const [price, mrp] = form.watch(['price', 'mrp']);
    const off = price && mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    return (
        <Section id="pricing" title="Pricing" description="In rupees, GST inclusive.">
            <div className="grid gap-4 sm:grid-cols-3">
                <TextField form={form} name="price" label="Selling price (₹)" type="number" inputMode="decimal" min={0} step="0.01" />
                <TextField form={form} name="mrp" label="MRP (₹)" type="number" inputMode="decimal" min={0} step="0.01" description="Leave empty to use the selling price." />
                <TextField form={form} name="gst" label="GST %" type="number" inputMode="decimal" min={0} max={100} step="0.01" />
            </div>
            {price ? (
                <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
                    Customers pay <Money value={price} className="font-semibold text-foreground" />
                    {off > 0 ? (
                        <>
                            {' '}
                            instead of <Money value={mrp} className="line-through" />, <span className="font-semibold text-success-text">{off}% off</span>
                        </>
                    ) : null}
                </p>
            ) : null}
        </Section>
    );
}

/* ---------------------------------------------------------------- Media */

function MediaSection({ form }: { form: Form }) {
    return (
        <Section id="media" title="Media" description="Pack shots on a plain background work best. Up to 8 images.">
            <Controller
                control={form.control}
                name="images"
                render={({ field, fieldState }) => (
                    <ImageManager
                        value={field.value}
                        onChange={(next) => {
                            field.onChange(next);
                            form.trigger('images');
                        }}
                        removeBackground={form.watch('removeBackground')}
                        onRemoveBackgroundChange={(v) => form.setValue('removeBackground', v, { shouldDirty: true })}
                        error={fieldState.error?.message}
                    />
                )}
            />
        </Section>
    );
}

/* ---------------------------------------------------------------- Inventory */

function InventorySection({
    form,
    product,
    isCreate,
    onAdjustStock,
}: {
    form: Form;
    product?: AdminProduct;
    isCreate: boolean;
    onAdjustStock: (product: AdminProduct) => void;
}) {
    const unit = form.watch('unit');
    const barcodeLike = unitLooksLikeBarcode(unit);
    return (
        <Section id="inventory" title="Inventory" description="Pack size and stock. Low-stock alerts use the reorder level.">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <TextField form={form} name="unit" label="Unit" placeholder="500 g, 1 L, 6 pcs" autoComplete="off" />
                    {barcodeLike ? (
                        <p className="flex items-start gap-1.5 text-sm text-warning" role="note">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            This looks like a barcode, not a pack size. Move the digits to Barcode and enter the size here.
                        </p>
                    ) : null}
                </div>
                <TextField form={form} name="reorderLevel" label="Reorder level" type="number" inputMode="numeric" min={0} step={1} description="Flag as low stock at or below this many." />
            </div>
            {isCreate ? (
                <TextField form={form} name="stock" label="Opening stock" type="number" inputMode="numeric" min={0} step={1} className="sm:max-w-[calc(50%-0.5rem)]" />
            ) : product ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium">In stock</p>
                        <p className="text-xs text-muted-foreground">Changes go through an adjustment so there is a record of who and why.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <StockCell stock={product.stock} reorderLevel={product.reorderLevel} state={product.stockState} />
                        <Button type="button" variant="outline" size="sm" onClick={() => onAdjustStock(product)}>
                            Adjust stock
                        </Button>
                    </div>
                </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
                <TextField form={form} name="shelfLife" label="Shelf life (days)" type="number" inputMode="numeric" min={0} step={1} />
                <TextField form={form} name="storageType" label="Storage" placeholder="Cool and dry, Refrigerated…" autoComplete="off" />
            </div>
        </Section>
    );
}

/* ---------------------------------------------------------------- Organisation */

function CascadeSelect({
    form,
    name,
    label,
    options,
    placeholder,
    allowNone,
    disabled,
    description,
}: {
    form: Form;
    name: 'categoryId' | 'subcategoryId' | 'itemGroupId';
    label: string;
    options: { value: string; label: string }[];
    placeholder: string;
    allowNone?: boolean;
    disabled?: boolean;
    description?: string;
}) {
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const id = `${name}-field`;
                const known = !field.value || options.some((o) => o.value === field.value);
                return (
                    <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        <Select
                            value={field.value || (allowNone ? NONE : '')}
                            onValueChange={(v) => field.onChange(v === NONE ? '' : v)}
                            disabled={disabled}
                        >
                            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} className="w-full" aria-invalid={fieldState.invalid || undefined}>
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {allowNone ? <SelectItem value={NONE}>None</SelectItem> : null}
                                {!known ? <SelectItem value={field.value}>Unknown ({field.value.slice(-6)})</SelectItem> : null}
                                {options.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldState.error ? <FieldError errors={[fieldState.error]} /> : description ? <FieldDescription>{description}</FieldDescription> : null}
                    </Field>
                );
            }}
        />
    );
}

function OrganisationSection({ form, isCreate }: { form: Form; isCreate: boolean }) {
    const categories = useCategories();
    const subcategories = useSubcategories();
    const itemGroups = useItemGroups();
    const [categoryId, subcategoryId, itemGroupId] = form.watch(['categoryId', 'subcategoryId', 'itemGroupId']);

    const subOptions = React.useMemo(
        () =>
            (subcategories.data ?? [])
                .filter((s) => refId(s.parentId) === categoryId)
                .map((s) => ({ value: s._id, label: s.isActive === false ? `${s.name} (hidden)` : s.name })),
        [subcategories.data, categoryId],
    );
    const groupOptions = React.useMemo(
        () =>
            (itemGroups.data ?? [])
                .filter((g) => refId(g.subcategoryId) === subcategoryId)
                .map((g) => ({ value: g._id, label: g.isActive === false ? `${g.name} (hidden)` : g.name })),
        [itemGroups.data, subcategoryId],
    );

    // When the user picks a different parent, clear the children. Stored values are never
    // changed just because they look inconsistent; that is shown, not auto-fixed.
    const prev = React.useRef({ categoryId, subcategoryId });
    React.useEffect(() => {
        const before = prev.current;
        prev.current = { categoryId, subcategoryId };
        if (before.categoryId && before.categoryId !== categoryId) {
            form.setValue('subcategoryId', '', { shouldDirty: true });
            form.setValue('itemGroupId', '', { shouldDirty: true });
        } else if (before.subcategoryId && before.subcategoryId !== subcategoryId) {
            form.setValue('itemGroupId', '', { shouldDirty: true });
        }
    }, [categoryId, subcategoryId, form]);

    // Picking a fresh produce / dairy category switches "Perishable" on (and a dry-goods one off),
    // until the user sets the switch themselves.
    const perishableTouched = React.useRef(false);
    const pickedCategory = React.useRef(categoryId);
    React.useEffect(() => {
        if (pickedCategory.current === categoryId) return;
        pickedCategory.current = categoryId;
        if (perishableTouched.current || !categoryId) return;
        const name = categories.data?.find((c) => c._id === categoryId)?.name;
        if (name === undefined) return;
        const fresh = looksFreshCategory(name);
        if (form.getValues('isPerishable') !== fresh) form.setValue('isPerishable', fresh, { shouldDirty: true });
    }, [categoryId, categories.data, form]);

    const catOptions = (categories.data ?? []).map((c) => ({ value: c._id, label: c.isActive === false ? `${c.name} (hidden)` : c.name }));
    const loading = categories.isPending || subcategories.isPending || itemGroups.isPending;

    return (
        <Section id="organisation" title="Organisation" description="Where it appears in the app and whether customers can order it.">
            {categories.isError ? <p className="text-sm text-destructive">Couldn’t load categories: {errorMessage(categories.error)}</p> : null}
            <div className="grid gap-4 sm:grid-cols-3">
                <CascadeSelect form={form} name="categoryId" label="Category" options={catOptions} placeholder={loading ? 'Loading…' : 'Choose a category'} />
                <CascadeSelect
                    form={form}
                    name="subcategoryId"
                    label="Subcategory"
                    options={subOptions}
                    placeholder={categoryId ? 'None' : 'Choose a category first'}
                    allowNone
                    disabled={!categoryId}
                    description={categoryId && !subOptions.length && !loading ? 'This category has no subcategories.' : undefined}
                />
                <CascadeSelect
                    form={form}
                    name="itemGroupId"
                    label="Item group"
                    options={groupOptions}
                    placeholder={subcategoryId ? 'None' : 'Choose a subcategory first'}
                    allowNone
                    disabled={!subcategoryId}
                />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                {!isCreate ? (
                    <Controller
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <Field>
                                <FieldLabel htmlFor="status-field">Status</FieldLabel>
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger id="status-field" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active · visible in the app</SelectItem>
                                        <SelectItem value="draft">Draft · hidden until published</SelectItem>
                                        <SelectItem value="archived">Archived · hidden, kept for orders</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        )}
                    />
                ) : null}
                <Controller
                    control={form.control}
                    name="isAvailable"
                    render={({ field }) => (
                        <Field orientation="horizontal" className="self-end rounded-xl border p-3">
                            <FieldContent>
                                <FieldLabel htmlFor="available-field">Can be ordered</FieldLabel>
                                <FieldDescription>Turn off to pause sales without unpublishing.</FieldDescription>
                            </FieldContent>
                            <Switch id="available-field" checked={!!field.value} onCheckedChange={field.onChange} />
                        </Field>
                    )}
                />
                <Controller
                    control={form.control}
                    name="isPerishable"
                    render={({ field }) => (
                        <Field orientation="horizontal" className="self-end rounded-xl border p-3">
                            <FieldContent>
                                <FieldLabel htmlFor="perishable-field">Perishable</FieldLabel>
                                <FieldDescription>Fresh fruit, vegetables, dairy. Shown in the app’s fresh section.</FieldDescription>
                            </FieldContent>
                            <Switch
                                id="perishable-field"
                                checked={!!field.value}
                                onCheckedChange={(v) => {
                                    perishableTouched.current = true;
                                    field.onChange(v);
                                }}
                            />
                        </Field>
                    )}
                />
            </div>
        </Section>
    );
}

/* ---------------------------------------------------------------- Nutrition */

function NutritionSection({ form }: { form: Form }) {
    const fields = [
        ['nutrition.protein', 'Protein (g)'],
        ['nutrition.carbs', 'Carbs (g)'],
        ['nutrition.sugar', 'Sugar (g)'],
        ['nutrition.fat', 'Fat (g)'],
        ['nutrition.transFat', 'Trans fat (g)'],
    ] as const;
    return (
        <Section id="nutrition" title="Nutrition" description="Optional. Per serving, as printed on the pack.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <TextField form={form} name="nutrition.servingSize" label="Serving size" placeholder="100 g" />
                {fields.map(([name, label]) => (
                    <TextField key={name} form={form} name={name} label={label} type="number" inputMode="decimal" min={0} step="0.1" />
                ))}
            </div>
        </Section>
    );
}

/* ---------------------------------------------------------------- Variants */

/**
 * Pack sizes. Each row is sold and stocked on its own (the app's pack chooser, the cart and
 * orders carry its SKU). The default pack is what the product's own price, unit and stock show;
 * the server mirrors it on save. Leave the list empty for a product sold in one pack.
 */
function VariantsSection({ form }: { form: Form }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' });
    const rows = form.watch('variants') ?? [];
    const listError = (form.formState.errors.variants as { message?: string; root?: { message?: string } } | undefined);
    const addRow = () => {
        const v = form.getValues();
        const base = (product: string) => product.replace(/[^\w./-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();
        append({
            sku: rows.length ? '' : base(`${v.name || 'SKU'}-${v.unit || '1'}`).slice(0, 60),
            unit: rows.length ? '' : v.unit,
            mrp: (rows.length ? undefined : v.mrp ?? v.price) as number,
            sellingPrice: (rows.length ? undefined : v.price) as number,
            stock: rows.length ? 0 : (v.stock ?? 0),
            isDefault: rows.length === 0,
            isActive: true,
        });
    };
    const makeDefault = (index: number) => {
        rows.forEach((_, i) => form.setValue(`variants.${i}.isDefault`, i === index, { shouldDirty: true }));
    };
    return (
        <Section
            id="variants"
            title="Pack sizes"
            description="Sell the same product in several sizes (500 g, 1 kg, 5 kg). Each size has its own SKU, price and stock. The default size is what lists show first."
        >
            {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">One pack only: price, unit and stock come from the sections above.</p>
            ) : null}
            <div className="grid gap-3">
                {fields.map((field, i) => (
                    <div key={field.id} className="grid gap-3 rounded-xl border p-3" aria-label={`Pack size ${i + 1}`} role="group">
                        <div className="grid gap-3 sm:grid-cols-[1.2fr_1.4fr]">
                            <TextField form={form} name={`variants.${i}.unit`} label="Pack size" placeholder="1 kg" autoComplete="off" />
                            <TextField form={form} name={`variants.${i}.sku`} label="SKU" placeholder="ATTA-1KG" autoComplete="off" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <TextField form={form} name={`variants.${i}.sellingPrice`} label="Price (₹)" type="number" inputMode="decimal" min={0} step="0.01" />
                            <TextField form={form} name={`variants.${i}.mrp`} label="MRP (₹)" type="number" inputMode="decimal" min={0} step="0.01" />
                            <TextField form={form} name={`variants.${i}.stock`} label="Stock" type="number" inputMode="numeric" min={0} step={1} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="radio"
                                        name="variant-default"
                                        className="size-4 accent-[var(--primary)]"
                                        checked={!!rows[i]?.isDefault}
                                        onChange={() => makeDefault(i)}
                                    />
                                    Default size
                                </label>
                                <Controller
                                    control={form.control}
                                    name={`variants.${i}.isActive`}
                                    render={({ field: f }) => (
                                        <label className="flex items-center gap-2 text-sm">
                                            <Switch checked={!!f.value} onCheckedChange={f.onChange} aria-label={`Pack size ${i + 1} on sale`} />
                                            On sale
                                        </label>
                                    )}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => {
                                    const wasDefault = rows[i]?.isDefault;
                                    remove(i);
                                    if (wasDefault) requestAnimationFrame(() => form.getValues('variants')?.length && form.setValue('variants.0.isDefault', true, { shouldDirty: true }));
                                }}
                            >
                                Remove
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
            {listError?.message || listError?.root?.message ? (
                <p className="text-sm text-destructive" role="alert">
                    {listError.message || listError.root?.message}
                </p>
            ) : null}
            <div>
                <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={fields.length >= MAX_VARIANTS}>
                    <PackagePlus className="size-4" aria-hidden />
                    Add pack size
                </Button>
            </div>
        </Section>
    );
}

function EditorSkeleton() {
    return (
        <div className="grid gap-6 px-4 py-5 sm:px-6" aria-busy aria-label="Loading product">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="grid gap-3">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-9 w-full" />
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-9" />
                        <Skeleton className="h-9" />
                    </div>
                </div>
            ))}
        </div>
    );
}
