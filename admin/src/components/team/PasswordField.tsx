import * as React from 'react';
import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { generatePassword, passwordStrength } from './password';

const METER_TONE = ['', 'bg-destructive', 'bg-warning', 'bg-success', 'bg-success'] as const;
const LABEL_TONE = ['', 'text-destructive', 'text-warning', 'text-success-text', 'text-success-text'] as const;

/** Password input bound to react-hook-form, with show/hide, a generator and a strength meter. */
export function PasswordField<T extends FieldValues>({
    form,
    name,
    label,
    description,
    minLength = 12,
}: {
    form: UseFormReturn<T, any, any>;
    name: FieldPath<T>;
    label: string;
    description?: React.ReactNode;
    minLength?: number;
}) {
    const [visible, setVisible] = React.useState(false);
    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const id = `${String(name)}-field`;
                const value: string = field.value ?? '';
                const strength = passwordStrength(value, minLength);
                return (
                    <Field data-invalid={fieldState.invalid || undefined}>
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel htmlFor={id}>{label}</FieldLabel>
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                    field.onChange(generatePassword(16));
                                    setVisible(true);
                                    form.trigger(name);
                                }}
                            >
                                <RefreshCw aria-hidden />
                                Generate
                            </Button>
                        </div>
                        <InputGroup className="h-9">
                            <InputGroupInput
                                id={id}
                                name={field.name}
                                ref={field.ref}
                                type={visible ? 'text' : 'password'}
                                autoComplete="new-password"
                                spellCheck={false}
                                autoCapitalize="off"
                                className="font-mono tracking-normal"
                                value={value}
                                onBlur={field.onBlur}
                                onChange={(e) => field.onChange(e.target.value)}
                                aria-invalid={fieldState.invalid || undefined}
                                aria-describedby={`${id}-help ${id}-strength`}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupButton
                                    size="icon-xs"
                                    onClick={() => setVisible((v) => !v)}
                                    aria-label={visible ? 'Hide password' : 'Show password'}
                                    aria-pressed={visible}
                                >
                                    {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                        <div id={`${id}-strength`} className="space-y-1.5" aria-live="polite">
                            <div className="grid grid-cols-4 gap-1" aria-hidden>
                                {[1, 2, 3, 4].map((step) => (
                                    <span
                                        key={step}
                                        className={cn(
                                            'h-1 rounded-full bg-muted transition-colors duration-200',
                                            strength.score >= step && METER_TONE[strength.score],
                                        )}
                                    />
                                ))}
                            </div>
                            {strength.score > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    <span className={cn('font-semibold', LABEL_TONE[strength.score])}>{strength.label}</span>
                                    {strength.hint ? <> · {strength.hint}</> : null}
                                </p>
                            ) : null}
                        </div>
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

function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = React.useState(false);
    return (
        <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                } catch {
                    toast.error('Could not copy', { description: 'Select the text and copy it manually.' });
                }
            }}
        >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
    );
}

export interface IssuedCredentials {
    title: string;
    description: string;
    username: string;
    password: string;
    /** Extra line under the fields, e.g. where to sign in. */
    note?: string;
}

/**
 * Shows a new password exactly once. Closing it discards the password from memory; the
 * server only keeps a hash, so there is no way to see it again.
 */
export function CredentialsDialog({ credentials, onClose }: { credentials: IssuedCredentials | null; onClose: () => void }) {
    const shown = React.useRef<IssuedCredentials | null>(null);
    if (credentials) shown.current = credentials;
    const c = credentials ?? shown.current;
    return (
        <Dialog open={!!credentials} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{c?.title}</DialogTitle>
                    <DialogDescription>{c?.description}</DialogDescription>
                </DialogHeader>
                {c ? (
                    <dl className="grid gap-3">
                        {[
                            { label: 'Username', value: c.username },
                            { label: 'Password', value: c.password },
                        ].map((row) => (
                            <div key={row.label} className="grid gap-1">
                                <dt className="text-xs font-semibold text-muted-foreground">{row.label}</dt>
                                <dd className="flex items-center gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-sm text-foreground select-all">
                                        {row.value}
                                    </code>
                                    <CopyButton value={row.value} label={row.label} />
                                </dd>
                            </div>
                        ))}
                    </dl>
                ) : null}
                <p className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
                    This password is shown only once. Share it privately; it can't be viewed again, only reset.
                    {c?.note ? ` ${c.note}` : ''}
                </p>
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        I've saved it
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
