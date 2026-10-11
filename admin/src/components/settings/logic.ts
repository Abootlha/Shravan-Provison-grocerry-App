/**
 * Client copies of two small backend rules, used for live previews only (the server stays the
 * source of truth for both):
 *  - backend/src/modules/settings/store-hours.ts → computeStoreOpenState
 *  - backend/src/modules/orders/pricing.ts       → calculateBill
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value: string | undefined | null): number | null {
    const match = TIME_PATTERN.exec(value || '');
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidTimezone(timezone: string): boolean {
    if (!timezone) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return true;
    } catch {
        return false;
    }
}

function localParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return { year: get('year'), month: get('month'), day: get('day'), minutes: get('hour') * 60 + get('minute') };
}

function offsetMinutes(date: Date, timezone: string): number {
    const p = localParts(date, timezone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day) + p.minutes * 60_000;
    const truncated = Math.floor(date.getTime() / 60_000) * 60_000;
    return Math.round((asUtc - truncated) / 60_000);
}

function zonedTimeToUtc(year: number, month: number, day: number, minutes: number, timezone: string): Date {
    const naive = Date.UTC(year, month - 1, day) + minutes * 60_000;
    const first = naive - offsetMinutes(new Date(naive), timezone) * 60_000;
    return new Date(naive - offsetMinutes(new Date(first), timezone) * 60_000);
}

export interface OpenState {
    isOpen: boolean;
    /** ISO time of the next opening; null when open, paused, or open around the clock. */
    nextOpenAt: string | null;
    /** Why: paused by staff, 24 hours, or within/outside the hours. */
    reason: 'paused' | 'always' | 'hours';
    /** ISO time the store closes next, when open with hours. */
    closesAt: string | null;
}

export function computeOpenState(
    settings: { isActive?: boolean; openTime?: string | null; closeTime?: string | null; timezone?: string | null },
    now: Date = new Date(),
): OpenState {
    if (settings.isActive === false) return { isOpen: false, nextOpenAt: null, reason: 'paused', closesAt: null };
    const open = toMinutes(settings.openTime);
    const close = toMinutes(settings.closeTime);
    if (open === null || close === null || open === close) return { isOpen: true, nextOpenAt: null, reason: 'always', closesAt: null };

    const timezone = settings.timezone && isValidTimezone(settings.timezone) ? settings.timezone : 'Asia/Kolkata';
    const local = localParts(now, timezone);
    const current = local.minutes;
    const isOpen = open < close ? current >= open && current < close : current >= open || current < close;

    const shift = (days: number) => {
        const d = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
        return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    };

    if (isOpen) {
        // Closing today, or tomorrow for the after-midnight part of an overnight window.
        const closeDay = open < close || current < close ? shift(0) : shift(1);
        return {
            isOpen: true,
            nextOpenAt: null,
            reason: 'hours',
            closesAt: zonedTimeToUtc(closeDay.year, closeDay.month, closeDay.day, close, timezone).toISOString(),
        };
    }
    const day = current >= open ? shift(1) : shift(0);
    return {
        isOpen: false,
        nextOpenAt: zonedTimeToUtc(day.year, day.month, day.day, open, timezone).toISOString(),
        reason: 'hours',
        closesAt: null,
    };
}

/** "8:00 am" for an HH:mm string. */
export function formatClock(value: string | null | undefined): string {
    const minutes = toMinutes(value);
    if (minutes === null) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const suffix = h < 12 ? 'am' : 'pm';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export interface Fees {
    deliveryFee: number;
    freeDeliveryThreshold: number;
    packagingFee: number;
    /** Fraction of the item total. */
    discountRate: number;
}

export interface Bill {
    itemTotal: number;
    deliveryFee: number;
    packagingFee: number;
    discount: number;
    totalAmount: number;
    freeDelivery: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateBill(itemTotal: number, fees: Fees): Bill {
    const total = round2(itemTotal);
    const freeDelivery = total >= fees.freeDeliveryThreshold;
    const deliveryFee = freeDelivery ? 0 : fees.deliveryFee;
    const discount = Math.round(total * fees.discountRate);
    return {
        itemTotal: total,
        deliveryFee,
        packagingFee: fees.packagingFee,
        discount,
        totalAmount: round2(total + deliveryFee + fees.packagingFee - discount),
        freeDelivery,
    };
}
