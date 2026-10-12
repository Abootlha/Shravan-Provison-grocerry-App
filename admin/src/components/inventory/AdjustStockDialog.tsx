import * as React from 'react';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useZodForm } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { errorMessage, http, isApiError } from '@/lib/http';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { invalidateProducts } from '../products/data';
import { STOCK_REASONS, type StockAdjustment, type StockReason } from '../products/types';

export interface StockTarget {
    _id: string;
    name: string;
    stock: number;
    reorderLevel?: number;
    unit?: string;
}

const schema = z
    .object({
        direction: z.enum(['add', 'remove']),
        quantity: z
            .number({ invalid_type_error: 'Enter how many', required_error: 'Enter how many' })
            .int('Use a whole number')
            .min(1, 'Enter at least 1')
            .max(1_000_000, 'That is more than 1,000,000'),
        reason: z.enum(['restock', 'damage', 'correction', 'return', 'other']),
        note: z.string().trim().max(500, 'Keep the note under 500 characters'),
    })
    .superRefine((v, ctx) => {
        if (v.reason === 'other' && !v.note) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Say what happened when the reason is “Other”' });
    });

type Values = z.input<typeof schema>;

const DEFAULTS = { direction: 'add', quantity: undefined, reason: 'restock', note: '' } as unknown as Values;

export function AdjustStockDialog({
    product,
    open,
    onOpenChange,
    onAdjusted,
}: {
    product: StockTarget | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdjusted?: (adjustment: StockAdjustment) => void;
}) {
    const form = useZodForm(schema, DEFAULTS);
    const [serverError, setServerError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (open) {
            form.reset(DEFAULTS);
            setServerError(null);
        }
    }, [open, form]);

    const direction = form.watch('direction');
    const quantity = form.watch('quantity');
    const current = product?.stock ?? 0;
    const qty = Number.isFinite(quantity) ? Number(quantity) : 0;
    const next = direction === 'add' ? current + qty : current - qty;
    const tooMany = direction === 'remove' && qty > current;

    const submit = form.handleSubmit(async (values) => {
        if (!product) return;
        setServerError(null);
        const delta = values.direction === 'add' ? values.quantity : -values.quantity;
        try {
            const res = await http.post<{ adjustment: StockAdjustment; product: { stock: number } }>(`/admin/products/${product._id}/stock-adjustments`, {
                delta,
                reason: values.reason,
                note: values.note || undefined,
            });
            toast.success(`${product.name}: stock ${formatNumber(res.adjustment.previousStock)} → ${formatNumber(res.adjustment.newStock)}`);
            invalidateProducts();
            onAdjusted?.(res.adjustment);
            onOpenChange(false);
        } catch (error) {
            setServerError(isApiError(error) && error.status === 409 ? `Only ${formatNumber(current)} in stock, so you can't remove ${formatNumber(qty)}.` : errorMessage(error));
        }
    });

    const busy = form.formState.isSubmitting;
    const reasons = STOCK_REASONS.filter((r) => (direction === 'add' ? r.value !== 'damage' : r.value !== 'restock' && r.value !== 'return'));

    return (
        <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} noValidate className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>Adjust stock</DialogTitle>
                        <DialogDescription className="line-clamp-2">{product?.name}</DialogDescription>
                    </DialogHeader>
                    <FieldGroup className="gap-4">
                        <Controller
                            control={form.control}
                            name="direction"
                            render={({ field }) => (
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    value={field.value}
                                    onValueChange={(v) => {
                                        if (!v) return;
                                        field.onChange(v);
                                        form.setValue('reason', v === 'add' ? 'restock' : 'damage');
                                    }}
                                    className="w-full"
                                    aria-label="Add or remove stock"
                                >
                                    <ToggleGroupItem value="add" className="flex-1 data-[state=on]:bg-brand-tint data-[state=on]:text-brand-text">
                                        <Plus aria-hidden /> Add
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="remove" className="flex-1 data-[state=on]:bg-brand-tint data-[state=on]:text-brand-text">
                                        <Minus aria-hidden /> Remove
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="quantity"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid || undefined}>
                                    <FieldLabel htmlFor="adjust-qty">Quantity{product?.unit ? ` (packs of ${product.unit})` : ''}</FieldLabel>
                                    <Input
                                        id="adjust-qty"
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        step={1}
                                        autoFocus
                                        ref={field.ref}
                                        value={field.value ?? ''}
                                        onBlur={field.onBlur}
                                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                                        aria-invalid={fieldState.invalid || tooMany || undefined}
                                    />
                                    <FieldDescription className="flex items-center gap-1.5 tabular-nums" aria-live="polite">
                                        <span>In stock {formatNumber(current)}</span>
                                        <ArrowRight className="size-3.5" aria-hidden />
                                        <span className={cn('font-semibold text-foreground', tooMany && 'text-destructive')}>
                                            {qty ? formatNumber(next) : '—'}
                                        </span>
                                        {tooMany ? <span className="text-destructive">· more than in stock</span> : null}
                                    </FieldDescription>
                                    <FieldError errors={[fieldState.error]} />
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <Field>
                                    <FieldLabel htmlFor="adjust-reason">Reason</FieldLabel>
                                    <Select value={field.value} onValueChange={(v) => field.onChange(v as StockReason)}>
                                        <SelectTrigger id="adjust-reason" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {reasons.map((r) => (
                                                <SelectItem key={r.value} value={r.value}>
                                                    {r.label}
                                                    <span className="text-muted-foreground">· {r.hint}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="note"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid || undefined}>
                                    <FieldLabel htmlFor="adjust-note">Note</FieldLabel>
                                    <Textarea id="adjust-note" rows={2} placeholder="Supplier invoice, who counted, what broke…" {...field} aria-invalid={fieldState.invalid || undefined} />
                                    <FieldError errors={[fieldState.error]} />
                                </Field>
                            )}
                        />
                    </FieldGroup>
                    {serverError ? (
                        <p role="alert" className="rounded-lg bg-destructive-tint px-3 py-2 text-sm text-destructive">
                            {serverError}
                        </p>
                    ) : null}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy || tooMany}>
                            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                            {direction === 'add' ? 'Add stock' : 'Remove stock'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
