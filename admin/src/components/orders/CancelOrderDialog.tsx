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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/http';

const QUICK_REASONS = ['Customer asked to cancel', 'Items out of stock', 'Address not serviceable', 'Payment issue'];

export interface CancelOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orderId: string;
    /** After pickup the goods are with the rider; the backend flags the order for review. */
    flagsReview: boolean;
    onConfirm: (reason: string) => Promise<unknown>;
}

export function CancelOrderDialog({ open, onOpenChange, orderId, flagsReview, onConfirm }: CancelOrderDialogProps) {
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const fieldId = React.useId();
    const errorId = React.useId();

    React.useEffect(() => {
        if (open) {
            setReason('');
            setError(null);
            setBusy(false);
        }
    }, [open]);

    const submit = async () => {
        const text = reason.trim();
        if (text.length < 3) {
            setError('Add a short reason. The customer and the audit log see it.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onConfirm(text);
            onOpenChange(false);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel order {orderId}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {flagsReview
                            ? 'The rider already has the items. Cancelling flags the order for manual review so the stock and cash can be reconciled.'
                            : 'Reserved stock goes back to inventory and the rider, if any, is freed. This cannot be undone.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                    <Label htmlFor={fieldId}>Reason</Label>
                    <Textarea
                        id={fieldId}
                        value={reason}
                        maxLength={500}
                        rows={3}
                        onChange={(e) => {
                            setReason(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="Why is this order being cancelled?"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        autoFocus
                    />
                    <div className="flex flex-wrap gap-1.5" aria-label="Common reasons">
                        {QUICK_REASONS.map((text) => (
                            <Button key={text} type="button" size="xs" variant="outline" onClick={() => setReason(text)}>
                                {text}
                            </Button>
                        ))}
                    </div>
                    {error ? (
                        <p id={errorId} role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    ) : null}
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>Keep order</AlertDialogCancel>
                    <Button
                        onClick={submit}
                        disabled={busy}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30"
                    >
                        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                        Cancel order
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
