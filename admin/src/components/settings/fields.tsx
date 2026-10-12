import * as React from 'react';
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

interface NumberFieldProps<T extends FieldValues> {
    form: UseFormReturn<T, any, any>;
    name: FieldPath<T>;
    label: string;
    description?: React.ReactNode;
    prefix?: string;
    suffix?: string;
    disabled?: boolean;
    className?: string;
    /** Allow decimals (radius, money). Default true. */
    decimals?: boolean;
    placeholder?: string;
}

/**
 * Number input with a unit before or after it (₹, %, km, min). Empty stays empty
 * (undefined), so the schema can say what is missing instead of silently saving 0.
 */
export function NumberField<T extends FieldValues>({
    form,
    name,
    label,
    description,
    prefix,
    suffix,
    disabled,
    className,
    decimals = true,
    placeholder,
}: NumberFieldProps<T>) {
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const id = `${String(name)}-field`;
                return (
                    <Field data-invalid={fieldState.invalid || undefined} data-disabled={disabled || undefined} className={className}>
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        <InputGroup className="h-9 bg-card">
                            {prefix ? (
                                <InputGroupAddon>
                                    <InputGroupText>{prefix}</InputGroupText>
                                </InputGroupAddon>
                            ) : null}
                            <InputGroupInput
                                id={id}
                                name={field.name}
                                ref={field.ref}
                                type="number"
                                inputMode={decimals ? 'decimal' : 'numeric'}
                                step="any"
                                placeholder={placeholder}
                                className="tabular-nums"
                                value={field.value ?? ''}
                                onBlur={field.onBlur}
                                onChange={(event) => field.onChange(event.target.value === '' ? undefined : event.target.valueAsNumber)}
                                onWheel={(event) => (event.target as HTMLInputElement).blur()}
                                disabled={disabled}
                                aria-invalid={fieldState.invalid || undefined}
                                aria-describedby={`${id}-help`}
                            />
                            {suffix ? (
                                <InputGroupAddon align="inline-end">
                                    <InputGroupText>{suffix}</InputGroupText>
                                </InputGroupAddon>
                            ) : null}
                        </InputGroup>
                        <div id={`${id}-help`} className="contents">
                            {description ? <FieldDescription>{description}</FieldDescription> : null}
                            <FieldError errors={[fieldState.error]} />
                        </div>
                    </Field>
                );
            }}
        />
    );
}

/** A titled block of the settings page with an anchor for deep links (#delivery). */
export function SettingsSection({
    id,
    title,
    description,
    aside,
    children,
    className,
}: {
    id: string;
    title: string;
    description?: React.ReactNode;
    /** Optional right-hand element in the header (status, small action). */
    aside?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    const headingId = `${id}-heading`;
    return (
        <section id={id} aria-labelledby={headingId} className={cn('scroll-mt-24 rounded-xl bg-card ring-1 ring-border', className)}>
            <header className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="min-w-0 space-y-1">
                    <h2 id={headingId} className="text-base font-semibold text-foreground">
                        {title}
                    </h2>
                    {description ? <p className="max-w-[60ch] text-sm text-pretty text-muted-foreground">{description}</p> : null}
                </div>
                {aside ? <div className="shrink-0">{aside}</div> : null}
            </header>
            <div className="px-4 py-5 sm:px-6">{children}</div>
        </section>
    );
}
