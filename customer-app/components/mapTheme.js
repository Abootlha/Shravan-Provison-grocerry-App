/**
 * Map theming shared by MapComponent.* and MapViewContainer.* (README §9 rule 13 / 15).
 *
 *   native  DARK_MAP_STYLE — Google Maps style JSON (land on the dark canvas, raised
 *           roads, deep water) for react-native-maps `customMapStyle` on Android. iOS (Apple Maps)
 *           uses `userInterfaceStyle="dark"` instead; mapProps(isDark) returns both.
 *   web     WEB_DARK_MAP_FILTER — CSS filter that re-tones the OSM / MapmyIndia embed in dark mode
 *           (light mode keeps the embed untouched).
 *
 * Colours come from themes.dark so the map sits on the same canvas as the app.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { themes } from '../constants/theme';

/**
 * Android's react-native-maps uses the Google provider, which throws natively ("API key not found")
 * and takes the whole app down when the build has no GOOGLE_MAPS_API_KEY (app.config.js only wires the
 * key when the env provides one). Native map components check this and render a plain surface
 * instead of crashing. iOS (Apple Maps) needs no key.
 */
export const NATIVE_MAPS_AVAILABLE =
    Platform.OS !== 'android' || !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;

const d = themes.dark.colors;

// Map paint is data for the map SDK, not UI colour — derived from the dark canvas / night scale.
const LAND = d.canvas; // #0E0C1D
const LAND_RAISED = d.surface; // parks / POI blocks lift slightly
const ROAD = d.night[800];
const ROAD_MAJOR = d.night[700];
const WATER = d.night[950];
const LABEL = d.inkMuted;
const LABEL_STRONG = d.inkSecondary;
const STROKE = d.night[950];

export const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: LAND }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: LABEL }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: STROKE }] },
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: ROAD }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: LABEL_STRONG }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: LAND_RAISED }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: LAND_RAISED }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: ROAD }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: STROKE }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: ROAD_MAJOR }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: ROAD_MAJOR }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: LABEL }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: ROAD }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: WATER }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: LABEL }] },
];

/** Props to spread on a react-native-maps <MapView> for the active scheme. */
export const mapProps = (isDark) => ({
    customMapStyle: isDark ? DARK_MAP_STYLE : [],
    userInterfaceStyle: isDark ? 'dark' : 'light',
});

/**
 * Web: OpenStreetMap's embed has no dark layer and keyless dark tile CDNs (CARTO) now watermark
 * "API key required", so dark mode re-tones the embed with a CSS filter instead: invert +
 * hue-rotate keeps water blue-ish and parks green-ish, then saturation/brightness are pulled
 * down so the map sits on the night canvas. Light mode is untouched.
 */
export const WEB_DARK_MAP_FILTER = 'invert(0.92) hue-rotate(180deg) saturate(0.55) brightness(0.88) contrast(0.95)';
