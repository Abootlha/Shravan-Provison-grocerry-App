import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildOrderParams, EMPTY_FILTERS, nextStep } from './order-model';
import { applyOrderEvent } from './useOrdersLive';
import { queryKeys } from '@/lib/query';
import type { OrderDetail, OrdersResponse } from './types';

const api = vi.hoisted(() => ({
    list: vi.fn(),
    detail: vi.fn(),
    setStatus: vi.fn(),
    assignRider: vi.fn(),
    unassignRider: vi.fn(),
    riders: vi.fn(),
}));

vi.mock('./order-model', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./order-model')>();
    return { ...actual, ordersApi: api };
});
vi.mock('./LiveTracking', () => ({ LiveTracking: () => <div data-testid="live-map" /> }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));

import { DETAIL_POLL_OFFLINE_MS, detailRefetchInterval, OrderDetailSheet } from './OrderDetailSheet';
import type { LiveConnection } from './useOrdersLive';
import { trackingUrlFromApiUrl } from '@/lib/config';
import { ConfirmHost } from '@/components/shared/confirm';

beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
    return {
        _id: 'o1',
        orderId: 'ORD-20261012-AAAA0001',
        orderStatus: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        itemTotal: 60,
        deliveryFee: 25,
        packagingFee: 5,
        discount: 3,
        totalAmount: 87,
        items: [{ productId: 'p1', name: 'Amul Taaza 1L', quantity: 2, price: 30, image: '' }],
        deliveryAddress: { type: 'Home', address: '14 Shastri Nagar', city: 'Gorakhpur', pincode: '273001', coordinates: { type: 'Point', coordinates: [83.37, 26.75] } },
        userId: { _id: 'u1', name: 'Priya Srivastava', phone: '+919000000101' },
        riderId: null,
        createdAt: '2026-10-12T05:00:00.000Z',
        statusTimeline: [{ previousStatus: null, status: 'PENDING', at: '2026-10-12T05:00:00.000Z', changedByRole: 'customer' }],
        ...overrides,
    };
}

function renderSheet(id = 'o1', connection?: LiveConnection) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <OrderDetailSheet orderId={id} onOpenChange={() => {}} connection={connection} />
            <ConfirmHost />
        </QueryClientProvider>,
    );
    return client;
}

beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    api.riders.mockResolvedValue({ riders: [] });
});

describe('nextStep', () => {
    it('only offers the transitions staff may make', () => {
        expect(nextStep(order()).advance?.status).toBe('CONFIRMED');
        expect(nextStep(order({ orderStatus: 'ASSIGNED' })).advance?.status).toBe('PACKED');
        for (const s of ['CONFIRMED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'] as const) {
            expect(nextStep(order({ orderStatus: s })).advance).toBeUndefined();
        }
        expect(nextStep(order({ orderStatus: 'DELIVERED' })).canCancel).toBe(false);
        expect(nextStep(order({ orderStatus: 'OUT_FOR_DELIVERY' })).cancelFlagsReview).toBe(true);
    });

    it('blocks confirming an unpaid online order and rider assignment before payment', () => {
        expect(nextStep(order({ paymentMethod: 'UPI' })).advance?.disabledReason).toMatch(/payment/i);
        expect(nextStep(order({ orderStatus: 'CONFIRMED', paymentMethod: 'UPI' })).canAssignRider).toBe(false);
        expect(nextStep(order({ orderStatus: 'CONFIRMED' })).canAssignRider).toBe(true);
        expect(nextStep(order({ orderStatus: 'CONFIRMED', riderId: 'r1' })).canUnassignRider).toBe(true);
    });
});

describe('buildOrderParams', () => {
    it('maps tabs and filters onto the admin list query', () => {
        expect(buildOrderParams({ tab: 'live', ...EMPTY_FILTERS }, 1, 20, '-createdAt')).toMatchObject({
            status: 'PENDING,CONFIRMED,ASSIGNED,PACKED,PICKED_UP,OUT_FOR_DELIVERY',
            q: undefined,
        });
        const p = buildOrderParams(
            { tab: 'live', ...EMPTY_FILTERS, statuses: ['PENDING', 'DELIVERED'], rider: 'unassigned', dateFrom: '2026-10-01', q: '  ORD-2026 ' },
            2,
            50,
            'totalAmount',
        );
        // A status outside the tab is dropped; a single day fills dateTo.
        expect(p).toMatchObject({ page: 2, limit: 50, status: 'PENDING', unassigned: 'true', riderId: undefined, dateFrom: '2026-10-01', dateTo: '2026-10-01', q: 'ORD-2026', sort: 'totalAmount' });
        expect(buildOrderParams({ tab: 'cancelled', ...EMPTY_FILTERS, rider: 'r9' }, 1, 20, '-createdAt')).toMatchObject({ status: 'CANCELLED', riderId: 'r9' });
    });
});

describe('applyOrderEvent', () => {
    it('patches cached rows in place', () => {
        const client = new QueryClient();
        const key = queryKeys.orders.list({ page: 1 });
        client.setQueryData<OrdersResponse>(key, { orders: [order(), order({ _id: 'o2', orderId: 'ORD-2' })], total: 2, page: 1, limit: 20, totalPages: 1 });
        applyOrderEvent(client, {
            _id: 'o1', orderId: 'ORD-20261012-AAAA0001', orderStatus: 'CONFIRMED', paymentStatus: 'PENDING', paymentMethod: 'COD', totalAmount: 87, riderId: 'r1', createdAt: '',
        });
        const data = client.getQueryData<OrdersResponse>(key)!;
        expect(data.orders[0].orderStatus).toBe('CONFIRMED');
        expect(data.orders[0].riderId).toBe('r1');
        expect(data.orders[1].orderStatus).toBe('PENDING');
    });
});

describe('OrderDetailSheet', () => {
    it('shows the order and confirms a pending order', async () => {
        api.detail.mockResolvedValue(order());
        api.setStatus.mockResolvedValue({ ...order(), orderStatus: 'CONFIRMED', riderAssignmentPending: true });
        renderSheet();

        await screen.findByText('ORD-20261012-AAAA0001');
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Priya Srivastava')).toBeInTheDocument();
        expect(within(dialog).getByText('Amul Taaza 1L')).toBeInTheDocument();
        expect(within(dialog).getByRole('link', { name: /google maps/i })).toHaveAttribute('href', expect.stringContaining('26.75,83.37'));
        expect(within(dialog).queryByRole('button', { name: /assign rider/i })).not.toBeInTheDocument();

        await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm order' }));
        await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith('o1', 'CONFIRMED'));
    });

    it('requires a reason to cancel and sends it as the note', async () => {
        api.detail.mockResolvedValue(order({ orderStatus: 'ASSIGNED', riderId: { _id: 'r1', name: 'Ravi Kumar' } }));
        api.setStatus.mockResolvedValue(order({ orderStatus: 'CANCELLED' }));
        renderSheet();

        await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
        const alert = await screen.findByRole('alertdialog');
        await userEvent.click(within(alert).getByRole('button', { name: 'Cancel order' }));
        expect(await within(alert).findByRole('alert')).toHaveTextContent(/reason/i);
        expect(api.setStatus).not.toHaveBeenCalled();

        await userEvent.type(within(alert).getByLabelText('Reason'), 'Items out of stock');
        await userEvent.click(within(alert).getByRole('button', { name: 'Cancel order' }));
        await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith('o1', 'CANCELLED', 'Items out of stock'));
    });

    it('assigns an available rider from the picker and keeps busy riders unselectable', async () => {
        api.detail.mockResolvedValue(order({ orderStatus: 'CONFIRMED' }));
        api.riders.mockResolvedValue({
            riders: [
                { _id: 'r1', name: 'Ravi Kumar', status: 'busy', isActive: true },
                { _id: 'r2', name: 'Sunil Yadav', status: 'available', isActive: true },
            ],
        });
        api.assignRider.mockResolvedValue(order({ orderStatus: 'CONFIRMED', riderId: 'r2' }));
        renderSheet();

        await userEvent.click(await screen.findByRole('combobox', { name: /assign rider/i }));
        const busy = await screen.findByRole('option', { name: /Ravi Kumar/ });
        expect(busy).toHaveAttribute('aria-disabled', 'true');
        await userEvent.click(screen.getByRole('option', { name: /Sunil Yadav/ }));
        await waitFor(() => expect(api.assignRider).toHaveBeenCalledWith('o1', 'r2'));
        expect(api.unassignRider).not.toHaveBeenCalled();
    });

    it('shows the live map only while the rider has the order', async () => {
        api.detail.mockResolvedValue(order({ orderStatus: 'OUT_FOR_DELIVERY', riderId: { _id: 'r1', name: 'Ravi Kumar' } }));
        renderSheet();
        expect(await screen.findByTestId('live-map')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Confirm order' })).not.toBeInTheDocument();
    });
});

describe('order panel live refresh', () => {
    it('refreshes in-progress orders by itself, faster while live updates are down', () => {
        expect(detailRefetchInterval('OUT_FOR_DELIVERY', 'offline')).toBe(8_000);
        expect(detailRefetchInterval('PICKED_UP', 'connecting')).toBe(8_000);
        expect(detailRefetchInterval('CONFIRMED', 'live')).toBe(30_000);
        expect(detailRefetchInterval('DELIVERED', 'offline')).toBe(false);
        expect(detailRefetchInterval('CANCELLED', 'live')).toBe(false);
        expect(detailRefetchInterval(undefined, 'live')).toBe(false);
    });

    it('shows the rider moving the order on without a socket event', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            const rider = { _id: 'r1', name: 'Md' };
            api.detail
                .mockResolvedValueOnce(order({ orderStatus: 'PICKED_UP', riderId: rider }))
                .mockResolvedValue(order({ orderStatus: 'OUT_FOR_DELIVERY', riderId: rider }));
            renderSheet('o1', 'offline');
            expect(await screen.findAllByText(/picked up/i)).not.toHaveLength(0);
            await vi.advanceTimersByTimeAsync(DETAIL_POLL_OFFLINE_MS + 100);
            await waitFor(() => expect(screen.getAllByText(/out for delivery/i).length).toBeGreaterThan(0));
            expect(api.detail).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('trackingUrlFromApiUrl', () => {
    it('puts the sockets on the API server when no tracking URL is configured', () => {
        expect(trackingUrlFromApiUrl('https://api.shravanprovision.com/api/v1')).toBe('https://api.shravanprovision.com/tracking');
        expect(trackingUrlFromApiUrl('http://localhost:3000/api/v1')).toBe('http://localhost:3000/tracking');
        expect(trackingUrlFromApiUrl('not a url')).toBeUndefined();
    });
});

describe('status history', () => {
    it('lists steps oldest first and marks the latest as current', async () => {
        api.detail.mockResolvedValue(
            order({
                orderStatus: 'OUT_FOR_DELIVERY',
                riderId: { _id: 'r1', name: 'Md' },
                statusTimeline: [
                    // Server order; the two 10:19 entries share a timestamp.
                    { previousStatus: null, status: 'PENDING', at: '2026-10-21T10:15:00.000Z', changedByRole: 'customer' },
                    { previousStatus: 'PENDING', status: 'CONFIRMED', at: '2026-10-21T10:16:00.000Z', changedByRole: 'admin' },
                    { previousStatus: 'CONFIRMED', status: 'PICKED_UP', at: '2026-10-21T10:19:00.000Z', changedByRole: 'rider' },
                    { previousStatus: 'PICKED_UP', status: 'OUT_FOR_DELIVERY', at: '2026-10-21T10:19:00.000Z', changedByRole: 'rider' },
                ],
            }),
        );
        renderSheet();
        const heading = await screen.findByText('Status history');
        const list = heading.closest('section')?.querySelector('ol') ?? document.querySelector('ol');
        const steps = within(list as HTMLElement).getAllByRole('listitem');
        expect(steps.map((li) => li.querySelector('p')?.textContent)).toEqual([
            'Order placed',
            'Confirmed',
            'Picked up',
            'Out for delivery',
        ]);
        expect(steps[3]).toHaveAttribute('aria-current', 'step');
        expect(steps[0]).not.toHaveAttribute('aria-current');
    });
});
