import * as React from 'react';
import { CameraOff, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ScannerState =
    | { kind: 'starting' }
    | { kind: 'scanning' }
    | { kind: 'denied' }
    | { kind: 'no-camera' }
    | { kind: 'insecure' }
    | { kind: 'error'; message: string };

interface Html5QrcodeLike {
    start: (camera: unknown, config: unknown, onSuccess: (text: string) => void, onError: () => void) => Promise<unknown>;
    stop: () => Promise<void>;
    clear: () => void;
    isScanning?: boolean;
}

function classify(error: unknown): ScannerState {
    const text = `${(error as { name?: string })?.name ?? ''} ${String((error as { message?: string })?.message ?? error)}`;
    if (/NotAllowed|Permission|denied/i.test(text)) return { kind: 'denied' };
    if (/NotFound|no camera|Requested device not found|OverconstrainedError/i.test(text)) return { kind: 'no-camera' };
    return { kind: 'error', message: 'The camera could not start. Close other apps using it and try again.' };
}

/** Camera barcode scanner (html5-qrcode, loaded on demand). Calls onDetected once and closes. */
export function BarcodeScanner({ open, onOpenChange, onDetected }: { open: boolean; onOpenChange: (open: boolean) => void; onDetected: (code: string) => void }) {
    const regionId = React.useId().replace(/:/g, '');
    const [state, setState] = React.useState<ScannerState>({ kind: 'starting' });
    const [attempt, setAttempt] = React.useState(0);
    const scannerRef = React.useRef<Html5QrcodeLike | null>(null);
    const doneRef = React.useRef(false);

    React.useEffect(() => {
        if (!open) return;
        let cancelled = false;
        doneRef.current = false;
        setState({ kind: 'starting' });

        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setState({ kind: 'insecure' });
            return;
        }

        (async () => {
            try {
                // Wait one frame so the dialog's region element exists.
                await new Promise((r) => requestAnimationFrame(r));
                const { Html5Qrcode } = await import('html5-qrcode');
                if (cancelled) return;
                const scanner = new Html5Qrcode(regionId, false) as unknown as Html5QrcodeLike;
                scannerRef.current = scanner;
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: (w: number, h: number) => ({ width: Math.min(280, w * 0.85), height: Math.min(140, h * 0.5) }) },
                    (text) => {
                        if (doneRef.current) return;
                        doneRef.current = true;
                        onDetected(text.trim());
                        onOpenChange(false);
                    },
                    () => {},
                );
                if (cancelled) {
                    await scanner.stop().catch(() => {});
                    return;
                }
                setState({ kind: 'scanning' });
            } catch (error) {
                if (!cancelled) setState(classify(error));
            }
        })();

        return () => {
            cancelled = true;
            const scanner = scannerRef.current;
            scannerRef.current = null;
            if (scanner) {
                scanner
                    .stop()
                    .catch(() => {})
                    .finally(() => {
                        try {
                            scanner.clear();
                        } catch {
                            /* already cleared */
                        }
                    });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, attempt, regionId]);

    const blocked = state.kind === 'denied' || state.kind === 'no-camera' || state.kind === 'insecure' || state.kind === 'error';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Scan barcode</DialogTitle>
                    <DialogDescription>Hold the pack’s barcode inside the frame. It fills in automatically.</DialogDescription>
                </DialogHeader>
                <div className="relative overflow-hidden rounded-xl border bg-muted">
                    <div id={regionId} className={blocked ? 'hidden' : 'aspect-[4/3] w-full [&_video]:size-full [&_video]:object-cover'} />
                    {state.kind === 'starting' ? (
                        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" aria-hidden /> Starting camera…
                        </div>
                    ) : null}
                    {blocked ? (
                        <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-background text-muted-foreground">
                                <CameraOff className="size-5" aria-hidden />
                            </span>
                            <p className="text-sm font-semibold">
                                {state.kind === 'denied'
                                    ? 'Camera access is blocked'
                                    : state.kind === 'no-camera'
                                      ? 'No camera found'
                                      : state.kind === 'insecure'
                                        ? 'Camera needs a secure connection'
                                        : 'Camera didn’t start'}
                            </p>
                            <p className="max-w-[40ch] text-sm text-pretty text-muted-foreground">
                                {state.kind === 'denied'
                                    ? 'Allow camera access for this site from the lock icon in the address bar, then try again. You can also type the barcode.'
                                    : state.kind === 'no-camera'
                                      ? 'This device has no camera we can use. Type the barcode printed under the bars instead.'
                                      : state.kind === 'insecure'
                                        ? 'Browsers only allow the camera on https pages. Type the barcode instead.'
                                        : state.message}
                            </p>
                        </div>
                    ) : null}
                </div>
                <DialogFooter>
                    {state.kind === 'denied' || state.kind === 'error' ? (
                        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                            <RotateCw aria-hidden /> Try again
                        </Button>
                    ) : null}
                    <Button variant={blocked ? 'default' : 'outline'} onClick={() => onOpenChange(false)}>
                        {blocked ? 'Type it instead' : 'Cancel'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
