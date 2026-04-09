import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface RiderLocation {
    riderId: string;
    riderName: string;
    latitude: number;
    longitude: number;
    timestamp: Date;
}

interface RiderTrackingMapProps {
    riders: RiderLocation[];
    center?: [number, number];
    zoom?: number;
    routeCoordinates?: { latitude: number; longitude: number }[];
    storeLocation?: [number, number];
    customerLocation?: [number, number];
    lastLocationUpdateAt?: string | null;
}

// Custom marker icon for riders
const riderIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function getNearestRoutePoint(
    point: { latitude: number; longitude: number },
    routeCoordinates: { latitude: number; longitude: number }[],
) {
    let nearest = routeCoordinates[0];
    let minDistance = Number.POSITIVE_INFINITY;

    routeCoordinates.forEach((coordinate) => {
        const distance = Math.hypot(
            point.latitude - coordinate.latitude,
            point.longitude - coordinate.longitude,
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearest = coordinate;
        }
    });

    return nearest;
}

function MapUpdater({
    riders,
    storeLocation,
    customerLocation,
}: {
    riders: RiderLocation[];
    storeLocation?: [number, number];
    customerLocation?: [number, number];
}) {
    const map = useMap();

    useEffect(() => {
        const boundsPoints = [
            ...riders.map(r => [r.latitude, r.longitude] as [number, number]),
            ...(storeLocation ? [storeLocation] : []),
            ...(customerLocation ? [customerLocation] : []),
        ];

        if (boundsPoints.length > 0) {
            const bounds = L.latLngBounds(boundsPoints);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [riders, storeLocation, customerLocation, map]);

    return null;
}

export default function RiderTrackingMap({
    riders,
    center = [28.6139, 77.2090],
    zoom = 12,
    routeCoordinates = [],
    storeLocation,
    customerLocation,
    lastLocationUpdateAt,
}: RiderTrackingMapProps) {
    const [isClient, setIsClient] = useState(false);
    const markerRefs = useRef<Record<string, L.Marker>>({});
    const animationRefs = useRef<Record<string, number>>({});
    const displayPositionsRef = useRef<Record<string, { latitude: number; longitude: number }>>({});
    const snappedRiders = useMemo(() => riders.map((rider) => {
        if (routeCoordinates.length < 2) return rider;
        const nearest = getNearestRoutePoint({ latitude: rider.latitude, longitude: rider.longitude }, routeCoordinates);
        const rawDistance = Math.hypot(rider.latitude - nearest.latitude, rider.longitude - nearest.longitude);
        const approxMeters = rawDistance * 111000;
        if (approxMeters > 90) return rider;
        return { ...rider, latitude: nearest.latitude, longitude: nearest.longitude };
    }), [riders, routeCoordinates]);
    const staleMs = lastLocationUpdateAt ? Date.now() - new Date(lastLocationUpdateAt).getTime() : null;
    const isStale = staleMs != null && staleMs > 30000;

    useEffect(() => {
        setIsClient(true);
        return () => {
            Object.values(animationRefs.current).forEach((id) => cancelAnimationFrame(id));
        };
    }, []);

    useEffect(() => {
        snappedRiders.forEach((rider) => {
            const marker = markerRefs.current[rider.riderId];
            if (!marker) return;

            const start = displayPositionsRef.current[rider.riderId] || { latitude: rider.latitude, longitude: rider.longitude };
            const end = { latitude: rider.latitude, longitude: rider.longitude };
            const startedAt = Date.now();
            const duration = 900;

            if (animationRefs.current[rider.riderId]) {
                cancelAnimationFrame(animationRefs.current[rider.riderId]);
            }

            const animate = () => {
                const elapsed = Date.now() - startedAt;
                const progress = Math.min(1, elapsed / duration);
                const eased = 1 - Math.pow(1 - progress, 3);
                const next = {
                    latitude: start.latitude + (end.latitude - start.latitude) * eased,
                    longitude: start.longitude + (end.longitude - start.longitude) * eased,
                };
                displayPositionsRef.current[rider.riderId] = next;
                marker.setLatLng([next.latitude, next.longitude]);

                if (progress < 1) {
                    animationRefs.current[rider.riderId] = requestAnimationFrame(animate);
                }
            };

            animationRefs.current[rider.riderId] = requestAnimationFrame(animate);
        });
    }, [snappedRiders]);

    if (!isClient) {
        return (
            <div
                className="w-full h-96 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--bg-tertiary)' }}
            >
                <p style={{ color: 'var(--text-muted)' }}>Loading map...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-96 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {isStale ? (
                <div className="absolute top-3 left-3 z-[1000] px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
                    Rider location may be delayed
                </div>
            ) : null}
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapUpdater riders={snappedRiders} storeLocation={storeLocation} customerLocation={customerLocation} />
                {routeCoordinates.length > 1 && (
                    <Polyline
                        positions={routeCoordinates.map((point) => [point.latitude, point.longitude] as [number, number])}
                        pathOptions={{ color: '#7C3AED', weight: 4 }}
                    />
                )}
                {storeLocation && <Marker position={storeLocation}><Popup>Store</Popup></Marker>}
                {customerLocation && <Marker position={customerLocation}><Popup>Customer</Popup></Marker>}
                {snappedRiders.map((rider) => (
                    <Marker
                        key={rider.riderId}
                        position={[rider.latitude, rider.longitude]}
                        icon={riderIcon}
                        ref={(instance) => {
                            if (instance) {
                                markerRefs.current[rider.riderId] = instance;
                                displayPositionsRef.current[rider.riderId] = {
                                    latitude: rider.latitude,
                                    longitude: rider.longitude,
                                };
                            }
                        }}
                    >
                        <Popup>
                            <div className="p-2">
                                <h3 className="font-semibold text-sm">{rider.riderName}</h3>
                                <p className="text-xs text-gray-600">
                                    Last updated: {new Date(rider.timestamp).toLocaleTimeString()}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {rider.latitude.toFixed(6)}, {rider.longitude.toFixed(6)}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
