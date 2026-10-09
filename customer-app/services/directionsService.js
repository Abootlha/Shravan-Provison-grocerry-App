import { MAPMYINDIA_CONFIG, LOCATION_URL } from './config';
import api from './api';
import Constants from 'expo-constants';

const MAPMYINDIA_API_KEY = MAPMYINDIA_CONFIG.apiKey;

// Google Maps API
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY ||
                            Constants.expoConfig?.ios?.config?.googleMapsApiKey ||
                            Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
                            process.env.GOOGLE_MAPS_API_KEY ||
                            '';

const GOOGLE_DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';

function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let b;
        let shift = 0;
        let result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;

        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);

        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        points.push({
            latitude: lat / 1e5,
            longitude: lng / 1e5,
        });
    }

    return points;
}

const routeCache = new Map();
const CACHE_TTL = 60000;

function getCacheKey(origin, destination) {
    const oLat = origin.latitude.toFixed(4);
    const oLng = origin.longitude.toFixed(4);
    const dLat = destination.latitude.toFixed(4);
    const dLng = destination.longitude.toFixed(4);
    return `${oLat},${oLng}->${dLat},${dLng}`;
}

export async function fetchRoute(origin, destination) {
    if (!origin || !destination) {
        return null;
    }

    const cacheKey = getCacheKey(origin, destination);
    const cached = routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    // Try Google Maps first if API key is available
    if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
        try {
            const googleRoute = await fetchGoogleRoute(origin, destination);
            if (googleRoute) {
                routeCache.set(cacheKey, { data: googleRoute, timestamp: Date.now() });
                return googleRoute;
            }
        } catch (error) {
            console.warn('Google Maps directions failed, falling back to MapMyIndia:', error);
        }
    }

    // Fallback to MapMyIndia
    if (!MAPMYINDIA_API_KEY) {
        console.warn('Mappls directions disabled: missing API key');
        return null;
    }

    try {
        const routePath = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
        const url = `${MAPMYINDIA_CONFIG.directionsUrl}/${routePath}?steps=false&geometries=polyline&access_token=${encodeURIComponent(MAPMYINDIA_API_KEY)}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn('MapMyIndia Directions API error:', response.status);
            return null;
        }

        const data = await response.json();

        if (!data.routes || !data.routes.length) {
            console.warn('MapMyIndia Directions API returned no routes');
            return null;
        }

        const route = data.routes[0];
        const leg = route.legs?.[0] || null;

        let coordinates = [];
        if (route.geometry) {
            coordinates = decodePolyline(route.geometry);
        }

        if (coordinates.length === 0 && leg?.geometry) {
            coordinates = decodePolyline(leg.geometry);
        }

        if (coordinates.length === 0) {
            return null;
        }

        const distanceMeters = leg?.distance || route.distance || 0;
        const durationSeconds = leg?.duration || route.duration || 0;

        const result = {
            coordinates,
            distance: formatDistance(distanceMeters),
            distanceValue: distanceMeters,
            duration: formatDuration(durationSeconds),
            durationValue: durationSeconds,
            bounds: data.bounds || null,
        };

        routeCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
    } catch (error) {
        console.error('Error fetching directions from MapMyIndia:', error);
        return null;
    }
}

// Google Maps Directions API
async function fetchGoogleRoute(origin, destination) {
    try {
        const params = new URLSearchParams({
            origin: `${origin.latitude},${origin.longitude}`,
            destination: `${destination.latitude},${destination.longitude}`,
            key: GOOGLE_MAPS_API_KEY,
            alternatives: 'false',
            optimize: 'false',
        });

        const response = await fetch(`${GOOGLE_DIRECTIONS_API_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Google Directions API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.routes || !data.routes.length) {
            console.warn('Google Directions API returned:', data.status);
            return null;
        }

        const route = data.routes[0];
        const leg = route.legs?.[0];

        if (!leg) {
            return null;
        }

        // Decode Google's polyline
        const coordinates = decodePolyline(route.overview_polyline?.points || '');

        if (coordinates.length === 0) {
            return null;
        }

        const distanceMeters = leg.distance?.value || 0;
        const durationSeconds = leg.duration?.value || 0;

        // Calculate bounds from coordinates
        const bounds = calculateBounds(coordinates);

        return {
            coordinates,
            distance: formatDistance(distanceMeters),
            distanceValue: distanceMeters,
            duration: formatDuration(durationSeconds),
            durationValue: durationSeconds,
            bounds,
        };
    } catch (error) {
        console.error('Error fetching directions from Google:', error);
        return null;
    }
}

// Calculate bounds from coordinates
function calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return null;
    }

    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLng = coordinates[0].longitude;
    let maxLng = coordinates[0].longitude;

    for (const coord of coordinates) {
        minLat = Math.min(minLat, coord.latitude);
        maxLat = Math.max(maxLat, coord.latitude);
        minLng = Math.min(minLng, coord.longitude);
        maxLng = Math.max(maxLng, coord.longitude);
    }

    return {
        northeast: { latitude: maxLat, longitude: maxLng },
        southwest: { latitude: minLat, longitude: minLng },
    };
}

function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)} sec`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
        return `${hours} hr`;
    }
    return `${hours} hr ${remainingMinutes} min`;
}

export function generateFallbackRoute(origin, destination, numPoints = 20) {
    if (!origin || !destination) return [];

    const coordinates = [];
    for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints;
        coordinates.push({
            latitude: origin.latitude + (destination.latitude - origin.latitude) * fraction,
            longitude: origin.longitude + (destination.longitude - origin.longitude) * fraction,
        });
    }
    return coordinates;
}

export function calculateBearing(start, end) {
    if (!start || !end) return 0;

    const startLat = (start.latitude * Math.PI) / 180;
    const startLng = (start.longitude * Math.PI) / 180;
    const endLat = (end.latitude * Math.PI) / 180;
    const endLng = (end.longitude * Math.PI) / 180;

    const dLng = endLng - startLng;

    const x = Math.sin(dLng) * Math.cos(endLat);
    const y =
        Math.cos(startLat) * Math.sin(endLat) -
        Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

    let bearing = (Math.atan2(x, y) * 180) / Math.PI;
    return (bearing + 360) % 360;
}

export function calculateDistance(coord1, coord2) {
    if (!coord1 || !coord2) return 0;

    const R = 6371000;
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((coord1.latitude * Math.PI) / 180) *
        Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function projectPointOnSegment(point, start, end) {
    const x = point.longitude;
    const y = point.latitude;
    const x1 = start.longitude;
    const y1 = start.latitude;
    const x2 = end.longitude;
    const y2 = end.latitude;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
        return { latitude: y1, longitude: x1 };
    }

    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));

    return {
        latitude: y1 + dy * t,
        longitude: x1 + dx * t,
    };
}

export function getNearestRoutePoint(point, routeCoordinates = []) {
    if (!point || !routeCoordinates || routeCoordinates.length < 2) {
        return { point: null, distance: Infinity };
    }

    let nearestPoint = null;
    let nearestDistance = Infinity;

    for (let i = 0; i < routeCoordinates.length - 1; i += 1) {
        const projected = projectPointOnSegment(point, routeCoordinates[i], routeCoordinates[i + 1]);
        const distance = calculateDistance(point, projected);

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPoint = projected;
        }
    }

    return {
        point: nearestPoint,
        distance: nearestDistance,
    };
}

export function snapPointToRoute(point, routeCoordinates = [], maxSnapDistance = 80) {
    const nearest = getNearestRoutePoint(point, routeCoordinates);

    if (!nearest.point || nearest.distance > maxSnapDistance) {
        return {
            point,
            distance: nearest.distance,
            snapped: false,
        };
    }

    return {
        point: nearest.point,
        distance: nearest.distance,
        snapped: true,
    };
}

export { decodePolyline, MAPMYINDIA_API_KEY };
