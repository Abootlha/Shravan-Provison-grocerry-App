import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
    Controller,
    type DefaultValues,
    type FieldPath,
    type FieldValues,
    type Path,
    type SubmitHandler,
    useForm,
    type UseFormReturn,
} from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, errorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------------------------------
 * useZodForm: react-hook-form + zod with the admin's defaults.
 * -----------------------------------------------------------------------------------------------*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyZodObject = z.ZodType<any, any, any>;

export function useZodForm<TSchema extends AnyZodObject>(
    schema: TSchema,
    defaultValues: DefaultValues<z.input<TSchema>>,
) {
    return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
        resolver: zodResolver(schema),
        defaultValues,
        mode: 'onTouched',
    });
}

/**
 * Applies a backend error to the form: field-level messages when the message names a field
 * ("name must be ..."), otherwise a root error shown above the footer.
 */
export function applyServerError<T extends FieldValues>(form: UseFormReturn<T, any, any>, error: unknown) {
    if (error instanceof ApiError) {
        const fields = Object.keys(form.getValues());
        let matched = false;
        for (const message of error.messages) {
            const field = fields.find((f) => message.toLowerCase().startsWith(f.toLowerCase() + ' '));
            if (field) {
                form.setError(field as Path<T>, { type: 'server', message });
                matched = true;
            }
        }
        if (matched) return;
    }
    form.setError('root.server' as Path<T>, { type: 'server', message: errorMessage(error) });
}

/* -------------------------------------------------------------------------------------------------
 * FormDialog / FormSheet
 * -----------------------------------------------------------------------------------------------*/

interface FormContainerProps<TSchema extends AnyZodObject> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: React.ReactNode;
    schema: TSchema;
    /** Initial values. Re-applied every time the container opens. */
    defaultValues: DefaultValues<z.input<TSchema>>;
    /** Throw (e.g. an ApiError) to keep it open and show the message; resolve to close. */
    onSubmit: (values: z.output<TSchema>, form: UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>>) => Promise<unknown> | unknown;
    submitLabel?: string;
    /** Fields. Receives the form so fields can be bound with `control={form.control}`. */
    children: (form: UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>>) => React.ReactNode;
    className?: string;
    /** FormSheet only: sheet width from `sm` up (default `lg`, 32rem). */
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

function useContainerForm<TSchema extends AnyZodObject>({
    open,
    onOpenChange,
    schema,
    defaultValues,
    onSubmit,
}: Pick<FormContainerProps<TSchema>, 'open' | 'onOpenChange' | 'schema' | 'defaultValues' | 'onSubmit'>) {
    const form = useZodForm(schema, defaultValues);
    const defaultsRef = React.useRef(defaultValues);
    defaultsRef.current = defaultValues;

    React.useEffect(() => {
        if (open) form.reset(defaultsRef.current);
    }, [open, form]);

    const submit: SubmitHandler<z.output<TSchema>> = async (values) => {
        try {
            await onSubmit(values, form);
            onOpenChange(false);
        } catch (error) {
            applyServerError(form, error);
        }
    };

    return { form, handleSubmit: form.handleSubmit(submit) };
}

function RootError({ form }: { form: UseFormReturn<any, any, any> }) {
    const message = (form.formState.errors.root as { server?: { message?: string } } | undefined)?.server?.message;
    if (!message) return null;
    return (
        <p role="alert" className="rounded-lg bg-destructive-tint px-3 py-2 text-sm text-destructive">
            {message}
        </p>
    );
}

function SubmitButton({ form, label }: { form: UseFormReturn<any, any, any>; label: string }) {
    const busy = form.formState.isSubmitting;
    return (
        <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {label}
        </Button>
    );
}

/** A short create/edit form in a centered dialog (≤ ~6 fields). */
export function FormDialog<TSchema extends AnyZodObject>(props: FormContainerProps<TSchema>) {
    const { open, onOpenChange, title, description, submitLabel = 'Save', children, className } = props;
    const { form, handleSubmit } = useContainerForm(props);
    return (
        <Dialog open={open} onOpenChange={(next) => !form.formState.isSubmitting && onOpenChange(next)}>
            <DialogContent className={cn('sm:max-w-lg', className)}>
                <form onSubmit={handleSubmit} noValidate className="grid gap-5">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description ? <DialogDescription>{description}</DialogDescription> : null}
                    </DialogHeader>
                    <FieldGroup>{children(form)}</FieldGroup>
                    <RootError form={form} />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                            Cancel
                        </Button>
                        <SubmitButton form={form} label={submitLabel} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** A longer form in a right-hand sheet (full width on phones). Body scrolls, footer stays. */
export function FormSheet<TSchema extends AnyZodObject>(props: FormContainerProps<TSchema>) {
    const { open, onOpenChange, title, description, submitLabel = 'Save', children, className, size = 'lg' } = props;
    const { form, handleSubmit } = useContainerForm(props);
    return (
        <Sheet open={open} onOpenChange={(next) => !form.formState.isSubmitting && onOpenChange(next)}>
            <SheetContent size={size} className={cn('gap-0 p-0', className)}>
                <form onSubmit={handleSubmit} noValidate className="flex h-full min-h-0 flex-col">
                    <SheetHeader className="border-b p-4 pr-12">
                        <SheetTitle>{title}</SheetTitle>
                        {description ? <SheetDescription>{description}</SheetDescription> : null}
                    </SheetHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <FieldGroup>{children(form)}</FieldGroup>
                    </div>
                    <SheetFooter className="gap-3 border-t p-4">
                        <RootError form={form} />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                                Cancel
                            </Button>
                            <SubmitButton form={form} label={submitLabel} />
                        </div>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}

/* -------------------------------------------------------------------------------------------------
 * Bound fields: label, description and inline error wired up (aria-invalid, aria-describedby).
 * -----------------------------------------------------------------------------------------------*/

interface BaseFieldProps<T extends FieldValues> {
    form: UseFormReturn<T, any, any>;
    name: FieldPath<T>;
    label: string;
    description?: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

export function TextField<T extends FieldValues>({
    form,
    name,
    label,
    description,
    disabled,
    className,
    ...inputProps
}: BaseFieldProps<T> & Omit<React.ComponentProps<typeof Input>, 'name' | 'form'>) {
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const id = `${String(name)}-field`;
                const isNumber = inputProps.type === 'number';
                return (
                    <Field data-invalid={fieldState.invalid || undefined} data-disabled={disabled || undefined} className={className}>
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        <Input
                            {...inputProps}
                            id={id}
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value ?? ''}
                            onChange={(event) =>
                                field.onChange(isNumber ? (event.target.value === '' ? undefined : event.target.valueAsNumber) : event.target.value)
                            }
                            disabled={disabled}
                            aria-invalid={fieldState.invalid || undefined}
                            aria-describedby={description || fieldState.error ? `${id}-help` : undefined}
                        />
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

export function TextareaField<T extends FieldValues>({
    form,
    name,
    label,
    description,
    disabled,
    className,
    ...textareaProps
}: BaseFieldProps<T> & Omit<React.ComponentProps<typeof Textarea>, 'name' | 'form'>) {
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const id = `${String(name)}-field`;
                return (
                    <Field data-invalid={fieldState.invalid || undefined} className={className}>
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        <Textarea
                            {...textareaProps}
                            {...field}
                            value={field.value ?? ''}
                            id={id}
                            disabled={disabled}
                            aria-invalid={fieldState.invalid || undefined}
                            aria-describedby={`${id}-help`}
                        />
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

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export function SelectField<T extends FieldValues>({
    form,
    name,
    label,
    description,
    disabled,
    className,
    options,
    placeholder = 'Select…',
}: BaseFieldProps<T> & { options: SelectOption[]; placeholder?: string }) {
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const id = `${String(name)}-field`;
                const value: string = field.value ?? '';
                // Label comes from the options, not from Radix's mounted items, so a value that
                // arrives before (or without) its option still reads as something.
                const selected = value ? options.find((o) => o.value === value) : undefined;
                const shown = value ? (selected?.label ?? (options.length ? 'Unavailable option' : 'Loading…')) : undefined;
                return (
                    <Field data-invalid={fieldState.invalid || undefined} className={className}>
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        <Select value={value} onValueChange={field.onChange} disabled={disabled} name={field.name}>
                            <SelectTrigger
                                id={id}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                className="w-full"
                                aria-invalid={fieldState.invalid || undefined}
                                aria-describedby={`${id}-help`}
                            >
                                <SelectValue placeholder={placeholder}>{shown}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {options.map((option) => (
                                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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

/** On/off setting with the label on the left. `variant="checkbox"` for list-style choices. */
export function SwitchField<T extends FieldValues>({
    form,
    name,
    label,
    description,
    disabled,
    className,
    variant = 'switch',
}: BaseFieldProps<T> & { variant?: 'switch' | 'checkbox' }) {
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const id = `${String(name)}-field`;
                const Control = variant === 'checkbox' ? Checkbox : Switch;
                return (
                    <Field orientation="horizontal" data-invalid={fieldState.invalid || undefined} className={className}>
                        {variant === 'checkbox' ? (
                            <Control id={id} checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} disabled={disabled} ref={field.ref} />
                        ) : null}
                        <FieldContent>
                            <FieldLabel htmlFor={id}>{label}</FieldLabel>
                            {description ? <FieldDescription>{description}</FieldDescription> : null}
                            <FieldError errors={[fieldState.error]} />
                        </FieldContent>
                        {variant === 'switch' ? (
                            <Control id={id} checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} disabled={disabled} ref={field.ref} />
                        ) : null}
                    </Field>
                );
            }}
        />
    );
}
