import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Leaflet map for one or more riders, with the store, the customer and the planned route.
 * Client-only: import it lazily (React.lazy) from islands that also render on the server.
 * Markers are drawn with theme tokens, so the map needs no external marker images.
 */

export interface RiderLocation {
    riderId: string;
    riderName: string;
    latitude: number;
    longitude: number;
    timestamp: Date | string;
}

export interface RiderTrackingMapProps {
    riders: RiderLocation[];
    center?: [number, number];
    zoom?: number;
    routeCoordinates?: { latitude: number; longitude: number }[];
    storeLocation?: [number, number];
    customerLocation?: [number, number];
    lastLocationUpdateAt?: string | null;
    className?: string;
}

function pin(kind: 'rider' | 'store' | 'customer', label: string) {
    const glyph =
        kind === 'rider'
            ? '<path d="M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M7 17h8l2-5h-4l-2-4H8"/>'
            : kind === 'store'
                ? '<path d="M4 10h16l-1.5-5h-13zM5 10v9h14v-9M10 19v-5h4v5"/>'
                : '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>';
    return L.divIcon({
        className: 'rider-map-pin',
        html: `<span class="rider-map-pin__dot rider-map-pin__dot--${kind}" role="img" aria-label="${label}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg></span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        tooltipAnchor: [0, -18],
    });
}

const ICONS = {
    rider: pin('rider', 'Rider'),
    store: pin('store', 'Store'),
    customer: pin('customer', 'Customer'),
};

function nearestRoutePoint(point: { latitude: number; longitude: number }, route: { latitude: number; longitude: number }[]) {
    let nearest = route[0];
    let min = Number.POSITIVE_INFINITY;
    for (const c of route) {
        const d = Math.hypot(point.latitude - c.latitude, point.longitude - c.longitude);
        if (d < min) {
            min = d;
            nearest = c;
        }
    }
    return nearest;
}

function useIsDark() {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const root = document.documentElement;
        const read = () => setDark(root.classList.contains('dark'));
        read();
        const observer = new MutationObserver(read);
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return dark;
}

/** Fits the view once per set of points (not on every rider move, so a user's pan sticks). */
function FitBounds({ points }: { points: [number, number][] }) {
    const map = useMap();
    const key = points.length;
    useEffect(() => {
        if (points.length === 0) return;
        if (points.length === 1) map.setView(points[0], 15);
        else map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, key]);
    return null;
}

export default function RiderTrackingMap({
    riders,
    center = [26.75, 83.37],
    zoom = 13,
    routeCoordinates = [],
    storeLocation,
    customerLocation,
    lastLocationUpdateAt,
    className,
}: RiderTrackingMapProps) {
    const dark = useIsDark();
    const markerRefs = useRef<Record<string, L.Marker>>({});
    const frames = useRef<Record<string, number>>({});
    const shown = useRef<Record<string, { latitude: number; longitude: number }>>({});

    // Snap a rider within ~90 m of the route onto it, so GPS jitter doesn't wander off the road.
    const snapped = useMemo(
        () =>
            riders.map((rider) => {
                if (routeCoordinates.length < 2) return rider;
                const n = nearestRoutePoint(rider, routeCoordinates);
                const meters = Math.hypot(rider.latitude - n.latitude, rider.longitude - n.longitude) * 111_000;
                return meters > 90 ? rider : { ...rider, latitude: n.latitude, longitude: n.longitude };
            }),
        [riders, routeCoordinates],
    );

    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 10_000);
        return () => clearInterval(id);
    }, []);
    const stale = lastLocationUpdateAt ? now - new Date(lastLocationUpdateAt).getTime() > 30_000 : false;

    // Glide markers between fixes instead of jumping; skipped under reduced motion.
    useEffect(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        for (const rider of snapped) {
            const marker = markerRefs.current[rider.riderId];
            if (!marker) continue;
            const end = { latitude: rider.latitude, longitude: rider.longitude };
            const start = shown.current[rider.riderId] ?? end;
            cancelAnimationFrame(frames.current[rider.riderId]);
            if (reduce) {
                shown.current[rider.riderId] = end;
                marker.setLatLng([end.latitude, end.longitude]);
                continue;
            }
            const began = performance.now();
            const step = (t: number) => {
                const p = Math.min(1, (t - began) / 900);
                const e = 1 - Math.pow(1 - p, 3);
                const next = {
                    latitude: start.latitude + (end.latitude - start.latitude) * e,
                    longitude: start.longitude + (end.longitude - start.longitude) * e,
                };
                shown.current[rider.riderId] = next;
                marker.setLatLng([next.latitude, next.longitude]);
                if (p < 1) frames.current[rider.riderId] = requestAnimationFrame(step);
            };
            frames.current[rider.riderId] = requestAnimationFrame(step);
        }
    }, [snapped]);

    useEffect(() => () => Object.values(frames.current).forEach((id) => cancelAnimationFrame(id)), []);

    const points: [number, number][] = [
        ...snapped.map((r) => [r.latitude, r.longitude] as [number, number]),
        ...(storeLocation ? [storeLocation] : []),
        ...(customerLocation ? [customerLocation] : []),
    ];

    return (
        <div className={cn('rider-map relative isolate h-72 w-full overflow-hidden rounded-xl border bg-muted', className)}>
            <style>{MAP_CSS}</style>
            {stale ? (
                <p className="absolute top-2 right-2 z-[500] max-w-[70%] rounded-md bg-warning-tint px-2 py-1 text-xs font-medium text-warning">
                    Last location {formatTime(lastLocationUpdateAt)}. Rider may be offline.
                </p>
            ) : null}
            <MapContainer center={points[0] ?? center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full" attributionControl>
                <TileLayer
                    key={dark ? 'dark' : 'light'}
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    className={dark ? 'rider-map-tiles--dark' : undefined}
                />
                <FitBounds points={points} />
                {routeCoordinates.length > 1 ? (
                    <Polyline
                        positions={routeCoordinates.map((p) => [p.latitude, p.longitude] as [number, number])}
                        pathOptions={{ className: 'rider-map-route', weight: 4, opacity: 0.85 }}
                    />
                ) : null}
                {storeLocation ? (
                    <Marker position={storeLocation} icon={ICONS.store} keyboard={false}>
                        <Tooltip>Store</Tooltip>
                    </Marker>
                ) : null}
                {customerLocation ? (
                    <Marker position={customerLocation} icon={ICONS.customer} keyboard={false}>
                        <Tooltip>Customer</Tooltip>
                    </Marker>
                ) : null}
                {snapped.map((rider) => (
                    <Marker
                        key={rider.riderId}
                        position={[rider.latitude, rider.longitude]}
                        icon={ICONS.rider}
                        keyboard={false}
                        ref={(instance) => {
                            if (!instance) return;
                            markerRefs.current[rider.riderId] = instance;
                            shown.current[rider.riderId] ??= { latitude: rider.latitude, longitude: rider.longitude };
                        }}
                    >
                        <Tooltip>
                            {rider.riderName} · {formatTime(rider.timestamp)}
                        </Tooltip>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}

const MAP_CSS = `
.rider-map .leaflet-container { background: var(--muted); font: inherit; }
.rider-map .leaflet-control-attribution { background: color-mix(in oklch, var(--card), transparent 15%); color: var(--muted-foreground); font-size: 10px; }
.rider-map .leaflet-control-attribution a { color: inherit; }
.rider-map .leaflet-bar a { background: var(--card); color: var(--foreground); border-color: var(--border); }
.rider-map .leaflet-bar { border: 1px solid var(--border); box-shadow: none; }
.rider-map .leaflet-tooltip { background: var(--popover); color: var(--popover-foreground); border: 1px solid var(--border); box-shadow: none; border-radius: 8px; font-size: 12px; }
.rider-map .leaflet-tooltip-top:before { border-top-color: var(--border); }
/* OSM has no dark style; invert the tiles so the map doesn't glare in dark mode. */
.rider-map .rider-map-tiles--dark { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.85) saturate(0.6); }
path.rider-map-route { stroke: var(--primary); }
.rider-map-pin { background: none; border: 0; }
.rider-map-pin__dot { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 999px; border: 2px solid var(--card); box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.rider-map-pin__dot--rider { background: var(--primary); color: var(--primary-foreground); }
.rider-map-pin__dot--store { background: var(--foreground); color: var(--background); }
.rider-map-pin__dot--customer { background: var(--success); color: var(--success-foreground); }
`;
