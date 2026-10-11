import * as React from 'react';
import { formatDateTime, formatMoney, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { calculateBill, computeOpenState, formatClock, type Fees } from './logic';

function useNow(intervalMs = 30_000) {
    const [now, setNow] = React.useState(() => new Date());
    React.useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return now;
}

function sameStoreDay(a: Date, b: Date, timeZone: string) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    return f.format(a) === f.format(b);
}

/** "8:00 am today" / "8:00 am tomorrow" / full date further out. */
export function describeMoment(iso: string, now: Date, timeZone = 'Asia/Kolkata') {
    const at = new Date(iso);
    if (sameStoreDay(at, now, timeZone)) return `${formatTime(at)} today`;
    if (sameStoreDay(at, new Date(now.getTime() + 86_400_000), timeZone)) return `${formatTime(at)} tomorrow`;
    return formatDateTime(at);
}

/** What customers would see right now with the values in the form (before saving). */
export function OpenStatePreview({
    isActive,
    openTime,
    closeTime,
    timezone,
}: {
    isActive: boolean;
    openTime: string;
    closeTime: string;
    timezone: string;
}) {
    const now = useNow();
    const state = computeOpenState({ isActive, openTime, closeTime, timezone }, now);
    const tone = state.reason === 'paused' ? 'warning' : state.isOpen ? 'success' : 'neutral';
    const title = state.reason === 'paused' ? 'Paused' : state.isOpen ? 'Open now' : 'Closed now';
    const detail =
        state.reason === 'paused'
            ? 'Customers cannot place orders until you resume.'
            : state.reason === 'always'
                ? 'Open 24 hours. Set different opening and closing times to close overnight.'
                : state.isOpen && state.closesAt
                    ? `Taking orders until ${describeMoment(state.closesAt, now)}.`
                    : state.nextOpenAt
                        ? `Opens at ${describeMoment(state.nextOpenAt, now)}.`
                        : '';
    return (
        <div aria-live="polite" className="rounded-lg bg-muted/60 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">With these settings, customers see</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <span
                    aria-hidden
                    className={cn(
                        'size-2 rounded-full',
                        tone === 'success' && 'bg-success',
                        tone === 'warning' && 'bg-warning',
                        tone === 'neutral' && 'bg-muted-foreground',
                    )}
                />
                {title}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
            {state.reason === 'hours' && openTime && closeTime ? (
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    Daily {formatClock(openTime)} – {formatClock(closeTime)}
                    {closeTime < openTime ? ' (closes after midnight)' : ''}
                </p>
            ) : null}
        </div>
    );
}

const SAMPLE_CARTS = [99, 199, 499];

/** A worked bill for a cart value the admin picks, using the unsaved fee values. */
export function BillPreview({ fees }: { fees: Partial<Fees> }) {
    const [cart, setCart] = React.useState<number>(SAMPLE_CARTS[1]);
    const complete =
        [fees.deliveryFee, fees.freeDeliveryThreshold, fees.packagingFee, fees.discountRate].every(
            (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
        );
    const bill = complete ? calculateBill(cart, fees as Fees) : null;
    const percent = typeof fees.discountRate === 'number' ? Math.round(fees.discountRate * 10_000) / 100 : null;
    const shortBy = bill && !bill.freeDelivery ? Math.max(0, (fees.freeDeliveryThreshold ?? 0) - cart) : 0;

    return (
        <div className="rounded-lg bg-muted/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Bill preview</p>
                <div className="flex items-center gap-1" role="group" aria-label="Cart value for the preview">
                    {SAMPLE_CARTS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setCart(value)}
                            aria-pressed={cart === value}
                            className={cn(
                                'h-7 rounded-md px-2 text-xs font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                cart === value ? 'bg-brand-tint text-brand-text' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            {formatMoney(value)}
                        </button>
                    ))}
                </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                Items in cart
                <span className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs">₹</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={Number.isFinite(cart) ? cart : ''}
                        onChange={(e) => setCart(e.target.value === '' ? 0 : Math.max(0, e.target.valueAsNumber))}
                        className="h-7 w-24 rounded-md border border-input bg-card pr-2 pl-5 text-xs text-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </span>
            </label>
            {bill ? (
                <div className="mt-3 grid gap-1.5 text-sm">
                    <dl className="grid gap-1.5">
                        <Line label="Items" value={formatMoney(bill.itemTotal)} />
                        <Line
                            label="Delivery"
                            value={bill.freeDelivery ? 'Free' : formatMoney(bill.deliveryFee)}
                            valueClassName={bill.freeDelivery ? 'text-success-text' : undefined}
                        />
                        <Line label="Packaging" value={formatMoney(bill.packagingFee)} />
                        {bill.discount > 0 ? (
                            <Line label={`Discount (${percent}%)`} value={`−${formatMoney(bill.discount)}`} valueClassName="text-success-text" />
                        ) : null}
                        <Line label="Customer pays" value={formatMoney(bill.totalAmount)} strong className="mt-1 border-t pt-2" />
                    </dl>
                    {shortBy > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {formatMoney(shortBy)} more in the cart makes delivery free.
                        </p>
                    ) : null}
                </div>
            ) : (
                <p className="mt-3 text-sm text-muted-foreground">Fill in all four fees to see the bill.</p>
            )}
        </div>
    );
}

function Line({
    label,
    value,
    strong,
    valueClassName,
    className,
}: {
    label: string;
    value: string;
    strong?: boolean;
    valueClassName?: string;
    className?: string;
}) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4', className)}>
            <dt className={cn(strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</dt>
            <dd className={cn('tabular-nums', strong ? 'font-semibold text-foreground' : 'text-foreground', valueClassName)}>{value}</dd>
        </div>
    );
}
