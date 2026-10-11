import * as React from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'motion/react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A vertical list the user can reorder by dragging the grip, or by focusing the grip and
 * pressing ↑ / ↓. The parent owns the order: `onReorder(ids)` fires once per finished move
 * (drag release, or a short pause after keyboard moves), never on every frame.
 */
export interface SortableListProps<T> {
    items: T[];
    getId: (item: T) => string;
    /** Name of one row, read out by the grip ("Move Dairy"). */
    getLabel: (item: T) => string;
    onReorder: (ids: string[]) => void;
    renderItem: (item: T, ctx: { handle: React.ReactNode; index: number; dragging: boolean }) => React.ReactNode;
    /** Disable moving (e.g. while a search filters the list or while saving). */
    disabled?: boolean;
    label: string;
    className?: string;
}

export function SortableList<T>({ items, getId, getLabel, onReorder, renderItem, disabled, label, className }: SortableListProps<T>) {
    const ids = React.useMemo(() => items.map(getId), [items, getId]);
    const [order, setOrder] = React.useState(ids);
    const [announcement, setAnnouncement] = React.useState('');
    const pending = React.useRef<number | null>(null);
    const orderRef = React.useRef(order);
    orderRef.current = order;
    const listRef = React.useRef<HTMLUListElement>(null);
    const keyboardMoved = React.useRef<string | null>(null);

    // A keyboard move re-inserts the row; keep focus on its grip so ↑/↓ can be pressed again.
    React.useLayoutEffect(() => {
        const id = keyboardMoved.current;
        if (!id) return;
        keyboardMoved.current = null;
        const grip = listRef.current?.querySelector<HTMLButtonElement>(`[data-sort-handle="${CSS.escape(id)}"]`);
        if (grip && document.activeElement !== grip) grip.focus();
    }, [order]);

    // Server order wins whenever it changes (after a save or a refetch).
    const idsKey = ids.join('|');
    React.useEffect(() => {
        setOrder(ids);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey]);

    const byId = React.useMemo(() => new Map(items.map((item) => [getId(item), item])), [items, getId]);

    const commit = React.useCallback(() => {
        if (pending.current) window.clearTimeout(pending.current);
        pending.current = null;
        const next = orderRef.current;
        if (next.join('|') !== idsKey) onReorder(next);
    }, [idsKey, onReorder]);

    React.useEffect(() => () => {
        if (pending.current) window.clearTimeout(pending.current);
    }, []);

    const moveBy = (id: string, delta: number) => {
        const from = orderRef.current.indexOf(id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= orderRef.current.length) return;
        const next = [...orderRef.current];
        next.splice(to, 0, ...next.splice(from, 1));
        orderRef.current = next;
        keyboardMoved.current = id;
        setOrder(next);
        const item = byId.get(id);
        setAnnouncement(`${item ? getLabel(item) : 'Item'} moved to position ${to + 1} of ${next.length}.`);
        if (pending.current) window.clearTimeout(pending.current);
        pending.current = window.setTimeout(commit, 700);
    };

    return (
        <>
            <Reorder.Group
                axis="y"
                values={order}
                onReorder={disabled ? () => undefined : setOrder}
                ref={listRef}
                className={cn('divide-y', className)}
                aria-label={label}
                as="ul"
            >
                {order.map((id, index) => {
                    const item = byId.get(id);
                    if (!item) return null;
                    return (
                        <SortableRow
                            key={id}
                            id={id}
                            index={index}
                            total={order.length}
                            label={getLabel(item)}
                            disabled={disabled}
                            onDragEnd={commit}
                            onMove={(delta) => moveBy(id, delta)}
                        >
                            {(handle, dragging) => renderItem(item, { handle, index, dragging })}
                        </SortableRow>
                    );
                })}
            </Reorder.Group>
            <p aria-live="polite" className="sr-only">
                {announcement}
            </p>
        </>
    );
}

function SortableRow({
    id,
    index,
    total,
    label,
    disabled,
    onDragEnd,
    onMove,
    children,
}: {
    id: string;
    index: number;
    total: number;
    label: string;
    disabled?: boolean;
    onDragEnd: () => void;
    onMove: (delta: number) => void;
    children: (handle: React.ReactNode, dragging: boolean) => React.ReactNode;
}) {
    const controls = useDragControls();
    const reduce = useReducedMotion();
    const [dragging, setDragging] = React.useState(false);

    const handle = (
        <button
            type="button"
            data-sort-handle={id}
            disabled={disabled}
            aria-label={`Move ${label}, position ${index + 1} of ${total}. Use the up and down arrow keys.`}
            aria-keyshortcuts="ArrowUp ArrowDown"
            onPointerDown={(event) => {
                if (disabled) return;
                event.preventDefault();
                controls.start(event);
            }}
            onKeyDown={(event) => {
                if (disabled) return;
                if (event.key === 'ArrowUp' && index > 0) {
                    event.preventDefault();
                    onMove(-1);
                } else if (event.key === 'ArrowDown' && index < total - 1) {
                    event.preventDefault();
                    onMove(1);
                }
            }}
            className={cn(
                'flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                disabled ? 'cursor-not-allowed opacity-40' : dragging ? 'cursor-grabbing' : 'cursor-grab',
            )}
        >
            <GripVertical className="size-4" aria-hidden />
        </button>
    );

    return (
        <Reorder.Item
            value={id}
            as="li"
            dragListener={false}
            dragControls={controls}
            onDragStart={() => setDragging(true)}
            onDragEnd={() => {
                setDragging(false);
                onDragEnd();
            }}
            layout={reduce ? undefined : 'position'}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className={cn('relative bg-card', dragging && 'z-10 rounded-lg shadow-float ring-1 ring-border')}
        >
            {children(handle, dragging)}
        </Reorder.Item>
    );
}
