import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A small, keyboard-friendly tree for audit payloads: objects and arrays collapse, scalars are
 * typed by colour. Not a raw dump: keys stay readable and long strings wrap.
 */
export function JsonViewer({ value, className }: { value: unknown; className?: string }) {
    return (
        <div className={cn('overflow-x-auto rounded-lg border bg-muted/30 p-2 font-mono text-[13px] leading-6', className)}>
            {isBranch(value) ? (
                <ul role="tree" aria-label="Changed values">
                    {entries(value).map(([k, v]) => (
                        <Node key={k} name={k} value={v} depth={0} />
                    ))}
                </ul>
            ) : (
                <Scalar value={value} />
            )}
        </div>
    );
}

const isBranch = (v: unknown): v is Record<string, unknown> | unknown[] => typeof v === 'object' && v !== null;
const entries = (v: Record<string, unknown> | unknown[]) =>
    Array.isArray(v) ? v.map((x, i) => [String(i), x] as const) : Object.entries(v);

function Scalar({ value }: { value: unknown }) {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">empty</span>;
    if (typeof value === 'boolean') return <span className="text-brand-text">{value ? 'true' : 'false'}</span>;
    if (typeof value === 'number') return <span className="text-chart-2 tabular-nums">{value}</span>;
    const text = String(value);
    if (/^\[?redacted\]?$/i.test(text) || text === '***') return <span className="text-muted-foreground italic">hidden</span>;
    return <span className="break-words whitespace-pre-wrap text-foreground">"{text}"</span>;
}

function Node({ name, value, depth }: { name: string; value: unknown; depth: number }) {
    const branch = isBranch(value);
    const [open, setOpen] = React.useState(depth < 1);
    const size = branch ? entries(value).length : 0;
    const summary = branch ? (Array.isArray(value) ? `${size} item${size === 1 ? '' : 's'}` : `${size} field${size === 1 ? '' : 's'}`) : null;

    if (!branch) {
        return (
            <li role="treeitem" aria-selected={false} className="flex gap-2 rounded px-1" style={{ paddingLeft: depth * 16 + 20 }}>
                <span className="shrink-0 text-muted-foreground">{name}:</span>
                <span className="min-w-0">
                    <Scalar value={value} />
                </span>
            </li>
        );
    }
    return (
        <li role="treeitem" aria-expanded={open} aria-selected={false}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-1 rounded px-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                style={{ paddingLeft: depth * 16 + 4 }}
            >
                <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-90')} aria-hidden />
                <span className="text-muted-foreground">{name}:</span>
                <span className="text-xs text-muted-foreground/80">{summary}</span>
            </button>
            {open && size > 0 ? (
                <ul role="group">
                    {entries(value).map(([k, v]) => (
                        <Node key={k} name={k} value={v} depth={depth + 1} />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}
