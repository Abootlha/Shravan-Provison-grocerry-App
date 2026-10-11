import { describe, expect, it } from 'vitest';
import { addDays, percentChange, previousRange, rangeInstants, toCsv } from '../analytics/api';
import { foldCategories } from '../analytics/charts';
import { calculateBill, computeOpenState, formatClock } from './logic';
import { settingsSchema, toFormValues, toUpdateBody } from './schema';
import type { StoreSettings } from './api';

const at = (iso: string) => new Date(iso);

describe('computeOpenState (mirrors backend store-hours)', () => {
    const hours = { isActive: true, openTime: '08:00', closeTime: '22:00', timezone: 'Asia/Kolkata' };

    it('is open inside the hours and reports the closing time', () => {
        const s = computeOpenState(hours, at('2026-10-12T06:00:00Z')); // 11:30 IST
        expect(s.isOpen).toBe(true);
        expect(s.closesAt).toBe('2026-10-12T16:30:00.000Z');
    });

    it('is closed before opening and opens later the same day', () => {
        const s = computeOpenState(hours, at('2026-10-11T21:18:00Z')); // 02:48 IST on the 12th
        expect(s).toMatchObject({ isOpen: false, nextOpenAt: '2026-10-12T02:30:00.000Z' });
    });

    it('handles overnight windows', () => {
        const night = { ...hours, openTime: '18:00', closeTime: '02:00' };
        expect(computeOpenState(night, at('2026-10-11T19:30:00Z')).isOpen).toBe(true); // 01:00 IST
        expect(computeOpenState(night, at('2026-10-12T06:00:00Z')).isOpen).toBe(false); // 11:30 IST
    });

    it('paused beats hours; equal times mean 24 hours', () => {
        expect(computeOpenState({ ...hours, isActive: false })).toMatchObject({ isOpen: false, reason: 'paused', nextOpenAt: null });
        expect(computeOpenState({ ...hours, closeTime: '08:00' })).toMatchObject({ isOpen: true, reason: 'always' });
    });

    it('formats clock times', () => {
        expect(formatClock('00:05')).toBe('12:05 am');
        expect(formatClock('22:00')).toBe('10:00 pm');
        expect(formatClock('')).toBe('—');
    });
});

describe('calculateBill (mirrors backend pricing)', () => {
    const fees = { deliveryFee: 25, freeDeliveryThreshold: 200, packagingFee: 5, discountRate: 0.05 };
    it('charges delivery below the threshold', () => {
        expect(calculateBill(60, fees)).toMatchObject({ deliveryFee: 25, discount: 3, totalAmount: 87, freeDelivery: false });
    });
    it('makes delivery free at the threshold', () => {
        expect(calculateBill(200, fees)).toMatchObject({ deliveryFee: 0, discount: 10, totalAmount: 195, freeDelivery: true });
    });
});

const settings: StoreSettings = {
    storeName: 'Shravan Kirana Store',
    location: { latitude: 26.75, longitude: 83.37, address: 'Gorakhpur' },
    storeTimings: { openTime: '08:00', closeTime: '22:00' },
    contactPhone: null,
    contactEmail: null,
    address: null,
    gstin: null,
    timezone: 'Asia/Kolkata',
    fees: { deliveryFee: 25, freeDeliveryThreshold: 200, packagingFee: 5, discountRate: 0.05 },
    serviceRadiusKm: 4,
    estimatedDeliveryMinutes: 10,
    isActive: true,
    isOpen: true,
    nextOpenAt: null,
};

describe('settings form', () => {
    it('keeps missing contact data empty instead of inventing it', () => {
        const v = toFormValues(settings);
        expect(v).toMatchObject({ contactPhone: '', contactEmail: '', gstin: '', discountPercent: 5 });
    });

    it('accepts decimal radius and rejects out-of-range values', () => {
        const base = toFormValues(settings);
        expect(settingsSchema.safeParse({ ...base, serviceRadiusKm: 2.75 }).success).toBe(true);
        const zero = settingsSchema.safeParse({ ...base, serviceRadiusKm: 0 });
        expect(zero.success).toBe(false);
        const empty = settingsSchema.safeParse({ ...base, deliveryFee: undefined });
        expect(empty.success).toBe(false);
    });

    it('validates GSTIN and upper-cases it', () => {
        const base = toFormValues(settings);
        const ok = settingsSchema.safeParse({ ...base, gstin: '09aaach7409r1zz' });
        expect(ok.success && ok.data.gstin).toBe('09AAACH7409R1ZZ');
        expect(settingsSchema.safeParse({ ...base, gstin: 'ABC' }).success).toBe(false);
    });

    it('sends only the changed groups, with the discount as a fraction', () => {
        const parsed = settingsSchema.parse({ ...toFormValues(settings), discountPercent: 7.5, serviceRadiusKm: 3.5 });
        expect(toUpdateBody(parsed, { discountPercent: true, serviceRadiusKm: true })).toEqual({
            fees: { discountRate: 0.075 },
            serviceRadiusKm: 3.5,
        });
        expect(toUpdateBody(parsed, { contactEmail: true })).toEqual({ contactEmail: '' });
    });
});

describe('analytics helpers', () => {
    it('computes the previous equal-length range', () => {
        expect(previousRange('2026-10-06', '2026-10-12')).toEqual({ from: '2026-09-29', to: '2026-10-05' });
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('never invents a delta without a base', () => {
        expect(percentChange(100, 0)).toBeUndefined();
        expect(percentChange(100, undefined)).toBeUndefined();
        expect(percentChange(150, 100)).toBe(50);
    });

    it('turns store days into UTC instants (IST)', () => {
        expect(rangeInstants('2026-10-12', '2026-10-12')).toEqual({
            start: '2026-10-11T18:30:00.000Z',
            end: '2026-10-12T18:29:59.999Z',
        });
    });

    it('quotes CSV cells', () => {
        expect(toCsv([['a,b', 'say "hi"', 3]])).toBe('"a,b","say ""hi""",3');
    });

    it('folds categories past eight into Other', () => {
        const rows = Array.from({ length: 10 }, (_, i) => ({ _id: String(i), categoryName: `C${i}`, revenue: 100 - i, itemsSold: 1 }));
        const folded = foldCategories(rows);
        expect(folded).toHaveLength(8);
        expect(folded[7]).toMatchObject({ name: 'Other (3)', revenue: 93 + 92 + 91, itemsSold: 3 });
    });
});
