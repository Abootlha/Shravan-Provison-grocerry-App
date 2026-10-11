/**
 * Open/closed state of the store, computed from storeTimings in the store's
 * timezone. Pure functions so they can be unit-tested with a fixed clock.
 */

export interface StoreTimingsLike {
  openTime?: string;
  closeTime?: string;
}

export interface StoreOpenState {
  isOpen: boolean;
  /** ISO timestamp of the next opening, null when open or closed indefinitely. */
  nextOpenAt: string | null;
}

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value: string | undefined): number | null {
  const match = TIME_PATTERN.exec(value || '');
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  minutes: number;
}

function localParts(date: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    minutes: get('hour') * 60 + get('minute'),
  };
}

/** Offset of `timezone` from UTC at `date`, in minutes. */
function offsetMinutes(date: Date, timezone: string): number {
  const p = localParts(date, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day) + p.minutes * 60_000;
  const truncated = Math.floor(date.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

/** UTC instant of a local wall-clock time in `timezone`. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timezone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day) + minutes * 60_000;
  const first = naive - offsetMinutes(new Date(naive), timezone) * 60_000;
  // Second pass corrects the offset across DST transitions.
  return new Date(naive - offsetMinutes(new Date(first), timezone) * 60_000);
}

export function computeStoreOpenState(
  settings: {
    isActive?: boolean;
    storeTimings?: StoreTimingsLike;
    timezone?: string;
  },
  now: Date = new Date(),
): StoreOpenState {
  // Manually closed by the store: no automatic reopening time.
  if (settings.isActive === false) {
    return { isOpen: false, nextOpenAt: null };
  }

  const open = toMinutes(settings.storeTimings?.openTime);
  const close = toMinutes(settings.storeTimings?.closeTime);
  // No (valid) timings, or open == close: open around the clock.
  if (open === null || close === null || open === close) {
    return { isOpen: true, nextOpenAt: null };
  }

  const timezone =
    settings.timezone && isValidTimezone(settings.timezone)
      ? settings.timezone
      : DEFAULT_TIMEZONE;
  const local = localParts(now, timezone);
  const current = local.minutes;

  const isOpen =
    open < close
      ? current >= open && current < close
      : // Overnight window, e.g. 18:00-02:00.
        current >= open || current < close;

  if (isOpen) return { isOpen: true, nextOpenAt: null };

  // Closed: the next opening is today if it is still ahead, else tomorrow.
  let { year, month, day } = local;
  if (current >= open) {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    year = tomorrow.getUTCFullYear();
    month = tomorrow.getUTCMonth() + 1;
    day = tomorrow.getUTCDate();
  }
  return {
    isOpen: false,
    nextOpenAt: zonedTimeToUtc(year, month, day, open, timezone).toISOString(),
  };
}

/** Local calendar date (YYYY-MM-DD) of `date` in `timezone`. */
export function localDateString(date: Date, timezone: string): string {
  const p = localParts(date, timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** UTC instant of local midnight starting the calendar day `ymd` (YYYY-MM-DD). */
export function startOfLocalDay(ymd: string, timezone: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return zonedTimeToUtc(year, month, day, 0, timezone);
}

/** YYYY-MM-DD shifted by `days` calendar days. */
export function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}
