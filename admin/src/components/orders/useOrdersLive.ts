import * as React from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { getValidAccessToken } from '@/lib/session';
import { ordersSocketUrl } from './order-model';
import type { Order, OrderDetail, OrderEvent, OrdersResponse } from './types';

export type LiveConnection = 'connecting' | 'live' | 'offline';

/** Copies the summary fields of a socket event onto a cached row; populated refs stay unless they changed. */
function mergeEvent<T extends Order>(row: T, event: OrderEvent): T {
    const currentRider = typeof row.riderId === 'object' && row.riderId ? row.riderId._id : row.riderId ?? null;
    const riderChanged = (event.riderId ?? null) !== (currentRider ?? null);
    return {
        ...row,
        orderStatus: event.orderStatus ?? row.orderStatus,
        paymentStatus: event.paymentStatus ?? row.paymentStatus,
        paymentMethod: event.paymentMethod ?? row.paymentMethod,
        totalAmount: event.totalAmount ?? row.totalAmount,
        requiresManualReview: event.requiresManualReview ?? row.requiresManualReview,
        updatedAt: event.updatedAt ?? row.updatedAt,
        riderId: riderChanged ? (event.riderId ?? null) : row.riderId,
    };
}

/** Patch every cached list page and the detail in place, so rows update before the refetch lands. */
export function applyOrderEvent(client: QueryClient, event: OrderEvent) {
    client.setQueriesData<OrdersResponse>({ queryKey: [...queryKeys.orders.all, 'list'] }, (data) => {
        if (!data?.orders?.some((o) => o._id === event._id)) return data;
        return { ...data, orders: data.orders.map((o) => (o._id === event._id ? mergeEvent(o, event) : o)) };
    });
    client.setQueryData<OrderDetail>(queryKeys.orders.detail(event._id), (data) => (data ? mergeEvent(data, event) : data));
}

interface Options {
    onNewOrder?: (event: OrderEvent) => void;
    onOrderUpdated?: (event: OrderEvent) => void;
}

/**
 * Subscribes to the admin:orders room on the /orders namespace (joined automatically for staff
 * tokens). New and updated orders patch the shared QueryClient and trigger a background refetch.
 */
export function useOrdersLive({ onNewOrder, onOrderUpdated }: Options = {}) {
    const client = useQueryClient();
    const [connection, setConnection] = React.useState<LiveConnection>('connecting');
    const handlers = React.useRef({ onNewOrder, onOrderUpdated });
    handlers.current = { onNewOrder, onOrderUpdated };

    React.useEffect(() => {
        let socket: Socket | null = null;
        let cancelled = false;
        let refetchTimer: ReturnType<typeof setTimeout> | undefined;

        // Several events often arrive together (status + rider + payment); refetch once.
        const scheduleRefetch = () => {
            clearTimeout(refetchTimer);
            refetchTimer = setTimeout(() => {
                client.invalidateQueries({ queryKey: queryKeys.orders.all });
            }, 400);
        };

        (async () => {
            let token: string;
            try {
                token = await getValidAccessToken();
            } catch {
                if (!cancelled) setConnection('offline');
                return;
            }
            if (cancelled) return;
            socket = io(ordersSocketUrl(), {
                // A function so every reconnect sends a fresh access token.
                auth: (cb) => {
                    getValidAccessToken().then((t) => cb({ token: t }), () => cb({ token }));
                },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 10_000,
            });
            socket.on('connect', () => setConnection('live'));
            socket.on('disconnect', () => setConnection('offline'));
            socket.on('connect_error', () => setConnection('offline'));
            socket.io.on('reconnect_attempt', () => setConnection('connecting'));
            socket.io.on('reconnect', () => scheduleRefetch());
            socket.on('order:new', (event: OrderEvent) => {
                handlers.current.onNewOrder?.(event);
                scheduleRefetch();
            });
            socket.on('order:updated', (event: OrderEvent) => {
                applyOrderEvent(client, event);
                handlers.current.onOrderUpdated?.(event);
                scheduleRefetch();
            });
        })();

        return () => {
            cancelled = true;
            clearTimeout(refetchTimer);
            socket?.removeAllListeners();
            socket?.io.removeAllListeners();
            socket?.disconnect();
        };
    }, [client]);

    return { connection };
}

/** A short two-note chime made with Web Audio, so no asset ships with the bundle. */
export function playNewOrderChime() {
    try {
        const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const notes = [
            { freq: 880, at: 0 },
            { freq: 1318.5, at: 0.14 },
        ];
        for (const note of notes) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = note.freq;
            const start = ctx.currentTime + note.at;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.34);
        }
        setTimeout(() => ctx.close().catch(() => undefined), 800);
    } catch {
        // Audio is optional; a blocked context should never break the page.
    }
}
