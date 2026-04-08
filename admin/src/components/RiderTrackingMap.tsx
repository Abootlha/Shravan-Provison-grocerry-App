import { useEffect, useRef, useState } from 'react';
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

function MapUpdater({ riders }: { riders: RiderLocation[] }) {
    const map = useMap();

    useEffect(() => {
        if (riders.length > 0) {
            const bounds = L.latLngBounds(riders.map(r => [r.latitude, r.longitude]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [riders, map]);

    return null;
}

export default function RiderTrackingMap({
    riders,
    center = [28.6139, 77.2090],
    zoom = 12,
    routeCoordinates = [],
    storeLocation,
    customerLocation,
}: RiderTrackingMapProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

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
        <div className="w-full h-96 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
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
                <MapUpdater riders={riders} />
                {routeCoordinates.length > 1 && (
                    <Polyline
                        positions={routeCoordinates.map((point) => [point.latitude, point.longitude] as [number, number])}
                        pathOptions={{ color: '#7C3AED', weight: 4 }}
                    />
                )}
                {storeLocation && <Marker position={storeLocation}><Popup>Store</Popup></Marker>}
                {customerLocation && <Marker position={customerLocation}><Popup>Customer</Popup></Marker>}
                {riders.map((rider) => (
                    <Marker
                        key={rider.riderId}
                        position={[rider.latitude, rider.longitude]}
                        icon={riderIcon}
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
