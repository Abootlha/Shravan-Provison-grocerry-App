import * as React from 'react';
import { AlertCircle, type LucideIcon, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/http';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
    icon?: LucideIcon;
    /** Say why it is empty: "No orders yet", "No products match these filters". */
    title: string;
    /** Say what to do next. */
    description?: React.ReactNode;
    /** The one action that fills it (a Button, or a link via Button asChild). */
    action?: React.ReactNode;
    /** "inline" fits inside a table/card; "page" is roomier for a whole page. */
    size?: 'inline' | 'page';
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, size = 'inline', className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                size === 'page' ? 'gap-3 px-6 py-20' : 'gap-2 px-4 py-12',
                className,
            )}
        >
            {Icon ? (
                <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="size-5" aria-hidden />
                </div>
            ) : null}
            <p className={cn('font-semibold text-foreground text-balance', size === 'page' ? 'text-base' : 'text-sm')}>{title}</p>
            {description ? <div className="max-w-[46ch] text-sm text-pretty text-muted-foreground">{description}</div> : null}
            {action ? <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
        </div>
    );
}

export interface ErrorStateProps {
    /** What failed, e.g. "Couldn't load orders". */
    title?: string;
    /** The error; its message is shown (ApiError messages are already human readable). */
    error?: unknown;
    onRetry?: () => void;
    retrying?: boolean;
    className?: string;
}

export function ErrorState({ title = "Couldn't load this", error, onRetry, retrying, className }: ErrorStateProps) {
    return (
        <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 px-4 py-12 text-center', className)}>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-destructive-tint text-destructive">
                <AlertCircle className="size-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {error !== undefined ? <p className="max-w-[52ch] text-sm text-muted-foreground">{errorMessage(error)}</p> : null}
            {onRetry ? (
                <Button variant="outline" onClick={onRetry} disabled={retrying} className="mt-2">
                    <RotateCw className={cn(retrying && 'animate-spin')} aria-hidden />
                    {retrying ? 'Retrying…' : 'Try again'}
                </Button>
            ) : null}
        </div>
    );
}
