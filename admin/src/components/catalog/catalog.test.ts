import { describe, expect, it } from 'vitest';
import { mergeVisibleOrder } from './api';
import { imageSchema } from './schemas';
import { bannerState, dayToEndIso, dayToStartIso, isoToLastDay, isoToStartDay, scheduleLabel } from '../banners/schedule';
import { bannerSchema, toBannerBody } from '../banners/BannerForm';

describe('mergeVisibleOrder', () => {
    it('keeps hidden rows in their slots and refills the rest in the new order', () => {
        expect(mergeVisibleOrder(['a', 'h1', 'b', 'c', 'h2'], ['c', 'a', 'b'])).toEqual(['c', 'h1', 'a', 'b', 'h2']);
    });
});

describe('imageSchema', () => {
    it('accepts links, data URIs, server paths and (optionally) icon tokens', () => {
        expect(imageSchema().safeParse('https://cdn.example.com/a.png').success).toBe(true);
        expect(imageSchema().safeParse('data:image/png;base64,AAAA').success).toBe(true);
        expect(imageSchema().safeParse('/uploads/a.png').success).toBe(true);
        expect(imageSchema().safeParse('').success).toBe(true);
        expect(imageSchema().safeParse('milk').success).toBe(false);
        expect(imageSchema({ allowPlainIcon: true }).safeParse('milk').success).toBe(true);
        expect(imageSchema({ required: true }).safeParse('').success).toBe(false);
    });
});

describe('banner schedule', () => {
    it('stores whole IST days with an exclusive end and reads them back', () => {
        const start = dayToStartIso('2026-10-12');
        const end = dayToEndIso('2026-10-18');
        expect(start).toBe('2026-10-11T18:30:00.000Z');
        expect(end).toBe('2026-10-18T18:30:00.000Z');
        expect(isoToStartDay(start)).toBe('2026-10-12');
        expect(isoToLastDay(end)).toBe('2026-10-18');
        expect(scheduleLabel(null, null)).toBe('No end date');
    });

    it('derives live, scheduled, ended and off', () => {
        const now = Date.parse('2026-10-12T06:00:00Z');
        expect(bannerState({ isActive: false, startsAt: null, endsAt: null }, now)).toBe('off');
        expect(bannerState({ isActive: true, startsAt: null, endsAt: null }, now)).toBe('live');
        expect(bannerState({ isActive: true, startsAt: '2026-11-01T00:00:00Z', endsAt: null }, now)).toBe('scheduled');
        expect(bannerState({ isActive: true, startsAt: null, endsAt: '2026-10-01T00:00:00Z' }, now)).toBe('ended');
    });

    it('requires the right target and builds the API body', () => {
        const base = {
            title: 'Fresh fruit',
            titleHi: '',
            image: 'https://cdn.example.com/b.png',
            targetType: 'url' as const,
            targetCategory: '',
            targetProduct: '',
            targetUrl: 'http://insecure.example.com',
            startDay: '2026-10-12',
            endDay: '',
            isActive: true,
        };
        expect(bannerSchema.safeParse(base).success).toBe(false);
        const ok = bannerSchema.parse({ ...base, targetUrl: 'https://example.com/offers' });
        expect(toBannerBody(ok)).toMatchObject({
            target: { type: 'url', url: 'https://example.com/offers' },
            startsAt: '2026-10-11T18:30:00.000Z',
            endsAt: null,
        });
        expect(bannerSchema.safeParse({ ...base, targetType: 'category' }).success).toBe(false);
    });
});
