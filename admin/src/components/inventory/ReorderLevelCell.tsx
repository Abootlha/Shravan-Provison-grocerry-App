import * as React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { errorMessage, http } from '@/lib/http';
import { cn } from '@/lib/utils';
import { invalidateProducts } from '../products/data';

/** Inline reorder-level editor: saves on Enter or blur, Escape reverts. */
export function ReorderLevelCell({ productId, name, value }: { productId: string; name: string; value: number }) {
    const [draft, setDraft] = React.useState(String(value));
    const [state, setState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [error, setError] = React.useState<string | null>(null);
    React.useEffect(() => setDraft(String(value)), [value]);

    const commit = async () => {
        const trimmed = draft.trim();
        if (trimmed === String(value)) return;
        const n = Number(trimmed);
        if (trimmed === '' || !Number.isInteger(n) || n < 0 || n > 100_000) {
            setState('error');
            setError('Whole number, 0–100000');
            return;
        }
        setState('saving');
        setError(null);
        try {
            await http.patch(`/admin/products/${productId}/reorder-level`, { reorderLevel: n });
            setState('saved');
            invalidateProducts();
            setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 1600);
        } catch (e) {
            setState('error');
            setError(errorMessage(e));
            toast.error('Reorder level not saved', { description: errorMessage(e) });
        }
    };

    return (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <span className="inline-flex size-4 items-center justify-center" aria-live="polite">
                {state === 'saving' ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Saving" /> : null}
                {state === 'saved' ? <Check className="size-3.5 text-success-text" aria-label="Saved" /> : null}
            </span>
            <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                step={1}
                value={draft}
                onChange={(e) => {
                    setDraft(e.target.value);
                    if (state === 'error') setState('idle');
                }}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                    } else if (e.key === 'Escape') {
                        setDraft(String(value));
                        setState('idle');
                    }
                }}
                aria-label={`Reorder level for ${name}`}
                aria-invalid={state === 'error' || undefined}
                title={error ?? 'Low-stock alert at or below this number'}
                className={cn('h-8 w-20 [appearance:textfield] text-right tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
            />
        </div>
    );
}
