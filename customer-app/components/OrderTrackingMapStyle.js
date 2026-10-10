/**
 * Basemap styles for the order-tracking map (react-native-maps `customMapStyle`, Google provider).
 * Pick one with `trackingMapStyle(isDark)`.
 *
 *   light  quiet lavender-grey (built from the light tokens — unchanged from before)
 *   dark   neutral night (DESIGN.md: dark is neutral, not purple): charcoal land, lifted grey roads,
 *          near-black water, muted grey labels, so the violet route, the pins and the rider dot carry the colour.
 *
 * Google map styles need opaque hex colours, so the dark values are written out here (they mirror
 * the dark tokens: canvas #0F0F0F · surface #1A1A1A · well #202020 · raised #232323 · inkMuted #8F8F8F).
 * iOS Apple Maps ignores customMapStyle; the map passes userInterfaceStyle there instead.
 */
import { themes } from '../constants/theme';

const L = themes.light.colors;

const LIGHT = [
    { elementType: 'geometry', stylers: [{ color: L.surfaceSunken }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: L.inkMuted }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: L.surfaceSunken }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: L.hairline }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: L.tint.mint }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: L.surface }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: L.tint.violet }] },
    { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: L.border }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: L.tint.sky }] },
];

const DARK = [
    { elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8F8F8F' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0F0F0F' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2E2E2E' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1E1E1E' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#202020' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1B231D' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2B2B2B' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#141414' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8A8A8A' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#363636' }] },
    { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#2E2E2E' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111315' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5E6266' }] },
];

export const trackingMapStyle = (isDark) => (isDark ? DARK : LIGHT);

/** Web (Leaflet) tiles — keyless OSM in both schemes; dark is restyled with a CSS filter (OrderTrackingMap.web). */
export const WEB_TILES = {
    light: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: null },
    dark: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: null },
};

export default trackingMapStyle;
