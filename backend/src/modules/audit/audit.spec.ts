import { of, lastValueFrom } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { AuditInterceptor, deriveAudit } from './audit.interceptor';
import { sanitizeForAudit, smallDiff } from './audit.service';

describe('deriveAudit', () => {
  it('names actions from the route template', () => {
    expect(
      deriveAudit('PATCH', '/api/v1/admin/products/:id/status', { id: 'p1' }),
    ).toEqual({
      entity: 'products',
      action: 'products.status',
      entityId: 'p1',
    });
    expect(
      deriveAudit('POST', '/api/v1/admin/products/:id/stock-adjustments', {
        id: 'p1',
      }),
    ).toEqual({
      entity: 'products',
      action: 'products.stock-adjustments',
      entityId: 'p1',
    });
    expect(deriveAudit('PUT', '/api/v1/categories/:id', { id: 'c1' })).toEqual({
      entity: 'categories',
      action: 'categories.update',
      entityId: 'c1',
    });
    expect(deriveAudit('POST', '/api/v1/admin/banners', {})).toEqual({
      entity: 'banners',
      action: 'banners.create',
      entityId: undefined,
    });
    expect(
      deriveAudit('DELETE', '/api/v1/admin/banners/:id', { id: 'b' }),
    ).toMatchObject({ action: 'banners.delete' });
  });
});

describe('audit diff sanitising', () => {
  it('redacts secrets and truncates big values', () => {
    const out = sanitizeForAudit({
      name: 'x',
      password: 'secret-value',
      refreshToken: 't',
      image: `data:image/png;base64,${'A'.repeat(5000)}`,
      description: 'd'.repeat(500),
      tags: Array.from({ length: 30 }, (_, i) => i),
    }) as any;
    expect(out.password).toBe('[redacted]');
    expect(out.refreshToken).toBe('[redacted]');
    expect(out.image).toMatch(/^\[data uri/);
    expect(out.description.length).toBeLessThan(250);
    expect(out.tags).toHaveLength(21);
  });

  it('returns undefined for empty bodies and caps the size', () => {
    expect(smallDiff({})).toBeUndefined();
    const big: Record<string, string> = {};
    for (let i = 0; i < 100; i++) big[`k${i}`] = 'v'.repeat(150);
    expect(smallDiff(big)).toEqual({
      truncated: true,
      keys: Object.keys(big),
    });
  });
});

describe('AuditInterceptor', () => {
  const record = jest.fn();
  const interceptor = new AuditInterceptor(
    { record } as any,
    { getAllAndOverride: jest.fn() } as unknown as Reflector,
  );

  const contextFor = (req: any) =>
    ({
      getType: () => 'http',
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({ statusCode: 200 }),
      }),
    }) as any;

  beforeEach(() => record.mockClear());

  it('records successful staff mutations', async () => {
    const req = {
      method: 'PATCH',
      route: { path: '/api/v1/admin/products/:id/status' },
      params: { id: 'p1' },
      body: { status: 'archived' },
      user: { userId: 'u1', role: 'manager' },
      ip: '10.0.0.1',
      originalUrl: '/api/v1/admin/products/p1/status?x=1',
    };
    await lastValueFrom(
      interceptor.intercept(contextFor(req), { handle: () => of({ ok: 1 }) }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'u1',
        role: 'manager',
        action: 'products.status',
        entity: 'products',
        entityId: 'p1',
        summary: 'products.status p1 status=archived',
        diff: { changes: { status: 'archived' } },
        ip: '10.0.0.1',
        path: '/api/v1/admin/products/p1/status',
      }),
    );
  });

  it('takes the entity id from the response for creates', async () => {
    const req = {
      method: 'POST',
      route: { path: '/api/v1/admin/banners' },
      params: {},
      body: { title: 'x' },
      user: { userId: 'u1', role: 'admin' },
    };
    await lastValueFrom(
      interceptor.intercept(contextFor(req), {
        handle: () => of({ banner: { _id: 'b1' } }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'banners.create', entityId: 'b1' }),
    );
  });

  it('ignores reads, customers, riders and auth routes', async () => {
    const cases = [
      {
        method: 'GET',
        user: { role: 'admin' },
        route: { path: '/api/v1/admin/products' },
      },
      {
        method: 'POST',
        user: { role: 'customer' },
        route: { path: '/api/v1/orders' },
      },
      {
        method: 'PATCH',
        user: { role: 'rider' },
        route: { path: '/api/v1/orders/:id/status' },
      },
      {
        method: 'POST',
        user: { role: 'admin' },
        route: { path: '/api/v1/auth/logout' },
      },
      { method: 'POST', route: { path: '/api/v1/auth/admin/login' } },
    ];
    for (const req of cases) {
      await lastValueFrom(
        interceptor.intercept(contextFor({ params: {}, body: {}, ...req }), {
          handle: () => of({}),
        }),
      );
    }
    expect(record).not.toHaveBeenCalled();
  });
});
