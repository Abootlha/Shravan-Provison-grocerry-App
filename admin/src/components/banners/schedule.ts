import { formatDate, storeDayKey } from '@/lib/format';
import type { Banner } from '@/components/catalog/types';

/**
 * The schedule is picked as whole store days (Asia/Kolkata). A banner runs from 00:00 on the
 * first day to 24:00 on the last day: `endsAt` is stored as 00:00 on the day after, which is
 * what the API's `startsAt ≤ now < endsAt` check expects.
 */
const IST = '+05:30';

export function dayToStartIso(day: string) {
    return new Date(`${day}T00:00:00${IST}`).toISOString();
}

export function dayToEndIso(lastDay: string) {
    const start = new Date(`${lastDay}T00:00:00${IST}`).getTime();
    return new Date(start + 86_400_000).toISOString();
}

export function isoToStartDay(iso: string | null | undefined) {
    return iso ? storeDayKey(iso) : '';
}

export function isoToLastDay(iso: string | null | undefined) {
    return iso ? storeDayKey(new Date(new Date(iso).getTime() - 1)) : '';
}

export type BannerState = 'live' | 'scheduled' | 'ended' | 'off';

export function bannerState(b: Pick<Banner, 'isActive' | 'startsAt' | 'endsAt'>, now = Date.now()): BannerState {
    if (!b.isActive) return 'off';
    if (b.endsAt && new Date(b.endsAt).getTime() <= now) return 'ended';
    if (b.startsAt && new Date(b.startsAt).getTime() > now) return 'scheduled';
    return 'live';
}

/** "12 Oct – 18 Oct 2026", "From 12 Oct 2026", "Until 18 Oct 2026", "Always". Days are inclusive. */
export function scheduleLabel(startsAt: string | null | undefined, endsAt: string | null | undefined) {
    const first = isoToStartDay(startsAt);
    const last = isoToLastDay(endsAt);
    const fmt = (day: string) => formatDate(`${day}T12:00:00${IST}`);
    if (first && last) return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
    if (first) return `From ${fmt(first)}`;
    if (last) return `Until ${fmt(last)}`;
    return 'No end date';
}
