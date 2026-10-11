import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime, formatMoney, formatNumber, storeDayKey } from './format';
import { ApiError, buildUrl, request } from './http';
import { refreshSession } from './session';
import { findNavLocation, isNavItemActive } from '@/components/shell/nav';

function memoryStorage() {
    const store = new Map<string, string>();
    return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
    };
}

function jwt(expSecondsFromNow: number) {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
    return `x.${payload}.y`;
}

describe('format', () => {
    it('formats rupees with Indian grouping and only shows paise when present', () => {
        expect(formatMoney(123456)).toBe('₹1,23,456');
        expect(formatMoney(99.5)).toBe('₹99.50');
        expect(formatMoney(null)).toBe('—');
        expect(formatNumber(1234567)).toBe('12,34,567');
    });

    it('uses Asia/Kolkata regardless of the runtime timezone', () => {
        // 20:00 UTC is 01:30 the next day in India.
        expect(storeDayKey('2026-10-12T20:00:00Z')).toBe('2026-10-13');
        expect(formatDateTime('2026-10-12T20:00:00Z')).toMatch(/13 Oct 2026/);
    });
});

describe('nav matching', () => {
    it('distinguishes order views by status', () => {
        expect(isNavItemActive('/orders', '/orders', '')).toBe(true);
        expect(isNavItemActive('/orders', '/orders', '?status=completed')).toBe(false);
        expect(isNavItemActive('/orders?status=completed', '/orders/', '?status=completed')).toBe(true);
        expect(findNavLocation('/orders', '?status=returns')?.item.title).toBe('Cancelled & returns');
        expect(findNavLocation('/products', '?action=new')?.group.label).toBe('Catalog');
    });
});

describe('http', () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
        storage = memoryStorage();
        vi.stubGlobal('localStorage', storage);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        window.__adminSessionRefresh = undefined;
    });

    it('builds query strings and skips empty values', () => {
        expect(buildUrl('/products', { page: 2, search: '', ids: ['a', 'b'], x: undefined }, 'http://api')).toBe(
            'http://api/products?page=2&ids=a&ids=b',
        );
    });

    it('turns backend errors into readable ApiErrors', async () => {
        storage.setItem('adminToken', jwt(600));
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                new Response(JSON.stringify({ statusCode: 400, message: ['name should not be empty', 'price must be positive'], error: 'Bad Request' }), {
                    status: 400,
                }),
            ),
        );
        const error = (await request('/products', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;
        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(400);
        expect(error.messages).toEqual(['name should not be empty', 'price must be positive']);
        expect(error.message).not.toContain('{');
    });

    it('keeps the session on 403', async () => {
        storage.setItem('adminToken', jwt(600));
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Forbidden resource' }), { status: 403 })));
        const error = (await request('/admin/orders').catch((e) => e)) as ApiError;
        expect(error.status).toBe(403);
        expect(storage.getItem('adminToken')).not.toBeNull();
    });

    it('reuses the refresh started by the page guard instead of calling /auth/refresh again', async () => {
        storage.setItem('adminRefreshToken', 'r1');
        const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        window.__adminSessionRefresh = Promise.resolve({ status: 'ok' as const, token: 'guard-token' });

        const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
        expect(a).toEqual({ status: 'ok', token: 'guard-token' });
        expect(b).toEqual(a);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shares one refresh between concurrent callers', async () => {
        storage.setItem('adminRefreshToken', 'r1');
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ accessToken: jwt(600), refreshToken: 'r2' }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(storage.getItem('adminRefreshToken')).toBe('r2');
    });
});
