import { MAPMYINDIA_CONFIG } from './config';

const MAPMYINDIA_API_KEY = MAPMYINDIA_CONFIG.apiKey;

export const MAP_STYLES = {
    default: [
        { featureType: 'poi.business', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
    ],
    minimal: [
        { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
        { featureType: 'poi.business', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5e5e5' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9c9c9' }] },
    ],
};

export function getMapmyIndiaMapUrl(center, zoom = 14, width = 400, height = 300) {
    if (!MAPMYINDIA_API_KEY) {
        console.warn('MapMyIndia API key not configured');
        return null;
    }

    const centerStr = `${center.longitude},${center.latitude}`;
    return `https://maps.mapmyindia.com/api/embedding?center=${centerStr}&zoom=${zoom}&size=${width}x${height}`;
}

export function getStaticMapUrl(markers = [], zoom = 14, width = 400, height = 300) {
    if (!MAPMYINDIA_API_KEY || markers.length === 0) {
        return null;
    }

    let markerStr = markers.map((m, i) => {
        const color = m.color || '2F7D32';
        const label = m.label || '';
        return `${i === 0 ? 'icon:' : ''}${m.longitude},${m.latitude}`;
    }).join('|');

    const center = markers[0];
    const centerStr = `${center.longitude},${center.latitude}`;

    return `https://maps.mapmyindia.com/api//staticmap/v2?center=${centerStr}&zoom=${zoom}&size=${width}x${height}&markers=${encodeURIComponent(markerStr)}&fit=pv`;
}

export function isMapMyIndiaConfigured() {
    return Boolean(MAPMYINDIA_API_KEY && MAPMYINDIA_API_KEY.length > 0);
}

export function getMapmyIndiaWebUrl(latitude, longitude, zoom = 16) {
    return `https://maps.mapmyindia.com/explore/#/place?q=${latitude},${longitude}&zoom=${zoom}&center=${longitude},${latitude}`;
}

export function openInMapMyIndia(latitude, longitude, placeName = '') {
    const url = getMapmyIndiaWebUrl(latitude, longitude);
    return url;
}

export default {
    MAP_STYLES,
    getMapmyIndiaMapUrl,
    getStaticMapUrl,
    isMapMyIndiaConfigured,
    getMapmyIndiaWebUrl,
    openInMapMyIndia,
};
