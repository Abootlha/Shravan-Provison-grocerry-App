import * as React from 'react';
import { Loader2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';

export interface ConfirmOptions {
    title: string;
    description?: React.ReactNode;
    /** Verb that names the action, e.g. "Delete product". Default "Confirm". */
    confirmLabel?: string;
    cancelLabel?: string;
    /** "destructive" paints the confirm button red. */
    tone?: 'default' | 'destructive';
    /**
     * Optional async work. The dialog stays open with a spinner until it settles; a thrown
     * error is shown inside the dialog and the user can retry or cancel.
     */
    onConfirm?: () => Promise<unknown> | unknown;
}

interface PendingConfirm extends ConfirmOptions {
    resolve: (confirmed: boolean) => void;
}

let current: PendingConfirm | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Imperative confirm, usable from any island: `if (await confirm({...})) doIt()`.
 * Rendered by the single <ConfirmHost /> that the shell mounts.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
    current?.resolve(false);
    return new Promise<boolean>((resolve) => {
        current = { ...options, resolve };
        emit();
    });
}

/** Hook form of `confirm` for components. */
export function useConfirm() {
    return confirm;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Mount once (the app shell does). */
export function ConfirmHost() {
    const pending = React.useSyncExternalStore(subscribe, () => current, () => null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        setBusy(false);
        setError(null);
    }, [pending]);

    const settle = (confirmed: boolean) => {
        if (!pending) return;
        pending.resolve(confirmed);
        if (current === pending) {
            current = null;
            emit();
        }
    };

    const onConfirm = async () => {
        if (!pending) return;
        if (!pending.onConfirm) return settle(true);
        setBusy(true);
        setError(null);
        try {
            await pending.onConfirm();
            settle(true);
        } catch (err) {
            setError(errorMessage(err));
            setBusy(false);
        }
    };

    return (
        <ConfirmDialog
            open={pending !== null}
            onOpenChange={(open) => {
                if (!open && !busy) settle(false);
            }}
            title={pending?.title ?? ''}
            description={pending?.description}
            confirmLabel={pending?.confirmLabel}
            cancelLabel={pending?.cancelLabel}
            tone={pending?.tone}
            busy={busy}
            error={error}
            onConfirm={onConfirm}
        />
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'default' | 'destructive';
    busy?: boolean;
    error?: string | null;
    onConfirm: () => void;
}

/** Controlled confirmation dialog, for cases where the caller owns the open state. */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'default',
    busy = false,
    error,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
                </AlertDialogHeader>
                {error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                ) : null}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
                    <Button
                        onClick={onConfirm}
                        disabled={busy}
                        className={cn(
                            tone === 'destructive' &&
                                'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30',
                        )}
                    >
                        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                        {confirmLabel}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
