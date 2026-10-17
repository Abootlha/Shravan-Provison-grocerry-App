import * as React from 'react';
import { io, type Socket } from 'socket.io-client';
import { Skeleton } from '@/components/ui/skeleton';
import { getValidAccessToken } from '@/lib/session';
import { formatNumber } from '@/lib/format';
import { deliveryPoint, riderOf, trackingSocketUrl } from './order-model';
import type { LatLng, OrderDetail } from './types';

// Leaflet touches `window` on import, so the map loads only in the browser, only when needed.
const RiderTrackingMap = React.lazy(async () => {
    try {
        return await import('../RiderTrackingMap');
    } catch (err) {
        console.warn('Initial RiderTrackingMap import failed, retrying...', err);
        await new Promise((resolve) => setTimeout(resolve, 300));
        return await import('../RiderTrackingMap');
    }
});

class TrackingMapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    state = { hasError: false };
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-72 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted/30 p-4 text-center">
                    <p className="text-sm font-medium text-foreground">Map preview unavailable</p>
                    <p className="text-xs text-muted-foreground">Unable to render live tracking map.</p>
                </div>
            );
        }
        return this.props.children;
    }
}

interface LocationFix extends LatLng {
    at: string;
}

interface LocationEvent {
    orderId?: string;
    location?: LatLng;
    timestamp?: string;
    tracking?: OrderDetail['tracking'];
}

/** Joins the order's tracking room and keeps the rider's last fix and route up to date. */
function useRiderLocation(order: OrderDetail) {
    const initial = order.tracking?.riderLocation ?? order.rider?.currentLocation ?? null;
    const [fix, setFix] = React.useState<LocationFix | null>(
        initial ? { ...initial, at: order.tracking?.lastLocationUpdateAt ?? order.updatedAt ?? new Date().toISOString() } : null,
    );
    const [tracking, setTracking] = React.useState(order.tracking ?? null);

    React.useEffect(() => {
        setTracking(order.tracking ?? null);
    }, [order.tracking]);

    React.useEffect(() => {
        let socket: Socket | null = null;
        let cancelled = false;
        (async () => {
            let token: string;
            try {
                token = await getValidAccessToken();
            } catch {
                return;
            }
            if (cancelled) return;
            socket = io(trackingSocketUrl(), { auth: { token }, transports: ['websocket', 'polling'] });
            socket.on('connect', () => socket?.emit('joinOrderRoom', { orderId: order._id }));
            socket.on('riderLocationUpdate', (event: LocationEvent) => {
                if (!event?.location) return;
                setFix({ latitude: event.location.latitude, longitude: event.location.longitude, at: event.timestamp ?? new Date().toISOString() });
                if (event.tracking) setTracking(event.tracking);
            });
        })();
        return () => {
            cancelled = true;
            if (socket?.connected) socket.emit('leaveOrderRoom', { orderId: order._id });
            socket?.removeAllListeners();
            socket?.disconnect();
        };
    }, [order._id]);

    return { fix, tracking };
}

export function LiveTracking({ order }: { order: OrderDetail }) {
    const { fix, tracking } = useRiderLocation(order);
    const rider = riderOf(order);
    const customer = deliveryPoint(order);
    const store = order.storeLocation ? ([order.storeLocation.latitude, order.storeLocation.longitude] as [number, number]) : undefined;
    const route = tracking?.routeCoordinates ?? [];

    const facts = [
        tracking?.durationMinutes != null ? `About ${Math.max(1, Math.round(tracking.durationMinutes))} min away` : null,
        tracking?.distanceRemaining != null
            ? tracking.distanceRemaining >= 1000
                ? `${formatNumber(Math.round(tracking.distanceRemaining / 100) / 10, { decimals: true })} km to go`
                : `${formatNumber(Math.round(tracking.distanceRemaining))} m to go`
            : null,
        tracking?.activeLeg === 'to_store' ? 'Heading to the store' : tracking?.activeLeg === 'to_customer' ? 'Heading to the customer' : null,
    ].filter(Boolean);

    return (
        <div className="space-y-2">
            {facts.length ? <p className="text-sm font-medium text-brand-text">{facts.join(' · ')}</p> : null}
            <TrackingMapErrorBoundary>
                <React.Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
                    <RiderTrackingMap
                        riders={fix ? [{ riderId: rider?.id ?? 'rider', riderName: rider?.name ?? 'Rider', latitude: fix.latitude, longitude: fix.longitude, timestamp: fix.at }] : []}
                        routeCoordinates={route}
                        storeLocation={store}
                        customerLocation={customer ?? undefined}
                        lastLocationUpdateAt={fix?.at ?? null}
                    />
                </React.Suspense>
            </TrackingMapErrorBoundary>
            {!fix ? (
                <p className="text-xs text-muted-foreground">No location from the rider yet. The map updates as soon as their app reports one.</p>
            ) : null}
        </div>
    );
}
