import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Buttons on the right; wraps below the title on small screens. */
    actions?: React.ReactNode;
    /** Extra row under the title, e.g. Tabs or filters. */
    children?: React.ReactNode;
    className?: string;
}

/** Page title block. The shell already shows breadcrumbs, so this is the page's one <h1>. */
export function PageHeader({ title, description, actions, children, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground">{title}</h1>
                    {description ? (
                        <p className="max-w-[65ch] text-sm text-pretty text-muted-foreground">{description}</p>
                    ) : null}
                </div>
                {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
            {children}
        </div>
    );
}

/** Standard page padding and vertical rhythm. Wrap page content in it. */
export function PageContainer({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8', className)} {...props} />;
}
