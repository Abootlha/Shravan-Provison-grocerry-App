import * as React from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { CalendarDays, FolderTree, Link2, Package } from 'lucide-react';
import { FormSheet, SelectField, SwitchField, TextField } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DateRangePicker } from '@/components/motion/date-range-picker';
import { ImageField } from '@/components/catalog/parts';
import { httpsUrl } from '@/components/catalog/schemas';
import type { Banner, BannerTargetType, Category } from '@/components/catalog/types';
import { cn } from '@/lib/utils';
import { BannerPreview } from './BannerPreview';
import { ProductPicker } from './ProductPicker';
import { dayToEndIso, dayToStartIso, isoToLastDay, isoToStartDay, scheduleLabel } from './schedule';

export const bannerSchema = z
    .object({
        title: z.string().trim().min(1, 'Enter the headline customers will read').max(120, 'Keep it under 120 characters'),
        titleHi: z.string().trim().max(120, 'Keep it under 120 characters'),
        image: httpsUrl('Paste the banner image link'),
        targetType: z.enum(['category', 'product', 'url']),
        targetCategory: z.string(),
        targetProduct: z.string(),
        targetUrl: z.string().trim(),
        startDay: z.string(),
        endDay: z.string(),
        isActive: z.boolean(),
    })
    .superRefine((v, ctx) => {
        if (v.targetType === 'category' && !v.targetCategory)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetCategory'], message: 'Choose the category the banner opens' });
        if (v.targetType === 'product' && !v.targetProduct)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetProduct'], message: 'Choose the product the banner opens' });
        if (v.targetType === 'url') {
            const ok = (() => {
                try {
                    return new URL(v.targetUrl).protocol === 'https:';
                } catch {
                    return false;
                }
            })();
            if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetUrl'], message: 'Use a link that starts with https://' });
        }
        if (v.startDay && v.endDay && v.endDay < v.startDay)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDay'], message: 'The last day must be on or after the first day' });
    });

type FormInput = z.input<typeof bannerSchema>;
export type BannerFormValues = z.output<typeof bannerSchema>;

export function toBannerBody(v: BannerFormValues) {
    return {
        title: v.title,
        titleHi: v.titleHi,
        image: v.image,
        target:
            v.targetType === 'category'
                ? { type: 'category' as const, id: v.targetCategory }
                : v.targetType === 'product'
                  ? { type: 'product' as const, id: v.targetProduct }
                  : { type: 'url' as const, url: v.targetUrl },
        startsAt: v.startDay ? dayToStartIso(v.startDay) : null,
        endsAt: v.endDay ? dayToEndIso(v.endDay) : null,
        isActive: v.isActive,
    };
}

export function bannerDefaults(banner: Banner | null): FormInput {
    return {
        title: banner?.title ?? '',
        titleHi: banner?.titleHi ?? '',
        image: banner?.image ?? '',
        targetType: banner?.target.type ?? 'category',
        targetCategory: banner?.target.type === 'category' ? (banner.target.id ?? '') : '',
        targetProduct: banner?.target.type === 'product' ? (banner.target.id ?? '') : '',
        targetUrl: banner?.target.type === 'url' ? (banner.target.url ?? '') : '',
        startDay: isoToStartDay(banner?.startsAt),
        endDay: isoToLastDay(banner?.endsAt),
        isActive: banner?.isActive ?? true,
    };
}

export function BannerForm({
    open,
    onOpenChange,
    banner,
    categories,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    banner: Banner | null;
    categories: Category[];
    onSubmit: (values: BannerFormValues) => Promise<void>;
}) {
    return (
        <FormSheet
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={banner ? 'Edit banner' : 'New banner'}
            description="Banners run across the top of the customer app’s home screen."
            schema={bannerSchema}
            defaultValues={bannerDefaults(banner)}
            submitLabel={banner ? 'Save banner' : 'Create banner'}
            onSubmit={onSubmit}
        >
            {(form) => <BannerFields form={form} categories={categories} />}
        </FormSheet>
    );
}

function BannerFields({ form, categories }: { form: UseFormReturn<FormInput, unknown, BannerFormValues>; categories: Category[] }) {
    const [lang, setLang] = React.useState<'en' | 'hi'>('en');
    const [title, titleHi, image, targetType] = form.watch(['title', 'titleHi', 'image', 'targetType']);

    return (
        <>
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Preview</p>
                    <ToggleGroup
                        type="single"
                        size="sm"
                        variant="outline"
                        spacing={0}
                        value={lang}
                        onValueChange={(v) => v && setLang(v as 'en' | 'hi')}
                        aria-label="Preview language"
                    >
                        <ToggleGroupItem value="en">English</ToggleGroupItem>
                        <ToggleGroupItem value="hi">हिन्दी</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <BannerPreview title={title} titleHi={titleHi} image={image} lang={lang} />
                <p className="text-xs text-muted-foreground">
                    Approximate. The app shows the image at 2:1 with the headline over its left side, so keep products on the right half.
                    {lang === 'hi' && !titleHi ? ' No Hindi headline yet, so the English one is shown.' : ''}
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <TextField form={form} name="title" label="Headline (English)" autoComplete="off" placeholder="Fresh fruit, 20% off" />
                <TextField form={form} name="titleHi" label="Headline (Hindi)" lang="hi" autoComplete="off" placeholder="ताज़े फल, 20% छूट" />
            </div>

            <ImageField
                form={form}
                name="image"
                label="Image link"
                allowUpload={false}
                aspect="wide"
                previewName={title}
                description="An https link to a 1200 × 600 image (for example from your image host)."
            />

            <TargetFields form={form} categories={categories} targetType={targetType} />

            <ScheduleField form={form} />

            <SwitchField
                form={form}
                name="isActive"
                label="Turned on"
                description="Off keeps the banner here without showing it. On shows it during its dates."
            />
        </>
    );
}

const TARGETS: { value: BannerTargetType; label: string; icon: typeof FolderTree }[] = [
    { value: 'category', label: 'Category', icon: FolderTree },
    { value: 'product', label: 'Product', icon: Package },
    { value: 'url', label: 'Web link', icon: Link2 },
];

function TargetFields({
    form,
    categories,
    targetType,
}: {
    form: UseFormReturn<FormInput, unknown, BannerFormValues>;
    categories: Category[];
    targetType: BannerTargetType;
}) {
    return (
        <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium text-foreground">When tapped, open</legend>
            <Controller
                control={form.control}
                name="targetType"
                render={({ field }) => (
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        spacing={0}
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                        aria-label="Banner opens"
                        className="w-full"
                    >
                        {TARGETS.map((t) => (
                            <ToggleGroupItem key={t.value} value={t.value} className="flex-1">
                                <t.icon aria-hidden />
                                {t.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                )}
            />
            {targetType === 'category' ? (
                <SelectField
                    form={form}
                    name="targetCategory"
                    label="Category"
                    placeholder="Choose a category"
                    options={categories.map((c) => ({ value: c._id, label: c.isActive ? c.name : `${c.name} (hidden in the app)` }))}
                />
            ) : targetType === 'product' ? (
                <Controller
                    control={form.control}
                    name="targetProduct"
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid || undefined}>
                            <FieldLabel htmlFor="targetProduct-field">Product</FieldLabel>
                            <ProductPicker
                                id="targetProduct-field"
                                value={field.value}
                                onChange={(id) => {
                                    field.onChange(id);
                                    void form.trigger('targetProduct');
                                }}
                                invalid={fieldState.invalid}
                                describedBy="targetProduct-help"
                            />
                            <div id="targetProduct-help" className="contents">
                                <FieldError errors={[fieldState.error]} />
                            </div>
                        </Field>
                    )}
                />
            ) : (
                <TextField
                    form={form}
                    name="targetUrl"
                    label="Web link"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://"
                    description="Opens in the browser. Use it for offers that live outside the app."
                />
            )}
        </fieldset>
    );
}

function ScheduleField({ form }: { form: UseFormReturn<FormInput, unknown, BannerFormValues> }) {
    const [open, setOpen] = React.useState(false);
    const [startDay, endDay] = form.watch(['startDay', 'endDay']);
    const endError = form.formState.errors.endDay;
    const summary =
        !startDay && !endDay ? 'Runs whenever it is turned on' : scheduleLabel(startDay ? dayToStartIso(startDay) : null, endDay ? dayToEndIso(endDay) : null);

    return (
        <Field data-invalid={endError ? true : undefined}>
            <FieldLabel id="schedule-label">Dates</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-sm">
                    <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate tabular-nums" role="status">
                        {summary}
                    </span>
                </div>
                <Button type="button" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="schedule-calendar">
                    {open ? 'Done' : startDay || endDay ? 'Change' : 'Set dates'}
                </Button>
                {startDay || endDay ? (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            form.setValue('startDay', '', { shouldDirty: true });
                            form.setValue('endDay', '', { shouldDirty: true, shouldValidate: true });
                        }}
                    >
                        Clear
                    </Button>
                ) : null}
            </div>
            <div id="schedule-calendar" hidden={!open} className={cn(open && 'pt-1')}>
                {open ? (
                    <DateRangePicker
                        label="Banner dates"
                        locale="en-IN"
                        value={startDay ? { from: startDay, to: endDay || undefined } : null}
                        onValueChange={(range) => {
                            form.setValue('startDay', range?.from ?? '', { shouldDirty: true });
                            form.setValue('endDay', range?.to ?? '', { shouldDirty: true, shouldValidate: true });
                        }}
                        showSummary={false}
                        className="w-full max-w-80 bg-card"
                    />
                ) : null}
            </div>
            <FieldDescription>
                Whole days in store time (IST), first and last day included. Pick one day only to start then and run with no end date.
            </FieldDescription>
            <FieldError errors={[endError]} />
        </Field>
    );
}

