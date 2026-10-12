import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
    label: string;
    icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    onSelect: () => void;
    destructive?: boolean;
    disabled?: boolean;
    /** Draw a separator above this item. */
    separated?: boolean;
}

/** The "…" menu at the end of a catalogue row. Only actions the backend supports go in here. */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
    if (!actions.length) return null;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`} onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44" onClick={(e) => e.stopPropagation()}>
                {actions.map((action) => (
                    <React.Fragment key={action.label}>
                        {action.separated ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuItem
                            disabled={action.disabled}
                            variant={action.destructive ? 'destructive' : 'default'}
                            onSelect={action.onSelect}
                        >
                            {action.icon ? <action.icon aria-hidden /> : null}
                            {action.label}
                        </DropdownMenuItem>
                    </React.Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
