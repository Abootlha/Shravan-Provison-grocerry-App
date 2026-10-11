import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/** Browser-only (Leaflet touches `window` on import): load it with React.lazy. */

const pin = L.divIcon({
    className: 'store-pin',
    html: '<span class="store-pin__dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
});

/** Whole-country view when the store has no location yet. Not a stand-in store position. */
const INDIA_VIEW = { center: [22.5, 79] as [number, number], zoom: 4 };

export interface LocationMapProps {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    disabled?: boolean;
    onPick: (latitude: number, longitude: number) => void;
}

function zoomForRadius(km: number | undefined) {
    if (!km || km <= 0) return 14;
    // Keep the whole service circle in view.
    return Math.max(8, Math.min(16, Math.round(14.6 - Math.log2(km))));
}

function FollowPosition({ position, zoom }: { position: [number, number] | null; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        if (!position) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        map.setView(position, Math.max(map.getZoom(), zoom), { animate: !reduce });
    }, [map, position?.[0], position?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}

function FitRadius({ zoom, enabled }: { zoom: number; enabled: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (enabled) map.setZoom(zoom);
    }, [map, zoom, enabled]);
    return null;
}

function ClickToPlace({ onPick, disabled }: { onPick: LocationMapProps['onPick']; disabled?: boolean }) {
    useMapEvents({
        click(event) {
            if (!disabled) onPick(round6(event.latlng.lat), round6(event.latlng.lng));
        },
    });
    return null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Leaflet writes SVG attributes, which cannot read CSS variables: resolve the brand colour (and follow theme changes). */
function usePrimaryColor() {
    const read = () => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6c3cf4';
    const [color, setColor] = useState(read);
    useEffect(() => {
        const observer = new MutationObserver(() => setColor(read()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
        return () => observer.disconnect();
    }, []);
    return color;
}

export default function LocationMap({ latitude, longitude, radiusKm, disabled, onPick }: LocationMapProps) {
    const position = useMemo<[number, number] | null>(
        () => (typeof latitude === 'number' && typeof longitude === 'number' ? [latitude, longitude] : null),
        [latitude, longitude],
    );
    const zoom = zoomForRadius(radiusKm);
    const primary = usePrimaryColor();
    const validRadius = typeof radiusKm === 'number' && radiusKm >= 0.5 && radiusKm <= 50;

    return (
        <div className="store-map relative isolate h-full w-full">
            <style>{`
                .store-map .leaflet-container { font: inherit; background: var(--muted); cursor: ${disabled ? 'default' : 'crosshair'}; }
                .store-pin { background: transparent; border: 0; }
                .store-pin__dot { display: block; width: 22px; height: 22px; border-radius: 9999px; background: var(--primary);
                  box-shadow: 0 0 0 3px var(--card), 0 2px 8px rgba(0,0,0,.25); }
                .store-map .leaflet-control-attribution { font-size: 10px; background: color-mix(in oklch, var(--card) 85%, transparent); color: var(--muted-foreground); }
                .store-map .leaflet-control-attribution a { color: inherit; }
                .store-map .leaflet-bar a { background: var(--card); color: var(--foreground); border-color: var(--border); }
                .dark .store-map .leaflet-tile-pane { filter: brightness(.8) contrast(1.1) saturate(.7); }
            `}</style>
            <MapContainer
                center={position ?? INDIA_VIEW.center}
                zoom={position ? zoom : INDIA_VIEW.zoom}
                scrollWheelZoom={false}
                className="h-full w-full"
                attributionControl
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickToPlace onPick={onPick} disabled={disabled} />
                <FollowPosition position={position} zoom={zoom} />
                <FitRadius zoom={zoom} enabled={!!position && validRadius} />
                {position ? (
                    <>
                        {validRadius ? (
                            <Circle center={position} radius={radiusKm! * 1000} pathOptions={{ color: primary, fillColor: primary, fillOpacity: 0.08, weight: 2 }} interactive={false} />
                        ) : null}
                        <Marker
                            position={position}
                            icon={pin}
                            draggable={!disabled}
                            keyboard={false}
                            title="Store location"
                            eventHandlers={{
                                dragend(event) {
                                    const p = (event.target as L.Marker).getLatLng();
                                    onPick(round6(p.lat), round6(p.lng));
                                },
                            }}
                        />
                    </>
                ) : null}
            </MapContainer>
        </div>
    );
}
