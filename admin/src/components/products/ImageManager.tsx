import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ImagePlus, Link2, Loader2, Star, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { errorMessage, http } from '@/lib/http';
import { imageSourceError, MAX_IMAGES } from './editorSchema';
import { ProductThumb } from './ProductBits';

interface ProcessingConfig {
    provider: string;
    enabled: boolean;
}

interface PreviewResult {
    image: string;
    width: number;
    height: number;
    bytes: number;
    provider: string;
    backgroundRemoved: boolean;
    warnings?: string[];
}

const MAX_EDGE = 1600;

/** Reads a picked file and re-encodes it (max 1600px edge, WebP) so it fits the 1.5 MB data-URI limit. */
async function fileToDataUri(file: File): Promise<string> {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error(`${file.name} is not a PNG, JPEG, WebP or GIF image.`);
    const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
        reader.readAsDataURL(file);
    });
    if (file.type === 'image/gif') return raw;
    const img = new Image();
    img.src = raw;
    await img.decode().catch(() => {
        throw new Error(`${file.name} could not be opened as an image.`);
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.75, 0.6]) {
        const out = canvas.toDataURL('image/webp', quality);
        // Some browsers fall back to PNG when WebP encoding is unsupported.
        if (out.length <= 1_400_000) return out;
    }
    return canvas.toDataURL('image/jpeg', 0.6);
}

export function ImageManager({
    value,
    onChange,
    removeBackground,
    onRemoveBackgroundChange,
    error,
    disabled,
}: {
    value: string[];
    onChange: (images: string[]) => void;
    removeBackground: boolean;
    onRemoveBackgroundChange: (value: boolean) => void;
    error?: string;
    disabled?: boolean;
}) {
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [url, setUrl] = React.useState('');
    const [urlError, setUrlError] = React.useState<string | null>(null);
    const [reading, setReading] = React.useState(false);
    const [previewIndex, setPreviewIndex] = React.useState<number | null>(null);
    const config = useQuery({
        queryKey: ['image-processing-config'],
        queryFn: ({ signal }) => http.get<ProcessingConfig>('/products/image/processing-config', { signal }),
        staleTime: 10 * 60_000,
    });
    const bgEnabled = config.data?.enabled ?? false;
    const full = value.length >= MAX_IMAGES;
    const hasUpload = value.some((v) => v.startsWith('data:'));

    const addFiles = async (files: FileList | null) => {
        if (!files?.length) return;
        setReading(true);
        const room = MAX_IMAGES - value.length;
        const picked = Array.from(files).slice(0, room);
        const added: string[] = [];
        for (const file of picked) {
            try {
                const uri = await fileToDataUri(file);
                const err = imageSourceError(uri);
                if (err) throw new Error(`${file.name}: ${err}`);
                added.push(uri);
            } catch (e) {
                toast.error('Image not added', { description: errorMessage(e) });
            }
        }
        if (files.length > room) toast.message(`Only ${MAX_IMAGES} images per product; ${files.length - room} skipped.`);
        if (added.length) onChange([...value, ...added]);
        setReading(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const addUrl = () => {
        const trimmed = url.trim();
        if (!trimmed) return;
        const err = imageSourceError(trimmed);
        if (err) return setUrlError(err);
        if (value.includes(trimmed)) return setUrlError('That image is already added.');
        onChange([...value, trimmed]);
        setUrl('');
        setUrlError(null);
    };

    const move = (from: number) => {
        const next = [...value];
        const [item] = next.splice(from, 1);
        next.unshift(item);
        onChange(next);
    };

    return (
        <div className="grid gap-4">
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Product images">
                {value.map((src, i) => (
                    <li key={`${i}-${src.slice(0, 64)}`} className="group relative">
                        <ProductThumb src={src} alt={`Image ${i + 1}`} className="aspect-square w-full" />
                        {i === 0 ? (
                            <span className="absolute top-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold">Main</span>
                        ) : null}
                        {src.startsWith('data:') ? (
                            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] text-muted-foreground">Upload</span>
                        ) : null}
                        <div className="absolute top-1 right-1 flex gap-1">
                            {i > 0 ? (
                                <Button type="button" size="icon-xs" variant="outline" className="bg-background" onClick={() => move(i)} disabled={disabled} aria-label={`Make image ${i + 1} the main image`}>
                                    <Star aria-hidden />
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                size="icon-xs"
                                variant="outline"
                                className="bg-background"
                                onClick={() => setPreviewIndex(i)}
                                disabled={disabled || src.startsWith('/')}
                                aria-label={`Preview pack shot for image ${i + 1}`}
                            >
                                <Wand2 aria-hidden />
                            </Button>
                            <Button
                                type="button"
                                size="icon-xs"
                                variant="outline"
                                className="bg-background hover:text-destructive"
                                onClick={() => onChange(value.filter((_, j) => j !== i))}
                                disabled={disabled}
                                aria-label={`Remove image ${i + 1}`}
                            >
                                <Trash2 aria-hidden />
                            </Button>
                        </div>
                    </li>
                ))}
                {!full ? (
                    <li>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={disabled || reading}
                            className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed bg-muted/40 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                        >
                            {reading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
                            {reading ? 'Preparing…' : 'Upload'}
                        </button>
                    </li>
                ) : null}
            </ul>
            <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => addFiles(e.target.files)}
            />
            {error ? <FieldError>{error}</FieldError> : null}

            <Field data-invalid={!!urlError || undefined}>
                <FieldLabel htmlFor="image-url">Add by link</FieldLabel>
                <div className="flex gap-2">
                    <Input
                        id="image-url"
                        type="url"
                        inputMode="url"
                        placeholder="https://…/pack-shot.jpg"
                        value={url}
                        disabled={disabled || full}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            setUrlError(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addUrl();
                            }
                        }}
                        aria-invalid={!!urlError || undefined}
                    />
                    <Button type="button" variant="outline" onClick={addUrl} disabled={disabled || full || !url.trim()}>
                        <Link2 aria-hidden /> Add
                    </Button>
                </div>
                {urlError ? <FieldError>{urlError}</FieldError> : <FieldDescription>{value.length}/{MAX_IMAGES} images. The first one is shown in the app.</FieldDescription>}
            </Field>

            <Field orientation="horizontal" data-disabled={!bgEnabled || undefined}>
                <FieldContent>
                    <FieldLabel htmlFor="remove-bg">Remove background from uploads</FieldLabel>
                    <FieldDescription>
                        {config.isPending
                            ? 'Checking the image service…'
                            : bgEnabled
                              ? 'Uploaded photos are cut out and centred on a square canvas when you save. Links are kept as they are.'
                              : 'Background removal is not set up on the server, so uploads are only trimmed and centred. Use the preview to check the result.'}
                    </FieldDescription>
                </FieldContent>
                <Switch
                    id="remove-bg"
                    checked={bgEnabled && removeBackground}
                    onCheckedChange={onRemoveBackgroundChange}
                    disabled={disabled || !bgEnabled || !hasUpload}
                />
            </Field>

            <PackShotPreview
                source={previewIndex !== null ? value[previewIndex] : null}
                removeBackground={bgEnabled && removeBackground}
                onClose={() => setPreviewIndex(null)}
                onUse={(processed) => {
                    if (previewIndex === null) return;
                    onChange(value.map((v, i) => (i === previewIndex ? processed : v)));
                    setPreviewIndex(null);
                    toast.success('Processed image will be saved');
                }}
            />
        </div>
    );
}

function PackShotPreview({
    source,
    removeBackground,
    onClose,
    onUse,
}: {
    source: string | null;
    removeBackground: boolean;
    onClose: () => void;
    onUse: (image: string) => void;
}) {
    const [state, setState] = React.useState<{ status: 'idle' | 'loading' | 'done' | 'error'; result?: PreviewResult; error?: string }>({ status: 'idle' });

    React.useEffect(() => {
        if (!source) return;
        const controller = new AbortController();
        setState({ status: 'loading' });
        http.post<PreviewResult>('/products/image/preview', { image: source, removeBackground }, { signal: controller.signal })
            .then((result) => setState({ status: 'done', result }))
            .catch((e) => {
                if (!controller.signal.aborted) setState({ status: 'error', error: errorMessage(e) });
            });
        return () => controller.abort();
    }, [source, removeBackground]);

    const result = state.result;
    const tooBig = result ? imageSourceError(result.image) !== null : false;

    return (
        <Dialog open={!!source} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Pack-shot preview</DialogTitle>
                    <DialogDescription>
                        How the server processes this image: trimmed, centred on a square{removeBackground ? ', background removed' : ''}. Nothing is saved yet.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                    <figure className="grid gap-1.5">
                        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] border bg-muted">
                            {source ? <img src={source} alt="Original" className="size-full object-contain" /> : null}
                        </div>
                        <figcaption className="text-xs text-muted-foreground">Original</figcaption>
                    </figure>
                    <figure className="grid gap-1.5">
                        <div
                            className="flex aspect-square items-center justify-center overflow-hidden rounded-[10px] border bg-[length:16px_16px] bg-[position:0_0,8px_8px] [background-image:linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%),linear-gradient(45deg,var(--muted)_25%,transparent_25%,transparent_75%,var(--muted)_75%)]"
                            aria-busy={state.status === 'loading'}
                        >
                            {state.status === 'loading' ? <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Processing" /> : null}
                            {state.status === 'error' ? <p className="px-4 text-center text-sm text-destructive">{state.error}</p> : null}
                            {result ? <img src={result.image} alt="Processed" className="size-full object-contain" /> : null}
                        </div>
                        <figcaption className="text-xs text-muted-foreground">
                            {result
                                ? `Processed · ${result.width}×${result.height} · ${Math.round(result.bytes / 1024)} KB${result.backgroundRemoved ? ' · background removed' : ''}`
                                : 'Processed'}
                        </figcaption>
                    </figure>
                </div>
                {result?.warnings?.length ? (
                    <ul className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">
                        {result.warnings.map((w) => (
                            <li key={w}>{w}</li>
                        ))}
                    </ul>
                ) : null}
                {tooBig ? <p className="text-sm text-muted-foreground">The processed file is too large to store directly; keep the original and it will be processed when you save.</p> : null}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        <ArrowLeft aria-hidden /> Keep original
                    </Button>
                    <Button onClick={() => result && onUse(result.image)} disabled={!result || tooBig}>
                        Use processed image
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

