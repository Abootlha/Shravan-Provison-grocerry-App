import { computeStoreOpenState, isValidTimezone } from './store-hours';

const timings = { openTime: '08:00', closeTime: '22:00' };
// 2026-10-12 in Asia/Kolkata (UTC+05:30).
const ist = (hhmm: string, day = 12) =>
  new Date(`2026-10-${day}T${hhmm}:00+05:30`);

describe('computeStoreOpenState', () => {
  it('is open inside the window', () => {
    expect(
      computeStoreOpenState({ storeTimings: timings }, ist('08:00')),
    ).toEqual({ isOpen: true, nextOpenAt: null });
    expect(
      computeStoreOpenState({ storeTimings: timings }, ist('21:59')).isOpen,
    ).toBe(true);
  });

  it('before opening: opens later today', () => {
    expect(
      computeStoreOpenState({ storeTimings: timings }, ist('06:30')),
    ).toEqual({
      isOpen: false,
      nextOpenAt: ist('08:00').toISOString(),
    });
  });

  it('after closing: opens tomorrow', () => {
    expect(
      computeStoreOpenState({ storeTimings: timings }, ist('22:00')),
    ).toEqual({
      isOpen: false,
      nextOpenAt: ist('08:00', 13).toISOString(),
    });
  });

  it('handles overnight windows', () => {
    const night = { openTime: '18:00', closeTime: '02:00' };
    expect(
      computeStoreOpenState({ storeTimings: night }, ist('23:00')).isOpen,
    ).toBe(true);
    expect(
      computeStoreOpenState({ storeTimings: night }, ist('01:59')).isOpen,
    ).toBe(true);
    expect(
      computeStoreOpenState({ storeTimings: night }, ist('03:00')),
    ).toEqual({ isOpen: false, nextOpenAt: ist('18:00').toISOString() });
  });

  it('uses the configured timezone', () => {
    // 07:00 UTC = 12:30 IST (open) but 03:00 in New York (closed).
    const now = new Date('2026-10-12T07:00:00Z');
    expect(
      computeStoreOpenState(
        { storeTimings: timings, timezone: 'Asia/Kolkata' },
        now,
      ).isOpen,
    ).toBe(true);
    const ny = computeStoreOpenState(
      { storeTimings: timings, timezone: 'America/New_York' },
      now,
    );
    expect(ny.isOpen).toBe(false);
    expect(ny.nextOpenAt).toBe('2026-10-12T12:00:00.000Z');
  });

  it('is closed with no reopening time when the store is deactivated', () => {
    expect(
      computeStoreOpenState(
        { isActive: false, storeTimings: timings },
        ist('12:00'),
      ),
    ).toEqual({ isOpen: false, nextOpenAt: null });
  });

  it('treats missing or equal timings as open all day', () => {
    expect(computeStoreOpenState({}, ist('03:00')).isOpen).toBe(true);
    expect(
      computeStoreOpenState(
        { storeTimings: { openTime: '00:00', closeTime: '00:00' } },
        ist('03:00'),
      ).isOpen,
    ).toBe(true);
  });

  it('validates timezones', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('Mars/Base')).toBe(false);
  });
});
