import * as React from 'react';
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { ImageOff, ImageUp, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------------------------------
 * Thumb: a catalogue image in a flat image well. Falls back to the record's initials, and shows a
 * short icon token (an emoji or icon name from older records) as text.
 * -----------------------------------------------------------------------------------------------*/

export function isImageSource(value: string | undefined | null): boolean {
    if (!value) return false;
    return /^https?:\/\//i.test(value) || value.startsWith('data:image/') || (value.startsWith('/') && !value.startsWith('//'));
}

export function Thumb({
    src,
    name,
    size = 'md',
    className,
}: {
    src?: string | null;
    name: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [src]);
    const box = size === 'sm' ? 'size-8 rounded-md' : size === 'lg' ? 'size-16 rounded-[10px]' : 'size-10 rounded-[10px]';
    const initials = name
        .split(/\s+/)
        .filter((w) => /[a-z0-9]/i.test(w[0] ?? ''))
        .slice(0, 2)
        .map((w) => w[0]!.toUpperCase())
        .join('');
    return (
        <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden bg-muted text-muted-foreground', box, className)}>
            {isImageSource(src) && !failed ? (
                <img
                    src={src ?? undefined}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() => setFailed(true)}
                    className="size-full object-contain p-0.5"
                />
            ) : src && !isImageSource(src) && src.length <= 4 ? (
                <span aria-hidden className="text-base leading-none">
                    {src}
                </span>
            ) : (
                <span aria-hidden className="text-[11px] font-semibold tracking-tight">
                    {initials || '?'}
                </span>
            )}
        </span>
    );
}

/* -------------------------------------------------------------------------------------------------
 * ImageField: URL or upload (as a data URI, which the catalogue endpoints accept) with a preview.
 * -----------------------------------------------------------------------------------------------*/

/** The backend accepts data URIs up to 1.5M characters (~1.1 MB of image). */
const MAX_UPLOAD_BYTES = 1_000_000;

function readAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
        reader.readAsDataURL(file);
    });
}

export function ImageField<T extends FieldValues>({
    form,
    name,
    label,
    description,
    allowUpload = true,
    previewName,
    aspect = 'square',
}: {
    form: UseFormReturn<T, any, any>;
    name: FieldPath<T>;
    label: string;
    description?: React.ReactNode;
    /** Banners need a hosted https image; catalogue records also accept an upload. */
    allowUpload?: boolean;
    previewName: string;
    aspect?: 'square' | 'wide';
}) {
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const id = `${String(name)}-field`;

    return (
        <Controller
            control={form.control}
            name={name}
            render={({ field, fieldState }) => {
                const value: string = field.value ?? '';
                const isData = value.startsWith('data:');
                const sizeKb = isData ? Math.round((value.length * 3) / 4 / 1024) : 0;
                return (
                    <Field data-invalid={fieldState.invalid || undefined}>
                        <FieldLabel htmlFor={id}>{label}</FieldLabel>
                        <div className="flex items-start gap-3">
                            <PreviewWell value={value} name={previewName} aspect={aspect} />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                {isData ? (
                                    <div className="flex h-9 items-center justify-between gap-2 rounded-lg border bg-card px-3 text-sm">
                                        <span className="truncate text-muted-foreground">Uploaded image · {formatNumber(sizeKb)} KB</span>
                                    </div>
                                ) : (
                                    <Input
                                        id={id}
                                        name={field.name}
                                        ref={field.ref}
                                        value={value}
                                        onBlur={field.onBlur}
                                        onChange={(e) => field.onChange(e.target.value.trim())}
                                        placeholder="https://…"
                                        inputMode="url"
                                        autoComplete="off"
                                        spellCheck={false}
                                        aria-invalid={fieldState.invalid || undefined}
                                        aria-describedby={`${id}-help`}
                                    />
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {allowUpload ? (
                                        <>
                                            <input
                                                ref={fileRef}
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/gif"
                                                className="sr-only"
                                                tabIndex={-1}
                                                aria-hidden
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    e.target.value = '';
                                                    if (!file) return;
                                                    if (file.size > MAX_UPLOAD_BYTES) {
                                                        setUploadError(`That image is ${formatNumber(Math.round(file.size / 1024))} KB. Use one under 1 MB, or paste a link.`);
                                                        return;
                                                    }
                                                    setUploadError(null);
                                                    field.onChange(await readAsDataUrl(file));
                                                }}
                                            />
                                            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                                                <ImageUp aria-hidden />
                                                Upload
                                            </Button>
                                        </>
                                    ) : null}
                                    {value ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setUploadError(null);
                                                field.onChange('');
                                            }}
                                        >
                                            <X aria-hidden />
                                            Remove
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div id={`${id}-help`} className="contents">
                            {description ? <FieldDescription>{description}</FieldDescription> : null}
                            {uploadError ? (
                                <p role="alert" className="text-sm text-destructive">
                                    {uploadError}
                                </p>
                            ) : null}
                            <FieldError errors={[fieldState.error]} />
                        </div>
                    </Field>
                );
            }}
        />
    );
}

function PreviewWell({ value, name, aspect }: { value: string; name: string; aspect: 'square' | 'wide' }) {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [value]);
    const box = aspect === 'wide' ? 'h-16 w-28' : 'size-16';
    if (!value) {
        return (
            <span className={cn('flex shrink-0 items-center justify-center rounded-[10px] border border-dashed bg-muted text-muted-foreground', box)}>
                <ImageOff className="size-4" aria-hidden />
            </span>
        );
    }
    if (!isImageSource(value)) return <Thumb src={value} name={name} size="lg" />;
    return (
        <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-muted', box)}>
            {failed ? (
                <span className="px-1 text-center text-[11px] leading-tight text-destructive">Can’t load</span>
            ) : (
                <img src={value} alt={`Preview of ${name || 'the image'}`} onError={() => setFailed(true)} className={cn('size-full', aspect === 'wide' ? 'object-cover' : 'object-contain p-1')} />
            )}
        </span>
    );
}

/* -------------------------------------------------------------------------------------------------
 * Small shared bits
 * -----------------------------------------------------------------------------------------------*/

export function InactiveBadge() {
    return <Badge variant="neutral">Hidden</Badge>;
}

/** "Show hidden (3)" switch used in every catalogue toolbar. */
export function ShowInactiveToggle({
    checked,
    onCheckedChange,
    count,
}: {
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    count: number | undefined;
}) {
    const id = React.useId();
    return (
        <div className="flex h-9 items-center gap-2 rounded-lg px-1">
            <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
            <Label htmlFor={id} className="cursor-pointer text-sm font-normal whitespace-nowrap text-muted-foreground">
                Show hidden{count ? <span className="tabular-nums"> ({formatNumber(count)})</span> : null}
            </Label>
        </div>
    );
}

/** Name with the Hindi name under it. */
export function BilingualName({ name, nameHi, inactive }: { name: string; nameHi?: string; inactive?: boolean }) {
    return (
        <span className="flex min-w-0 flex-col">
            <span className={cn('flex min-w-0 items-center gap-2 font-medium text-foreground', inactive && 'text-muted-foreground')}>
                <span className="truncate">{name}</span>
                {inactive ? <InactiveBadge /> : null}
            </span>
            {nameHi ? (
                <span lang="hi" className="truncate text-xs text-muted-foreground">
                    {nameHi}
                </span>
            ) : (
                <span className="text-xs text-muted-foreground/70">No Hindi name</span>
            )}
        </span>
    );
}

/** Products count, or a dash while unknown. Never a made-up number. */
export function CountCell({ value, href }: { value: number | undefined; href?: string }) {
    if (value === undefined) return <span className="text-muted-foreground tabular-nums">—</span>;
    if (href && value > 0) {
        return (
            <a href={href} className="tabular-nums text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none">
                {formatNumber(value)}
            </a>
        );
    }
    return <span className={cn('tabular-nums', value === 0 ? 'text-muted-foreground' : 'text-foreground')}>{formatNumber(value)}</span>;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
    return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export function SearchInput({
    value,
    onChange,
    placeholder,
    label,
    className,
}: {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    label: string;
    className?: string;
}) {
    return (
        <div className={cn('relative w-full sm:w-64', className)}>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={label}
                className="pl-8"
                autoComplete="off"
            />
        </div>
    );
}

/** The sheet primitive is 3/4 wide on phones; catalogue forms need the full width there. */
export const SHEET_WIDTH = 'data-[side=right]:w-full data-[side=right]:sm:max-w-lg';
