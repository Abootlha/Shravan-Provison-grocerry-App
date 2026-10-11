import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Lock } from 'lucide-react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import {
    applyServerError,
    ErrorState,
    PageContainer,
    PageHeader,
    SwitchField,
    TextareaField,
    TextField,
    useZodForm,
    withProviders,
} from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/http';
import { queryClient, queryKeys } from '@/lib/query';
import { cn } from '@/lib/utils';
import { fetchStoreSettings, saveStoreSettings, useCanEditSettings, type StoreSettings } from './api';
import { NumberField, SettingsSection } from './fields';
import { LocationPicker } from './LocationPicker';
import { BillPreview, OpenStatePreview } from './previews';
import { settingsSchema, toFormValues, toUpdateBody, type SettingsFormInput, type SettingsFormValues } from './schema';

type SettingsForm = UseFormReturn<SettingsFormInput, unknown, SettingsFormValues>;

const SECTIONS = [
    { id: 'profile', label: 'Store profile', fields: ['storeName', 'contactPhone', 'contactEmail', 'address', 'gstin', 'timezone'] },
    { id: 'hours', label: 'Hours & availability', fields: ['openTime', 'closeTime', 'isActive'] },
    { id: 'delivery', label: 'Delivery area', fields: ['latitude', 'longitude', 'pickupAddress', 'serviceRadiusKm', 'estimatedDeliveryMinutes'] },
    { id: 'fees', label: 'Fees', fields: ['deliveryFee', 'freeDeliveryThreshold', 'packagingFee', 'discountPercent'] },
] as const;

const TIMEZONES: string[] = (() => {
    try {
        const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
        if (list?.length) return list;
    } catch {
        /* older browsers */
    }
    return ['Asia/Kolkata'];
})();

function SettingsPage() {
    const canEdit = useCanEditSettings();
    const settings = useQuery({
        queryKey: queryKeys.settings.store,
        queryFn: ({ signal }) => fetchStoreSettings(signal),
        // Never refetch under someone who is typing.
        refetchOnWindowFocus: false,
    });

    return (
        <PageContainer>
            <PageHeader
                title="Store & delivery"
                description="Your store's details, when you take orders, where you deliver and what customers pay on top of their items."
            />
            {settings.isPending ? (
                <SettingsSkeleton />
            ) : settings.isError ? (
                <div className="rounded-xl bg-card ring-1 ring-border">
                    <ErrorState
                        title="Couldn't load store settings"
                        error={settings.error}
                        onRetry={() => settings.refetch()}
                        retrying={settings.isFetching}
                    />
                </div>
            ) : (
                <SettingsForm settings={settings.data} readOnly={canEdit === false} />
            )}
        </PageContainer>
    );
}

function SettingsForm({ settings, readOnly }: { settings: StoreSettings; readOnly: boolean }) {
    const form = useZodForm(settingsSchema, toFormValues(settings));
    const { isDirty, dirtyFields, isSubmitting } = form.formState;
    const values = useWatch({ control: form.control }) as SettingsFormInput;

    // Leaving with unsaved edits asks first (Astro pages are full navigations).
    React.useEffect(() => {
        if (!isDirty) return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isDirty]);

    // Deep links such as /settings#delivery (the old /delivery page redirects here).
    React.useEffect(() => {
        const id = window.location.hash.slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }, []);

    const save = useMutation({
        mutationFn: saveStoreSettings,
        onSuccess: (result) => {
            queryClient.setQueryData(queryKeys.settings.store, result.settings);
            form.reset(toFormValues(result.settings));
            toast.success('Store settings saved', { description: 'Customers see the changes on their next refresh.' });
        },
    });

    const onSubmit = form.handleSubmit(
        async (data) => {
            const body = toUpdateBody(data, dirtyFields as Record<string, unknown>);
            if (!Object.keys(body).length) {
                form.reset(form.getValues());
                return;
            }
            try {
                await save.mutateAsync(body);
            } catch (error) {
                applyServerError(form, error);
                toast.error('Settings not saved', { description: errorMessage(error) });
            }
        },
        (errors) => {
            const first = SECTIONS.find((s) => s.fields.some((f) => f in errors));
            toast.error('Some fields need attention', { description: first ? `Check ${first.label}.` : undefined });
            if (first) document.getElementById(first.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        },
    );

    const dirtySections = SECTIONS.filter((s) => s.fields.some((f) => (dirtyFields as Record<string, unknown>)[f]));
    const rootError = (form.formState.errors.root as { server?: { message?: string } } | undefined)?.server?.message;
    const disabled = readOnly || isSubmitting;

    return (
        <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
            <nav aria-label="Settings sections" className="hidden lg:block">
                <ul className="sticky top-24 grid gap-0.5 text-sm">
                    {SECTIONS.map((s) => {
                        const dirty = dirtySections.includes(s);
                        return (
                            <li key={s.id}>
                                <a
                                    href={`#${s.id}`}
                                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                    {s.label}
                                    {dirty ? (
                                        <span className="size-1.5 rounded-full bg-primary" aria-label="Unsaved changes" />
                                    ) : null}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="grid min-w-0 gap-6">
                {readOnly ? (
                    <p className="flex items-start gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                        Only admins can change store settings. You can view them here.
                    </p>
                ) : null}

                <SettingsSection id="profile" title="Store profile" description="Shown to customers on receipts and in the app's help screen.">
                    <FieldGroup className="grid gap-5 sm:grid-cols-2">
                        <TextField form={form} name="storeName" label="Store name" disabled={disabled} className="sm:col-span-2" maxLength={100} />
                        <TextField
                            form={form}
                            name="contactPhone"
                            label="Contact phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            placeholder="+91 98765 43210"
                            description={values.contactPhone ? undefined : 'Not set. Customers see no phone number.'}
                            disabled={disabled}
                        />
                        <TextField
                            form={form}
                            name="contactEmail"
                            label="Contact email"
                            type="email"
                            autoComplete="off"
                            placeholder="store@yourdomain.in"
                            description={values.contactEmail ? undefined : 'Not set. Optional.'}
                            disabled={disabled}
                        />
                        <TextareaField
                            form={form}
                            name="address"
                            label="Registered address"
                            rows={2}
                            description="For invoices. The pickup point riders go to is set under Delivery area."
                            disabled={disabled}
                            className="sm:col-span-2"
                        />
                        <TextField
                            form={form}
                            name="gstin"
                            label="GSTIN"
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            placeholder="15 characters"
                            maxLength={15}
                            description={values.gstin ? undefined : 'Leave empty if the store is not GST registered.'}
                            disabled={disabled}
                            className="[&_input]:uppercase [&_input]:placeholder:normal-case"
                        />
                        <TextField
                            form={form}
                            name="timezone"
                            label="Timezone"
                            list="store-timezones"
                            autoComplete="off"
                            spellCheck={false}
                            description="Opening hours and daily reports follow this zone."
                            disabled={disabled}
                        />
                        <datalist id="store-timezones">
                            {TIMEZONES.map((tz) => (
                                <option key={tz} value={tz} />
                            ))}
                        </datalist>
                    </FieldGroup>
                </SettingsSection>

                <SettingsSection
                    id="hours"
                    title="Hours & availability"
                    description="Orders are accepted only while the store is open. Same opening and closing time means open 24 hours."
                >
                    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                        <FieldGroup className="gap-5">
                            <div className="grid grid-cols-2 gap-4">
                                <TimeField form={form} name="openTime" label="Opens at" disabled={disabled} />
                                <TimeField form={form} name="closeTime" label="Closes at" disabled={disabled} />
                            </div>
                            <SwitchField
                                form={form}
                                name="isActive"
                                label="Taking orders"
                                description={
                                    values.isActive
                                        ? 'Turn off to pause the store right away, for example during a stock-take. It stays paused until you turn it back on.'
                                        : 'The store is paused. Turn on to accept orders again during opening hours.'
                                }
                                disabled={disabled}
                            />
                        </FieldGroup>
                        <OpenStatePreview
                            isActive={!!values.isActive}
                            openTime={values.openTime ?? ''}
                            closeTime={values.closeTime ?? ''}
                            timezone={values.timezone ?? ''}
                        />
                    </div>
                </SettingsSection>

                <SettingsSection
                    id="delivery"
                    title="Delivery area"
                    description="Where riders pick up orders and how far you deliver. Addresses outside the circle cannot order."
                >
                    <div className="grid gap-6">
                        <LocationPicker form={form} disabled={disabled} />
                        <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                            <NumberField
                                form={form}
                                name="serviceRadiusKm"
                                label="Delivery radius"
                                suffix="km"
                                description="0.5 to 50 km, decimals allowed (e.g. 3.5)."
                                disabled={disabled}
                            />
                            <NumberField
                                form={form}
                                name="estimatedDeliveryMinutes"
                                label="Usual delivery time"
                                suffix="min"
                                decimals={false}
                                description="Shown to customers before they order. 1 to 240 minutes."
                                disabled={disabled}
                            />
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection id="fees" title="Fees" description="Added to every order at checkout. Changes apply to new orders only.">
                    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                        <FieldGroup className="grid gap-5 sm:grid-cols-2">
                            <NumberField form={form} name="deliveryFee" label="Delivery fee" prefix="₹" description="Charged below the free-delivery amount." disabled={disabled} />
                            <NumberField
                                form={form}
                                name="freeDeliveryThreshold"
                                label="Free delivery from"
                                prefix="₹"
                                description="Cart value that makes delivery free. 0 = always free."
                                disabled={disabled}
                            />
                            <NumberField form={form} name="packagingFee" label="Packaging fee" prefix="₹" description="Charged on every order." disabled={disabled} />
                            <NumberField
                                form={form}
                                name="discountPercent"
                                label="Store discount"
                                suffix="%"
                                description="Taken off the item total, rounded to the rupee. Up to 90%."
                                disabled={disabled}
                            />
                        </FieldGroup>
                        <BillPreview
                            fees={{
                                deliveryFee: values.deliveryFee,
                                freeDeliveryThreshold: values.freeDeliveryThreshold,
                                packagingFee: values.packagingFee,
                                discountRate:
                                    typeof values.discountPercent === 'number' && values.discountPercent <= 90
                                        ? values.discountPercent / 100
                                        : undefined,
                            }}
                        />
                    </div>
                </SettingsSection>
                {!readOnly && isDirty ? (
                    <SaveBar
                        sections={dirtySections.map((s) => s.label)}
                        saving={isSubmitting}
                        error={rootError}
                        onDiscard={() => {
                            form.reset(toFormValues(settings));
                            toast('Changes discarded');
                        }}
                    />
                ) : null}
            </div>
        </form>
    );
}

function TimeField({ form, name, label, disabled }: { form: SettingsForm; name: 'openTime' | 'closeTime'; label: string; disabled?: boolean }) {
    const id = `${name}-field`;
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor={id}>{label}</FieldLabel>
                    <Input
                        id={id}
                        type="time"
                        name={field.name}
                        ref={field.ref}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={disabled}
                        className="tabular-nums"
                        aria-invalid={fieldState.invalid || undefined}
                        aria-describedby={fieldState.error ? `${id}-error` : undefined}
                    />
                    <FieldError id={`${id}-error`} errors={[fieldState.error]} />
                </Field>
            )}
        />
    );
}

/** Sticky footer: always says whether anything is unsaved, so Save is never a guess. */
function SaveBar({
    sections,
    saving,
    error,
    onDiscard,
}: {
    sections: string[];
    saving: boolean;
    error?: string;
    onDiscard: () => void;
}) {
    return (
        <div className="sticky bottom-3 z-30 transition-[opacity,translate] duration-200 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none">
            <div className="flex flex-col gap-3 rounded-xl bg-popover px-4 py-3 text-popover-foreground shadow-float ring-1 ring-border sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm" role="status">
                    <p className="font-medium">Unsaved changes</p>
                    <p className={cn('text-pretty', error ? 'text-destructive' : 'text-muted-foreground')}>
                        {error ? error : sections.length ? sections.join(' · ') : 'Review and save.'}
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="outline" onClick={onDiscard} disabled={saving} className="flex-1 sm:flex-none">
                        Discard
                    </Button>
                    <Button type="submit" disabled={saving} className="flex-1 sm:flex-none">
                        {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function SettingsSkeleton() {
    return (
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10" aria-busy="true" aria-label="Loading store settings">
            <div className="hidden gap-2 lg:grid lg:content-start">
                {SECTIONS.map((s) => (
                    <Skeleton key={s.id} className="h-8 w-40" />
                ))}
            </div>
            <div className="grid gap-6">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-xl bg-card p-6 ring-1 ring-border">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <Skeleton className="h-9" />
                            <Skeleton className="h-9" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default withProviders(SettingsPage);
